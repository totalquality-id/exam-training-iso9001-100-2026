-- =====================================================================
-- Final Assessment ISO 9001:2026 — skema Supabase
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor.
-- WAJIB: ganti 'GANTI_EMAIL_ADMIN@perusahaan.com' di bawah dengan email admin Anda.
-- =====================================================================

-- 1) Daftar admin (berdasarkan email akun Supabase Auth)
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;   -- tanpa policy = tidak bisa diakses via API
insert into public.admins (email) values (lower('admin@totalquality.co.id')) on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(),'') = 'authenticated'
     and exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

-- 2) Kunci jawaban & rubrik (hanya admin yang bisa membaca)
create table if not exists public.grading_config (id int primary key, config jsonb not null);
alter table public.grading_config enable row level security;
drop policy if exists cfg_select on public.grading_config;
create policy cfg_select on public.grading_config for select to authenticated using (public.is_admin());

insert into public.grading_config (id, config) values (1, $cfg${
 "mc": {
  "1": "C",
  "2": "C",
  "3": "B",
  "4": "B",
  "5": "C",
  "6": "A",
  "7": "D",
  "8": "D",
  "9": "C",
  "10": "A",
  "11": "B",
  "12": "C",
  "13": "A",
  "14": "C",
  "15": "A",
  "16": "B",
  "17": "D",
  "18": "A",
  "19": "D",
  "20": "B",
  "21": "D",
  "22": "B",
  "23": "D",
  "24": "C",
  "25": "B"
 },
 "comp": {
  "1": "FND",
  "2": "FND",
  "3": "FND",
  "4": "CTX",
  "5": "CTX",
  "6": "LDR",
  "7": "LDR",
  "8": "LDR",
  "9": "R&O",
  "10": "R&O",
  "11": "R&O",
  "12": "R&O",
  "13": "SUP",
  "14": "SUP",
  "15": "OPS",
  "16": "OPS",
  "17": "OPS",
  "18": "OPS",
  "19": "PER",
  "20": "PER",
  "21": "PER",
  "22": "PER",
  "23": "PER",
  "24": "IMP",
  "25": "IMP"
 },
 "tf": {
  "26": "S",
  "27": "S",
  "28": "S",
  "29": "S",
  "30": "B"
 },
 "manual": [
  {
   "id": "B26",
   "sec": "B",
   "label": "Alasan No. 26",
   "max": 1,
   "crit": "Reasoning tepat (+1)",
   "qs": [
    26
   ]
  },
  {
   "id": "B27",
   "sec": "B",
   "label": "Alasan No. 27",
   "max": 1,
   "crit": "Reasoning tepat (+1)",
   "qs": [
    27
   ]
  },
  {
   "id": "B28",
   "sec": "B",
   "label": "Alasan No. 28",
   "max": 1,
   "crit": "Reasoning tepat (+1)",
   "qs": [
    28
   ]
  },
  {
   "id": "B29",
   "sec": "B",
   "label": "Alasan No. 29",
   "max": 1,
   "crit": "Reasoning tepat (+1)",
   "qs": [
    29
   ]
  },
  {
   "id": "B30",
   "sec": "B",
   "label": "Alasan No. 30",
   "max": 1,
   "crit": "Reasoning tepat (+1)",
   "qs": [
    30
   ]
  },
  {
   "id": "C1",
   "sec": "C",
   "label": "Case 1 — Climate Change & Context",
   "max": 4,
   "crit": [
    "Relevance/reasoning (1)",
    "2 risks (1)",
    "2 opportunities (1)",
    "Action/QMS linkage (1)"
   ],
   "qs": [
    31,
    32
   ]
  },
  {
   "id": "C2",
   "sec": "C",
   "label": "Case 2 — Quality Culture & Ethical Behaviour",
   "max": 4,
   "crit": [
    "Problem identification (1)",
    "Culture/ethics reasoning (1)",
    "Customer/capability linkage (1)",
    "Action (1)"
   ],
   "qs": [
    33,
    34
   ]
  },
  {
   "id": "C3",
   "sec": "C",
   "label": "Case 3 — Organizational Knowledge",
   "max": 4,
   "crit": [
    "Knowledge risk (1)",
    "Action 1 (1)",
    "Action 2 (1)",
    "Action 3/reasoning (1)"
   ],
   "qs": [
    35,
    36
   ]
  },
  {
   "id": "C4",
   "sec": "C",
   "label": "Case 4 — Digitalization & Risk",
   "max": 4,
   "crit": [
    "Opportunity analysis (1)",
    "Risk analysis (1)",
    "Control/action (1)",
    "Effectiveness/performance evaluation (1)"
   ],
   "qs": [
    37,
    38
   ]
  },
  {
   "id": "C5",
   "sec": "C",
   "label": "Case 5 — Performance Evaluation",
   "max": 4,
   "crit": [
    "Rejects premature conclusion (1)",
    "Analysis/evaluation need (1)",
    "At least 4 relevant data (1)",
    "Linkage to decision/improvement (1)"
   ],
   "qs": [
    39,
    40
   ]
  },
  {
   "id": "D41",
   "sec": "D",
   "label": "No. 41 — Context",
   "max": 2,
   "crit": "≥3 issues relevan dan linkage ke QMS",
   "qs": [
    41
   ]
  },
  {
   "id": "D42",
   "sec": "D",
   "label": "No. 42 — Interested Parties",
   "max": 2,
   "crit": "≥4 parties + relevant requirements",
   "qs": [
    42
   ]
  },
  {
   "id": "D43",
   "sec": "D",
   "label": "No. 43 — Climate Change",
   "max": 2,
   "crit": "Decision + reasoning + QMS linkage",
   "qs": [
    43
   ]
  },
  {
   "id": "D44",
   "sec": "D",
   "label": "No. 44 — Risk & Opportunity",
   "max": 3,
   "crit": "Risk, opportunity, process linkage dan action",
   "qs": [
    44
   ]
  },
  {
   "id": "D45",
   "sec": "D",
   "label": "No. 45 — Quality Culture & Ethics",
   "max": 2,
   "crit": "Culture/behaviour gap + ethical issue",
   "qs": [
    45
   ]
  },
  {
   "id": "D46",
   "sec": "D",
   "label": "No. 46 — Organizational Knowledge",
   "max": 2,
   "crit": "Knowledge risk + action/transfer",
   "qs": [
    46
   ]
  },
  {
   "id": "D47",
   "sec": "D",
   "label": "No. 47 — Digitalization",
   "max": 2,
   "crit": "Technology risk + control/effectiveness",
   "qs": [
    47
   ]
  },
  {
   "id": "D48",
   "sec": "D",
   "label": "No. 48 — Performance",
   "max": 2,
   "crit": "KPI relevan + purpose/measurement",
   "qs": [
    48
   ]
  },
  {
   "id": "D49",
   "sec": "D",
   "label": "No. 49 — Improvement",
   "max": 3,
   "crit": "Priority action jelas, owner/target bila ada",
   "qs": [
    49
   ]
  }
 ]
}$cfg$::jsonb)
on conflict (id) do update set config = excluded.config;

