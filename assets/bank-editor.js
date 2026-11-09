// Halaman "Bank soal" di konsol trainer: daftar bank, bank baru mengikuti pola yang sudah ada, dan editor soal.
// Pola: "pg" (seperti bank 100 soal pilihan ganda), "mix" (seperti bank 50 soal campuran), "essay" (seperti bank Training IMS).
// Isi soal disimpan di tabel question_banks (publik), kunci/pembahasan/rubrik di grading_config (khusus admin),
// lewat fungsi database save_bank. Lihat supabase/bank_editor.sql.
// Struktur (tambah/hapus/pindah soal, poin, skor maksimum rubrik) dikunci untuk bank bawaan dan bank yang sudah
// dikerjakan peserta, agar jawaban yang tersimpan (per nomor soal) tetap cocok. Untuk mengubah struktur: Duplikat.
window.BankEditor = ctx => {
const { esc, $, $$ } = ctx;
const PAT = window.BANK_PATTERN, L = "ABCD", KIND = { mc: "Pilihan ganda", tf: "Benar/Salah + alasan", essay: "Esai" };
const ALLOW = { pg: ["mc"], mix: ["mc", "tf", "essay"], essay: ["essay"] };
const DESC = {
  pg: ["Bagian per area/kompetensi, soal pilihan ganda 4 opsi (A sampai D) dengan satu kunci.", "Dinilai otomatis, 1 poin per soal. Pembahasan opsional untuk trainer.", "Mengikuti pola bank 100 soal pilihan ganda."],
  mix: ["Bagian pilihan ganda, Benar/Salah dengan alasan, dan studi kasus esai.", "PG & Benar/Salah dinilai otomatis (poin bisa diatur); alasan dan esai dinilai trainer dengan rubrik.", "Mengikuti pola bank 50 soal campuran."],
  essay: ["Setiap bagian adalah satu studi kasus dengan beberapa pertanyaan esai.", "Seluruhnya dinilai trainer dengan rubrik per soal; nilai = skor / skor maksimum × 100.", "Mengikuti pola bank Training IMS."],
};
const DEF_SCALE = ["Skor 4: tepat dan lengkap sesuai poin kunci, disertai alasan/contoh yang relevan", "Skor 3: tepat, tetapi kurang lengkap atau alasannya kurang kuat",
  "Skor 2: sebagian benar; poin kunci baru terjawab sebagian", "Skor 1: menjawab, tetapi kurang tepat atau terlalu umum", "Skor 0: salah, tidak relevan, atau tidak dijawab"];
const INTRO = { mc: "Pilih satu jawaban yang paling tepat.", tf: "Tentukan Benar atau Salah, lalu tuliskan alasan Anda.",
  case: "Yang dinilai adalah ketepatan reasoning dan penerapan, bukan redaksi baku.",
  essay: "Jawablah setiap pertanyaan berdasarkan kasus berikut. Yang dinilai adalah ketepatan pemahaman dan penerapan, bukan redaksi baku." };
const clone = x => JSON.parse(JSON.stringify(x));
let ed = null, dirty = false, uidN = 0, pendingNew = null, newPat = "pg";
const uid = () => "u" + ++uidN;
const patOf = b => b.custom ? b.pattern : b.essay ? "essay" : b.manual ? "mix" : "pg";
const usage = v => ({ batches: ctx.batches().filter(b => ctx.batchBank(b) === v).length, attempts: ctx.rows().filter(a => ctx.attemptBank(a) === v).length });
const editable = b => !b.make && !!ctx.cfg(b.version);
const num = v => v === "" || v === null || v === undefined || isNaN(+v) ? null : +v;

// ---------- daftar bank ----------
function maxOf(b) {
  const cf = ctx.cfg(b.version); if (!cf) return null;
  if (b.make) return null;
  if (!b.manual) return Object.keys(cf.mc || {}).length;
  const mp = num(cf.mc_pts) ?? 2, tp = num(cf.tf_pts) ?? 1;
  return (b.essay ? 0 : Object.keys(cf.mc || {}).length * mp + Object.keys(cf.tf || {}).length * tp) + (cf.manual || []).reduce((t, m) => t + (+m.max || 0), 0);
}
function renderList() {
  const el = $("#pgBank"), all = Object.values(ctx.BANKS);
  const rank = b => (b.archived ? 2 : 0) + (b.custom ? 1 : 0);
  const list = [...all].sort((x, y) => rank(x) - rank(y));
  const card = b => {
    const u = usage(b.version), cf = ctx.cfg(b.version), mx = maxOf(b), p = b.make ? null : patOf(b);
    const tag = b.archived ? ["Diarsipkan", "b-mut"] : b.custom ? ["Buatan admin", "b-info"] : ["Bawaan", "b-ok"];
    const spec = b.make ? "Pola khusus: soal diundi per peserta. Tidak dapat diubah di editor."
      : [`${b.total} soal`, `${b.sections.length} bagian`, `${b.minutes} menit`, cf ? "" : `kunci belum ada, jalankan ${b.sql || "SQL bank soal"}`].filter(Boolean).join(" · ");
    const canDel = b.custom && !u.batches && !u.attempts;
    return `<div class="bc ${b.archived ? "off" : ""}"><div class="bc-top"><div><h3>${editable(b) ? `<a class="rowlink" href="${ctx.href("bank", b.version)}">${esc(b.label)}</a>` : esc(b.label)}</h3>
        <p>${b.make ? "Hafalan klausul" : esc(PAT[p].name)}${b.override ? " · teks bawaan sudah diubah" : ""}</p></div><span class="badge ${tag[1]}">${tag[0]}</span></div>
      <div class="specs">${esc(spec)}</div>
      <div class="bc-stats"><div><b>${u.batches}</b><span>Batch</span></div><div><b>${u.attempts}</b><span>Peserta</span></div><div><b>${mx ?? "-"}</b><span>Skor maksimum</span></div></div>
      <div class="bc-act">${editable(b) ? `<a class="btn soft sm" href="${ctx.href("bank", b.version)}">Ubah soal</a><button class="btn ghost sm" data-b="dup" data-v="${esc(b.version)}" title="Buat bank baru dari salinan bank ini; strukturnya bebas diubah">Duplikat</button>` : ""}
        ${b.custom ? `<button class="btn ghost sm" data-b="arc" data-v="${esc(b.version)}">${b.archived ? "Aktifkan" : "Arsipkan"}</button>` : ""}<div class="sp"></div>
        ${b.custom ? `<button class="btn danger sm" data-b="del" data-v="${esc(b.version)}" ${canDel ? "" : `disabled title="Sudah dipakai batch atau peserta; arsipkan saja"`}>Hapus</button>` : ""}</div></div>`;
  };
  el.innerHTML = `<div class="phead"><div><h1>Bank soal</h1><p class="mut">Buat bank soal baru mengikuti pola yang sudah ada, atau ubah soal, kunci, pembahasan, dan rubrik bank yang ada.</p></div>
      <div class="ctl"><button class="btn" id="bNewBank" ${ctx.hasTable() ? "" : "disabled"}>Bank Soal Baru</button></div></div>
    ${ctx.hasTable() ? "" : `<div class="alert"><b>Editor bank soal belum aktif.</b> Jalankan <code>supabase/bank_editor.sql</code> di Supabase → SQL Editor, lalu muat ulang halaman ini.</div>`}
    <div class="bgrid">${list.map(card).join("")}</div>
    <p class="hint" style="margin:14px 2px 60px">Bank yang diarsipkan tidak muncul di pilihan bank soal saat membuat batch, tetapi data pesertanya tetap ada. Bank bawaan tidak dapat dihapus; teksnya dapat diubah dan disimpan di database (file soal asli tidak berubah).</p>`;
  if ($("#bNewBank")) $("#bNewBank").onclick = openNew;
  $$("#pgBank [data-b]").forEach(x => x.onclick = () => listAct(x.dataset.b, x.dataset.v, x));
}
async function listAct(a, v, btn) {
  const b = ctx.BANKS[v];
  if (a === "dup") { pendingNew = fromBank(b, ctx.cfg(v), true); ctx.nav("bank", "baru"); return; }
  if (a === "arc") {
    btn.disabled = true;
    const { error } = await ctx.sb().rpc("set_bank_active", { p_version: v, p_active: !!b.archived });
    if (error) { btn.disabled = false; return alert("Gagal: " + error.message); }
    await ctx.reloadBanks(); renderList(); return;
  }
  if (a === "del") {
    if (!confirm(`Hapus bank soal "${b.label}" beserta kunci dan rubriknya?\nTindakan ini tidak dapat dibatalkan.`)) return;
    btn.disabled = true;
    const { error } = await ctx.sb().rpc("delete_bank", { p_version: v });
    if (error) { btn.disabled = false; return alert("Gagal menghapus: " + error.message); }
    await ctx.reloadBanks(); renderList();
  }
}

// ---------- bank baru: pilih pola ----------
function openNew() {
  $("#nbPat").innerHTML = Object.entries(PAT).map(([k, p]) => `<button type="button" data-p="${k}" class="${k === newPat ? "on" : ""}" aria-pressed="${k === newPat}">
    <b>${esc(p.name)}</b><span class="xs mut">${esc(DESC[k][2])}</span><span>${esc(DESC[k][0])}</span><span class="mut">${esc(DESC[k][1])}</span></button>`).join("");
  $("#nbName").value = ""; $("#nbErr").textContent = ""; $("#mNewBank").hidden = false; $("#nbName").focus();
}
$("#nbPat").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (!b) return; newPat = b.dataset.p; $$("#nbPat button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); });
const closeNew = () => $("#mNewBank").hidden = true;
$("#nbX").onclick = $("#nbNo").onclick = closeNew;
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#mNewBank").hidden) closeNew(); });
$("#fNewBank").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#nbName").value.trim();
  if (name.length < 3) return $("#nbErr").textContent = "Isi nama bank soal (minimal 3 karakter).";
  pendingNew = newModel(newPat, name); closeNew(); ctx.nav("bank", "baru");
});

