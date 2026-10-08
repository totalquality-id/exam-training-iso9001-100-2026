(() => {
const E = window.EXAM, CFG = window.APP_CONFIG;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const view = id => document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== id);
const ST = { in_progress: "Mengerjakan", submitted: "Selesai", graded: "Selesai" };
const REM = { CTX: "Workshop 2 — Context & Climate Relevance Lab", LDR: "Workshop 3 — Quality Culture Challenge", "R&O": "Workshop 4 — Risk & Opportunity War Room", SUP: "Workshop 5 — Knowledge Risk Map", OPS: "Workshop 6 — Customer Promise Challenge" };
const fmtD = d => d ? new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—";
const mins = a => a.submitted_at ? Math.round((new Date(a.submitted_at) - new Date(a.started_at)) / 6000) / 10 : null;

// peta pertanyaan: nomor -> {area, text, opts}
const Q = {};
E.mc.forEach(([n, q, o]) => Q[n] = { text: q, opts: o });

let sb, cfg, rows = [], batches = [], cur = null, poll, bf = "all";

async function init() {
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("GANTI")) { view("vLogin"); $("#lErr").textContent = "Isi assets/config.js terlebih dahulu."; return; }
  sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { storageKey: "exam-admin" } });
  const { data: { session } } = await sb.auth.getSession();
  session ? enter(session.user.email) : view("vLogin");
}
$("#fLogin").addEventListener("submit", async e => {
  e.preventDefault(); $("#lErr").textContent = "";
  const { data, error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
  if (error) return $("#lErr").textContent = "Email atau password salah.";
  enter(data.user.email);
});
async function enter(email) {
  const { data } = await sb.from("grading_config").select("config").eq("id", 1).maybeSingle();
  if (!data) { await sb.auth.signOut(); view("vLogin"); $("#lErr").textContent = "Akun ini bukan admin, atau skema database belum dijalankan."; return; }
  cfg = data.config;
  if (!cfg || cfg.version !== E.version || !cfg.mc) { await sb.auth.signOut(); view("vLogin"); $("#lErr").textContent = "Kunci jawaban di database belum sesuai dengan bank soal baru. Jalankan supabase/update_questions.sql di Supabase → SQL Editor, lalu login ulang."; return; }
  $("#me").textContent = email; view("vApp"); await load(); poll = setInterval(load, 10000);
}
$("#bOut").onclick = async () => { clearInterval(poll); await sb.auth.signOut(); location.reload(); };
$("#bRef").onclick = load; $("#qs").oninput = $("#fs").onchange = renderList;
$("#fb").onchange = e => { bf = e.target.value; setXlsLabel(); renderList(); };
document.querySelectorAll(".ntab").forEach(b => b.onclick = () => go(b.dataset.p));
function go(p) {
  document.querySelectorAll(".ntab").forEach(b => b.classList.toggle("on", b.dataset.p === p));
  $("#pgList").hidden = p !== "list"; $("#pgBatch").hidden = p !== "batch"; if (p === "batch") renderBatches();
}
const batchRows = () => bf === "all" ? rows : bf === "none" ? rows.filter(r => !r.batch_id) : rows.filter(r => r.batch_id === bf);
const bcode = id => (batches.find(b => b.id === id) || {}).code || "";
const setXlsLabel = () => $("#bXls").textContent = bf === "all" ? "Ekspor Excel (semua batch)" : "Ekspor Excel (batch terpilih)";
const pubUrl = code => new URL("./?kode=" + code, location.href).href;
const copy = async (t, btn) => { try { await navigator.clipboard.writeText(t); } catch { prompt("Salin teks berikut:", t); return; } const o = btn.textContent; btn.textContent = "Tersalin ✓"; setTimeout(() => btn.textContent = o, 1400); };

async function load() {
  const [a, b] = await Promise.all([
    sb.from("attempts").select("*").order("started_at", { ascending: false }),
    sb.from("batches").select("*").order("created_at", { ascending: false })]);
  if (a.error) return $("#upd").textContent = "Gagal memuat: " + a.error.message;
  rows = a.data; batches = b.data || [];
  $("#upd").textContent = b.error ? "Jalankan supabase/batch.sql terlebih dahulu" : "Diperbarui " + new Date().toLocaleTimeString("id-ID");
  renderBatchFilter(); renderList(); if (!$("#pgBatch").hidden) renderBatches();
  if (cur) { const x = rows.find(r => r.id === cur.a.id); if (x && x.status !== cur.a.status && cur.a.status === "in_progress") openDet(x.id); }
}
function renderBatchFilter() {
  const sel = $("#fb"), v = bf;
  sel.innerHTML = `<option value="all">Semua batch</option>` + batches.map(b => `<option value="${b.id}">${esc(b.copart)} · ${esc(b.code)}</option>`).join("") + (rows.some(r => !r.batch_id) ? `<option value="none">Tanpa batch (data lama)</option>` : "");
  sel.value = [...sel.options].some(o => o.value === v) ? v : "all"; bf = sel.value; setXlsLabel();
}

// ---- perhitungan nilai (otomatis: 1 poin per soal) ----
function cat(t) { return t >= 90 ? "EXCELLENT" : t >= 80 ? "VERY GOOD / COMPETENT" : t >= 70 ? "COMPETENT" : t >= 60 ? "NEEDS IMPROVEMENT" : "NOT YET COMPETENT"; }
const isCur = a => (a.answers || {}).v === E.version;          // dikerjakan dengan bank soal yang berlaku sekarang
const scored = a => a.status !== "in_progress";
function calc(a) {
  if (!isCur(a)) return null;
  const mc = (a.answers || {}).mc || {}, comp = {}, N = Object.keys(cfg.mc).length; let right = 0;
  for (const [n, k] of Object.entries(cfg.mc)) {
    const ok = String(mc[n] || "").toUpperCase() === k, c = (cfg.comp || {})[n] || "—";
    comp[c] = comp[c] || { got: 0, max: 0 }; comp[c].max++; if (ok) { comp[c].got++; right++; }
  }
  const total = Math.round(right / N * 1000) / 10;
  return { total, right, N, comp, cat: cat(total) };
}

// ---- daftar ----
function renderList() {
  const base = batchRows(), fin = base.filter(r => scored(r) && isCur(r)), avg = fin.length ? (fin.reduce((t, r) => t + calc(r).total, 0) / fin.length).toFixed(1) : "—";
  const cnt = st => base.filter(r => r.status === st).length;
  $("#stats").innerHTML = [["Total peserta", base.length], ["Mengerjakan", cnt("in_progress")], ["Selesai", base.length - cnt("in_progress")], ["Rata-rata nilai", avg]]
    .map(([l, v]) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`).join("");
  const q = $("#qs").value.toLowerCase(), f = $("#fs").value;
  const list = base.filter(r => (f === "all" || (f === "done" ? r.status !== "in_progress" : r.status === f)) && (r.name + " " + r.job_title + " " + (r.copart || "")).toLowerCase().includes(q));
  $("#tb").innerHTML = list.length ? list.map(r => {
    const legacy = scored(r) && !isCur(r), c = scored(r) ? calc(r) : null, pct = Math.round((r.answered_count || 0) / E.total * 100);
    return `<tr class="cl" data-id="${r.id}"><td><div class="b">${esc(r.name)}</div><div class="mut small">${esc(r.job_title)}${r.copart ? " · " + esc(r.copart) : ""}</div></td>
      <td><span class="badge ${r.status === "in_progress" ? "b-in_progress" : "b-graded"}">${ST[r.status]}</span></td>
      <td>${legacy ? "—" : `<div class="pb"><div class="pbar"><i style="width:${pct}%"></i></div><span class="small">${r.answered_count || 0}/${E.total}</span></div>`}</td>
      <td class="small">${fmtD(r.started_at)}</td><td class="small">${fmtD(r.submitted_at || r.last_saved_at)}</td>
      <td class="small">${mins(r) !== null ? mins(r) + " mnt" : "—"}</td>
      <td>${c ? `<b>${c.total}</b><span class="mut small"> /100</span><div class="small mut">${c.cat}</div>` : legacy ? `<span class="mut small">Soal versi lama</span>` : "—"}</td></tr>`;
  }).join("") : `<tr><td colspan="7" class="mut" style="text-align:center;padding:32px">Belum ada peserta.</td></tr>`;
  document.querySelectorAll("tr.cl").forEach(tr => tr.onclick = () => openDet(tr.dataset.id));
}

// ---- batch ----
function renderBatches() {
  $("#bt").innerHTML = batches.length ? batches.map(b => {
    const p = rows.filter(r => r.batch_id === b.id), sub = p.filter(r => r.status !== "in_progress").length;
    return `<tr><td><div class="b">${esc(b.copart)}</div>${b.note ? `<div class="mut small">${esc(b.note)}</div>` : ""}</td>
      <td><span class="code">${esc(b.code)}</span></td>
      <td><span class="badge ${b.is_open ? "b-graded" : "b-in_progress"}">${b.is_open ? "Dibuka" : "Ditutup"}</span></td>
      <td>${p.length} peserta<div class="mut small">${sub} sudah submit</div></td><td class="small">${fmtD(b.created_at)}</td>
      <td class="acts"><button class="btn ghost sm" data-a="code" data-id="${b.id}">Salin kode</button><button class="btn ghost sm" data-a="link" data-id="${b.id}">Salin tautan</button>
      <button class="btn ghost sm" data-a="view" data-id="${b.id}">Lihat peserta</button><button class="btn ghost sm" data-a="toggle" data-id="${b.id}">${b.is_open ? "Tutup batch" : "Buka batch"}</button>
      <button class="btn danger sm" data-a="del" data-id="${b.id}">Hapus</button></td></tr>`;
  }).join("") : `<tr><td colspan="6" class="mut" style="text-align:center;padding:32px">Belum ada batch. Buat batch pertama di atas.</td></tr>`;
  $("#bt").querySelectorAll("button[data-a]").forEach(btn => btn.onclick = () => batchAct(btn.dataset.a, batches.find(b => b.id === btn.dataset.id), btn));
}
async function batchAct(a, b, btn) {
  if (a === "code") return copy(b.code, btn);
  if (a === "link") return copy(pubUrl(b.code), btn);
  if (a === "view") { bf = b.id; $("#fb").value = b.id; setXlsLabel(); go("list"); return renderList(); }
  if (a === "toggle") { const { error } = await sb.from("batches").update({ is_open: !b.is_open }).eq("id", b.id); if (error) return alert("Gagal: " + error.message); return load(); }
  if (a === "del") {
    if (!confirm(`Hapus batch "${b.copart}" (kode ${b.code})?\nData peserta tetap tersimpan, tetapi kode ini tidak bisa dipakai lagi.`)) return;
    const { error } = await sb.from("batches").delete().eq("id", b.id); if (error) return alert("Gagal: " + error.message); if (bf === b.id) bf = "all"; return load();
  }
}
$("#bnAdd").onclick = async () => {
  const name = $("#bnName").value.trim(); $("#bnErr").textContent = ""; $("#bnOk").innerHTML = "";
  if (name.length < 2) return $("#bnErr").textContent = "Isi nama Copart (minimal 2 karakter).";
  $("#bnAdd").disabled = true;
  const { data, error } = await sb.rpc("create_batch", { p_copart: name, p_note: $("#bnNote").value });
  $("#bnAdd").disabled = false;
  if (error) return $("#bnErr").textContent = "Gagal membuat batch: " + error.message;
  $("#bnName").value = ""; $("#bnNote").value = "";
  $("#bnOk").innerHTML = `<div class="newcode"><div><div class="small mut">Batch dibuat untuk <b>${esc(data.copart)}</b>. Bagikan kode ini ke peserta:</div><div class="code" style="margin-top:8px">${esc(data.code)}</div></div>
    <div class="sp"></div><button class="btn ghost sm" id="ncCode">Salin kode</button><button class="btn ghost sm" id="ncLink">Salin tautan</button></div>`;
  $("#ncCode").onclick = e => copy(data.code, e.target); $("#ncLink").onclick = e => copy(pubUrl(data.code), e.target);
  load();
};

// ---- detail peserta ----
function openDet(id) {
  const a = rows.find(r => r.id === id); if (!a) return;
  cur = { a, wrongOnly: false };
  $("#vList").hidden = true; $("#vDet").hidden = false; window.scrollTo(0, 0);
  const lock = a.status === "in_progress", legacy = scored(a) && !isCur(a);
  $("#vDet").innerHTML = `<div style="padding:24px 0 8px"><button class="btn ghost sm" id="bBack">← Kembali</button></div>
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
      <div><h1>${esc(a.name)}</h1><p class="mut">${esc(a.job_title)}${a.copart ? " · " + esc(a.copart) : ""} · Mulai ${fmtD(a.started_at)} · Submit ${fmtD(a.submitted_at)}${mins(a) !== null ? " · " + mins(a) + " menit" : ""}</p></div>
      <span class="badge ${lock ? "b-in_progress" : "b-graded"}">${ST[a.status]}</span></div>
    ${lock ? `<div class="alert">Peserta masih mengerjakan (${a.answered_count || 0}/${E.total} terjawab). Nilai muncul otomatis setelah jawaban dikirim; halaman ini bisa dilihat sebagai pantauan.</div>` : ""}
    ${legacy ? `<div class="alert"><b>Soal versi lama.</b> Peserta ini mengerjakan bank soal sebelumnya (format campuran), sehingga tidak dapat dinilai dengan kunci yang baru. Datanya tetap tersimpan; hapus bila hanya data uji.</div>` : ""}
    <div id="sum"></div>
    ${legacy ? "" : `<div class="bar" style="margin-top:20px"><label class="small" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="onlyWrong"> Tampilkan hanya jawaban salah / kosong</label></div><div id="pn"></div>`}
    <div class="card" style="margin:24px 0 8px"><label class="f" style="margin-top:0">Catatan trainer</label><textarea id="note" ${lock ? "disabled" : ""}>${esc(a.trainer_notes || "")}</textarea>
      <div style="display:flex;gap:10px;justify-content:space-between;margin-top:14px;flex-wrap:wrap"><button class="btn danger sm" id="bDel">Hapus peserta</button>
      <div style="display:flex;gap:10px;align-items:center"><span class="mut small" id="svMsg"></span><button class="btn" id="bSave" ${lock ? "disabled" : ""}>Simpan Catatan</button></div></div></div><div style="height:60px"></div>`;
  $("#bBack").onclick = () => { cur = null; $("#vDet").hidden = true; $("#vList").hidden = false; renderList(); };
  $("#bSave").onclick = saveNote; $("#bDel").onclick = delAttempt;
  if (!legacy) { $("#onlyWrong").onchange = e => { cur.wrongOnly = e.target.checked; panel(); }; panel(); }
  summary();
}

function summary() {
  const a = cur.a, c = calc(a), ok = scored(a) && c;
  if (!ok) { $("#sum").innerHTML = ""; return; }
  const comp = Object.entries(c.comp), weak = comp.filter(([k, v]) => REM[k] && v.got / v.max < 0.6).map(([k]) => REM[k]);
  $("#sum").innerHTML = `<div class="sum"><div class="stat hl"><span>Nilai</span><b>${c.total}<span class="mut small"> /100</span></b></div>
      <div class="stat"><span>Jawaban benar</span><b>${c.right}<span class="mut small"> /${c.N}</span></b></div>
      <div class="stat"><span>Terjawab</span><b>${a.answered_count || 0}<span class="mut small"> /${E.total}</span></b></div></div>
    <p><span class="badge b-submitted">${c.cat}</span></p>
    <div class="tw" style="margin-top:12px"><table><thead><tr><th>Area</th><th>Benar</th><th>Persentase</th></tr></thead><tbody>${comp.map(([k, v]) => {
      const pc = Math.round(v.got / v.max * 100);
      return `<tr><td>${esc((E.codes || {})[k] || k)} <span class="mut small">${esc(k)}</span></td><td>${v.got}/${v.max}</td><td><div class="pb"><div class="pbar"><i style="width:${pc}%"></i></div><span class="small">${pc}%</span></div></td></tr>`;
    }).join("")}</tbody></table></div>
    ${weak.length ? `<div class="alert"><b>Rekomendasi remedial</b> (area &lt; 60%): ${weak.map(esc).join("; ")}</div>` : ""}`;
}

function panel() {
  const a = cur.a, mc = (a.answers || {}).mc || {}, fin = scored(a), L = "ABCD";
  const body = E.mc.map(([n, q, o]) => {
    const v = mc[n] || "", k = cfg.mc[n], ok = v === k;
    if (cur.wrongOnly && (!fin || ok)) return "";
    const tx = x => x ? `${x}. ${esc(o[L.indexOf(x)])}` : "—";
    return `<tr><td>${n}</td><td>${esc(q)}<div class="mut small">${esc((cfg.comp || {})[n] || "")}${cfg.exp && cfg.exp[n] ? " · Pembahasan: " + esc(cfg.exp[n]) : ""}</div></td><td>${tx(v)}</td><td>${tx(k)}</td><td class="${fin ? (ok ? "ok" : "no") : ""}">${fin ? (ok ? "✓ +1" : "✗ 0") : "—"}</td></tr>`;
  }).join("");
  $("#pn").innerHTML = `<div class="tw"><table><thead><tr><th>No</th><th>Pertanyaan</th><th>Jawaban peserta</th><th>Kunci</th><th>Hasil</th></tr></thead><tbody>${body || `<tr><td colspan="5" class="mut" style="text-align:center;padding:24px">Tidak ada jawaban salah.</td></tr>`}</tbody></table></div>`;
}

async function saveNote() {
  const a = cur.a; $("#bSave").disabled = true; $("#svMsg").textContent = "Menyimpan…";
  const { data, error } = await sb.from("attempts").update({ trainer_notes: $("#note").value }).eq("id", a.id).select().single();
  $("#bSave").disabled = false;
  if (error) return $("#svMsg").textContent = "Gagal: " + error.message;
  Object.assign(a, data); const i = rows.findIndex(r => r.id === a.id); if (i >= 0) rows[i] = data;
  $("#svMsg").textContent = "Catatan tersimpan";
}
async function delAttempt() {
  if (!confirm("Hapus peserta ini beserta seluruh jawabannya? Tindakan ini tidak dapat dibatalkan.")) return;
  const { error } = await sb.from("attempts").delete().eq("id", cur.a.id);
  if (error) return alert("Gagal menghapus: " + error.message);
  rows = rows.filter(r => r.id !== cur.a.id); $("#bBack").click();
}

// ---- ekspor Excel ----
$("#bXls").onclick = async () => {
  $("#bXls").disabled = true; $("#bXls").textContent = "Menyiapkan…";
  try { await load(); await exportXlsx(); } catch (e) { alert("Gagal ekspor: " + e.message); }
  $("#bXls").disabled = false; setXlsLabel();
};
function head(ws) {
  const r = ws.getRow(1); r.height = 24;
  r.eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0047AB" } }; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
  ws.views = [{ state: "frozen", ySplit: 1 }]; ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}
function body(ws) {
  ws.eachRow((r, i) => { if (i === 1) return; r.eachCell(c => { c.alignment = { vertical: "top", wrapText: true }; c.border = { bottom: { style: "thin", color: { argb: "FFE3E8EF" } } }; }); });
}
async function exportXlsx() {
  const wb = new ExcelJS.Workbook(); wb.creator = "ISO 9001:2026 Final Assessment"; wb.created = new Date();
  const codeMax = {}; Object.values(cfg.comp || {}).forEach(c => codeMax[c] = (codeMax[c] || 0) + 1);
  const codes = Object.keys(codeMax);
  const w1 = wb.addWorksheet("Rekap Nilai");
  w1.columns = [["No", 5], ["Nama", 26], ["Jabatan", 24], ["Copart", 24], ["Kode Batch", 11], ["Status", 16], ["Mulai", 18], ["Submit", 18], ["Durasi (mnt)", 12], ["Terjawab", 10], ["Benar", 9], ["Nilai (/100)", 12], ["Kategori", 24],
    ...codes.map(c => [`${c} (/${codeMax[c]})`, 12]), ["Catatan trainer", 40]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const w2 = wb.addWorksheet("Detail Jawaban");
  w2.columns = [["Nama", 24], ["Jabatan", 20], ["Copart", 22], ["No", 6], ["Area", 10], ["Pertanyaan", 60], ["Jawaban peserta", 50], ["Kunci", 8], ["Poin", 8]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const list = [...batchRows()].reverse();
  list.forEach((a, i) => {
    const ok = scored(a), legacy = ok && !isCur(a), c = ok ? calc(a) : null, mc = (a.answers || {}).mc || {};
    w1.addRow([i + 1, a.name, a.job_title, a.copart || "", bcode(a.batch_id), legacy ? "Selesai (soal versi lama)" : ST[a.status], new Date(a.started_at), a.submitted_at ? new Date(a.submitted_at) : "", mins(a) ?? "", a.answered_count || 0,
      ...(c ? [c.right, c.total, c.cat, ...codes.map(k => (c.comp[k] || { got: 0 }).got)] : ["", "", "", ...codes.map(() => "")]), a.trainer_notes || ""]);
    if (!c) return;
    E.mc.forEach(([n, q, o]) => { const v = mc[n] || "", k = cfg.mc[n];
      w2.addRow([a.name, a.job_title, a.copart || "", n, (cfg.comp || {})[n] || "", q, v ? `${v}. ${o["ABCD".indexOf(v)] || ""}` : "", k, v === k ? 1 : 0]); });
  });
  [w1, w2].forEach(w => { head(w); body(w); });
  ["G", "H"].forEach(col => w1.getColumn(col).numFmt = "dd/mm/yyyy hh:mm");
  const buf = await wb.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const el = document.createElement("a"); el.href = url; const bn = (batches.find(b => b.id === bf) || {}).copart, slug = bn ? "_" + bn.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") : "";
  el.download = "Hasil_Final_Assessment_ISO9001" + slug + "_" + new Date().toISOString().slice(0, 10) + ".xlsx"; el.click(); URL.revokeObjectURL(url);
}
init();
})();
