(() => {
const E = window.EXAM, CFG = window.APP_CONFIG;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const view = id => document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== id);
const ST = { in_progress: "Mengerjakan", submitted: "Menunggu penilaian", graded: "Selesai dinilai" };
const REM = { CTX: "Workshop 2 — Context & Climate Relevance Lab", LDR: "Workshop 3 — Quality Culture Challenge", "R&O": "Workshop 4 — Risk & Opportunity War Room", SUP: "Workshop 5 — Knowledge Risk Map", OPS: "Workshop 6 — Customer Promise Challenge" };
const fmtD = d => d ? new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—";
const mins = a => a.submitted_at ? Math.round((new Date(a.submitted_at) - new Date(a.started_at)) / 6000) / 10 : null;

// peta pertanyaan: nomor -> {sec, label, text}
const Q = {};
E.mc.forEach(([n, q, o]) => Q[n] = { sec: "A", text: q, opts: o });
E.tf.forEach(([n, q]) => Q[n] = { sec: "B", text: q });
E.cases.forEach((c, i) => c.qs.forEach(([n, q]) => Q[n] = { sec: "C", label: `Case ${i + 1} — ${c.title}`, text: q }));
E.integrated.qs.forEach(([n, lb, q]) => Q[n] = { sec: "D", label: lb, text: q });

let sb, cfg, rows = [], batches = [], cur = null, poll, tab = "A", bf = "all";

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
  cfg = data.config; $("#me").textContent = email; view("vApp"); await load(); poll = setInterval(load, 10000);
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

// ---- perhitungan nilai ----
function cat(t) { return t >= 90 ? "EXCELLENT" : t >= 80 ? "VERY GOOD / COMPETENT" : t >= 70 ? "COMPETENT" : t >= 60 ? "NEEDS IMPROVEMENT" : "NOT YET COMPETENT"; }
function calc(a, ms = a.manual_scores || {}) {
  const ans = a.answers || {}, mc = ans.mc || {}, tf = ans.tf || {};
  let A = 0, Btf = 0; const comp = {};
  for (const [n, k] of Object.entries(cfg.mc)) {
    const ok = (mc[n] || "").toUpperCase() === k; if (ok) A += 2;
    const c = (cfg.comp || {})[n]; if (c) { comp[c] = comp[c] || { got: 0, max: 0 }; comp[c].max += 2; if (ok) comp[c].got += 2; }
  }
  for (const [n, k] of Object.entries(cfg.tf)) if ((tf[n] || "") === k) Btf++;
  const sum = s => cfg.manual.filter(m => m.sec === s).reduce((t, m) => t + (Number(ms[m.id]) || 0), 0);
  const B = Btf + sum("B"), C = sum("C"), D = sum("D"), total = A + B + C + D;
  const done = cfg.manual.filter(m => ms[m.id] !== undefined && ms[m.id] !== "").length;
  return { A, Btf, B, C, D, total, comp, done, need: cfg.manual.length, cat: cat(total), flag: C < 12 && total >= 70 };
}
const scored = a => a.status !== "in_progress";

// ---- daftar ----
function renderList() {
  const base = batchRows(), g = base.filter(r => r.status === "graded"), avg = g.length ? (g.reduce((t, r) => t + calc(r).total, 0) / g.length).toFixed(1) : "—";
  const cnt = st => base.filter(r => r.status === st).length;
  $("#stats").innerHTML = [["Total peserta", base.length], ["Mengerjakan", cnt("in_progress")], ["Menunggu penilaian", cnt("submitted")], ["Selesai dinilai", g.length], ["Rata-rata nilai", avg]]
    .map(([l, v]) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`).join("");
  const q = $("#qs").value.toLowerCase(), f = $("#fs").value;
  const list = base.filter(r => (f === "all" || r.status === f) && (r.name + " " + r.job_title + " " + (r.copart || "")).toLowerCase().includes(q));
  $("#tb").innerHTML = list.length ? list.map(r => {
    const c = scored(r) ? calc(r) : null, pct = Math.round((r.answered_count || 0) / E.total * 100);
    return `<tr class="cl" data-id="${r.id}"><td><div class="b">${esc(r.name)}</div><div class="mut small">${esc(r.job_title)}${r.copart ? " · " + esc(r.copart) : ""}</div></td>
      <td><span class="badge b-${r.status}">${ST[r.status]}</span></td>
      <td><div class="pb"><div class="pbar"><i style="width:${pct}%"></i></div><span class="small">${r.answered_count || 0}/${E.total}</span></div></td>
      <td class="small">${fmtD(r.started_at)}</td><td class="small">${fmtD(r.submitted_at || r.last_saved_at)}</td>
      <td class="small">${mins(r) !== null ? mins(r) + " mnt" : "—"}</td>
      <td>${c ? `<b>${c.total}</b><span class="mut small"> /100</span>${r.status === "graded" ? `<div class="small mut">${c.cat}</div>` : `<div class="small mut">sementara (${c.done}/${c.need} item manual)</div>`}` : "—"}</td></tr>`;
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

// ---- detail & penilaian ----
function openDet(id) {
  const a = rows.find(r => r.id === id); if (!a) return;
  cur = { a, draft: { ...(a.manual_scores || {}) } }; tab = "A";
  $("#vList").hidden = true; $("#vDet").hidden = false; window.scrollTo(0, 0);
  const lock = a.status === "in_progress";
  $("#vDet").innerHTML = `<div style="padding:24px 0 8px"><button class="btn ghost sm" id="bBack">← Kembali</button></div>
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
      <div><h1>${esc(a.name)}</h1><p class="mut">${esc(a.job_title)}${a.copart ? " · " + esc(a.copart) : ""} · Mulai ${fmtD(a.started_at)} · Submit ${fmtD(a.submitted_at)}${mins(a) !== null ? " · " + mins(a) + " menit" : ""}</p></div>
      <span class="badge b-${a.status}">${ST[a.status]}</span></div>
    ${lock ? `<div class="alert">Peserta masih mengerjakan (${a.answered_count || 0}/${E.total} terjawab). Penilaian dapat dilakukan setelah jawaban dikirim; halaman ini bisa dilihat sebagai pantauan.</div>` : ""}
    <div id="sum"></div>
    <div class="tabs">${["A", "B", "C", "D"].map(s => `<button class="tab" data-t="${s}">Section ${s}</button>`).join("")}</div>
    <div id="pn"></div>
    <div class="card" style="margin:24px 0 8px"><label class="f" style="margin-top:0">Catatan trainer</label><textarea id="note" ${lock ? "disabled" : ""}>${esc(a.trainer_notes || "")}</textarea>
      <div style="display:flex;gap:10px;justify-content:space-between;margin-top:14px;flex-wrap:wrap"><button class="btn danger sm" id="bDel">Hapus peserta</button>
      <div style="display:flex;gap:10px;align-items:center"><span class="mut small" id="svMsg"></span><button class="btn" id="bSave" ${lock ? "disabled" : ""}>Simpan Penilaian</button></div></div></div><div style="height:60px"></div>`;
  $("#bBack").onclick = () => { cur = null; $("#vDet").hidden = true; $("#vList").hidden = false; renderList(); };
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => { tab = b.dataset.t; panel(); });
  $("#bSave").onclick = saveGrade; $("#bDel").onclick = delAttempt;
  panel(); summary();
}

function summary() {
  const a = cur.a, c = calc(a, cur.draft), ok = scored(a);
  const card = (l, v, m, x = "") => `<div class="stat ${x}"><span>${l}</span><b>${ok ? v : "—"}<span class="mut small"> /${m}</span></b></div>`;
  const weak = ok ? Object.entries(c.comp).filter(([k, v]) => REM[k] && v.got / v.max < 0.6).map(([k]) => REM[k]) : [];
  if (ok && c.D < 12) weak.push("Workshop 7 — ISO 9001:2026 Transition Project");
  $("#sum").innerHTML = `<div class="sum">${card("Section A", c.A, 50)}${card("Section B", c.B, 10)}${card("Section C", c.C, 20)}${card("Section D", c.D, 20)}${card("Total", c.total, 100, "hl")}</div>
    ${ok ? `<p><span class="badge b-submitted">${c.cat}</span> <span class="mut small">· Knowledge ${c.A + c.B}/60 · Application ${c.C}/20 · Transition ${c.D}/20 · penilaian manual ${c.done}/${c.need} item</span></p>` : ""}
    ${ok && c.flag ? `<div class="alert"><b>Perhatian (guardrail):</b> Application Score &lt; 60% dari maksimum. Peserta tidak sebaiknya dinyatakan kompeten hanya karena total tinggi; gunakan hasil sebagai diagnostic tool.</div>` : ""}
    ${weak.length ? `<div class="alert"><b>Rekomendasi remedial</b> (area &lt; 60%): ${weak.map(esc).join("; ")}</div>` : ""}`;
}

const ansBox = v => v && String(v).trim() ? `<div class="ans">${esc(v)}</div>` : `<div class="ans empty">(tidak dijawab)</div>`;
function sel(m, lock) {
  const v = cur.draft[m.id];
  return `<select data-m="${m.id}" ${lock ? "disabled" : ""}><option value="">—</option>${Array.from({ length: m.max + 1 }, (_, i) => `<option value="${i}" ${v !== undefined && v !== "" && Number(v) === i ? "selected" : ""}>${i}</option>`).join("")}</select> <span class="mut small">/ ${m.max}</span>`;
}
function panel() {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
  const a = cur.a, ans = a.answers || {}, lock = a.status === "in_progress", L = "ABCD";
  let h = "";
  if (tab === "A") {
    h = `<div class="tw"><table><thead><tr><th>No</th><th>Pertanyaan</th><th>Jawaban</th><th>Kunci</th><th>Hasil</th></tr></thead><tbody>` +
      E.mc.map(([n, q, o]) => { const v = (ans.mc || {})[n], k = cfg.mc[n], ok = v === k;
        const t = x => x ? `${x}. ${esc(o[L.indexOf(x)])}` : "—";
        return `<tr><td>${n}</td><td>${esc(q)}<div class="mut small">${esc((cfg.comp || {})[n] || "")}</div></td><td>${t(v)}</td><td>${t(k)}</td><td class="${ok ? "ok" : "no"}">${ok ? "✓ +2" : "✗ 0"}</td></tr>`; }).join("") + `</tbody></table></div>`;
  } else if (tab === "B") {
    h = E.tf.map(([n, q]) => { const v = (ans.tf || {})[n], k = cfg.tf[n], m = cfg.manual.find(x => x.id === "B" + n), ok = v === k;
      return `<div class="gi"><div class="gh"><b>${n}. ${esc(q)}</b></div>
        <p class="small">Jawaban peserta: <b>${v === "B" ? "Benar" : v === "S" ? "Salah" : "—"}</b> · Kunci: <b>${k === "B" ? "Benar" : "Salah"}</b> · <span class="${ok ? "ok" : "no"}">${ok ? "+1" : "0"}</span></p>
        ${ansBox((ans.tfr || {})[n])}
        <div class="gh"><span class="small mut">${esc(m.crit)}</span><span>Skor alasan: ${sel(m, lock)}</span></div></div>`; }).join("");
  } else {
    const items = cfg.manual.filter(m => m.sec === tab);
    h = (tab === "D" ? `<div class="scn">${esc(E.integrated.scenario)}</div>` : "") +
      items.map(m => `<div class="gi"><div class="gh"><h3>${esc(m.label)}</h3><span>${sel(m, lock)}</span></div>
        ${m.qs.map(n => `<div class="qt small"><b>${n}.</b> ${esc(Q[n].text)}</div>${ansBox((ans.txt || {})[n])}`).join("")}
        <ul class="crit">${[].concat(m.crit).map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>`).join("");
    if (tab === "D") { const n = 50; h += `<div class="gi"><div class="gh"><h3>Management Question (No. 50)</h3><span class="mut small">tanpa bobot pada rubrik</span></div><div class="qt small">${esc(Q[n].text)}</div>${ansBox((ans.txt || {})[n])}</div>`; }
  }
  $("#pn").innerHTML = h;
  $("#pn").querySelectorAll("select[data-m]").forEach(s => s.onchange = () => { cur.draft[s.dataset.m] = s.value === "" ? "" : Number(s.value); summary(); });
}

async function saveGrade() {
  const a = cur.a, c = calc(a, cur.draft), full = c.done === c.need;
  $("#bSave").disabled = true; $("#svMsg").textContent = "Menyimpan…";
  const upd = { manual_scores: cur.draft, trainer_notes: $("#note").value, status: full ? "graded" : "submitted", graded_at: full ? new Date().toISOString() : null };
  const { data, error } = await sb.from("attempts").update(upd).eq("id", a.id).select().single();
  $("#bSave").disabled = false;
  if (error) return $("#svMsg").textContent = "Gagal: " + error.message;
  Object.assign(a, data); const i = rows.findIndex(r => r.id === a.id); rows[i] = data;
  $("#svMsg").textContent = full ? "Tersimpan — penilaian selesai" : `Tersimpan sebagai draft (${c.done}/${c.need} item manual terisi)`;
  summary();
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
  const w1 = wb.addWorksheet("Rekap Nilai");
  w1.columns = [["No", 5], ["Nama", 26], ["Jabatan", 24], ["Copart", 24], ["Kode Batch", 11], ["Status", 20], ["Mulai", 18], ["Submit", 18], ["Durasi (mnt)", 12], ["Terjawab", 10], ["A (/50)", 9], ["B (/10)", 9], ["C (/20)", 9], ["D (/20)", 9], ["Total (/100)", 12], ["Kategori", 24], ["Knowledge (/60)", 14], ["Application (/20)", 15], ["Transition (/20)", 14], ["Catatan guardrail", 30], ["Item manual terisi", 14], ["Catatan trainer", 40]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const w2 = wb.addWorksheet("Detail Jawaban");
  w2.columns = [["Nama", 24], ["Jabatan", 20], ["Copart", 22], ["No", 6], ["Section", 9], ["Area", 26], ["Pertanyaan", 50], ["Jawaban peserta", 60], ["Kunci", 8], ["Poin otomatis", 12]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const w3 = wb.addWorksheet("Penilaian Manual");
  w3.columns = [["Nama", 24], ["Jabatan", 20], ["Copart", 22], ["Section", 9], ["Item", 36], ["Skor", 8], ["Maks", 8]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const list = [...batchRows()].reverse();
  list.forEach((a, i) => {
    const ok = scored(a), c = calc(a), ans = a.answers || {};
    w1.addRow([i + 1, a.name, a.job_title, a.copart || "", bcode(a.batch_id), ST[a.status], new Date(a.started_at), a.submitted_at ? new Date(a.submitted_at) : "", mins(a) ?? "", a.answered_count || 0,
      ...(ok ? [c.A, c.B, c.C, c.D, c.total, c.cat, c.A + c.B, c.C, c.D, c.flag ? "Application < 60% — tinjau sebelum dinyatakan kompeten" : "", `${c.done}/${c.need}`] : ["", "", "", "", "", "", "", "", "", "", ""]), a.trainer_notes || ""]);
    for (let n = 1; n <= E.total; n++) { const q = Q[n]; let v = "", k = "", p = "";
      if (q.sec === "A") { v = (ans.mc || {})[n] || ""; k = cfg.mc[n]; p = v === k ? 2 : 0; }
      else if (q.sec === "B") { v = ((ans.tf || {})[n] || "") + ((ans.tfr || {})[n] ? " — " + ans.tfr[n] : ""); k = cfg.tf[n]; p = ((ans.tf || {})[n] === k) ? 1 : 0; }
      else v = (ans.txt || {})[n] || "";
      w2.addRow([a.name, a.job_title, a.copart || "", n, q.sec, q.label || (cfg.comp || {})[n] || "", q.text, v, k, ok && p !== "" ? p : ""]); }
    if (ok) cfg.manual.forEach(m => w3.addRow([a.name, a.job_title, a.copart || "", m.sec, m.label, (a.manual_scores || {})[m.id] ?? "", m.max]));
  });
  [w1, w2, w3].forEach(w => { head(w); body(w); });
  ["G", "H"].forEach(col => w1.getColumn(col).numFmt = "dd/mm/yyyy hh:mm");
  const buf = await wb.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const el = document.createElement("a"); el.href = url; const bn = (batches.find(b => b.id === bf) || {}).copart, slug = bn ? "_" + bn.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") : "";
  el.download = "Hasil_Final_Assessment_ISO9001" + slug + "_" + new Date().toISOString().slice(0, 10) + ".xlsx"; el.click(); URL.revokeObjectURL(url);
}
init();
})();
