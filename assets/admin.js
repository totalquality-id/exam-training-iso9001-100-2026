(() => {
const E = window.EXAM, CFG = window.APP_CONFIG, L = "ABCD";
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const view = id => document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== id);
const ST = { in_progress: "Mengerjakan", submitted: "Selesai", graded: "Selesai" };
const REM = { CTX: "Workshop 2 — Context & Climate Relevance Lab", LDR: "Workshop 3 — Quality Culture Challenge", "R&O": "Workshop 4 — Risk & Opportunity War Room", SUP: "Workshop 5 — Knowledge Risk Map", OPS: "Workshop 6 — Customer Promise Challenge" };
const fmtD = d => d ? new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—";
const mins = a => a.submitted_at ? Math.round((new Date(a.submitted_at) - new Date(a.started_at)) / 6000) / 10 : null;
const num = v => v === null || v === undefined || v === "" || isNaN(+v) ? null : +v;
const toLocal = d => { if (!d) return ""; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const fromLocal = v => v ? new Date(v).toISOString() : null;

// Aturan ujian yang dapat diatur per batch. Mode layar penuh, anti-salin, dan pencatatan keluar halaman selalu aktif.
const OPTS = [
  ["shuffle_q", "Acak urutan soal", "Diacak di dalam tiap bagian, berbeda untuk setiap peserta. Nomor yang tampil tetap berurutan."],
  ["shuffle_opt", "Acak pilihan jawaban", "Urutan A–D diacak per peserta. Pilihan seperti “Semua benar” tetap di posisinya."],
  ["show_score", "Tampilkan nilai ke peserta", "Setelah mengirim, peserta melihat nilai dan status lulus. Kunci jawaban tidak ditampilkan."],
  ["require_all", "Wajib menjawab semua soal", "Kirim terkunci sampai semua soal terjawab. Saat waktu habis tetap terkirim otomatis."],
];
const DEF = { shuffle_q: false, shuffle_opt: true, show_score: false, require_all: false, pass_mark: 70 };
const OPT_LABEL = { shuffle_q: "Acak soal", shuffle_opt: "Acak pilihan", show_score: "Nilai ditampilkan", require_all: "Wajib jawab semua" };

// peta pertanyaan: nomor -> {text, opts}
const Q = {};
E.mc.forEach(([n, q, o]) => Q[n] = { text: q, opts: o });

let sb, cfg, rows = [], batches = [], cur = null, poll, bf = "all", fsv = "all", hasSettings = true, editId = null, an = { sort: "no", area: "all" };
let route = { p: "list", id: null }, listY = 0;

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
  const probe = await sb.from("batches").select("settings,open_from,open_until").limit(1);
  hasSettings = !probe.error;
  $("#me").textContent = email;
  view("vApp"); await load(); render(); poll = setInterval(load, 10000);
}
$("#bOut").onclick = async () => { clearInterval(poll); await sb.auth.signOut(); location.hash = ""; location.reload(); };
$("#bRef").onclick = load;
$("#qs").oninput = $("#sort").onchange = () => renderList();
$("#fs").onclick = e => { const b = e.target.closest("button"); if (!b) return; fsv = b.dataset.v; $$("#fs button").forEach(x => x.classList.toggle("on", x === b)); renderList(); };
$("#fb").onchange = e => setBf(e.target.value);

// ---- navigasi berbasis URL: #/peserta, #/peserta/<id>, #/batch, #/analisis (+ ?batch=<id>) ----
// Tombol Back/Forward browser, refresh, dan tautan langsung ke halaman/peserta tetap berfungsi.
const PATH = { list: "peserta", batch: "batch", anal: "analisis" }, PAGE = { peserta: "list", batch: "batch", analisis: "anal" };
const href = (p, id) => "#/" + PATH[p] + (id ? "/" + id : "") + (bf !== "all" ? "?batch=" + bf : "");
function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, "").split("?"), [pg, id] = path.split("/");
  return { p: PAGE[pg] || "list", id: id || null, b: new URLSearchParams(qs || "").get("batch") || "all" };
}
const nav = (p, id) => { location.hash = href(p, id); };
window.addEventListener("hashchange", render);
function render() {
  const r = parseHash(), fromList = route.p === "list" && !route.id && !$("#vList").hidden;
  if (r.b !== bf) { bf = [...$("#fb").options].some(o => o.value === r.b) ? r.b : "all"; $("#fb").value = bf; setXlsLabel(); }
  if (r.id && fromList) listY = window.scrollY;                       // ingat posisi daftar
  const backToList = route.id && !r.id && r.p === "list";
  route = { p: r.p, id: r.id };
  $$(".sn-i").forEach(a => { const on = a.dataset.p === r.p; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); a.href = href(a.dataset.p); });
  document.title = (r.id ? "Detail peserta" : { list: "Peserta", batch: "Batch", anal: "Analisis soal" }[r.p]) + " — Trainer Console";
  if (r.id) { $("#vList").hidden = true; $("#vDet").hidden = false; navCounts(); openDet(r.id); return; }
  cur = null; $("#vDet").hidden = true; $("#vList").hidden = false;
  $("#pgList").hidden = r.p !== "list"; $("#pgBatch").hidden = r.p !== "batch"; $("#pgAnal").hidden = r.p !== "anal";
  paint();
  window.scrollTo(0, backToList ? listY : 0);
}
function paint() {                                                    // gambar ulang halaman yang tampil tanpa mengubah posisi scroll
  navCounts();
  if (route.id) return;
  if (route.p === "list") renderList(); else if (route.p === "batch") renderBatches(); else renderAnal();
}
function setBf(v) {
  bf = v; $("#fb").value = v; setXlsLabel();
  history.replaceState(null, "", href(route.p, route.id));
  $$(".sn-i").forEach(a => a.href = href(a.dataset.p));
  paint();
}
function navCounts() {
  const base = batchRows(), live = base.filter(r => r.status === "in_progress").length;
  $("#nList").innerHTML = base.length ? base.length + (live ? ` <i title="${live} sedang mengerjakan">${live} aktif</i>` : "") : "";
  $("#nBatch").textContent = batches.length || "";
  const b = bOf(bf), ctx = bf === "all" ? "Semua batch" : bf === "none" ? "Tanpa batch (data lama)" : b ? `${b.copart} · kode ${b.code}` : "";
  $("#ctxList").textContent = ctx + " · diperbarui otomatis";
  $("#ctxAnal").textContent = ctx + " · dari peserta yang sudah mengirim jawaban";
}
// pintasan keyboard: / cari, Esc kembali ke daftar, ← → peserta sebelumnya/berikutnya
document.addEventListener("keydown", e => {
  if (!$("#mBatch").hidden || $("#vApp").hidden) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === "/" && !typing && route.p === "list" && !route.id) { e.preventDefault(); $("#qs").focus(); }
  if (!route.id || typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") nav("list");
  if (e.key === "ArrowLeft" && $("#bPrev")) $("#bPrev").click();
  if (e.key === "ArrowRight" && $("#bNext")) $("#bNext").click();
});
const batchRows = () => bf === "all" ? rows : bf === "none" ? rows.filter(r => !r.batch_id) : rows.filter(r => r.batch_id === bf);
const bOf = id => batches.find(b => b.id === id);
const bcode = id => (bOf(id) || {}).code || "";
const setXlsLabel = () => $("#bXls").textContent = bf === "all" ? "Ekspor Excel" : "Ekspor Excel (batch ini)";
const pubUrl = code => new URL("./?kode=" + code, location.href).href;
const copy = async (t, btn) => {
  try { await navigator.clipboard.writeText(t); } catch { prompt("Salin teks berikut:", t); return; }
  const o = btn.textContent; btn.textContent = "Tersalin"; setTimeout(() => btn.textContent = o, 1400);
};