-- 3) Data pengerjaan peserta
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 2 and 120),
  job_title text not null check (char_length(job_title) between 2 and 120),
  status text not null default 'in_progress' check (status in ('in_progress','submitted','graded')),
  answers jsonb not null default '{}'::jsonb,
  answered_count int not null default 0,
  started_at timestamptz not null default now(),
  last_saved_at timestamptz,
  submitted_at timestamptz,
  manual_scores jsonb not null default '{}'::jsonb,
  trainer_notes text,
  graded_at timestamptz
);
create index if not exists attempts_user_idx on public.attempts (user_id);
alter table public.attempts enable row level security;

drop policy if exists att_ins on public.attempts; drop policy if exists att_sel on public.attempts;
drop policy if exists att_upd on public.attempts; drop policy if exists att_del on public.attempts;
create policy att_ins on public.attempts for insert to authenticated with check (user_id = auth.uid());
create policy att_sel on public.attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy att_upd on public.attempts for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy att_del on public.attempts for delete to authenticated using (public.is_admin());

-- 4) Pengaman: peserta hanya boleh mengubah jawabannya sendiri dan mengirim (in_progress -> submitted).
--    Nilai, catatan, status 'graded', dan data identitas tidak dapat diubah peserta.
create or replace function public.attempts_guard() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid(); new.status := 'in_progress'; new.manual_scores := '{}'::jsonb;
      new.trainer_notes := null; new.graded_at := null; new.submitted_at := null;
    else
      if old.status <> 'in_progress' then raise exception 'Jawaban sudah dikirim dan tidak dapat diubah'; end if;
      new.id := old.id; new.user_id := old.user_id; new.name := old.name; new.job_title := old.job_title;
      new.started_at := old.started_at; new.manual_scores := old.manual_scores;
      new.trainer_notes := old.trainer_notes; new.graded_at := old.graded_at;
      if new.status = 'submitted' then new.submitted_at := now();
      else new.status := 'in_progress'; new.submitted_at := null; end if;
      new.last_saved_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_attempts_guard on public.attempts;
create trigger trg_attempts_guard before insert or update on public.attempts for each row execute function public.attempts_guard();
