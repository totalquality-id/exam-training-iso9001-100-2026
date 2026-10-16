-- =====================================================================
-- COPART → TRAINING → BATCH — jalankan di Supabase → SQL Editor SETELAH supabase/settings.sql.
-- Alur admin: buat Copart → buat Training di Copart tersebut → buat Batch (test) di Training.
-- Satu Copart dapat memiliki banyak Training; satu Training dapat memiliki banyak Batch.
-- Laporan rekap nilai per Training diekspor dari konsol trainer (tab Training).
-- Aman dijalankan ulang. Batch lama otomatis dikelompokkan: satu Copart per nama Copart,
-- dengan satu Training "Training sebelumnya" yang dapat diganti nama atau dipindahkan.
-- Jika settings.sql dijalankan ulang, jalankan ulang file ini sesudahnya.
-- =====================================================================

-- 1) Copart
create table if not exists public.coparts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists coparts_name_idx on public.coparts (lower(name));
alter table public.coparts enable row level security;
drop policy if exists cop_admin on public.coparts;
create policy cop_admin on public.coparts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Training (milik satu Copart)
--    signers: [{ label: "Dibuat", name, title }, ...] untuk kolom tanda tangan laporan
create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  copart_id uuid not null references public.coparts(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 200),
  date_from date,
  date_to date,
  form_code text,
  pass_mark int not null default 70 check (pass_mark between 0 and 100),
  signers jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  constraint trainings_dates_chk check (date_from is null or date_to is null or date_to >= date_from)
);
create index if not exists trainings_copart_idx on public.trainings (copart_id);
alter table public.trainings enable row level security;
drop policy if exists trn_admin on public.trainings;
create policy trn_admin on public.trainings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3) Batch milik satu Training; name = nama batch/test (tampil di laporan sebagai "Test yang diberikan")
alter table public.batches add column if not exists training_id uuid references public.trainings(id) on delete restrict;
alter table public.batches add column if not exists name text;
create index if not exists batches_training_idx on public.batches (training_id);

-- 4) Nama Copart pada batch selalu mengikuti Copart dari Training-nya (dipakai halaman peserta & data peserta baru).
create or replace function public.batches_copart_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.training_id is not null then
    select c.name into new.copart from public.trainings t join public.coparts c on c.id = t.copart_id where t.id = new.training_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_batches_copart on public.batches;
create trigger trg_batches_copart before insert or update of training_id, copart on public.batches
  for each row execute function public.batches_copart_sync();

-- Ganti nama Copart → nama pada batch-batch-nya ikut berubah (data peserta lama tetap menyimpan nama saat itu)
create or replace function public.coparts_rename() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.batches set copart = new.name where training_id in (select id from public.trainings where copart_id = new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_coparts_rename on public.coparts;
create trigger trg_coparts_rename after update of name on public.coparts for each row execute function public.coparts_rename();

-- 5) Kelompokkan batch lama (tanpa training) per nama Copart
insert into public.coparts (name)
select distinct on (lower(trim(b.copart))) trim(b.copart) from public.batches b
where b.training_id is null and char_length(trim(b.copart)) >= 2
  and not exists (select 1 from public.coparts c where lower(c.name) = lower(trim(b.copart)))
order by lower(trim(b.copart)), b.created_at;

insert into public.trainings (copart_id, name, date_from, date_to)
select c.id, 'Training sebelumnya', min(b.created_at)::date, max(b.created_at)::date
from public.batches b join public.coparts c on lower(c.name) = lower(trim(b.copart))
where b.training_id is null
  and not exists (select 1 from public.trainings t where t.copart_id = c.id and t.name = 'Training sebelumnya')
group by c.id;

update public.batches b set training_id = t.id
from public.coparts c join public.trainings t on t.copart_id = c.id and t.name = 'Training sebelumnya'
where b.training_id is null and lower(c.name) = lower(trim(b.copart));

-- 6) Admin: buat batch di dalam Training (nama Copart diambil dari Training)
drop function if exists public.create_batch(text, text);
drop function if exists public.create_batch(text, text, int);
drop function if exists public.create_batch(text, text, int, jsonb, timestamptz, timestamptz);
create or replace function public.create_batch(p_training uuid, p_name text, p_note text default null, p_minutes int default 90,
  p_settings jsonb default '{}'::jsonb, p_open_from timestamptz default null, p_open_until timestamptz default null) returns public.batches
language plpgsql security definer set search_path = public as $$
declare c text; cp text; r public.batches;
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  select co.name into cp from public.trainings t join public.coparts co on co.id = t.copart_id where t.id = p_training;
  if cp is null then raise exception 'Training tidak ditemukan'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Isi nama batch (minimal 2 karakter)'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 600 then raise exception 'Durasi harus antara 5 dan 600 menit'; end if;
  if p_open_from is not null and p_open_until is not null and p_open_until <= p_open_from then raise exception 'Waktu tutup harus setelah waktu buka'; end if;
  loop
    c := (floor(random() * 900000) + 100000)::int::text;
    exit when not exists (select 1 from public.batches where code = c);
  end loop;
  insert into public.batches (code, copart, training_id, name, note, duration_minutes, settings, open_from, open_until)
  values (c, cp, p_training, trim(p_name), nullif(trim(coalesce(p_note,'')), ''), p_minutes, coalesce(p_settings, '{}'::jsonb), p_open_from, p_open_until)
  returning * into r;
  return r;
end $$;
revoke execute on function public.create_batch(uuid, text, text, int, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_batch(uuid, text, text, int, jsonb, timestamptz, timestamptz) to authenticated;

-- 7) Peserta: cek kode — ditambah nama Training dan nama batch untuk ditampilkan di halaman awal
drop function if exists public.get_batch(text);
create or replace function public.get_batch(p_code text)
returns table (copart text, is_open boolean, duration_minutes int, settings jsonb, open_from timestamptz, open_until timestamptz, training text, batch_name text)
language sql stable security definer set search_path = public as $$
  select b.copart, b.is_open, b.duration_minutes, b.settings, b.open_from, b.open_until, t.name, b.name
  from public.batches b left join public.trainings t on t.id = b.training_id
  where b.code = regexp_replace(coalesce(p_code,''), '\D', '', 'g') limit 1;
$$;
grant execute on function public.get_batch(text) to anon, authenticated;
