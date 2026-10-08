-- =====================================================================
-- FITUR BATCH (per Copart) — jalankan di Supabase → SQL Editor.
-- Aman dijalankan ulang. Untuk instalasi yang SUDAH berjalan, cukup jalankan file ini saja.
-- =====================================================================

-- 1) Tabel batch
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  copart text not null check (char_length(copart) between 2 and 120),
  note text,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.batches enable row level security;
drop policy if exists bat_admin on public.batches;
create policy bat_admin on public.batches for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 1b) Durasi pengerjaan per batch (menit), diatur admin saat membuat batch
alter table public.batches add column if not exists duration_minutes int not null default 90;
alter table public.batches drop constraint if exists batches_duration_chk;
alter table public.batches add constraint batches_duration_chk check (duration_minutes between 5 and 600);

-- 2) Kolom batch pada data peserta (copart disimpan sebagai salinan agar hasil lama tetap utuh)
alter table public.attempts add column if not exists batch_id uuid references public.batches(id) on delete set null;
alter table public.attempts add column if not exists copart text;
-- durasi disalin dari batch saat peserta mulai, sehingga mengubah batch tidak mengubah ujian yang sedang berjalan (null = data lama, pakai durasi bawaan aplikasi)
alter table public.attempts add column if not exists duration_minutes int;
create index if not exists attempts_batch_idx on public.attempts (batch_id);

-- 3) Peserta tidak lagi boleh insert langsung; wajib lewat kode batch (fungsi join_batch)
drop policy if exists att_ins on public.attempts;

-- 4) Pengaman: peserta tidak dapat mengubah batch/copart
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
      new.started_at := old.started_at; new.manual_scores := old.manual_scores;
      new.trainer_notes := old.trainer_notes; new.graded_at := old.graded_at;
      if new.status = 'submitted' then new.submitted_at := now();
      else new.status := 'in_progress'; new.submitted_at := null; end if;
      new.last_saved_at := now();
    end if;
  end if;
  return new;
end $$;

-- 5) Admin: buat batch dengan kode 6 angka acak yang unik dan durasi (menit)
drop function if exists public.create_batch(text, text);
create or replace function public.create_batch(p_copart text, p_note text default null, p_minutes int default 90) returns public.batches
language plpgsql security definer set search_path = public as $$
declare c text; r public.batches;
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 600 then raise exception 'Durasi harus antara 5 dan 600 menit'; end if;
  loop
    c := (floor(random() * 900000) + 100000)::int::text;
    exit when not exists (select 1 from public.batches where code = c);
  end loop;
  insert into public.batches (code, copart, note, duration_minutes) values (c, trim(p_copart), nullif(trim(coalesce(p_note,'')), ''), p_minutes) returning * into r;
  return r;
end $$;
revoke execute on function public.create_batch(text, text, int) from public, anon;
grant execute on function public.create_batch(text, text, int) to authenticated;

-- 6) Peserta: cek kode (hanya mengembalikan nama copart, status buka/tutup, dan durasi)
drop function if exists public.get_batch(text);
create or replace function public.get_batch(p_code text) returns table (copart text, is_open boolean, duration_minutes int)
language sql stable security definer set search_path = public as $$
  select b.copart, b.is_open, b.duration_minutes from public.batches b where b.code = regexp_replace(coalesce(p_code,''), '\D', '', 'g') limit 1;
$$;
grant execute on function public.get_batch(text) to anon, authenticated;

-- 7) Peserta: bergabung ke batch (membuat data pengerjaan)
create or replace function public.join_batch(p_code text, p_name text, p_job text) returns public.attempts
language plpgsql security definer set search_path = public as $$
declare b public.batches; r public.attempts;
begin
  if auth.uid() is null then raise exception 'Sesi tidak valid, muat ulang halaman'; end if;
  select * into b from public.batches where code = regexp_replace(coalesce(p_code,''), '\D', '', 'g');
  if not found then raise exception 'Kode batch tidak ditemukan'; end if;
  if not b.is_open then raise exception 'Batch sudah ditutup'; end if;
  insert into public.attempts (user_id, name, job_title, batch_id, copart, duration_minutes)
  values (auth.uid(), trim(p_name), trim(p_job), b.id, b.copart, b.duration_minutes) returning * into r;
  return r;
end $$;
revoke execute on function public.join_batch(text, text, text) from public, anon;
grant execute on function public.join_batch(text, text, text) to authenticated;
