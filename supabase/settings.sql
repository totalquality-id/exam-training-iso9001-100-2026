-- =====================================================================
-- PENGATURAN UJIAN PER BATCH — jalankan di Supabase → SQL Editor SETELAH batch.sql.
-- Menambah: jadwal buka/tutup otomatis, acak soal, acak pilihan jawaban, nilai lulus,
-- tampilkan nilai ke peserta, wajib jawab semua, pencatatan perpindahan tab,
-- undian soal bank hafalan klausul, dan remidi (peserta di bawah KKM mengulang di batch yang sama).
-- Aman dijalankan ulang. Data peserta & batch yang ada tidak berubah.
-- =====================================================================

-- 1) Pengaturan & jadwal pada batch
--    settings: { bank (versi bank soal), shuffle_q, shuffle_opt, show_score, require_all (boolean), pass_mark (0–100),
--                cl (pengaturan bank klausul), remedial_rule ('kkm' | 'best' | 'raw') }
alter table public.batches add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.batches add column if not exists open_from timestamptz;
alter table public.batches add column if not exists open_until timestamptz;
alter table public.batches drop constraint if exists batches_window_chk;
alter table public.batches add constraint batches_window_chk check (open_from is null or open_until is null or open_until > open_from);

-- 2) Salinan pengaturan pada data peserta (diambil saat mulai, seperti durasi)
alter table public.attempts add column if not exists settings jsonb not null default '{}'::jsonb;

-- 2b) Remidi: peserta di bawah KKM mengulang di baris yang sama (batch yang sama).
--     remedial = remidi ke-berapa; history = hasil percobaan sebelumnya; remedial_token = kode remidi peserta.
--     Status 'remedial' = remidi sudah dibuka trainer, peserta belum mulai.
alter table public.attempts add column if not exists remedial int not null default 0;
alter table public.attempts add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.attempts add column if not exists remedial_token text;
create unique index if not exists attempts_remedial_token_idx on public.attempts (remedial_token) where remedial_token is not null;
alter table public.attempts drop constraint if exists attempts_status_check;
alter table public.attempts add constraint attempts_status_check check (status in ('in_progress','submitted','graded','remedial'));

-- 3) Pengaman: peserta tidak dapat mengubah pengaturan, batch, durasi, identitas, maupun data remidi.
--    Fungsi server tepercaya (claim_remedial) menandai transaksinya dengan app.trusted agar boleh memulai remidi.
create or replace function public.attempts_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.trusted', true), '') = '1' then return new; end if;
  if coalesce(auth.role(),'') in ('anon','authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid(); new.status := 'in_progress'; new.manual_scores := '{}'::jsonb;
      new.trainer_notes := null; new.graded_at := null; new.submitted_at := null;
      new.remedial := 0; new.history := '[]'::jsonb; new.remedial_token := null;
    else
      if old.status <> 'in_progress' then raise exception 'Jawaban sudah dikirim dan tidak dapat diubah'; end if;
      new.id := old.id; new.user_id := old.user_id; new.name := old.name; new.job_title := old.job_title;
      new.batch_id := old.batch_id; new.copart := old.copart; new.duration_minutes := old.duration_minutes;
      new.settings := old.settings;
      new.started_at := old.started_at; new.manual_scores := old.manual_scores;
      new.trainer_notes := old.trainer_notes; new.graded_at := old.graded_at;
      new.remedial := old.remedial; new.history := old.history; new.remedial_token := old.remedial_token;
      if new.status = 'submitted' then new.submitted_at := now();
      else new.status := 'in_progress'; new.submitted_at := null; end if;
      new.last_saved_at := now();
    end if;
  end if;
  return new;
end $$;

-- 3b) Bank hafalan klausul: undian soal per peserta & penilaian (sama persis dengan window.clauseGrade di assets/banks.js)
create or replace function public.lev(a text, b text) returns int language plpgsql immutable as $$
declare la int := char_length(a); lb int := char_length(b); prev int[]; cur int[];
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cur := cur || least(cur[j] + 1, prev[j + 1] + 1, prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end $$;
create or replace function public.clause_nt(x text) returns text language sql immutable as $$
  select trim(regexp_replace(replace(lower(left(coalesce(x, ''), 200)), '&', ' dan '), '[^a-z0-9]+', ' ', 'g'));
$$;
create or replace function public.clause_nn(x text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(replace(coalesce(x, ''), ',', '.'), '[^0-9.]', '', 'g'), '\.+', '.', 'g'), '^\.|\.$', '', 'g');
$$;
-- p = '1': jawaban judul (toleransi jarak edit ≤ 15%); p = '2': jawaban nomor (harus sama)
create or replace function public.clause_ok(p text, k text, v text) returns boolean language plpgsql immutable as $$
declare a text; b text;
begin
  if p = '2' then a := public.clause_nn(v); return a <> '' and a = public.clause_nn(k); end if;
  a := public.clause_nt(v); b := public.clause_nt(k);
  if a = '' then return false; end if;
  return a = b or public.lev(a, b) * 100 <= 15 * greatest(char_length(a), char_length(b));