// ---------- model editor ----------
const mkItem = (kind, sec) => ({ uid: uid(), n: null, kind, q: "", o: kind === "mc" ? ["", "", "", ""] : null, key: "", area: kind === "mc" && sec ? sec.code || "" : "", exp: "", label: "" });
const mkRub = (it, pattern) => ({ uid: uid(), id: null, label: "", max: it.kind === "tf" ? 1 : 4, crit: it.kind === "tf" ? "Alasan tepat dan relevan" : "", items: [it.uid] });
const mkSec = (name, extra) => Object.assign({ uid: uid(), name, short: "", code: "", intro: "", scenario: "", part: undefined, items: [] }, extra || {});
function addItem(s, kind) { const it = mkItem(kind, s); s.items.push(it); if (kind !== "mc") ed.rubrics.push(mkRub(it, ed.pattern)); return it; }
function newModel(pattern, label) {
  ed = { version: null, isNew: true, builtin: false, pattern, locked: false, meta: { label, short: "", desc: "", minutes: pattern === "mix" ? 75 : 90 },
    mcPts: 2, tfPts: 1, scale: DEF_SCALE.join("\n"), codes: {}, baseCfg: null, sections: [], rubrics: [] };
  if (pattern === "pg") { const s = mkSec("Bagian 1", { code: "A1" }); ed.sections.push(s); addItem(s, "mc"); }
  if (pattern === "mix") {
    const a = mkSec("Pilihan ganda", { intro: INTRO.mc }), b = mkSec("Benar / Salah + alasan", { intro: INTRO.tf }), c = mkSec("Studi kasus 1", { intro: INTRO.case });
    ed.sections.push(a, b, c); addItem(a, "mc"); addItem(b, "tf"); addItem(c, "essay");
  }
  if (pattern === "essay") { const s = mkSec("Kasus 1", { intro: INTRO.essay }); ed.sections.push(s); addItem(s, "essay"); }
  const m = ed; ed = null; return m;
}
function fromBank(b, cf, dup) {
  cf = cf || {};
  const uidOf = {}, pattern = patOf(b);
  const sections = b.sections.map(s => ({ uid: uid(), name: s.name, short: s.short && s.short !== s.name ? s.short : "", code: s.code || "", intro: s.intro || "", scenario: s.scenario || "", part: s.part,
    items: s.items.map(it => { const u = uid(); uidOf[it.n] = u;
      return { uid: u, n: dup ? null : it.n, kind: it.kind, q: it.q, o: it.kind === "mc" ? [0, 1, 2, 3].map(i => (it.o || [])[i] || "") : null,
        key: it.kind === "mc" ? (cf.mc || {})[it.n] || "" : it.kind === "tf" ? (cf.tf || {})[it.n] || "" : "", area: (cf.comp || {})[it.n] || "", exp: (cf.exp || {})[it.n] || "", label: it.label || "" }; }) }));
  const rubrics = (cf.manual || []).map(m => ({ uid: uid(), id: dup ? null : m.id, label: m.label || "", max: +m.max || 0, crit: [].concat(m.crit || []).join("\n"), items: (m.qs || []).map(n => uidOf[n]).filter(Boolean) }));
  const u = usage(b.version), builtin = !b.custom && !dup, locked = !dup && (builtin || u.attempts > 0);
  if (!locked) sections.forEach(s => s.items.forEach(it => {                 // soal B/S & esai tanpa rubrik diberi rubrik skor 0 (= tidak dinilai, mis. No. 50 bank 50 soal)
    if (it.kind !== "mc" && !rubrics.some(r => r.items.includes(it.uid))) rubrics.push(Object.assign(mkRub(it), { max: 0, crit: "" }));
  }));
  return { version: dup ? null : b.version, isNew: !!dup, builtin, pattern, attempts: dup ? 0 : u.attempts,
    locked, lockWhy: builtin ? "bawaan" : "dipakai",
    meta: { label: dup ? "Salinan " + b.label : b.label, short: dup ? "" : b.short && b.short !== b.label ? b.short : "", desc: dup ? "" : b.custom ? b.rawDesc || "" : b.desc || "", minutes: b.minutes },
    mcPts: num(cf.mc_pts) ?? 2, tfPts: num(cf.tf_pts) ?? 1, scale: [].concat(cf.scale || (pattern === "essay" ? DEF_SCALE : [])).join("\n"),
    codes: clone(b.codes || {}), baseCfg: dup ? null : clone(cf), sections: dup ? sections.map(s => Object.assign(s, { part: undefined })) : sections, rubrics };
}