async function load() {
  const [a, b] = await Promise.all([
    sb.from("attempts").select("*").order("started_at", { ascending: false }),
    sb.from("batches").select("*").order("created_at", { ascending: false })]);
  if (a.error) return $("#upd").textContent = "Gagal memuat: " + a.error.message;
  rows = a.data; batches = b.data || [];
  $("#upd").textContent = b.error ? "Jalankan supabase/batch.sql terlebih dahulu" : "Diperbarui " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  renderBatchFilter(); paint();
  if (cur) {
    const x = rows.find(r => r.id === cur.a.id);
    if (x && cur.a.status === "in_progress" && (x.status !== cur.a.status || x.last_saved_at !== cur.a.last_saved_at || x.duration_minutes !== cur.a.duration_minutes)) openDet(x.id, true);
  }
}
function renderBatchFilter() {
  const v = bf, opts = `<option value="all">Semua batch</option>` + batches.map(b => `<option value="${b.id}">${esc(b.copart)} · ${esc(b.code)}</option>`).join("") + (rows.some(r => !r.batch_id) ? `<option value="none">Tanpa batch (data lama)</option>` : "");
  const sel = $("#fb"); sel.innerHTML = opts; sel.value = [...sel.options].some(o => o.value === v) ? v : "all";
  bf = sel.value; setXlsLabel();
}

