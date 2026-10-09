-- =====================================================================
-- BANK SOAL KEDUA: 50 soal campuran (ISO 9001:2026)
--   Section A  25 pilihan ganda (2 poin/soal, otomatis)        = 50
--   Section B  5 benar/salah (1 poin, otomatis) + alasan (1 poin, manual) = 10
--   Section C  5 studi kasus (rubrik 4 poin, manual)          = 20
--   Section D  kasus terpadu (rubrik, manual)                 = 20
-- Jalankan di Supabase → SQL Editor SETELAH supabase/settings.sql. Aman dijalankan ulang.
-- Hanya menambah/memperbarui kunci & rubrik bank ini (grading_config id = 2).
-- Bank 100 soal (id = 1), data peserta, dan batch tidak disentuh.
-- =====================================================================

insert into public.grading_config (id, config) values (2, $cfg${
 "version": "mix50-2026-v1",
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