end $$;
-- Klausul yang masuk cakupan pengaturan (c.scope = klausul utama, c.lv = tingkat 1/2/3)
create or replace function public.clause_pool(k jsonb, c jsonb) returns setof text language sql stable as $$
  select e.key from jsonb_each_text(k -> 't1') e
  where split_part(e.key, '.', 1)::int = any (coalesce((select array_agg(x::int) from jsonb_array_elements_text(c -> 'scope') x), array[1,2,3,4,5,6,7,8,9,10]))
    and array_length(string_to_array(e.key, '.'), 1) = any (coalesce((select array_agg(x::int) from jsonb_array_elements_text(c -> 'lv') x), array[1,2,3]));
$$;
-- Undian soal: { p1: [nomor klausul], p2: [ID judul] }. n = 0 berarti semua; shuf = acak urutan (selain itu urut klausul);
-- sep = jenis 2 sebisa mungkin memakai klausul yang tidak ditanyakan di jenis 1.
create or replace function public.clause_draw(k jsonb, c jsonb) returns jsonb language plpgsql volatile as $$
declare p1 jsonb := '[]'; p2 jsonb := '[]'; used text[] := '{}'; n1 int; n2 int; s1 boolean; s2 boolean; sep boolean;
begin
  c := coalesce(c, '{}'::jsonb);
  n1 := coalesce((c -> 'p1' ->> 'n')::int, 0); s1 := coalesce((c -> 'p1' ->> 'shuf')::boolean, false);
  n2 := coalesce((c -> 'p2' ->> 'n')::int, 0); s2 := coalesce((c -> 'p2' ->> 'shuf')::boolean, true);
  sep := coalesce((c ->> 'sep')::boolean, true);
  if coalesce((c -> 'p1' ->> 'on')::boolean, true) then
    with pool as (select num, random() r from public.clause_pool(k, c) num),
         pick as (select num, r from pool order by r limit case when n1 > 0 then n1 end)
    select coalesce(jsonb_agg(num order by case when s1 then r end, string_to_array(num, '.')::int[]), '[]'::jsonb),
           coalesce(array_agg(num), '{}') into p1, used from pick;
  end if;
  if coalesce((c -> 'p2' ->> 'on')::boolean, true) then
    with pool as (select num, random() r, num = any (used) u from public.clause_pool(k, c) num),
         pick as (select num, r from pool order by case when sep then u end, r limit case when n2 > 0 then n2 end)
    select coalesce(jsonb_agg(t.key order by case when s2 then p.r end, string_to_array(p.num, '.')::int[]), '[]'::jsonb) into p2
    from pick p join jsonb_each_text(k -> 't2') t on t.value = p.num;
  end if;
  return jsonb_build_object('p1', p1, 'p2', p2);
end $$;
-- Pengaturan yang disalin ke peserta saat mulai; untuk bank klausul ditambah hasil undian soal
create or replace function public.attempt_settings(s jsonb) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare k jsonb;
begin
  s := coalesce(s, '{}'::jsonb) - 'draw';
  select config into k from public.grading_config where config ->> 'version' = s ->> 'bank' and config ? 't1' limit 1;
  if k is not null then s := s || jsonb_build_object('draw', public.clause_draw(k, s -> 'cl')); end if;
  return s;
end $$;
revoke execute on function public.attempt_settings(jsonb) from public, anon, authenticated;

-- 4) Admin: buat batch beserta pengaturan & jadwal
drop function if exists public.create_batch(text, text);
drop function if exists public.create_batch(text, text, int);
create or replace function public.create_batch(p_copart text, p_note text default null, p_minutes int default 90,
  p_settings jsonb default '{}'::jsonb, p_open_from timestamptz default null, p_open_until timestamptz default null) returns public.batches
