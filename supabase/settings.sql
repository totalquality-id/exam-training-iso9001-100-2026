-- =====================================================================
-- PENGATURAN UJIAN PER BATCH — jalankan di Supabase → SQL Editor SETELAH batch.sql.
-- Menambah: jadwal buka/tutup otomatis, acak soal, acak pilihan jawaban, nilai lulus,
-- tampilkan nilai ke peserta, wajib jawab semua, dan pencatatan perpindahan tab.
-- Aman dijalankan ulang. Data peserta & batch yang ada tidak berubah.
-- =====================================================================

-- 1) Pengaturan & jadwal pada batch
--    settings: { bank (versi bank soal), shuffle_q, shuffle_opt, show_score, require_all (boolean), pass_mark (0–100) }
alter table public.batches add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.batches add column if not exists open_from timestamptz;
alter table public.batches add column if not exists open_until timestamptz;
alter table public.batches drop constraint if exists batches_window_chk;
alter table public.batches add constraint batches_window_chk check (open_from is null or open_until is null or open_until > open_from);

-- 2) Salinan pengaturan pada data peserta (diambil saat mulai, seperti durasi)
alter table public.attempts add column if not exists settings jsonb not null default '{}'::jsonb;

-- 3) Pengaman: peserta tidak dapat mengubah pengaturan, batch, durasi, maupun identitas
create or replace function public.attempts_guard() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid(); new.status := 'in_progress'; new.manual_scores := '{}'::jsonb;
      new.trainer_notes := null; new.graded_at := null; new.submitted_at := null;
    else
      if old.status <> 'in_progress' then raise exception 'Jawaban sudah dikirim dan tidak dapat diubah'; end if;
      new.id := old.id; new.user_id := old.user_id; new.name := old.name; new.job_title := old.job_title;
      new.batch_id := old.batch_id; new.copart := old.copart; new.duration_minutes := old.duration_minutes;
      new.settings := old.settings;
      new.started_at := old.started_at; new.manual_scores := old.manual_scores;
      new.trainer_notes := old.trainer_notes; new.graded_at := old.graded_at;
      if new.status = 'submitted' then new.submitted_at := now();
      else new.status := 'in_progress'; new.submitted_at := null; end if;
      new.last_saved_at := now();
    end if;
  end if;
  return new;
end $$;

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
  values (auth.uid(), trim(p_name), trim(p_job), b.id, b.copart, b.duration_minutes, coalesce(b.settings, '{}'::jsonb)) returning * into r;
  return r;
end $$;
revoke execute on function public.join_batch(text, text, text) from public, anon;
grant execute on function public.join_batch(text, text, text) to authenticated;

-- 7) Peserta: lihat nilai sendiri setelah mengirim — hanya jika batch mengizinkan "tampilkan nilai".
--    Kunci jawaban tetap tidak pernah dikirim ke browser peserta; nilai dihitung di server.
create or replace function public.my_result(p_attempt uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; bs jsonb; k jsonb; n int; r int; tfr int; man numeric; pm numeric; ver text; show boolean;
begin
  select * into a from public.attempts where id = p_attempt and user_id = auth.uid();
  if not found or a.status = 'in_progress' then return null; end if;
  select settings into bs from public.batches where id = a.batch_id;
  show := coalesce((bs ->> 'show_score')::boolean, (a.settings ->> 'show_score')::boolean, false);
  if not show then return null; end if;
  -- versi bank soal dari jawaban; jawaban lama tanpa versi (format campuran) = bank 50 soal
  ver := coalesce(a.answers ->> 'v', case when a.answers ? 'tf' or a.answers ? 'txt' then 'mix50-2026-v1' end);
  select config into k from public.grading_config where config ->> 'version' = ver limit 1;
  if k is null then return null; end if;
  pm := coalesce((bs ->> 'pass_mark')::numeric, (a.settings ->> 'pass_mark')::numeric, 70);
  select count(*), count(*) filter (where upper(coalesce(a.answers -> 'mc' ->> e.key, '')) = e.value)
    into n, r from jsonb_each_text(k -> 'mc') e;
  if n = 0 then return null; end if;
  if k ? 'manual' then
    -- bank dengan penilaian manual: nilai baru tersedia setelah trainer selesai menilai
    if a.status <> 'graded' then return json_build_object('pending', true); end if;
    select count(*) filter (where coalesce(a.answers -> 'tf' ->> e.key, '') = e.value) into tfr from jsonb_each_text(coalesce(k -> 'tf', '{}'::jsonb)) e;
    select coalesce(sum(nullif(a.manual_scores ->> (m ->> 'id'), '')::numeric), 0) into man from jsonb_array_elements(k -> 'manual') m;
    return json_build_object('right', r, 'total', n, 'score', r * 2 + tfr + man, 'pass_mark', pm, 'manual', true);
  end if;
  return json_build_object('right', r, 'total', n, 'score', round(r * 100.0 / n, 1), 'pass_mark', pm);
end $$;
revoke execute on function public.my_result(uuid) from public, anon;
grant execute on function public.my_result(uuid) to authenticated;