// ---- perhitungan nilai (otomatis: 1 poin per soal) ----
function cat(t) { return t >= 90 ? "EXCELLENT" : t >= 80 ? "VERY GOOD / COMPETENT" : t >= 70 ? "COMPETENT" : t >= 60 ? "NEEDS IMPROVEMENT" : "NOT YET COMPETENT"; }
const isCur = a => (a.answers || {}).v === E.version;          // dikerjakan dengan bank soal yang berlaku sekarang
const scored = a => a.status !== "in_progress";
const passMark = a => num(((bOf(a.batch_id) || {}).settings || {}).pass_mark) ?? num((a.settings || {}).pass_mark) ?? 70;   // nilai lulus terbaru dari batch
const evOf = a => (a.answers || {}).ev || {};
const flOf = a => ((a.answers || {}).fl || []).map(Number);
const leftMin = a => Math.max(0, Math.ceil((new Date(a.started_at).getTime() + (a.duration_minutes || E.minutes) * 60000 - Date.now()) / 60000));
const away = s => s >= 60 ? Math.round(s / 60) + " mnt" : (s || 0) + " dtk";
const viol = ev => (ev.blur || 0) + (ev.fs || 0);
const violTxt = ev => [ev.blur ? `${ev.blur}× keluar halaman` : "", ev.fs ? `${ev.fs}× keluar layar penuh` : "", ev.nofs ? "tanpa layar penuh" : ""].filter(Boolean).join(" · ");
function calc(a) {
  if (!isCur(a)) return null;
  const mc = (a.answers || {}).mc || {}, comp = {}, N = Object.keys(cfg.mc).length; let right = 0;
  for (const [n, k] of Object.entries(cfg.mc)) {
    const ok = String(mc[n] || "").toUpperCase() === k, c = (cfg.comp || {})[n] || "—";
    comp[c] = comp[c] || { got: 0, max: 0 }; comp[c].max++; if (ok) { comp[c].got++; right++; }
  }
  const total = Math.round(right / N * 1000) / 10, pm = passMark(a);
  return { total, right, N, comp, cat: cat(total), pass: total >= pm, pm };
}
const passBadge = c => `<span class="badge ${c.pass ? "b-ok" : "b-bad"}">${c.pass ? "Lulus" : "Belum lulus"}</span>`;
const stat = (label, value, sub, hl) => `<div class="stat${hl ? " hl" : ""}"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

// ---- daftar peserta ----
function renderList() {
  const base = batchRows(), fin = base.filter(r => scored(r) && isCur(r)), cs = fin.map(calc);
  const avg = cs.length ? (cs.reduce((t, c) => t + c.total, 0) / cs.length).toFixed(1) : "—", top = cs.length ? Math.max(...cs.map(c => c.total)) : null;
  const passN = cs.filter(c => c.pass).length, prog = base.filter(r => r.status === "in_progress").length;
  $("#stats").innerHTML = stat("Total peserta", base.length, `${fin.length} sudah dinilai`)
    + stat("Mengerjakan", prog, prog ? "sedang berlangsung" : "tidak ada yang aktif")
    + stat("Selesai", base.length - prog, base.length ? Math.round((base.length - prog) / base.length * 100) + "% dari peserta" : "")
    + stat("Rata-rata nilai", avg, top !== null ? "tertinggi " + top : "", true)
    + stat("Kelulusan", cs.length ? Math.round(passN / cs.length * 100) + "%" : "—", cs.length ? `${passN} dari ${cs.length} lulus` : "belum ada nilai", true);
  const list = filtered();
  $("#tbFoot").textContent = list.length ? `Menampilkan ${list.length} dari ${base.length} peserta · klik baris untuk melihat detail` : "";
  $("#tb").innerHTML = list.length ? list.map(r => {
    const legacy = scored(r) && !isCur(r), c = scored(r) ? calc(r) : null, pct = Math.round((r.answered_count || 0) / E.total * 100), ev = evOf(r), fl = flOf(r).length, live = r.status === "in_progress";
    return `<tr class="cl" data-id="${r.id}"><td><a class="b rowlink" href="${href("list", r.id)}">${esc(r.name)}</a><div class="mut small">${esc(r.job_title)}${r.copart ? " · " + esc(r.copart) : ""}</div>
        ${violTxt(ev) ? `<div class="xs wtx" style="margin-top:2px">${violTxt(ev)}</div>` : ""}</td>
      <td><span class="badge ${live ? "b-in_progress" : "b-graded"}">${ST[r.status]}</span></td>
      <td>${legacy ? "—" : `<div class="pb"><div class="pbar"><i style="width:${pct}%"></i></div><span class="small">${r.answered_count || 0}/${E.total}</span></div>
        ${live ? `<div class="xs mut" style="margin-top:4px">Sisa ${leftMin(r)} mnt${fl ? ` · ${fl} ragu-ragu` : ""}</div>` : ""}`}</td>
      <td class="small">${fmtD(r.started_at)}</td><td class="small">${fmtD(r.submitted_at || r.last_saved_at)}</td>
      <td class="small">${mins(r) !== null ? mins(r) + " mnt" : "—"}</td>
      <td class="nw">${c ? `<b>${c.total}</b><span class="mut small"> /100</span> ${passBadge(c)}<div class="xs mut">${c.cat}</div>` : legacy ? `<span class="mut small">Soal versi lama</span>` : "—"}</td></tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty">${base.length ? "Tidak ada peserta yang cocok dengan filter." : "Belum ada peserta. Bagikan kode batch untuk memulai."}</div></td></tr>`;
  $$("tr.cl").forEach(tr => tr.onclick = e => { if (!e.target.closest("a") && !getSelection().toString()) nav("list", tr.dataset.id); });
}
// daftar sesuai pencarian, filter status, dan urutan yang aktif (juga dipakai tombol sebelumnya/berikutnya di detail)
function filtered() {
  const q = $("#qs").value.toLowerCase(), so = $("#sort").value;
  let list = batchRows().filter(r => (fsv === "all" || (fsv === "done" ? r.status !== "in_progress" : r.status === fsv)) && (r.name + " " + r.job_title + " " + (r.copart || "")).toLowerCase().includes(q));
  const sc = r => scored(r) && isCur(r) ? calc(r).total : -1;
  if (so === "score") list = [...list].sort((a, b) => sc(b) - sc(a));
  if (so === "low") list = [...list].sort((a, b) => (sc(a) < 0 ? 999 : sc(a)) - (sc(b) < 0 ? 999 : sc(b)));
  if (so === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "id"));
  return list;
}