language plpgsql security definer set search_path = public as $$
declare c text; r public.batches;
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 600 then raise exception 'Durasi harus antara 5 dan 600 menit'; end if;
  if p_open_from is not null and p_open_until is not null and p_open_until <= p_open_from then raise exception 'Waktu tutup harus setelah waktu buka'; end if;
  loop
    c := (floor(random() * 900000) + 100000)::int::text;
    exit when not exists (select 1 from public.batches where code = c);
  end loop;
  insert into public.batches (code, copart, note, duration_minutes, settings, open_from, open_until)
  values (c, trim(p_copart), nullif(trim(coalesce(p_note,'')), ''), p_minutes, coalesce(p_settings, '{}'::jsonb), p_open_from, p_open_until)
  returning * into r;
  return r;
end $$;
revoke execute on function public.create_batch(text, text, int, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_batch(text, text, int, jsonb, timestamptz, timestamptz) to authenticated;

-- 5) Peserta: cek kode (nama copart, status, durasi, pengaturan, jadwal)
drop function if exists public.get_batch(text);
create or replace function public.get_batch(p_code text)
returns table (copart text, is_open boolean, duration_minutes int, settings jsonb, open_from timestamptz, open_until timestamptz)
language sql stable security definer set search_path = public as $$
  select b.copart, b.is_open, b.duration_minutes, b.settings, b.open_from, b.open_until
  from public.batches b where b.code = regexp_replace(coalesce(p_code,''), '\D', '', 'g') limit 1;
$$;
grant execute on function public.get_batch(text) to anon, authenticated;

-- 6) Peserta: bergabung ke batch (cek jadwal, salin durasi & pengaturan)
create or replace function public.join_batch(p_code text, p_name text, p_job text) returns public.attempts
language plpgsql security definer set search_path = public as $$
declare b public.batches; r public.attempts;
begin
  if auth.uid() is null then raise exception 'Sesi tidak valid, muat ulang halaman'; end if;
  select * into b from public.batches where code = regexp_replace(coalesce(p_code,''), '\D', '', 'g');
  if not found then raise exception 'Kode batch tidak ditemukan'; end if;
  if not b.is_open then raise exception 'Batch sudah ditutup'; end if;
  if b.open_from is not null and now() < b.open_from then raise exception 'Batch belum dibuka'; end if;
  if b.open_until is not null and now() > b.open_until then raise exception 'Batch sudah ditutup'; end if;
  insert into public.attempts (user_id, name, job_title, batch_id, copart, duration_minutes, settings)
  values (auth.uid(), trim(p_name), trim(p_job), b.id, b.copart, b.duration_minutes, public.attempt_settings(b.settings)) returning * into r;
  return r;
end $$;
revoke execute on function public.join_batch(text, text, text) from public, anon;
grant execute on function public.join_batch(text, text, text) to authenticated;

-- 6b) Peserta: cek kode remidi (dibuka trainer untuk peserta di bawah KKM)
drop function if exists public.get_remedial(text);
create or replace function public.get_remedial(p_token text)
returns table (name text, job_title text, copart text, remedial int, duration_minutes int, settings jsonb)
language sql stable security definer set search_path = public as $$
  select a.name, a.job_title, a.copart, a.remedial, coalesce(b.duration_minutes, a.duration_minutes),
         coalesce(b.settings, a.settings, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('bank', a.settings ->> 'bank'))
  from public.attempts a left join public.batches b on b.id = a.batch_id
  where a.status = 'remedial' and a.remedial_token = upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g')) limit 1;
$$;
grant execute on function public.get_remedial(text) to anon, authenticated;

-- 6c) Peserta: mulai remidi — lewat kode remidi (perangkat mana pun) atau id pengerjaan (perangkat yang sama).
--     Baris yang sama dipakai ulang: jawaban dikosongkan, waktu mulai baru, durasi & aturan diambil dari batch saat ini,
--     bank soal tetap sama dengan ujian awal. Hasil sebelumnya sudah tersimpan di kolom history oleh trainer.
create or replace function public.claim_remedial(p_token text default null, p_attempt uuid default null) returns public.attempts
language plpgsql security definer set search_path = public as $$
declare a public.attempts; b public.batches; s jsonb; r public.attempts;
begin
  if auth.uid() is null then raise exception 'Sesi tidak valid, muat ulang halaman'; end if;
  if p_token is not null then
    select * into a from public.attempts where remedial_token = upper(regexp_replace(p_token, '[^A-Za-z0-9]', '', 'g')) for update;
  else
    select * into a from public.attempts where id = p_attempt and user_id = auth.uid() for update;
  end if;
  if not found then raise exception 'Kode remidi tidak ditemukan'; end if;
  if a.status <> 'remedial' then raise exception 'Remidi ini sudah dimulai atau dibatalkan'; end if;
  select * into b from public.batches where id = a.batch_id;
  s := coalesce(b.settings, a.settings, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('bank', a.settings ->> 'bank'));
  perform set_config('app.trusted', '1', true);
  update public.attempts set user_id = auth.uid(), status = 'in_progress', answers = '{}'::jsonb, answered_count = 0,
    manual_scores = '{}'::jsonb, started_at = now(), last_saved_at = null, submitted_at = null, graded_at = null,
    duration_minutes = coalesce(b.duration_minutes, a.duration_minutes), settings = public.attempt_settings(s), remedial_token = null
  where id = a.id returning * into r;
  perform set_config('app.trusted', '', true);
  return r;
