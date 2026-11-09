-- =====================================================================
-- EDITOR BANK SOAL (halaman "Bank Soal" di admin.html)
--   Admin dapat membuat bank soal baru mengikuti pola yang sudah ada (pilihan ganda, campuran, esai studi kasus)
--   dan mengubah teks, pilihan, kunci, pembahasan, serta rubrik bank yang sudah ada.
--   - question_banks : isi soal (publik, dibaca halaman peserta). Untuk bank bawaan, baris ini menimpa teks
--                      dari assets/questions*.js; strukturnya tetap sama.
--   - grading_config : kunci, pembahasan, dan rubrik (hanya admin), satu baris per bank seperti sebelumnya.
--   Perubahan hanya lewat fungsi save_bank / set_bank_active / delete_bank (khusus admin).
-- Jalankan di Supabase → SQL Editor SETELAH supabase/settings.sql. Aman dijalankan ulang.
-- Bank lain, data peserta, dan batch tidak disentuh.
-- =====================================================================

create table if not exists public.question_banks (
  version    text primary key,
  pattern    text not null check (pattern in ('builtin', 'pg', 'mix', 'essay')),
  label      text not null,
  short      text,
  descr      text,
  minutes    int not null default 90 check (minutes between 5 and 600),
  content    jsonb not null default '{}'::jsonb,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.question_banks enable row level security;
-- isi soal tidak memuat kunci jawaban, jadi boleh dibaca peserta (termasuk sesi anonim)
drop policy if exists qb_select on public.question_banks;
create policy qb_select on public.question_banks for select to anon, authenticated using (true);

-- Simpan bank soal: isi (question_banks) + kunci/rubrik (grading_config) dalam satu transaksi
create or replace function public.save_bank(p_version text, p_pattern text, p_label text, p_short text, p_descr text,
  p_minutes int, p_content jsonb, p_config jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cid int;
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  if coalesce(trim(p_version), '') = '' or p_version !~ '^[a-z0-9][a-z0-9._-]{2,80}$' then raise exception 'Versi bank tidak valid'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Nama bank wajib diisi'; end if;
  if p_config is null or p_config ->> 'version' is distinct from p_version then raise exception 'Versi kunci jawaban tidak sesuai'; end if;
  if exists (select 1 from public.grading_config where config ->> 'version' = p_version and config ? 't1') then
    raise exception 'Bank hafalan klausul tidak dapat diubah lewat editor';
  end if;
  insert into public.question_banks (version, pattern, label, short, descr, minutes, content)
  values (p_version, p_pattern, trim(p_label), nullif(trim(coalesce(p_short, '')), ''), nullif(trim(coalesce(p_descr, '')), ''), p_minutes, coalesce(p_content, '{}'::jsonb))
  on conflict (version) do update set pattern = excluded.pattern, label = excluded.label, short = excluded.short, descr = excluded.descr,
    minutes = excluded.minutes, content = excluded.content, updated_at = now();
  select id into cid from public.grading_config where config ->> 'version' = p_version limit 1;
  if cid is null then
    lock table public.grading_config in exclusive mode;
    insert into public.grading_config (id, config) select coalesce(max(id), 0) + 1, p_config from public.grading_config;
  else
    update public.grading_config set config = p_config where id = cid;
  end if;
end $$;
revoke execute on function public.save_bank(text, text, text, text, text, int, jsonb, jsonb) from public, anon;
grant execute on function public.save_bank(text, text, text, text, text, int, jsonb, jsonb) to authenticated;

-- Arsipkan / aktifkan bank buatan admin (bank arsip tidak muncul di pilihan batch baru; data peserta tetap)
create or replace function public.set_bank_active(p_version text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  update public.question_banks set active = p_active, updated_at = now() where version = p_version and pattern <> 'builtin';
  if not found then raise exception 'Bank tidak ditemukan atau merupakan bank bawaan'; end if;
end $$;
revoke execute on function public.set_bank_active(text, boolean) from public, anon;
grant execute on function public.set_bank_active(text, boolean) to authenticated;

-- Hapus bank buatan admin yang belum pernah dipakai batch maupun peserta
create or replace function public.delete_bank(p_version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  if not exists (select 1 from public.question_banks where version = p_version and pattern <> 'builtin') then
    raise exception 'Bank tidak ditemukan atau merupakan bank bawaan';
  end if;
  if exists (select 1 from public.batches where settings ->> 'bank' = p_version) then
    raise exception 'Bank masih dipakai batch. Ganti bank soal batch tersebut atau arsipkan bank ini.';
  end if;
  if exists (select 1 from public.attempts where answers ->> 'v' = p_version or settings ->> 'bank' = p_version) then
    raise exception 'Bank sudah dikerjakan peserta. Arsipkan bank ini agar data peserta tetap utuh.';
  end if;
  delete from public.question_banks where version = p_version;
  delete from public.grading_config where config ->> 'version' = p_version;
end $$;
revoke execute on function public.delete_bank(text) from public, anon;
grant execute on function public.delete_bank(text) to authenticated;

-- my_result: penilaian bank campuran dibuat umum (poin PG & B/S dari kunci, nilai = skor / skor maksimum × 100);
-- hasil bank 50 soal tetap sama. Sama persis dengan supabase/settings.sql.
create or replace function public.my_result(p_attempt uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; bs jsonb; k jsonb; d jsonb; n int; r int; n1 int; tfr int; ntf int; man numeric; mx numeric; mp numeric; tp numeric;
  pm numeric; ver text; show boolean; raw numeric; sc numeric; best numeric; kind text := 'mc';
begin
  select * into a from public.attempts where id = p_attempt and user_id = auth.uid();
  if not found or a.status in ('in_progress', 'remedial') then return null; end if;
  select settings into bs from public.batches where id = a.batch_id;
  show := coalesce((bs ->> 'show_score')::boolean, (a.settings ->> 'show_score')::boolean, false);
  if not show then return null; end if;
  -- versi bank soal dari jawaban; jawaban lama tanpa versi (format campuran) = bank 50 soal
  ver := coalesce(a.answers ->> 'v', case when a.answers ? 'tf' or a.answers ? 'txt' then 'mix50-2026-v1' end);
  select config into k from public.grading_config where config ->> 'version' = ver limit 1;
  if k is null then return null; end if;
  pm := coalesce((bs ->> 'pass_mark')::numeric, (a.settings ->> 'pass_mark')::numeric, 70);
  if k ? 't1' then
    -- hafalan klausul: soal sesuai undian peserta, nomor soal 1..n berurutan (jenis 1 lalu jenis 2); koreksi trainer di manual_scores
    kind := 'clause'; d := coalesce(a.settings -> 'draw', '{}'::jsonb); n1 := jsonb_array_length(coalesce(d -> 'p1', '[]'::jsonb));
    select count(*), count(*) filter (where case when q.ov in ('0', '1') then q.ov = '1' else public.clause_ok(q.p, q.ref, q.v, k) end)
      into n, r from (
        select '1' p, x.ref, a.answers -> 'txt' ->> x.i::text v, a.manual_scores ->> ('1:' || x.ref) ov
        from jsonb_array_elements_text(coalesce(d -> 'p1', '[]'::jsonb)) with ordinality x(ref, i)
        union all
        select '2', y.ref, a.answers -> 'txt' ->> (y.i + n1)::text, a.manual_scores ->> ('2:' || y.ref)
        from jsonb_array_elements_text(coalesce(d -> 'p2', '[]'::jsonb)) with ordinality y(ref, i)
      ) q;
    if n = 0 then return null; end if;
    raw := round(r * 100.0 / n, 1);
  elsif k ? 'essay' then
    -- bank esai (mis. Training IMS): seluruh soal dinilai trainer dengan rubrik
    if a.status <> 'graded' then return json_build_object('pending', true); end if;
    kind := 'essay';
    select coalesce(sum(nullif(a.manual_scores ->> (m ->> 'id'), '')::numeric), 0), coalesce(sum((m ->> 'max')::numeric), 0)
      into man, mx from jsonb_array_elements(k -> 'manual') m;
    if mx = 0 then return null; end if;
    r := round(man)::int; n := mx::int;
    raw := round(man * 100.0 / mx, 1);
  else
    select count(*), count(*) filter (where upper(coalesce(a.answers -> 'mc' ->> e.key, '')) = e.value)
      into n, r from jsonb_each_text(coalesce(k -> 'mc', '{}'::jsonb)) e;
    if k ? 'manual' then
      -- bank campuran (PG + benar/salah + rubrik trainer): nilai baru tersedia setelah trainer selesai menilai
      if a.status <> 'graded' then return json_build_object('pending', true); end if;
      kind := 'manual';
      mp := coalesce((k ->> 'mc_pts')::numeric, 2); tp := coalesce((k ->> 'tf_pts')::numeric, 1);
      select count(*), count(*) filter (where coalesce(a.answers -> 'tf' ->> e.key, '') = e.value)
        into ntf, tfr from jsonb_each_text(coalesce(k -> 'tf', '{}'::jsonb)) e;
      select coalesce(sum(nullif(a.manual_scores ->> (m ->> 'id'), '')::numeric), 0), coalesce(sum((m ->> 'max')::numeric), 0)
        into man, mx from jsonb_array_elements(coalesce(k -> 'manual', '[]'::jsonb)) m;
      mx := n * mp + ntf * tp + mx;
      if mx = 0 then return null; end if;
      raw := round((r * mp + tfr * tp + man) * 100.0 / mx, 1);
    else
      if n = 0 then return null; end if;
      raw := round(r * 100.0 / n, 1);
    end if;
  end if;
  sc := raw;
  if jsonb_array_length(coalesce(a.history, '[]'::jsonb)) > 0 then
    select max((h ->> 'score')::numeric) into best from jsonb_array_elements(a.history) h;
    best := coalesce(best, 0);
    sc := case coalesce(bs ->> 'remedial_rule', 'kkm') when 'raw' then raw when 'best' then greatest(best, raw) else greatest(best, least(raw, pm)) end;
  end if;
  return json_build_object('right', r, 'total', n, 'score', sc, 'raw', raw, 'pass_mark', pm, 'kind', kind, 'manual', kind in ('manual', 'essay'), 'remedial', a.remedial);
end $$;
revoke execute on function public.my_result(uuid) from public, anon;
grant execute on function public.my_result(uuid) to authenticated;