// ---- batch ----
function bState(b) {
  const now = Date.now();
  if (!b.is_open) return ["Ditutup", "b-mut"];
  if (b.open_from && now < new Date(b.open_from).getTime()) return ["Terjadwal", "b-info"];
  if (b.open_until && now > new Date(b.open_until).getTime()) return ["Jadwal berakhir", "b-mut"];
  return ["Dibuka", "b-ok"];
}
function renderBatches() {
  $("#bWarn").innerHTML = hasSettings ? "" : `<div class="alert"><b>Pengaturan ujian belum aktif.</b> Jalankan <code>supabase/settings.sql</code> di Supabase → SQL Editor untuk mengaktifkan jadwal, pengacakan, nilai lulus, dan tampilkan nilai. Setelah itu muat ulang halaman ini.</div>`;
  $("#bt").innerHTML = batches.length ? batches.map(b => {
    const p = rows.filter(r => r.batch_id === b.id), sub = p.filter(r => r.status !== "in_progress"), cs = sub.filter(isCur).map(calc);
    const avg = cs.length ? (cs.reduce((t, c) => t + c.total, 0) / cs.length).toFixed(1) : "—", s = b.settings || {}, [stT, stC] = bState(b);
    const spec = [`${b.duration_minutes || E.minutes} menit`];
    if (hasSettings) {
      spec.push(`lulus ≥ ${num(s.pass_mark) ?? 70}`);
      Object.entries(OPT_LABEL).forEach(([k, t]) => s[k] && spec.push(t.toLowerCase()));
    }
    const sched = hasSettings && (b.open_from || b.open_until) ? `<div class="specs">Jadwal: ${b.open_from ? fmtD(b.open_from) : "…"} – ${b.open_until ? fmtD(b.open_until) : "…"}</div>` : "";
    return `<div class="bc ${b.is_open ? "" : "off"}">
      <div class="bc-top"><div><h3>${esc(b.copart)}</h3><p>${b.note ? esc(b.note) : "Dibuat " + fmtD(b.created_at)}</p></div><span class="badge ${stC}">${stT}</span></div>
      <div class="bc-code"><span class="code">${esc(b.code)}</span><div class="sp"></div><button class="btn ghost sm" data-a="code" data-id="${b.id}">Salin kode</button><button class="btn ghost sm" data-a="link" data-id="${b.id}">Salin tautan</button></div>
      <div class="specs">${spec.join(" · ")}</div>${sched}
      <div class="bc-stats"><div><b>${p.length}</b><span>Peserta</span></div><div><b>${sub.length}</b><span>Sudah kirim</span></div><div><b>${avg}</b><span>Rata-rata</span></div></div>
      <div class="bc-act"><button class="btn soft sm" data-a="view" data-id="${b.id}">Lihat peserta</button><button class="btn ghost sm" data-a="edit" data-id="${b.id}">Pengaturan</button>
        <button class="btn ghost sm" data-a="toggle" data-id="${b.id}">${b.is_open ? "Tutup" : "Buka"}</button><div class="sp"></div>
        <button class="btn danger sm" data-a="del" data-id="${b.id}">Hapus</button></div></div>`;
  }).join("") : `<div class="card empty" style="grid-column:1/-1"><h3 style="margin:0 0 6px;color:var(--ink)">Belum ada batch</h3><p style="margin:0 0 16px">Buat batch untuk mendapatkan kode 6 angka yang dibagikan ke peserta.</p><button class="btn" data-a="new">Buat Batch</button></div>`;
  $$("#bt button[data-a]").forEach(btn => btn.onclick = () => batchAct(btn.dataset.a, bOf(btn.dataset.id), btn));
}
async function batchAct(a, b, btn) {
  if (a === "new") return openBatch();
  if (a === "code") return copy(b.code, btn);
  if (a === "link") return copy(pubUrl(b.code), btn);
  if (a === "edit") return openBatch(b);
  if (a === "view") { bf = b.id; $("#fb").value = b.id; setXlsLabel(); return nav("list"); }
  if (a === "toggle") { const { error } = await sb.from("batches").update({ is_open: !b.is_open }).eq("id", b.id); if (error) return alert("Gagal: " + error.message); return load(); }
  if (a === "del") {
    if (!confirm(`Hapus batch "${b.copart}" (kode ${b.code})?\nData peserta tetap tersimpan, tetapi kode ini tidak bisa dipakai lagi.`)) return;
    const { error } = await sb.from("batches").delete().eq("id", b.id); if (error) return alert("Gagal: " + error.message); if (bf === b.id) bf = "all"; return load();
  }
}

// ---- form batch (buat & ubah pengaturan) ----
$("#toggles").innerHTML = OPTS.map(([k, t, d]) => `<label class="tg"><div class="tx"><b>${t}</b><span>${d}</span></div><span class="sw"><input type="checkbox" id="o_${k}"><i></i></span></label>`).join("");
const syncPresets = () => $$("#presets button").forEach(b => b.classList.toggle("on", b.dataset.m === $("#bnMin").value));
$("#presets").onclick = e => { const b = e.target.closest("button"); if (b) { $("#bnMin").value = b.dataset.m; syncPresets(); } };
$("#bnMin").oninput = syncPresets;
function openBatch(b) {
  editId = b ? b.id : null;
  const s = Object.assign({}, DEF, b ? Object.assign({ shuffle_opt: false }, b.settings || {}) : {});
  $("#mbTitle").textContent = b ? "Pengaturan Batch" : "Batch Baru";
  $("#mbSub").textContent = b ? `${b.copart} · kode ${b.code}` : "Kode 6 angka dibuat otomatis.";
  $("#bnName").value = b ? b.copart : ""; $("#bnNote").value = b ? b.note || "" : "";
  $("#bnMin").value = b ? b.duration_minutes || E.minutes : E.minutes; $("#bnPass").value = num(s.pass_mark) ?? 70;
  $("#bnFrom").value = b ? toLocal(b.open_from) : ""; $("#bnUntil").value = b ? toLocal(b.open_until) : "";
  OPTS.forEach(([k]) => { const el = $("#o_" + k); el.checked = !!s[k]; el.disabled = !hasSettings; });
  ["#bnPass", "#bnFrom", "#bnUntil"].forEach(id => $(id).disabled = !hasSettings);
  $("#mbNote").innerHTML = !hasSettings ? "Jadwal, nilai lulus, dan aturan ujian memerlukan <code>supabase/settings.sql</code>. Saat ini hanya nama, keterangan, dan durasi yang disimpan."
    : (b ? "Durasi, pengacakan, dan wajib jawab semua berlaku untuk peserta yang mulai setelah perubahan disimpan. Nilai lulus, tampilkan nilai, dan jadwal berlaku langsung. " : "")
      + "Mode layar penuh, perlindungan salin, dan pencatatan keluar halaman selalu aktif.";
  $("#bnAdd").textContent = b ? "Simpan" : "Buat Batch"; $("#bnErr").textContent = "";
  syncPresets(); $("#mBatch").hidden = false; $("#bnName").focus();
}
const closeBatch = () => $("#mBatch").hidden = true;
$("#bNew").onclick = () => openBatch(); $("#mbX").onclick = $("#mbNo").onclick = closeBatch;
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#mBatch").hidden) closeBatch(); });
$("#fBatch").addEventListener("submit", async e => {
  e.preventDefault(); const err = m => $("#bnErr").textContent = m; err("");
  const name = $("#bnName").value.trim(), note = $("#bnNote").value.trim(), min = Number($("#bnMin").value), pm = Number($("#bnPass").value);
  const from = fromLocal($("#bnFrom").value), until = fromLocal($("#bnUntil").value);
  if (name.length < 2) return err("Isi nama Copart (minimal 2 karakter).");
  if (!Number.isInteger(min) || min < 5 || min > 600) return err("Durasi harus berupa bilangan bulat antara 5 dan 600 menit.");
  if (hasSettings && (!Number.isFinite(pm) || pm < 0 || pm > 100)) return err("Nilai minimal lulus harus antara 0 dan 100.");
  if (hasSettings && from && until && new Date(until) <= new Date(from)) return err("Waktu tutup harus setelah waktu buka.");
  const prev = editId ? (bOf(editId) || {}).settings || {} : {};
  const settings = Object.assign({}, prev, { pass_mark: pm }); OPTS.forEach(([k]) => settings[k] = $("#o_" + k).checked);
  $("#bnAdd").disabled = true;
  let data, error;
  if (editId) {
    const p = { copart: name, note: note || null, duration_minutes: min };
    if (hasSettings) Object.assign(p, { settings, open_from: from, open_until: until });
    ({ data, error } = await sb.from("batches").update(p).eq("id", editId).select().single());
  } else {
    ({ data, error } = await sb.rpc("create_batch", hasSettings ? { p_copart: name, p_note: note, p_minutes: min, p_settings: settings, p_open_from: from, p_open_until: until } : { p_copart: name, p_note: note, p_minutes: min }));
  }
  $("#bnAdd").disabled = false;
  if (error) return err("Gagal menyimpan: " + error.message + (/function|p_settings|p_minutes|schema cache|column/i.test(error.message) ? " — jalankan ulang supabase/batch.sql dan supabase/settings.sql di SQL Editor." : ""));
  closeBatch();
  if (!editId) {
    $("#bnOk").innerHTML = `<div class="newcode"><div><div class="small mut">Batch dibuat untuk <b>${esc(data.copart)}</b> (${data.duration_minutes} menit). Bagikan kode ini ke peserta:</div><div class="code" style="margin-top:8px">${esc(data.code)}</div></div>
      <div class="sp"></div><button class="btn ghost sm" id="ncCode">Salin kode</button><button class="btn ghost sm" id="ncLink">Salin tautan</button><button class="btn ghost sm" id="ncX">Tutup</button></div>`;
    $("#ncCode").onclick = e => copy(data.code, e.currentTarget); $("#ncLink").onclick = e => copy(pubUrl(data.code), e.currentTarget); $("#ncX").onclick = () => $("#bnOk").innerHTML = "";
  }
  load();
});

