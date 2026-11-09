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
  label: "100 soal pilihan ganda", short: "100 PG", desc: "Dinilai otomatis, 1 poin per soal.", sql: "supabase/update_questions.sql",
  codes: A.codes,
  sections: A.areas.map(ar => ({ name: ar.name, short: ar.short, code: ar.code,
    items: A.mc.filter(([n]) => n >= ar.from && n <= ar.to).map(([n, q, o]) => ({ n, kind: "mc", q, o })) })),
});

const M = window.EXAM_MIX50;              // 50 soal campuran, sebagian dinilai manual dengan rubrik
if (M) finish({
  version: M.version, key: "mix50", manual: true, minutes: M.minutes,
  label: "50 soal campuran (PG, benar/salah, studi kasus)", short: "50 campuran", desc: "PG & benar/salah dinilai otomatis; alasan dan studi kasus dinilai trainer dengan rubrik.", sql: "supabase/bank_mix50.sql",
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
  const PART = { 1: { name: "Jenis 1 · Nomor → Judul", intro: "Tuliskan judul (keterangan) untuk setiap nomor klausul. Boleh dalam bahasa Indonesia atau Inggris. Huruf besar/kecil dan tanda baca tidak berpengaruh; salah ketik kecil masih ditoleransi." },
                 2: { name: "Jenis 2 · Judul → Nomor", intro: "Tuliskan nomor klausul untuk setiap judul, misalnya 7.1.4. Untuk judul yang muncul di beberapa klausul, induk klausulnya ditampilkan sebagai petunjuk." } };
  const base = {
    version: K.version, key: "klausul", kind: "clause", manual: false, minutes: K.minutes,
    label: "Hafalan klausul ISO 9001:2026", short: "Klausul", desc: "Jenis 1: nomor → judul klausul · Jenis 2: judul → nomor. Dinilai otomatis (toleransi salah ketik + regex padanan kata Indonesia/Inggris); trainer dapat mengoreksi per soal.", sql: "supabase/bank_klausul.sql",
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
// Penilaian hafalan klausul (sama persis dengan fungsi public.clause_ok di database; cf = kunci bank klausul dari grading_config):
// jenis 2 — semua angka di jawaban diambil dengan regex lalu digabung titik ("Klausul 7.1.4.", "7,1,4", "7 1 4" → "7.1.4"), harus sama persis;
// jenis 1, berurutan:
//   1) judul dinormalisasi (huruf kecil, tanpa tanda baca, "&" = "dan"); benar bila sama atau jarak edit ≤ 15% panjangnya
//      terhadap judul Indonesia (cf.t1) maupun Inggris (cf.e1) — kecuali jawabannya persis judul klausul lain;
//   2) akhiran "-nya" dibuang, regex padanan kata (cf.rx.syn: kata Indonesia/Inggris/singkatan → kata baku), kata sambung (cf.rx.stop) dibuang, lalu kata kunci
//      jawaban dibandingkan dengan kata kunci judul (cf.kw, dihitung database dengan rx yang sama); per kata masih menoleransi salah ketik.
//      Benar bila semua kata kunci cocok tanpa kata lain; atau ≥ 2/3 kata kunci cocok tanpa kata lain / semua cocok dengan sedikit kata lain
//      (judul ≥ 5 kata kunci) — kecuali jawabannya persis judul klausul lain (mis. "Audit Internal" untuk 9.2.2 Program Audit Internal).
// Trainer tetap dapat mengoreksi per soal (Anggap benar / Anggap salah).
const normT = s => String(s || "").slice(0, 200).toLowerCase().replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, " ").trim();
const normN = s => (String(s || "").slice(0, 100).match(/\d{1,9}/g) || []).map(Number).join(".");
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const rxC = new WeakMap(), gC = new WeakMap();
const rxOf = rx => {
  if (!rxC.has(rx)) rxC.set(rx, { syn: (rx.syn || []).map(([p, w]) => [new RegExp(`\\b(?:${p})\\b`, "g"), ` ${w} `]), stop: rx.stop ? new RegExp(`\\b(?:${rx.stop})\\b`, "g") : null });
  return rxC.get(rx);
};
const tok = (s, rx) => { const r = rxOf(rx); let x = ` ${normT(s).replace(/([a-z]{3})nya\b/g, "$1")} `; r.syn.forEach(([re, w]) => x = x.replace(re, w)); if (r.stop) x = x.replace(r.stop, " "); return [...new Set(x.split(/\s+/).filter(Boolean))]; };
const tm = (a, b) => { const m = Math.min(a.length, b.length); return a === b || (m >= 5 && lev(a, b) <= (m >= 9 ? 2 : 1)); };
const kwm = (at, kt) => {                            // lv 2 = semua kata kunci cocok tanpa kata lain, 1 = cocok sebagian (lolos), 0 = tidak
  const n = kt.length, h = kt.filter(x => at.some(y => tm(x, y))).length, e = at.filter(y => !kt.some(x => tm(x, y))).length;
  return { n, h, e, lv: !n || !at.length ? 0 : h === n && !e ? 2 : h * 3 >= n * 2 && (!e || (h === n && e * 4 < n)) ? 1 : 0 };
};
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
function gradeTitle(ref, v, cf) {
  const a = normT(v); if (!a) return { ok: false, how: "empty" };
  const own = [cf.t1[ref], (cf.e1 || {})[ref]].map(t => t ? normT(t) : "");
  if (a === own[0]) return { ok: true, how: "exact" };
  if (a === own[1]) return { ok: true, how: "en" };
  // persis judul klausul lain (Indonesia/Inggris) → salah, walau mirip ejaannya (mis. "Menentukan …" untuk 8.2.3 "Meninjau …")
  const other = Object.keys(cf.t1).find(r => r !== ref && (normT(cf.t1[r]) === a || normT((cf.e1 || {})[r]) === a));
  if (other) return { ok: false, how: "no", conf: other };
  let sim = 0;
  for (const b of own) {
    if (!b) continue;
    const d = lev(a, b), m = Math.max(a.length, b.length), s = Math.round((1 - d / m) * 100);
    if (d * 100 <= 15 * m) return { ok: true, how: "typo", sim: s };
    sim = Math.max(sim, s);
  }
  if (!cf.rx || !cf.kw) return { ok: false, how: "no", sim };
  const at = tok(v, cf.rx), kws = cf.kw[ref] || [];
  const best = kws.map(kt => kwm(at, kt)).sort((x, y) => y.lv - x.lv || y.h / (y.n || 1) - x.h / (x.n || 1))[0] || { lv: 0, h: 0, n: 0 };
  if (best.lv === 2) return { ok: true, how: "rx", h: best.h, n: best.n };
  // jawaban persis judul klausul lain (yang kata kuncinya berbeda) → salah, walau sebagian kata kuncinya cocok
  const conf = at.length ? Object.keys(cf.kw).find(r => r !== ref && cf.kw[r].some(kt => sameSet(kt, at) && !kws.some(o => sameSet(o, kt)))) : undefined;
  const ok = best.lv === 1 && !conf;
  return { ok, how: ok ? "part" : "no", h: best.h, n: best.n, e: best.e, conf, sim };
}
window.clauseGrade = (part, ref, v, cf) => {
  if (!gC.has(cf)) gC.set(cf, new Map());
  const memo = gC.get(cf), id = part + "|" + ref + "|" + (v || "");
  if (memo.has(id)) return memo.get(id);
  let g;
  if (String(part) === "2") { const a = normN(v); g = !a ? { ok: false, how: "empty" } : { ok: a === normN(cf.t2[ref]), how: a === normN(cf.t2[ref]) ? "exact" : "no" }; }
  else g = gradeTitle(ref, v, cf);
  memo.set(id, g); return g;
};
window.clauseCfg = { DEF: CL_DEF, clOf, clCount, clPool };

// Training IMS: 7 studi kasus × 3 soal esai; seluruhnya dinilai trainer dengan rubrik (grading_config id = 4, essay: true).
// Bagian = studi kasus (part "1".."7"); nilai = total skor rubrik / skor maksimum × 100.
const I = window.EXAM_IMS;
if (I) finish({
  version: I.version, key: "ims", manual: true, essay: true, minutes: I.minutes,
  label: "Training IMS (7 studi kasus, esai)", short: "IMS", sql: "supabase/bank_ims.sql",
  desc: "21 soal esai dalam 7 studi kasus (5S, Kaizen, Lean, kompetensi, talent management). Seluruhnya dinilai trainer dengan rubrik.",
  codes: {},
  parts: Object.fromEntries(I.cases.map((c, i) => [String(i + 1), { name: c.title }])),
  sections: I.cases.map((c, i) => ({ name: `Kasus ${i + 1}: ${c.title}`, short: `${i + 1} · ${c.title}`, part: String(i + 1), scenario: c.scenario,
    intro: "Jawablah setiap pertanyaan berdasarkan kasus berikut. Yang dinilai adalah ketepatan pemahaman dan penerapan, bukan redaksi baku.",
    items: c.qs.map(([n, q]) => ({ n, kind: "essay", q })) })),
});

window.BANKS = B;
window.BANK_DEFAULT = A.version;
window.bankOf = settings => { const b = B[(settings || {}).bank] || B[A.version]; return b.make ? b.make(settings || {}) : b; };
})();
