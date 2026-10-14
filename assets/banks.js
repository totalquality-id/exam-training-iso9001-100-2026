// Daftar bank soal. Menyeragamkan struktur semua bank menjadi: bagian (halaman) → butir soal { n, kind: "mc" | "tf" | "essay" | "short", q, o?, label? }.
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

// Hafalan klausul: butir soal berbeda per peserta, diundi server saat mulai (settings.draw = { p1: [nomor], p2: [id judul] })
// sesuai pengaturan batch settings.cl. Kunci (nomor ↔ judul) hanya ada di database.
const K = window.EXAM_KLAUSUL;
const CL_DEF = { scope: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], lv: [1, 2, 3], p1: { on: true, n: 0, shuf: false }, p2: { on: true, n: 0, shuf: true }, sep: true, seq: true };
const clOf = s => { const c = Object.assign({}, CL_DEF, (s || {}).cl || {}); c.p1 = Object.assign({}, CL_DEF.p1, c.p1); c.p2 = Object.assign({}, CL_DEF.p2, c.p2); return c; };
const lvOf = n => String(n).split(".").length;
const clPool = cl => K.nums.filter(n => cl.scope.includes(+n.split(".")[0]) && cl.lv.includes(lvOf(n)));
const clCount = cl => { const p = clPool(cl).length, c = x => !x.on ? 0 : x.n > 0 ? Math.min(x.n, p) : p; return { pool: p, p1: c(cl.p1), p2: c(cl.p2) }; };
const PAGE = 20;
if (K) {
  const PART = { 1: { name: "Jenis 1 · Nomor → Judul", intro: "Tuliskan judul (keterangan) untuk setiap nomor klausul. Huruf besar/kecil dan tanda baca tidak berpengaruh; salah ketik kecil masih ditoleransi." },
                 2: { name: "Jenis 2 · Judul → Nomor", intro: "Tuliskan nomor klausul untuk setiap judul, misalnya 7.1.4. Untuk judul yang muncul di beberapa klausul, induk klausulnya ditampilkan sebagai petunjuk." } };
  const base = {
    version: K.version, key: "klausul", kind: "clause", manual: false, minutes: K.minutes,
    label: "Hafalan klausul ISO 9001:2026", short: "Klausul", desc: "Jenis 1: nomor → judul klausul · Jenis 2: judul → nomor. Dinilai otomatis dengan toleransi salah ketik; trainer dapat mengoreksi per soal.",
    parts: { 1: { name: "Nomor → Judul" }, 2: { name: "Judul → Nomor" } },
    sections: [], items: [], item: {}, total: K.nums.length * 2, codes: {},
  };
  const cache = new WeakMap();
  base.make = s => {
    if (cache.has(s)) return cache.get(s);
    const b = Object.create(base), cl = clOf(s), d = s.draw, secs = [];
    b.cl = cl;
    if (d) {
      let n = 0;
      [["1", d.p1 || []], ["2", d.p2 || []]].forEach(([p, refs]) => {
        const pages = Math.ceil(refs.length / PAGE);
        for (let i = 0; i < refs.length; i += PAGE) {
          const items = refs.slice(i, i + PAGE).map(ref => p === "1"
            ? { n: ++n, kind: "short", part: p, ref, q: "Klausul " + ref, ph: "Judul klausul" }
            : { n: ++n, kind: "short", part: p, ref, q: K.titles[ref] || "?", sub: K.hint[ref] ? "bagian dari: " + K.hint[ref] : "", ph: "Nomor klausul", num: true });
          const pg = pages > 1 ? ` (${i / PAGE + 1}/${pages})` : "";
          secs.push({ name: PART[p].name + pg, short: `Jenis ${p} · ${items[0].n}–${items[items.length - 1].n}`, part: p, intro: PART[p].intro, items });
        }
      });
    }
    b.sections = secs;
    b.items = secs.flatMap((sc, i) => sc.items.map(it => Object.assign(it, { sec: i })));
    b.item = {}; b.items.forEach(it => b.item[it.n] = it);
    b.total = d ? b.items.length : (c => c.p1 + c.p2)(clCount(cl));
    b.seq = !!(d && (d.p1 || []).length && (d.p2 || []).length && cl.seq);   // jenis 2 terbuka setelah jenis 1 dikunci
    cache.set(s, b); return b;
  };
  B[base.version] = base;
}
// Penilaian hafalan klausul (sama persis dengan fungsi public.clause_ok di database):
// jenis 1 — judul dinormalisasi (huruf kecil, tanpa tanda baca, "&" = "dan"), benar bila sama atau jarak edit ≤ 15% panjangnya;
// jenis 2 — nomor dinormalisasi ("Klausul 7.1.4." → "7.1.4"), harus sama persis.
const normT = s => String(s || "").slice(0, 200).toLowerCase().replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, " ").trim();
const normN = s => String(s || "").replace(/,/g, ".").replace(/[^0-9.]/g, "").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
window.clauseGrade = (part, key, v) => {
  if (String(part) === "2") { const a = normN(v); return { ok: !!a && a === normN(key), exact: true }; }
  const a = normT(v), b = normT(key);
  if (!a) return { ok: false, exact: true };
  if (a === b) return { ok: true, exact: true };
  const d = lev(a, b), m = Math.max(a.length, b.length);
  return { ok: d * 100 <= 15 * m, exact: false, sim: Math.round((1 - d / m) * 100) };
};
window.clauseCfg = { DEF: CL_DEF, clOf, clCount, clPool };

window.BANKS = B;
window.BANK_DEFAULT = A.version;
window.bankOf = settings => { const b = B[(settings || {}).bank] || B[A.version]; return b.make ? b.make(settings || {}) : b; };
})();