// ---------- tampilan editor ----------
const fld = (label, inner, cls) => `<div class="${cls || ""}"><label class="f">${label}</label>${inner}</div>`;
const inp = (b, v, attrs) => `<input type="text" data-k="${b}" value="${esc(v ?? "")}" ${attrs || ""}>`;
const area = (b, v, rows, attrs) => `<textarea data-k="${b}" rows="${rows || 2}" ${attrs || ""}>${esc(v ?? "")}</textarea>`;
const tools = (t, id, first, last) => ed.locked ? "" : `<div class="etools"><button type="button" class="ebtn" data-act="up" data-t="${t}" data-id="${id}" ${first ? "disabled" : ""} title="Pindah ke atas" aria-label="Pindah ke atas">↑</button><button type="button" class="ebtn" data-act="down" data-t="${t}" data-id="${id}" ${last ? "disabled" : ""} title="Pindah ke bawah" aria-label="Pindah ke bawah">↓</button><button type="button" class="ebtn del" data-act="del" data-t="${t}" data-id="${id}" title="Hapus" aria-label="Hapus">${window.ic("trash")}</button></div>`;
function partOf(i) { return ed.builtin ? ed.sections[i].part : ed.pattern === "mix" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i] : ed.pattern === "essay" ? String(i + 1) : undefined; }
function numbering() { const m = {}; let k = 0; ed.sections.forEach(s => s.items.forEach(it => m[it.uid] = ed.locked ? it.n : ++k)); return m; }
function rubricHtml(r, no, it) {
  const many = r.items.length > 1, tf = it.kind === "tf";
  return `<div class="erub" data-r="${r.uid}"><div class="erub-h">${tf ? "Rubrik alasan" : "Rubrik"}${many ? ` untuk soal ${r.items.map(u => no[u]).join(", ")}` : ""}</div>
    <div class="fgrid">${fld("Label rubrik (opsional)", inp(`r:${r.uid}:label`, r.label, `maxlength="120" placeholder="${tf ? "Alasan No. " + no[it.uid] : "No. " + no[it.uid]}"`))}
      ${fld("Skor maksimum", `<input type="number" data-k="r:${r.uid}:max" value="${esc(r.max)}" min="0" max="100" step="1" ${ed.locked ? "disabled" : ""}>`)}</div>
    ${fld("Kriteria / poin jawaban yang diharapkan <span class=\"mut\">(satu per baris)</span>", area(`r:${r.uid}:crit`, r.crit, 3))}
    <div class="hint">Skor maksimum 0 berarti ${tf ? "alasan" : "soal ini"} tidak dinilai.</div></div>`;
}
function itemHtml(s, it, j, no) {
  const lastRub = ed.rubrics.filter(r => r.items[r.items.length - 1] === it.uid);
  let body = "";
  if (it.kind === "essay") body += fld("Topik / label soal (opsional)", inp(`i:${it.uid}:label`, it.label, `maxlength="80" placeholder="mis. Context, Risk & Opportunity"`));
  body += fld(it.kind === "tf" ? "Pernyataan" : "Pertanyaan", area(`i:${it.uid}:q`, it.q, it.kind === "mc" ? 2 : 3));
  if (it.kind === "mc") body += `<label class="f">Pilihan jawaban <span class="mut">(pilih kunci di sebelah kiri)</span></label><div class="eopts">${[0, 1, 2, 3].map(k => `<label class="eopt${it.key === L[k] ? " on" : ""}">
      <input type="radio" name="k_${it.uid}" data-k="i:${it.uid}:key" value="${L[k]}" ${it.key === L[k] ? "checked" : ""} aria-label="Kunci ${L[k]}"><span class="k">${L[k]}</span>
      <input type="text" data-k="o:${it.uid}:${k}" value="${esc(it.o[k])}" placeholder="Pilihan ${L[k]}" maxlength="400"></label>`).join("")}</div>
    <div class="fgrid">${fld("Area / kompetensi", inp(`i:${it.uid}:area`, it.area, `list="edCodes" maxlength="30" placeholder="${esc(s.code || "kode area")}"`))}${fld("Pembahasan (opsional)", inp(`i:${it.uid}:exp`, it.exp, `maxlength="600"`))}</div>`;
  if (it.kind === "tf") body += `<label class="f">Kunci</label><div class="seg ekey">${[["B", "Benar"], ["S", "Salah"]].map(([v, t]) => `<label class="${it.key === v ? "on" : ""}"><input type="radio" name="k_${it.uid}" data-k="i:${it.uid}:key" value="${v}" ${it.key === v ? "checked" : ""}>${t}</label>`).join("")}</div>`;
  body += lastRub.map(r => rubricHtml(r, no, it)).join("");
  return `<div class="eitem" data-i="${it.uid}"><div class="eitem-h"><span class="qno">Soal ${no[it.uid]}</span><span class="badge b-info">${KIND[it.kind]}</span><div class="sp"></div>${tools("item", it.uid, j === 0, j === s.items.length - 1)}</div>${body}</div>`;
}
function secHtml(s, i, no) {
  const P = ed.pattern, pt = partOf(i);
  return `<section class="card esec" data-s="${s.uid}"><div class="esec-h"><h3>Bagian ${i + 1}${P === "mix" && pt ? ` <span class="mut">· ${pt}</span>` : ""}</h3><div class="sp"></div>${tools("sec", s.uid, i === 0, i === ed.sections.length - 1)}</div>
    <div class="fgrid">${fld(P === "essay" ? "Judul studi kasus" : "Nama bagian", inp(`s:${s.uid}:name`, s.name, `maxlength="120"`))}
      ${P === "pg" ? fld("Kode area", inp(`s:${s.uid}:code`, s.code, `maxlength="30" placeholder="mis. CTX"`)) : fld("Nama singkat di navigasi (opsional)", inp(`s:${s.uid}:short`, s.short, `maxlength="60"`))}</div>
    ${P === "pg" ? `<div class="fgrid">${fld("Nama singkat di navigasi (opsional)", inp(`s:${s.uid}:short`, s.short, `maxlength="60"`))}<div></div></div>` : ""}
    ${fld("Petunjuk pengerjaan (opsional)", area(`s:${s.uid}:intro`, s.intro, 2))}
    ${P !== "pg" ? fld(`Kasus / skenario${P === "mix" ? " (opsional)" : ""}`, area(`s:${s.uid}:scenario`, s.scenario, 4, `placeholder="Ceritakan kasusnya. Baris baru dan daftar bernomor ditampilkan apa adanya."`)) : ""}
    <div class="eitems">${s.items.map((it, j) => itemHtml(s, it, j, no)).join("") || `<div class="empty small">Belum ada soal di bagian ini.</div>`}</div>
    ${ed.locked ? "" : `<div class="eadd">${ALLOW[P].map(k => `<button type="button" class="btn ghost sm" data-add="${k}" data-s="${s.uid}">${window.ic("plus")} Soal ${KIND[k].toLowerCase()}</button>`).join("")}</div>`}</section>`;
}
function stats() {
  let n = 0, mx = 0, mc = 0, tf = 0;
  ed.sections.forEach(s => s.items.forEach(it => { n++; if (it.kind === "mc") mc++; if (it.kind === "tf") tf++; }));
  const rub = ed.rubrics.reduce((t, r) => t + (+r.max || 0), 0);
  mx = ed.pattern === "pg" ? mc : ed.pattern === "essay" ? rub : mc * (+ed.mcPts || 0) + tf * (+ed.tfPts || 0) + rub;
  return { n, mx };
}
function statText() { const s = stats(); return `${s.n} soal · skor maksimum ${s.mx}${s.mx && s.mx !== 100 ? ` · nilai = skor / ${s.mx} × 100` : ""}`; }
function render() {
  const P = ed.pattern, no = numbering(), el = $("#pgBank");
  const codes = new Set([...Object.keys(ed.codes || {}), ...ed.sections.map(s => s.code).filter(Boolean), ...ed.sections.flatMap(s => s.items.map(it => it.area)).filter(Boolean)]);
  const lock = !ed.locked ? "" : ed.lockWhy === "bawaan"
    ? `<div class="alert info"><b>Bank bawaan.</b> Teks soal, pilihan, kunci, area, pembahasan, kasus, dan kriteria rubrik dapat diubah. Struktur (jumlah & urutan soal, poin, skor maksimum rubrik) dikunci agar nomor soal tetap sama dengan file bawaan dan jawaban peserta. Untuk mengubah struktur, gunakan <b>Duplikat</b> di daftar bank soal.${ed.attempts ? ` Perubahan kunci langsung memengaruhi nilai ${ed.attempts} peserta yang sudah mengerjakan.` : ""}</div>`
    : `<div class="alert info"><b>Bank ini sudah dikerjakan ${ed.attempts} peserta.</b> Struktur (jumlah & urutan soal, poin, skor maksimum rubrik) dikunci agar jawaban yang tersimpan tetap cocok. Teks, pilihan, kunci, pembahasan, dan kriteria rubrik masih dapat diubah; perubahan kunci langsung memengaruhi nilai peserta tersebut. Untuk mengubah struktur, gunakan <b>Duplikat</b>.</div>`;
  el.innerHTML = `<div class="crumbs"><a href="${ctx.href("bank")}">Bank soal</a><span>/</span><span>${esc(ed.meta.label || "Bank baru")}</span></div>
    <div class="phead" style="margin-top:8px"><div><h1>${ed.isNew ? "Bank soal baru" : "Ubah bank soal"}</h1><p class="mut">Pola ${esc(PAT[P].name.toLowerCase())} · ${esc(DESC[P][2].replace(/\.$/, ""))}${ed.version ? ` · versi <code>${esc(ed.version)}</code>` : ""}</p></div></div>
    ${lock}
    <section class="card esec"><div class="esec-h"><h3>Informasi bank</h3></div>
      <div class="fgrid">${fld("Nama bank soal", inp("m:label", ed.meta.label, `maxlength="120"`))}${fld("Nama singkat (opsional)", inp("m:short", ed.meta.short, `maxlength="40" placeholder="dipakai di daftar peserta & ekspor"`))}</div>
      ${fld("Keterangan (opsional)", inp("m:desc", ed.meta.desc, `maxlength="300" placeholder="Tampil sebagai keterangan saat memilih bank soal di batch"`))}
      <div class="fgrid">${fld("Durasi bawaan (menit)", `<input type="number" data-k="m:minutes" value="${esc(ed.meta.minutes)}" min="5" max="600" step="1">`)}
        ${P === "mix" ? `<div class="fgrid tight">${fld("Poin per soal PG", `<input type="number" data-k="p:mcPts" value="${esc(ed.mcPts)}" min="1" max="20" step="1" ${ed.locked ? "disabled" : ""}>`)}${fld("Poin per soal B/S", `<input type="number" data-k="p:tfPts" value="${esc(ed.tfPts)}" min="1" max="20" step="1" ${ed.locked ? "disabled" : ""}>`)}</div>` : "<div></div>"}</div>
      ${P === "essay" ? fld("Skala skor untuk trainer <span class=\"mut\">(satu per baris, tampil saat menilai)</span>", area("p:scale", ed.scale, 5)) : ""}
      <div class="hint">${esc(DESC[P][1])}</div></section>
    ${ed.sections.map((s, i) => secHtml(s, i, no)).join("")}
    ${ed.locked ? "" : `<div class="eadd" style="margin:4px 0 0"><button type="button" class="btn soft" data-act="addsec">${window.ic("plus")} Tambah ${P === "essay" ? "studi kasus" : "bagian"}</button></div>`}
    <datalist id="edCodes">${[...codes].map(c => `<option value="${esc(c)}">`).join("")}</datalist>
    <div class="ebar"><div><b id="edStat">${esc(statText())}</b><div class="small" id="edMsg">${dirty ? "Ada perubahan yang belum disimpan" : ed.isNew ? "Belum disimpan" : "Semua perubahan tersimpan"}</div></div><div class="sp"></div>
      <a class="btn ghost" href="${ctx.href("bank")}">Kembali</a><button type="button" class="btn" id="edSave">Simpan</button></div>`;
  $("#edSave").onclick = save;
}
function touch() { dirty = true; const m = $("#edMsg"); if (m) { m.textContent = "Ada perubahan yang belum disimpan"; m.className = "small"; } const st = $("#edStat"); if (st) st.textContent = statText(); }
const findSec = id => ed.sections.find(s => s.uid === id);
const findItem = id => { for (const s of ed.sections) { const it = s.items.find(x => x.uid === id); if (it) return [s, it]; } return [null, null]; };
function setVal(k, v, el) {
  const [t, id, f] = k.split(":");
  if (t === "m") ed.meta[id] = id === "minutes" ? v : v;
  else if (t === "p") ed[id] = v;
  else if (t === "s") findSec(id)[f] = v;
  else if (t === "i") { const it = findItem(id)[1]; it[f] = v;
    if (f === "key" && el) el.closest(it.kind === "mc" ? ".eopts" : ".ekey").querySelectorAll("label").forEach(l => l.classList.toggle("on", l.querySelector("input[type=radio]").checked)); }
  else if (t === "o") findItem(id)[1].o[+f] = v;
  else if (t === "r") { const r = ed.rubrics.find(x => x.uid === id); r[f] = f === "max" ? v : v; }
  el && el.classList.remove("bad");
  touch();
}
function onInput(e) { const el = e.target; if (!ed || !el.dataset.k || (el.type === "radio" && !el.checked)) return; setVal(el.dataset.k, el.value, el); }
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
function dropItems(uids) { ed.rubrics.forEach(r => r.items = r.items.filter(u => !uids.includes(u))); ed.rubrics = ed.rubrics.filter(r => r.items.length); }
const filled = it => it.q.trim() || (it.o || []).some(x => x.trim());
function onClick(e) {
  if (!ed) return;
  const add = e.target.closest("[data-add]"), act = e.target.closest("[data-act]");
  if (add) { const s = findSec(add.dataset.s), it = addItem(s, add.dataset.add); touch(); rerender(); focusItem(it.uid); return; }
  if (!act) return;
  const a = act.dataset.act, t = act.dataset.t, id = act.dataset.id;
  if (a === "addsec") {
    const P = ed.pattern, k = ed.sections.length + 1;
    const nCase = ed.sections.filter(x => x.items.some(it => it.kind === "essay")).length + 1;
    const s = P === "pg" ? mkSec(`Bagian ${k}`, { code: `A${k}` }) : P === "essay" ? mkSec(`Kasus ${k}`, { intro: INTRO.essay }) : mkSec(`Studi kasus ${nCase}`, { intro: INTRO.case });
    ed.sections.push(s); addItem(s, P === "pg" ? "mc" : "essay"); touch(); rerender();
    requestAnimationFrame(() => { const x = $(`#pgBank [data-s="${s.uid}"]`); if (x) x.scrollIntoView({ block: "start", behavior: "smooth" }); });
    return;
  }
  if (t === "sec") {
    const i = ed.sections.findIndex(s => s.uid === id), s = ed.sections[i];
    if (a === "del") {
      if (ed.sections.length === 1) return alert("Bank soal minimal memiliki satu bagian.");
      if (s.items.some(filled) && !confirm(`Hapus bagian "${s.name || i + 1}" beserta ${s.items.length} soalnya?`)) return;
      dropItems(s.items.map(x => x.uid)); ed.sections.splice(i, 1);
    } else move(ed.sections, i, a === "up" ? -1 : 1);
  } else {
    const [s, it] = findItem(id), i = s.items.indexOf(it);
    if (a === "del") { if (filled(it) && !confirm("Hapus soal ini?")) return; dropItems([it.uid]); s.items.splice(i, 1); }
    else move(s.items, i, a === "up" ? -1 : 1);
  }
  touch(); rerender();
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function focusItem(u) { requestAnimationFrame(() => { const x = $(`#pgBank [data-i="${u}"]`); if (!x) return; x.scrollIntoView({ block: "center", behavior: "smooth" }); const t = x.querySelector("textarea"); if (t) t.focus({ preventScroll: true }); }); }
$("#pgBank").addEventListener("input", onInput);
$("#pgBank").addEventListener("change", onInput);
$("#pgBank").addEventListener("click", onClick);
window.addEventListener("beforeunload", e => { if (ed && dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---------- validasi & simpan ----------
function validate() {
  const errs = [], P = ed.pattern, no = numbering(), bad = (msg, k) => errs.push({ msg, k });
  if (ed.meta.label.trim().length < 3) bad("Nama bank soal minimal 3 karakter.", "m:label");
  const mi = +ed.meta.minutes; if (!Number.isInteger(mi) || mi < 5 || mi > 600) bad("Durasi harus bilangan bulat 5 sampai 600 menit.", "m:minutes");
  if (P === "mix") ["mcPts", "tfPts"].forEach(k => { const v = +ed[k]; if (!Number.isInteger(v) || v < 1 || v > 20) bad("Poin per soal harus bilangan bulat 1 sampai 20.", "p:" + k); });
  if (!ed.sections.length) bad("Tambahkan minimal satu bagian.");
  ed.sections.forEach((s, i) => {
    if (!s.name.trim()) bad(`Bagian ${i + 1}: nama bagian wajib diisi.`, `s:${s.uid}:name`);
    if (P === "pg" && !s.code.trim()) bad(`Bagian ${i + 1}: kode area wajib diisi.`, `s:${s.uid}:code`);
    if (!s.items.length) bad(`Bagian ${i + 1}: belum ada soal.`);
    s.items.forEach(it => {
      const w = `Soal ${no[it.uid]}`;
      if (!it.q.trim()) bad(`${w}: ${it.kind === "tf" ? "pernyataan" : "pertanyaan"} wajib diisi.`, `i:${it.uid}:q`);
      if (it.kind === "mc") { it.o.forEach((o, k) => { if (!o.trim()) bad(`${w}: pilihan ${L[k]} wajib diisi.`, `o:${it.uid}:${k}`); }); if (!L.includes(it.key) || !it.key) bad(`${w}: pilih kunci jawaban.`, `i:${it.uid}:key`); }
      if (it.kind === "tf" && !["B", "S"].includes(it.key)) bad(`${w}: pilih kunci Benar atau Salah.`, `i:${it.uid}:key`);
    });
  });
  ed.rubrics.forEach(r => {
    const v = +r.max, w = `Rubrik soal ${r.items.map(u => no[u]).join(", ")}`;
    if (String(r.max).trim() === "" || !Number.isInteger(v) || v < 0 || v > 100) bad(`${w}: skor maksimum harus bilangan bulat 0 sampai 100.`, `r:${r.uid}:max`);
  });
  if (!errs.length && !stats().mx) bad("Skor maksimum bank masih 0.");
  return errs;
}
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "bank";
const genVersion = label => `c-${slug(label)}-${Array.from(crypto.getRandomValues(new Uint8Array(3)), x => x.toString(36).padStart(2, "0")).join("").slice(0, 5)}`;
function build(version) {
  const P = ed.pattern, map = numbering(), lines = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
  const sections = ed.sections.map((s, i) => ({ name: s.name.trim(), short: s.short.trim() || s.name.trim(), code: P === "pg" ? s.code.trim() : s.code || undefined, part: partOf(i),
    intro: s.intro.trim() || undefined, scenario: s.scenario.trim() || undefined,
    items: s.items.map(it => ({ n: map[it.uid], kind: it.kind, q: it.q.trim(), o: it.kind === "mc" ? it.o.map(o => o.trim()) : undefined, label: it.label.trim() || undefined })) }));
  const mc = {}, comp = {}, exp = {}, tf = {}, secOfItem = {};
  ed.sections.forEach((s, i) => s.items.forEach(it => {
    const n = map[it.uid]; secOfItem[it.uid] = i;
    if (it.kind === "mc") { mc[n] = it.key; const c = it.area.trim() || (P === "pg" ? s.code.trim() : ""); if (c) comp[n] = c; if (it.exp.trim()) exp[n] = it.exp.trim(); }
    if (it.kind === "tf") tf[n] = it.key;
  }));
  const pos = {}; let k = 0; ed.sections.forEach(s => s.items.forEach(it => pos[it.uid] = k++));
  const manual = ed.rubrics.filter(r => r.items.length && +r.max > 0).sort((a, b) => pos[a.items[0]] - pos[b.items[0]]).map((r, i) => {
    const qs = r.items.map(u => map[u]), first = findItem(r.items[0])[1], tfR = first.kind === "tf";
    const auto = tfR ? `Alasan No. ${qs[0]}` : qs.length > 1 ? `No. ${qs.join(", ")}` : `No. ${qs[0]}${first.label.trim() ? " · " + first.label.trim() : ""}`;
    return { id: ed.locked && r.id ? r.id : "R" + (i + 1), sec: partOf(secOfItem[r.items[0]]), label: r.label.trim() || auto, max: +r.max, crit: lines(r.crit), qs };
  });
  const codes = clone(ed.codes || {});
  if (P === "pg") sections.forEach(s => { if (s.code && !codes[s.code]) codes[s.code] = s.name; });
  Object.values(comp).forEach(c => { if (!codes[c]) codes[c] = c; });
  const cfg = Object.assign(ed.locked && ed.baseCfg ? clone(ed.baseCfg) : {}, { version });
  if (P === "pg") Object.assign(cfg, { mc, comp, exp });
  if (P === "mix") Object.assign(cfg, { mc, comp, exp, tf, manual }, ed.builtin ? {} : { mixed: true, mc_pts: +ed.mcPts, tf_pts: +ed.tfPts });
  if (P === "essay") Object.assign(cfg, { essay: true, scale: lines(ed.scale), manual });
  if (!Object.keys(cfg.exp || {}).length) delete cfg.exp;
  return { content: { sections, codes }, config: cfg };
}
async function save() {
  const errs = validate(), msg = $("#edMsg");
  $$("#pgBank .bad").forEach(x => x.classList.remove("bad"));
  if (errs.length) {
    errs.forEach(e => { if (e.k) $$(`#pgBank [data-k="${CSS.escape(e.k)}"]`).forEach(x => x.classList.add("bad")); });
    msg.className = "small no"; msg.textContent = errs[0].msg + (errs.length > 1 ? ` (dan ${errs.length - 1} isian lain)` : "");
    const first = $("#pgBank .bad"); if (first) { first.scrollIntoView({ block: "center", behavior: "smooth" }); first.focus({ preventScroll: true }); }
    return;
  }
  if (ed.attempts && !confirm(`Bank ini sudah dikerjakan ${ed.attempts} peserta. Perubahan kunci dan rubrik langsung mengubah nilai mereka. Simpan?`)) return;
  const version = ed.version || genVersion(ed.meta.label), { content, config } = build(version), btn = $("#edSave");
  btn.disabled = true; msg.className = "small"; msg.textContent = "Menyimpan…";
  const { error } = await ctx.sb().rpc("save_bank", { p_version: version, p_pattern: ed.builtin ? "builtin" : ed.pattern, p_label: ed.meta.label.trim(), p_short: ed.meta.short.trim(),
    p_descr: ed.meta.desc.trim(), p_minutes: +ed.meta.minutes, p_content: content, p_config: config });
  btn.disabled = false;
  if (error) { msg.className = "small no"; msg.textContent = "Gagal menyimpan: " + error.message + (/save_bank|function|schema cache/i.test(error.message) ? " (jalankan supabase/bank_editor.sql)" : ""); return; }
  await ctx.reloadBanks();
  dirty = false; const wasNew = ed.isNew; ed = null;
  if (wasNew) { location.hash = ctx.href("bank", version); return; }
  open(version); const m = $("#edMsg"); if (m) { m.className = "small ok"; m.textContent = "Tersimpan"; }
}

// ---------- rute ----------
function open(id) {
  if (id === "baru") {
    if (!pendingNew) { location.replace(ctx.href("bank")); return; }
    ed = pendingNew; pendingNew = null; dirty = true;
  } else {
    const b = ctx.BANKS[id];
    if (!b || !editable(b)) { ed = null; $("#pgBank").innerHTML = `<div class="crumbs"><a href="${ctx.href("bank")}">Bank soal</a><span>/</span><span>Tidak ditemukan</span></div><div class="card empty"><h3 style="margin:0 0 6px;color:var(--ink)">Bank soal tidak dapat dibuka</h3><p style="margin:0 0 16px">Bank tidak ditemukan, kuncinya belum ada di database, atau polanya tidak dapat diubah di editor.</p><a class="btn" href="${ctx.href("bank")}">Kembali ke daftar</a></div>`; return; }
    ed = fromBank(b, ctx.cfg(id), false); dirty = false;
  }
  render();
}
return {
  paint(id) { if (!id) { ed = null; renderList(); } },
  open,
  canLeave() { if (!ed || !dirty) return true; if (!confirm("Perubahan pada bank soal belum disimpan. Tinggalkan halaman ini?")) return false; dirty = false; ed = null; return true; },
  editing: () => !!ed,
};
};