end $$;
revoke execute on function public.claim_remedial(text, uuid) from public, anon;
grant execute on function public.claim_remedial(text, uuid) to authenticated;

-- 7) Peserta: lihat nilai sendiri setelah mengirim — hanya jika batch mengizinkan "tampilkan nilai".
--    Kunci jawaban tetap tidak pernah dikirim ke browser peserta; nilai dihitung di server.
--    Setelah remidi, nilai akhir mengikuti aturan batch settings.remedial_rule (sama dengan konsol trainer):
--      'kkm'  (bawaan) nilai tertinggi, dengan nilai remidi dibatasi maksimal KKM
--      'best' nilai tertinggi dari semua percobaan
--      'raw'  nilai remidi terakhir apa adanya
create or replace function public.my_result(p_attempt uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; bs jsonb; k jsonb; d jsonb; n int; r int; n1 int; tfr int; man numeric; pm numeric; ver text; show boolean;
  raw numeric; sc numeric; best numeric; kind text := 'mc';
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
    select count(*), count(*) filter (where case when q.ov in ('0', '1') then q.ov = '1' else public.clause_ok(q.p, q.key, q.v) end)
      into n, r from (
        select '1' p, x.ref, k -> 't1' ->> x.ref key, a.answers -> 'txt' ->> x.i::text v, a.manual_scores ->> ('1:' || x.ref) ov
        from jsonb_array_elements_text(coalesce(d -> 'p1', '[]'::jsonb)) with ordinality x(ref, i)
        union all
        select '2', y.ref, k -> 't2' ->> y.ref, a.answers -> 'txt' ->> (y.i + n1)::text, a.manual_scores ->> ('2:' || y.ref)
        from jsonb_array_elements_text(coalesce(d -> 'p2', '[]'::jsonb)) with ordinality y(ref, i)
      ) q;
    if n = 0 then return null; end if;
    raw := round(r * 100.0 / n, 1);
  else
    select count(*), count(*) filter (where upper(coalesce(a.answers -> 'mc' ->> e.key, '')) = e.value)
      into n, r from jsonb_each_text(k -> 'mc') e;
    if n = 0 then return null; end if;
    if k ? 'manual' then
      -- bank dengan penilaian manual: nilai baru tersedia setelah trainer selesai menilai
      if a.status <> 'graded' then return json_build_object('pending', true); end if;
      kind := 'manual';
      select count(*) filter (where coalesce(a.answers -> 'tf' ->> e.key, '') = e.value) into tfr from jsonb_each_text(coalesce(k -> 'tf', '{}'::jsonb)) e;
      select coalesce(sum(nullif(a.manual_scores ->> (m ->> 'id'), '')::numeric), 0) into man from jsonb_array_elements(k -> 'manual') m;
      raw := r * 2 + tfr + man;
    else
      raw := round(r * 100.0 / n, 1);
    end if;
  end if;
  sc := raw;
  if jsonb_array_length(coalesce(a.history, '[]'::jsonb)) > 0 then
    select max((h ->> 'score')::numeric) into best from jsonb_array_elements(a.history) h;
    best := coalesce(best, 0);
    sc := case coalesce(bs ->> 'remedial_rule', 'kkm') when 'raw' then raw when 'best' then greatest(best, raw) else greatest(best, least(raw, pm)) end;
  end if;
  return json_build_object('right', r, 'total', n, 'score', sc, 'raw', raw, 'pass_mark', pm, 'kind', kind, 'manual', kind = 'manual', 'remedial', a.remedial);
end $$;
revoke execute on function public.my_result(uuid) from public, anon;
grant execute on function public.my_result(uuid) to authenticated;