// ---- detail peserta ----
function openDet(id, keep) {
  const a = rows.find(r => r.id === id);
  if (!a) { cur = null; $("#vDet").innerHTML = `<div class="crumbs"><a href="${href("list")}">Peserta</a><span>/</span><span>Tidak ditemukan</span></div><div class="card empty"><h3 style="margin:0 0 6px;color:var(--ink)">Peserta tidak ditemukan</h3><p style="margin:0 0 16px">Data mungkin sudah dihapus.</p><a class="btn" href="${href("list")}">Kembali ke daftar</a></div>`; return; }
  const y = window.scrollY, filter = cur && cur.a.id === id ? cur.filter : "all";
  cur = { a, filter };
  $("#vList").hidden = true; $("#vDet").hidden = false; if (!keep) window.scrollTo(0, 0);
  const lock = a.status === "in_progress", legacy = scored(a) && !isCur(a), c = scored(a) ? calc(a) : null, ev = evOf(a), fl = flOf(a), s = a.settings || {};
  const dur = a.duration_minutes || E.minutes, end = new Date(new Date(a.started_at).getTime() + dur * 60000);
  const cards = c
    ? stat("Nilai", `${c.total}<small> /100</small>`, c.cat, true) + stat("Jawaban benar", `${c.right}<small> /${c.N}</small>`, `${a.answered_count || 0} dari ${E.total} terjawab`)
      + stat("Kelulusan", c.pass ? "Lulus" : "Belum lulus", `nilai lulus ${c.pm}`) + stat("Durasi", mins(a) !== null ? mins(a) + "<small> mnt</small>" : "—", `dari ${dur} menit`)
    : lock ? stat("Terjawab", `${a.answered_count || 0}<small> /${E.total}</small>`, Math.round((a.answered_count || 0) / E.total * 100) + "% selesai", true) + stat("Sisa waktu", `${leftMin(a)}<small> mnt</small>`, "berakhir " + end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))
      + stat("Ragu-ragu", fl.length, "soal ditandai") + stat("Pelanggaran", viol(ev), viol(ev) ? "keluar halaman / layar penuh" : "tidak ada")
    : "";
  const rules = Object.entries(OPT_LABEL).filter(([k]) => s[k]).map(([, t]) => t).join(" · ") || "Standar";
  const ids = filtered().map(r => r.id), pos = ids.indexOf(a.id), prev = pos > 0 ? ids[pos - 1] : null, next = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;
  $("#vDet").innerHTML = `<div class="crumbs"><a href="${href("list")}" title="Kembali ke daftar (Esc)">Peserta</a><span>/</span><span>${esc(a.name)}</span><div class="sp"></div>
      ${pos >= 0 ? `<span class="xs mut">${pos + 1} dari ${ids.length}</span>` : ""}
      ${prev ? `<a class="btn ghost sm" id="bPrev" href="${href("list", prev)}" title="Peserta sebelumnya (←)">Sebelumnya</a>` : ""}
      ${next ? `<a class="btn ghost sm" id="bNext" href="${href("list", next)}" title="Peserta berikutnya (→)">Berikutnya</a>` : ""}</div>
    <div class="dhead"><div><h1>${esc(a.name)}</h1><p class="mut" style="margin:4px 0 0">${esc(a.job_title)}${a.copart ? " · " + esc(a.copart) : ""}${a.batch_id ? " · batch " + esc(bcode(a.batch_id)) : ""}</p></div>
      <span class="badge ${lock ? "b-in_progress" : "b-graded"}">${ST[a.status]}</span></div>
    ${legacy ? `<div class="alert"><b>Soal versi lama.</b> Peserta ini mengerjakan bank soal sebelumnya sehingga tidak dapat dinilai dengan kunci yang baru. Hapus bila hanya data uji.</div>` : ""}
    <div class="dgrid">${cards}</div>
    <div class="two">
      <div class="panel"><h3>Info pengerjaan</h3><dl class="kv">
        <dt>Mulai</dt><dd>${fmtD(a.started_at)}</dd><dt>Batas waktu</dt><dd>${fmtD(end)} <span class="mut small">(${dur} menit)</span></dd><dt>Dikirim</dt><dd>${fmtD(a.submitted_at)}</dd>
        <dt>Aktivitas terakhir</dt><dd>${fmtD(a.last_saved_at)}</dd>
        <dt>Keluar halaman</dt><dd>${ev.blur ? `<span class="wtx">${ev.blur} kali · total ${away(ev.away)}</span>${ev.last ? ` <span class="mut small">terakhir ${fmtD(ev.last)}</span>` : ""}` : "Tidak pernah"}</dd>
        <dt>Keluar layar penuh</dt><dd>${ev.fs ? `<span class="wtx">${ev.fs} kali</span>` : "Tidak pernah"}${ev.nofs ? ` <span class="wtx small">· browser peserta tidak mendukung layar penuh</span>` : ""}</dd>
        <dt>Ragu-ragu</dt><dd>${fl.length ? fl.sort((x, y) => x - y).join(", ") + (s.shuffle_q ? ` <span class="mut small">(nomor bank soal)</span>` : "") : "—"}</dd>
        <dt>Aturan</dt><dd>${rules}</dd></dl></div>
      ${lock ? `<div class="panel"><h3>Kontrol trainer</h3>
        <label class="f" style="margin-top:0">Tambah waktu</label><div class="ctrl"><select id="addMin"><option value="5">+5 menit</option><option value="10" selected>+10 menit</option><option value="15">+15 menit</option><option value="30">+30 menit</option></select><button class="btn ghost" id="bAdd">Tambah</button></div>
        <p class="hint">Timer peserta diperbarui otomatis dalam ±30 detik.</p>
        <label class="f">Akhiri pengerjaan</label><button class="btn danger" id="bForce">Kirim paksa sekarang</button>
        <p class="hint">Jawaban yang sudah tersinkron dikirim dan dinilai. Peserta tidak dapat melanjutkan.</p><div class="small" id="ctlMsg"></div></div>`
      : `<div class="panel"><h3>Catatan trainer</h3><textarea id="note" placeholder="Catatan untuk peserta ini">${esc(a.trainer_notes || "")}</textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:12px"><span class="mut small" id="svMsg"></span><button class="btn" id="bSave">Simpan</button></div></div>`}
    </div>
    <div id="sum"></div>
    ${legacy ? "" : `<div class="bar" style="margin-top:28px"><h2 style="margin-right:auto">Jawaban</h2><div class="seg" id="pf"><button data-v="all">Semua</button><button data-v="wrong">Salah / kosong</button><button data-v="flag">Ragu-ragu</button></div></div>
      ${s.shuffle_opt ? `<div class="alert info">Pilihan jawaban diacak untuk peserta ini. Huruf di tabel mengikuti urutan bank soal (sama dengan kunci).</div>` : ""}<div id="pn"></div>`}
    <div style="display:flex;justify-content:flex-end;margin:24px 0 60px"><button class="btn danger sm" id="bDel">Hapus peserta</button></div>`;
  $("#bDel").onclick = delAttempt;
  if (lock) { $("#bAdd").onclick = addTime; $("#bForce").onclick = forceSubmit; } else { $("#bSave").onclick = saveNote; $("#note").onchange = saveNote; }
  if (!legacy) {
    $$("#pf button").forEach(x => x.classList.toggle("on", x.dataset.v === cur.filter));
    $("#pf").onclick = e => { const x = e.target.closest("button"); if (!x) return; cur.filter = x.dataset.v; $$("#pf button").forEach(z => z.classList.toggle("on", z === x)); panel(); };
    panel();
  }
  summary();
  if (keep) window.scrollTo(0, y);
}

function summary() {
  const a = cur.a, c = calc(a), ok = scored(a) && c;
  if (!ok) { $("#sum").innerHTML = ""; return; }
  const comp = Object.entries(c.comp), weak = comp.filter(([k, v]) => REM[k] && v.got / v.max < 0.6).map(([k]) => REM[k]);
  $("#sum").innerHTML = `<h2 style="margin:28px 0 12px">Rincian per area</h2>
    <div class="tw"><table><thead><tr><th>Area</th><th>Benar</th><th>Persentase</th></tr></thead><tbody>${comp.map(([k, v]) => {
      const pc = Math.round(v.got / v.max * 100);
      return `<tr><td>${esc((E.codes || {})[k] || k)} <span class="mut small">${esc(k)}</span></td><td>${v.got}/${v.max}</td><td><div class="pb"><div class="pbar ${pc < 60 ? "bad" : pc < 80 ? "" : "ok"}"><i style="width:${pc}%"></i></div><span class="small">${pc}%</span></div></td></tr>`;
    }).join("")}</tbody></table></div>
    ${weak.length ? `<div class="alert"><b>Rekomendasi remedial</b> (area &lt; 60%): ${weak.map(esc).join("; ")}</div>` : ""}`;
}

function panel() {
  const a = cur.a, mc = (a.answers || {}).mc || {}, fin = scored(a), fl = flOf(a);
  const body = E.mc.map(([n, q, o]) => {
    const v = mc[n] || "", k = cfg.mc[n], ok = v === k, f = fl.includes(n);
    if (cur.filter === "wrong" && (!fin || ok)) return "";
    if (cur.filter === "flag" && !f) return "";
    const tx = x => x ? `${x}. ${esc(o[L.indexOf(x)])}` : `<span class="mut">—</span>`;
    return `<tr><td class="nw">${n}${f ? `<span class="fmark" title="Ditandai ragu-ragu">R</span>` : ""}</td><td>${esc(q)}<div class="mut small">${esc((cfg.comp || {})[n] || "")}${cfg.exp && cfg.exp[n] ? " · Pembahasan: " + esc(cfg.exp[n]) : ""}</div></td><td>${tx(v)}</td><td>${tx(k)}</td><td class="nw ${fin ? (ok ? "ok" : "no") : ""}">${fin ? (ok ? "Benar" : "Salah") : "—"}</td></tr>`;
  }).join("");
  const none = cur.filter === "flag" ? "Tidak ada soal yang ditandai ragu-ragu." : "Tidak ada jawaban salah.";
  $("#pn").innerHTML = `<div class="tw"><table class="qx"><thead><tr><th>No</th><th>Pertanyaan</th><th>Jawaban peserta</th><th>Kunci</th><th>Hasil</th></tr></thead><tbody>${body || `<tr><td colspan="5"><div class="empty">${none}</div></td></tr>`}</tbody></table></div>`;
}

async function updAttempt(p) {
  const { data, error } = await sb.from("attempts").update(p).eq("id", cur.a.id).select().single();
  if (error) throw error;
  const i = rows.findIndex(r => r.id === data.id); if (i >= 0) rows[i] = data;
  return data;
}
async function addTime() {
  const add = Number($("#addMin").value), base = cur.a.duration_minutes || E.minutes;
  $("#bAdd").disabled = true;
  try { await updAttempt({ duration_minutes: base + add }); openDet(cur.a.id, true); $("#ctlMsg").innerHTML = `<span class="ok">Waktu ditambah ${add} menit (total ${base + add} menit).</span>`; }
  catch (e) { $("#bAdd").disabled = false; $("#ctlMsg").innerHTML = `<span class="no">Gagal: ${esc(e.message)}</span>`; }
}
async function forceSubmit() {
  if (!confirm(`Kirim paksa jawaban ${cur.a.name} sekarang?\nJawaban yang sudah tersinkron akan dinilai dan peserta tidak dapat melanjutkan.`)) return;
  $("#bForce").disabled = true;
  try { await updAttempt({ status: "submitted", submitted_at: new Date().toISOString() }); openDet(cur.a.id, true); }
  catch (e) { $("#bForce").disabled = false; $("#ctlMsg").innerHTML = `<span class="no">Gagal: ${esc(e.message)}</span>`; }
}
async function saveNote() {
  $("#bSave").disabled = true; $("#svMsg").textContent = "Menyimpan…";
  try { const d = await updAttempt({ trainer_notes: $("#note").value }); cur.a = d; $("#svMsg").textContent = "Tersimpan"; }
  catch (e) { $("#svMsg").textContent = "Gagal: " + e.message; }
  $("#bSave").disabled = false;
}
async function delAttempt() {
  if (!confirm("Hapus peserta ini beserta seluruh jawabannya? Tindakan ini tidak dapat dibatalkan.")) return;
  const { error } = await sb.from("attempts").delete().eq("id", cur.a.id);
  if (error) return alert("Gagal menghapus: " + error.message);
  rows = rows.filter(r => r.id !== cur.a.id); nav("list");
}

// ---- analisis soal ----
const lvl = p => p >= 80 ? ["Mudah", "e"] : p >= 50 ? ["Sedang", "m"] : ["Sulit", "h"];
function itemStats(list) {
  return E.mc.map(([n, q, o]) => {
    const d = { A: 0, B: 0, C: 0, D: 0, _: 0 };
    list.forEach(a => { const v = String(((a.answers || {}).mc || {})[n] || "").toUpperCase(); if (v && d[v] !== undefined) d[v]++; else d._++; });
    const k = cfg.mc[n], p = list.length ? Math.round(d[k] / list.length * 100) : 0;
    return { n, q, o, d, k, p, comp: (cfg.comp || {})[n] || "—", flags: list.filter(a => flOf(a).includes(n)).length };
  });
}
function renderAnal() {
  const fin = batchRows().filter(r => scored(r) && isCur(r));
  if (!fin.length) { $("#anal").innerHTML = `<div class="card empty"><h3 style="margin:0 0 6px;color:var(--ink)">Belum ada data</h3><p style="margin:0">Analisis muncul setelah ada peserta yang mengirim jawaban.</p></div>`; return; }
  const it = itemStats(fin), byArea = {};
  it.forEach(x => { (byArea[x.comp] = byArea[x.comp] || []).push(x.p); });
  const hard = it.filter(x => x.p < 50).length, easy = it.filter(x => x.p >= 80).length;
  let list = an.area === "all" ? it : it.filter(x => x.comp === an.area);
  if (an.sort === "hard") list = [...list].sort((a, b) => a.p - b.p || a.n - b.n);
  if (an.sort === "easy") list = [...list].sort((a, b) => b.p - a.p || a.n - b.n);
  const areas = Object.entries(byArea).map(([k, ps]) => { const v = Math.round(ps.reduce((t, x) => t + x, 0) / ps.length); return `<div class="area"><div class="t"><span>${esc((E.codes || {})[k] || k)}</span><span>${v}%</span></div><div class="pbar ${v < 60 ? "bad" : v < 80 ? "" : "ok"}"><i style="width:${v}%"></i></div><div class="xs mut" style="margin-top:7px">${ps.length} soal</div></div>`; }).join("");
  $("#anal").innerHTML = `<div class="stats s4">${stat("Peserta dinilai", fin.length)}${stat("Rata-rata benar", Math.round(it.reduce((t, x) => t + x.p, 0) / it.length) + "%", "", true)}${stat("Soal sulit", hard, "&lt; 50% peserta benar")}${stat("Soal mudah", easy, "≥ 80% peserta benar")}</div>
    <h2 style="margin:8px 0 12px">Per area</h2><div class="areas">${areas}</div>
    <div class="bar"><h2 style="margin-right:auto">Per soal</h2>
      <select id="anArea" aria-label="Filter area"><option value="all">Semua area</option>${Object.keys(byArea).map(k => `<option value="${esc(k)}" ${an.area === k ? "selected" : ""}>${esc((E.codes || {})[k] || k)}</option>`).join("")}</select>
      <div class="seg" id="anSort"><button data-v="no">Nomor</button><button data-v="hard">Tersulit</button><button data-v="easy">Termudah</button></div></div>
    <div class="tw"><table class="qx"><thead><tr><th>No</th><th>Pertanyaan</th><th>Benar</th><th>Tingkat</th><th>Sebaran jawaban</th></tr></thead><tbody>${list.map(x => {
      const [lt, lc] = lvl(x.p);
      return `<tr><td>${x.n}</td><td>${esc(x.q)}<div class="mut small">${esc(x.comp)} · kunci ${x.k}${x.flags ? ` · ${x.flags} peserta ragu-ragu` : ""}</div></td>
        <td class="nw"><div class="pb" style="min-width:120px"><div class="pbar ${x.p < 50 ? "bad" : x.p < 80 ? "" : "ok"}"><i style="width:${x.p}%"></i></div><span class="small">${x.p}%</span></div></td>
        <td><span class="lvl ${lc}">${lt}</span></td>
        <td><div class="dist">${L.split("").map(l => `<span class="${l === x.k ? "k" : x.d[l] > x.d[x.k] ? "hot" : ""}" title="${esc(x.o[L.indexOf(l)])}">${l} ${x.d[l]}</span>`).join("")}<span title="Tidak dijawab">– ${x.d._}</span></div></td></tr>`;
    }).join("")}</tbody></table></div>
    <p class="hint">Hijau: kunci jawaban. Merah: pengecoh yang dipilih lebih banyak peserta daripada kunci (indikasi miskonsepsi atau soal ambigu).</p>`;
  $$("#anSort button").forEach(b => b.classList.toggle("on", b.dataset.v === an.sort));
  $("#anSort").onclick = e => { const b = e.target.closest("button"); if (b) { an.sort = b.dataset.v; renderAnal(); } };
  $("#anArea").onchange = e => { an.area = e.target.value; renderAnal(); };
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
  const wb = new ExcelJS.Workbook(); wb.creator = "Total Quality Training Exam"; wb.created = new Date();
  const codeMax = {}; Object.values(cfg.comp || {}).forEach(c => codeMax[c] = (codeMax[c] || 0) + 1);
  const codes = Object.keys(codeMax);
  const w1 = wb.addWorksheet("Rekap Nilai");
  w1.columns = [["No", 5], ["Nama", 26], ["Jabatan", 24], ["Copart", 24], ["Kode Batch", 11], ["Status", 16], ["Mulai", 18], ["Submit", 18], ["Durasi (mnt)", 12], ["Terjawab", 10], ["Benar", 9], ["Nilai (/100)", 12], ["Kategori", 24], ["Nilai lulus", 10], ["Lulus", 12],
    ...codes.map(c => [`${c} (/${codeMax[c]})`, 12]), ["Ragu-ragu", 10], ["Keluar halaman (kali)", 13], ["Waktu di luar (mnt)", 13], ["Keluar layar penuh (kali)", 14], ["Tanpa layar penuh", 12], ["Catatan trainer", 40]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const w2 = wb.addWorksheet("Detail Jawaban");
  w2.columns = [["Nama", 24], ["Jabatan", 20], ["Copart", 22], ["No", 6], ["Area", 10], ["Pertanyaan", 60], ["Jawaban peserta", 50], ["Kunci", 8], ["Poin", 8], ["Ragu-ragu", 10]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  const list = [...batchRows()].reverse();
  list.forEach((a, i) => {
    const ok = scored(a), legacy = ok && !isCur(a), c = ok ? calc(a) : null, mc = (a.answers || {}).mc || {}, ev = evOf(a), fl = flOf(a);
    w1.addRow([i + 1, a.name, a.job_title, a.copart || "", bcode(a.batch_id), legacy ? "Selesai (soal versi lama)" : ST[a.status], new Date(a.started_at), a.submitted_at ? new Date(a.submitted_at) : "", mins(a) ?? "", a.answered_count || 0,
      ...(c ? [c.right, c.total, c.cat, c.pm, c.pass ? "Lulus" : "Belum lulus", ...codes.map(k => (c.comp[k] || { got: 0 }).got)] : ["", "", "", passMark(a), "", ...codes.map(() => "")]),
      fl.length, ev.blur || 0, ev.away ? Math.round(ev.away / 6) / 10 : 0, ev.fs || 0, ev.nofs ? "Ya" : "", a.trainer_notes || ""]);
    if (!c) return;
    E.mc.forEach(([n, q, o]) => { const v = mc[n] || "", k = cfg.mc[n];
      w2.addRow([a.name, a.job_title, a.copart || "", n, (cfg.comp || {})[n] || "", q, v ? `${v}. ${o[L.indexOf(v)] || ""}` : "", k, v === k ? 1 : 0, fl.includes(n) ? "Ya" : ""]); });
  });
  const fin = list.filter(a => scored(a) && isCur(a));
  const w3 = wb.addWorksheet("Analisis Soal");
  w3.columns = [["No", 6], ["Area", 10], ["Pertanyaan", 60], ["Kunci", 8], ["% Benar", 10], ["Tingkat", 10], ["A", 7], ["B", 7], ["C", 7], ["D", 7], ["Kosong", 8], ["Ragu-ragu", 10]].map(([header, width], i) => ({ header, width, key: "c" + i }));
  if (fin.length) itemStats(fin).forEach(x => w3.addRow([x.n, x.comp, x.q, x.k, x.p, lvl(x.p)[0], x.d.A, x.d.B, x.d.C, x.d.D, x.d._, x.flags]));
  [w1, w2, w3].forEach(w => { head(w); body(w); });
  ["G", "H"].forEach(col => w1.getColumn(col).numFmt = "dd/mm/yyyy hh:mm");
  const buf = await wb.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const el = document.createElement("a"); el.href = url; const bn = (bOf(bf) || {}).copart, slug = bn ? "_" + bn.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") : "";
  el.download = "Hasil_Training_Exam" + slug + "_" + new Date().toISOString().slice(0, 10) + ".xlsx"; el.click(); URL.revokeObjectURL(url);
}
init();
})();
