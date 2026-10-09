// Daftar bank soal. Menyeragamkan struktur kedua bank menjadi: bagian (halaman) → butir soal { n, kind: "mc" | "tf" | "essay", q, o?, label? }.
// Bank dipilih per batch (settings.bank); peserta menyimpan jawaban dengan answers.v = versi bank.
(() => {
const B = {};
const finish = b => {
  b.items = b.sections.flatMap((s, i) => s.items.map(it => Object.assign(it, { sec: i })));
  b.item = {}; b.items.forEach(it => b.item[it.n] = it);
  b.total = b.items.length;
  B[b.version] = b;
};

const A = window.EXAM;                    // 100 soal pilihan ganda, dinilai otomatis
finish({
  version: A.version, key: "qb100", manual: false, minutes: A.minutes,
  label: "100 soal pilihan ganda", short: "100 PG", desc: "Dinilai otomatis, 1 poin per soal.",
  codes: A.codes,
  sections: A.areas.map(ar => ({ name: ar.name, short: ar.short, code: ar.code,
    items: A.mc.filter(([n]) => n >= ar.from && n <= ar.to).map(([n, q, o]) => ({ n, kind: "mc", q, o })) })),
});

const M = window.EXAM_MIX50;              // 50 soal campuran, sebagian dinilai manual dengan rubrik
if (M) finish({
  version: M.version, key: "mix50", manual: true, minutes: M.minutes,
  label: "50 soal campuran (PG, benar/salah, studi kasus)", short: "50 campuran", desc: "PG & benar/salah dinilai otomatis; alasan dan studi kasus dinilai trainer dengan rubrik.",
  codes: { FND: "Fundamental", CTX: "Context", LDR: "Leadership", "R&O": "Risk & Opportunity", SUP: "Support", OPS: "Operation", PER: "Performance Evaluation", IMP: "Improvement" },
  parts: { A: { name: "Multiple Choice", max: 50 }, B: { name: "True/False + Reasoning", max: 10 }, C: { name: "Case Analysis", max: 20 }, D: { name: "Integrated Transition Case", max: 20 } },
  sections: [
    { name: "Multiple Choice", short: "A · Pilihan ganda", part: "A", intro: "Pilih satu jawaban yang paling tepat. Setiap soal bernilai 2 poin.",
      items: M.mc.map(([n, q, o]) => ({ n, kind: "mc", q, o })) },
    { name: "True / False + Reasoning", short: "B · Benar/Salah", part: "B", intro: "Tentukan Benar atau Salah, lalu tuliskan alasan Anda.",
      items: M.tf.map(([n, q]) => ({ n, kind: "tf", q })) },
    ...M.cases.map((c, i) => ({ name: `Case ${i + 1} — ${c.title}`, short: `C${i + 1} · ${c.title}`, part: "C", scenario: c.scenario,
      intro: "Yang dinilai adalah ketepatan reasoning dan penerapan, bukan redaksi baku.",
      items: c.qs.map(([n, q]) => ({ n, kind: "essay", q })) })),
    { name: M.integrated.title, short: "D · Kasus terpadu", part: "D", scenario: M.integrated.scenario,
      intro: "Analisis kasus terpadu berikut.",
      items: M.integrated.qs.map(([n, lb, q]) => ({ n, kind: "essay", q, label: lb })) },
  ],
});

window.BANKS = B;
window.BANK_DEFAULT = A.version;
window.bankOf = settings => B[(settings || {}).bank] || B[A.version];
})();
