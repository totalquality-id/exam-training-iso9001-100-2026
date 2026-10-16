(() => {
let BK = window.bankOf();
const CFG = window.APP_CONFIG, L = "ABCD", CK = "exam-cache", ic = window.ic;
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let sb, attempt, ans, S = {}, saveT, tick, loop, chk, dirty = false, pending = false, saving = false, done = false;
let page = 0, order = [], disp = {}, opt = {}, secOf = {}, QM = {}, warned = {}, away = false, awayAt = 0;

const view = id => document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== id);
const fatal = (m, title, reload) => { $("#fatalTitle").textContent = title || "Konfigurasi belum lengkap"; $("#fatalMsg").textContent = m; $("#bReload").hidden = !reload; view("vFatal"); };
const setSt = t => $("#saveSt").textContent = t;
const fmtDT = d => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const cat = t => t >= 90 ? "EXCELLENT" : t >= 80 ? "VERY GOOD / COMPETENT" : t >= 70 ? "COMPETENT" : t >= 60 ? "NEEDS IMPROVEMENT" : "NOT YET COMPETENT";
function toast(msg, kind) {
  const el = document.createElement("div"); el.className = "toast" + (kind ? " " + kind : ""); el.textContent = msg;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), 6000);
}

// ---- cache lokal: salinan jawaban di perangkat, aman dari refresh & putus koneksi ----
const readCache = () => { try { return JSON.parse(localStorage.getItem(CK)); } catch { return null; } };
const writeCache = () => { try {
  localStorage.setItem(CK, JSON.stringify({ attempt: { id: attempt.id, user_id: attempt.user_id, name: attempt.name, job_title: attempt.job_title, copart: attempt.copart, batch_id: attempt.batch_id, duration_minutes: attempt.duration_minutes, started_at: attempt.started_at, settings: attempt.settings || {}, remedial: attempt.remedial || 0 }, answers: ans, dirty, pending, done, page }));
} catch {} };

async function init() {
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("GANTI")) return fatal("Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada assets/config.js.");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { storageKey: "exam-participant" } });
  const { data: { session } } = await sb.auth.getSession();
  const c = readCache(), qs = new URLSearchParams(location.search), rq = qs.get("remidi");
  if (session && c && c.attempt && c.attempt.user_id === session.user.id) {          // lanjut dari perangkat ini, tanpa butuh internet
    attempt = c.attempt; dirty = !!c.dirty; pending = !!c.pending; done = !!c.done;
    if (done) return rq ? remLookup(rq) : showDone();
    startExam(c.answers, c.page); if (pending) showSending(); syncFromServer(); return;
  }
  if (session) {                                                                      // perangkat/cache baru: ambil dari server
    const { data, error } = await sb.from("attempts").select("*").eq("user_id", session.user.id).order("started_at", { ascending: false }).limit(1);
    if (error) return fatal("Tidak dapat terhubung ke server. Jawaban Anda aman; periksa koneksi lalu muat ulang halaman ini.", "Koneksi terputus", true);
    if (data && data[0]) {
      attempt = data[0];
      if (attempt.status === "in_progress") { startExam(attempt.answers, 0); writeCache(); return; }
      done = true; writeCache(); if (!rq) return showDone();
    }
  }
  if (rq) return remLookup(rq);
  view("vStart"); showCode();
  const k = qs.get("kode");
  if (k) { $("#code").value = k.replace(/\D/g, "").slice(0, 6); lookup(k); }
}

// ---- kode batch & data peserta ----
let batch = null;
function showCode() { batch = null; $("#fCode").hidden = false; $("#fStart").hidden = true; $("#fRem").hidden = true; $("#fRemCode").hidden = true; }
$("#code").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6));
$("#fCode").addEventListener("submit", e => { e.preventDefault(); lookup($("#code").value); });
$("#bChange").onclick = () => { showCode(); $("#code").select(); };
async function lookup(raw) {
  const code = String(raw || "").replace(/\D/g, ""), err = m => $("#cErr").textContent = m; err("");
  if (code.length !== 6) return err("Kode batch terdiri dari 6 angka.");
  $("#bCode").disabled = true;
  const { data, error } = await sb.rpc("get_batch", { p_code: code });
  $("#bCode").disabled = false;
  if (error) return err("Tidak dapat memeriksa kode. Periksa koneksi lalu coba lagi.");
  if (!data || !data.length) return err("Kode batch tidak ditemukan.");
  const d = data[0], now = Date.now();
  if (!d.is_open) return err("Batch ini sudah ditutup.");
  if (d.open_from && now < new Date(d.open_from).getTime()) return err(`Batch dibuka pada ${fmtDT(d.open_from)}.`);
  if (d.open_until && now > new Date(d.open_until).getTime()) return err("Batch ini sudah ditutup.");
  const bk = window.bankOf(d.settings);
  batch = { code, copart: d.copart, minutes: d.duration_minutes || bk.minutes };
  $("#bCopart").textContent = batch.copart; $("#bInfo").textContent = [d.training, d.batch_name, `${bk.total} soal · ${batch.minutes} menit`].filter(Boolean).join(" · ");
  $("#fCode").hidden = true; $("#fStart").hidden = false; $("#name").focus();
}

$("#fStart").addEventListener("submit", async e => {
  e.preventDefault(); $("#sErr").textContent = ""; $("#bStart").disabled = true;
  enterFs();                                         // harus dipanggil langsung dari klik pengguna
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    const { data, error } = await sb.rpc("join_batch", { p_code: batch.code, p_name: $("#name").value.trim(), p_job: $("#job").value.trim() });
    if (error) throw error;
    attempt = data; startExam({}, 0); writeCache();
  } catch (err) { exitFs(); $("#sErr").textContent = "Gagal memulai: " + (err.message || err); $("#bStart").disabled = false; }
});

// ---- remidi: dibuka trainer untuk peserta di bawah KKM; mengulang di batch yang sama ----
let remCode = null;
$("#bRemLink").onclick = () => { $("#fCode").hidden = true; $("#fRemCode").hidden = false; $("#rcErr").textContent = ""; $("#rcode").focus(); };
$("#bRemBack").onclick = () => { showCode(); $("#code").focus(); };
$("#bRemChange").onclick = () => { $("#fRem").hidden = true; $("#fRemCode").hidden = false; $("#rcode").select(); };
$("#rcode").addEventListener("input", e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
$("#fRemCode").addEventListener("submit", e => { e.preventDefault(); remLookup($("#rcode").value); });
async function remLookup(raw) {
  view("vStart"); showCode(); $("#fCode").hidden = true; $("#fRemCode").hidden = false;
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), err = m => $("#rcErr").textContent = m; err("");
  $("#rcode").value = code;
  if (code.length !== 8) return err("Kode remidi terdiri dari 8 huruf/angka.");
  $("#bRemCode").disabled = true;
  const { data, error } = await sb.rpc("get_remedial", { p_token: code });
  $("#bRemCode").disabled = false;
  if (error) return err("Tidak dapat memeriksa kode. Periksa koneksi lalu coba lagi.");
  if (!data || !data.length) return err("Kode remidi tidak ditemukan, atau remidi ini sudah dimulai.");
  const d = data[0], bk = window.bankOf(d.settings);
  remCode = code;
  $("#rName").textContent = d.name; $("#rMeta").textContent = d.job_title + (d.copart ? " · " + d.copart : "");
  $("#rInfo").textContent = `Remidi ke-${d.remedial} · ${bk.total} soal · ${d.duration_minutes || bk.minutes} menit`;
  $("#rErr").textContent = ""; $("#bRemStart").disabled = false;
  $("#fRemCode").hidden = true; $("#fRem").hidden = false;
}
$("#fRem").addEventListener("submit", e => { e.preventDefault(); startRemedial({ p_token: remCode }, $("#rErr"), $("#bRemStart")); });
$("#bRemNow").onclick = () => startRemedial({ p_attempt: attempt.id }, $("#remErr"), $("#bRemNow"));
async function startRemedial(args, errEl, btn) {
  errEl.textContent = ""; btn.disabled = true;
  enterFs();                                         // harus dipanggil langsung dari klik pengguna
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    const { data, error } = await sb.rpc("claim_remedial", args);
    if (error) throw error;
    attempt = data; done = false; pending = false; dirty = false; warned = {};
    $("#result").innerHTML = ""; $("#remBox").hidden = true;
    if (location.search) history.replaceState(null, "", location.pathname);
    startExam({}, 0); writeCache();
  } catch (err) { exitFs(); errEl.textContent = "Gagal memulai remidi: " + (err.message || err); btn.disabled = false; }
}
async function checkRemedial() {                   // perangkat yang sama: tampilkan tombol bila trainer membuka remidi
  try {
    const { data } = await sb.from("attempts").select("status,remedial").eq("id", attempt.id).maybeSingle();
    if (!data || data.status !== "remedial") return;
    $("#remTxt").textContent = `Trainer membuka remidi ke-${data.remedial} untuk Anda. Ujian diulang dari awal di batch yang sama; nilai Anda diperbarui setelah remidi selesai.`;
    $("#remBox").hidden = false; $("#bRemNow").disabled = false;
  } catch {}
}

// ---- mode terkunci: layar penuh, blokir pintasan/salin, catat keluar halaman ----
const root = document.documentElement;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsOK = !!(root.requestFullscreen || root.webkitRequestFullscreen) && document.fullscreenEnabled !== false;   // iPhone tidak mendukung
const active = () => !!ans && !done && !pending && !$("#vExam").hidden;
let fsDenied = !fsOK;                                // browser menolak layar penuh (mis. browser dalam aplikasi chat)
function markNoFs() { if (fsDenied && ans && !ans.ev.nofs) { ans.ev.nofs = 1; dirty = true; writeCache(); } }
function enterFs() {
  const denied = () => { fsDenied = true; markNoFs(); lockUI(); };
  try { const p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: "hide" }) : root.webkitRequestFullscreen(); if (p && p.then) p.then(lockUI, denied); } catch { denied(); }
  try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); } catch {}   // Chrome/Edge: tahan Esc & pintasan sistem
}
function exitFs() {
  try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch {}
  try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch?.(() => {}); } catch {}
}
const lockUI = () => { $("#lock").hidden = !(!fsDenied && active() && !fsEl()); };
function onFs() {
  if (!fsEl() && active()) { ans.ev.fs = (ans.ev.fs || 0) + 1; ans.ev.last = new Date().toISOString(); dirty = true; writeCache(); }
  lockUI();
}
document.addEventListener("fullscreenchange", onFs); document.addEventListener("webkitfullscreenchange", onFs);
$("#bLock").onclick = () => { enterFs(); setTimeout(lockUI, 300); };
function leave() {
  if (!active() || away) return;
  away = true; awayAt = Date.now(); ans.ev.blur = (ans.ev.blur || 0) + 1; ans.ev.last = new Date().toISOString(); dirty = true; writeCache();
}
function back() {
  if (!away) return; away = false;
  if (!ans) return;
  ans.ev.away = (ans.ev.away || 0) + Math.round((Date.now() - awayAt) / 1000); dirty = true; writeCache();
  if (active()) toast(`Anda meninggalkan halaman ujian (${ans.ev.blur}×). Aktivitas ini dilaporkan ke trainer.`, "warn");
}
window.addEventListener("blur", leave); window.addEventListener("focus", back);
document.addEventListener("visibilitychange", () => {
  if (!ans || done) return;
  if (document.hidden) return leave();
  back(); if (dirty || pending) flush();
});
window.addEventListener("beforeunload", e => { if (active()) { e.preventDefault(); e.returnValue = ""; } });
const inText = e => !!e.target && (e.target.tagName === "TEXTAREA" || (e.target.tagName === "INPUT" && e.target.type === "text" && !!e.target.closest("#exam")));
["copy", "cut", "selectstart", "dragstart"].forEach(t => document.addEventListener(t, e => { if (!$("#vExam").hidden && !inText(e)) e.preventDefault(); }));
["paste", "drop", "contextmenu"].forEach(t => document.addEventListener(t, e => { if (!$("#vExam").hidden) e.preventDefault(); }));
const EDIT_KEY = /^(a|c|x|z|y|arrowleft|arrowright|arrowup|arrowdown|backspace|delete|home|end)$/i;   // pintasan menyunting di kolom jawaban
document.addEventListener("keydown", e => {
  if ($("#vExam").hidden || done) return;
  if (e.key === "Escape") { closeSide(); closeModal(); return; }
  if (inText(e) && (e.ctrlKey || e.metaKey) && !e.altKey && EDIT_KEY.test(e.key)) return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d{1,2}$/.test(e.key) || e.key === "PrintScreen" || e.key === "ContextMenu") { e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener("keyup", e => { if (e.key === "PrintScreen" && !$("#vExam").hidden) { try { navigator.clipboard.writeText(""); } catch {} } });

// ---- pengacakan: ditentukan oleh id peserta, sehingga urutannya tetap sama setiap kali halaman dibuka ----
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const seedId = () => attempt.id + (attempt.remedial ? ":r" + attempt.remedial : "");   // remidi: urutan acak baru
function shuffle(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Pilihan seperti "Semua benar" tetap di posisinya; soal yang pilihannya merujuk huruf lain ("A dan B") tidak diacak.
const PIN = /^(semua (jawaban )?benar|ketiganya|keduanya benar|semua di atas)/i, REF = /\b[A-D]\s*(dan|atau|&|,)\s*[A-D]\b/;
function optOrder(n, o) {
  const idx = o.map((_, k) => k);
  if (!S.shuffle_opt || o.some(t => REF.test(t))) return idx;
  const free = idx.filter(k => !PIN.test(o[k].trim())), mixed = shuffle(free, seeded(seedId() + ":o" + n));
  let f = 0; return idx.map(k => PIN.test(o[k].trim()) ? k : mixed[f++]);
}
function build() {
  QM = BK.item; disp = {}; secOf = {};
  order = BK.sections.map((sec, i) => {
    const ns = sec.items.map(it => it.n);
    const sh = S.shuffle_q && sec.items.every(it => it.kind === "mc") ? shuffle(ns, seeded(seedId() + ":q" + i)) : ns;   // hanya bagian pilihan ganda yang diacak
    sh.forEach((n, j) => { disp[n] = ns[j]; secOf[n] = i; });            // nomor tampil tetap berurutan di tiap bagian
    return sh;
  });
  BK.items.forEach(it => { if (it.kind === "mc") opt[it.n] = optOrder(it.n, it.o); });
}

function startExam(saved, pg) {
  // Jawaban dari versi soal lama (format berbeda) tidak dipakai agar tidak tercampur dengan kunci yang baru
  S = attempt.settings || {}; BK = window.bankOf(S);
  if (BK.kind === "clause" && !BK.items.length) return fatal("Soal hafalan klausul belum diundi oleh server. Minta trainer menjalankan ulang supabase/settings.sql, lalu mulai ulang.", "Soal belum tersedia", true);
  const legacy = !!saved && !saved.v && BK.manual && !!(saved.tf || saved.txt);   // jawaban format lama tanpa versi = bank 50 soal
  const same = !!saved && (saved.v === BK.version || legacy), pick = k => same && saved[k] ? Object.assign({}, saved[k]) : {};
  ans = { v: BK.version, mc: pick("mc"), tf: pick("tf"), tfr: pick("tfr"), txt: pick("txt"), fl: same && Array.isArray(saved.fl) ? saved.fl.map(Number) : [], ev: same && saved.ev ? Object.assign({}, saved.ev) : {} };
  if (same && saved.lk) ans.lk = 1;                  // hafalan klausul: jenis 1 sudah dikunci
  if (saved && !same && Object.keys(saved).length) dirty = true;
  $("#pTotal").textContent = BK.total;
  $("#whoN").textContent = attempt.name; $("#whoM").textContent = attempt.job_title + (attempt.copart ? " · " + attempt.copart : "");
  build(); shell();
  page = Math.min(Math.max(0, pg | 0), BK.sections.length - 1);
  while (page > 0 && blocked(page)) page--;
  renderPage(); progress(); view("vExam"); net(); focusGrid();
  document.body.classList.add("exam-on"); markNoFs(); lockUI();
  const t = () => {
    const s = Math.max(0, Math.round((endAt() - Date.now()) / 1000));
    $("#timer").textContent = $("#lockTimer").textContent = fmtT(s); $("#timerBox").classList.toggle("warn", s < 600);
    for (const m of [10, 5, 1]) if (!warned[m] && s > 0 && s <= m * 60 && s > m * 60 - 60) { warned[m] = true; toast(`Sisa waktu ${m} menit.`, "warn"); }
    if (s === 0 && !pending && !done) { pending = true; writeCache(); lockUI(); showSending("Waktu habis. Jawaban Anda sedang dikirim…"); flush(); }
  };
  t(); tick = setInterval(t, 1000);
  loop = setInterval(() => { if ((dirty || pending) && !saving) flush(); }, 5000);
  chk = setInterval(checkServer, 30000);
}
const endAt = () => new Date(attempt.started_at).getTime() + (attempt.duration_minutes || BK.minutes) * 60000;   // durasi dari batch; data lama pakai bawaan
const fmtT = s => { const p = v => String(v).padStart(2, "0"), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + p(m) : p(m)) + ":" + p(s % 60); };

// ---- sinkronisasi dengan server ----
function applyServer(d) {
  if (d.duration_minutes && d.duration_minutes !== attempt.duration_minutes) {
    const diff = d.duration_minutes - (attempt.duration_minutes || BK.minutes);
    attempt.duration_minutes = d.duration_minutes; writeCache();
    toast(diff > 0 ? `Trainer menambah waktu ujian ${diff} menit.` : "Durasi ujian diperbarui oleh trainer.", "ok");
  }
}
async function syncFromServer() {
  const { data, error } = await sb.from("attempts").select("status,answers,duration_minutes").eq("id", attempt.id).maybeSingle();
  if (error || !data) return;
  if (data.status !== "in_progress") return finish();
  applyServer(data);
  let added = false;
  if ((data.answers || {}).v !== BK.version) return;
  for (const k of ["mc", "tf", "tfr", "txt"]) for (const [n, v] of Object.entries(data.answers[k] || {})) if (!(n in ans[k])) { ans[k][n] = v; added = true; }
  if (added) { restore(); progress(); dirty = true; writeCache(); }
}
async function checkServer() {                 // memantau perubahan dari trainer: tambah waktu atau kirim paksa
  if (done || !navigator.onLine) return;
  try {
    const { data, error } = await sb.from("attempts").select("status,duration_minutes").eq("id", attempt.id).maybeSingle();
    if (error || !data) return;
    if (data.status !== "in_progress") return finish();
    applyServer(data);
  } catch {}
}
async function flush() {
  if (saving || done || (!dirty && !pending)) return true;
  saving = true;
  const snap = JSON.stringify(ans), wasPending = pending;
  const p = { answers: ans, answered_count: count() }; if (wasPending) p.status = "submitted";
  let error = null;
  try { ({ error } = await sb.from("attempts").update(p).eq("id", attempt.id)); } catch (e) { error = e; }
  saving = false;
  const already = error && /sudah dikirim/i.test(error.message || "");
  if (error && !already) {
    setSt(navigator.onLine ? "gagal menyimpan, mencoba lagi…" : "offline — tersimpan di perangkat");
    if (pending) showSending();
    return false;
  }
  if (wasPending || already) { finish(); return true; }
  if (JSON.stringify(ans) === snap) dirty = false;
  writeCache(); setSt("tersimpan " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
  if (dirty) { clearTimeout(saveT); saveT = setTimeout(flush, 1200); }
  return true;
}
function finish() {
  done = true; pending = false; dirty = false; clearInterval(tick); clearInterval(loop); clearInterval(chk); clearTimeout(saveT);
  writeCache(); $("#mConfirm").hidden = true; closeSide(); lockUI(); exitFs(); document.body.classList.remove("exam-on"); showDone();
}
const net = () => $("#net").hidden = navigator.onLine;
window.addEventListener("offline", net);
window.addEventListener("online", () => { net(); if (ans && !done) flush(); });

// ---- tampilan soal: satu bagian per halaman ----
const KEY = { mc: "mc", tf: "tf", essay: "txt", short: "txt" };
const answered = n => { const it = QM[n]; return !!it && !!String(ans[KEY[it.kind]][n] || "").trim(); };
const isFl = n => ans.fl.includes(+n);
// hafalan klausul berurutan: halaman jenis 2 terkunci sampai jenis 1 dikunci; setelah itu jawaban jenis 1 tidak dapat diubah
const blocked = i => !!BK.seq && !ans.lk && BK.sections[i].part === "2";
const frozen = n => !!BK.seq && !!ans.lk && QM[n].part === "1";
const LOCKMSG = "Selesaikan dan kunci Jenis 1 terlebih dahulu untuk membuka Jenis 2.";
function shell() {
  $("#grid").innerHTML = BK.sections.map((sec, i) => `<div class="gsec" data-s="${i}"><div class="gsec-h" data-p="${i}"><span>${BK.manual ? "" : i + 1 + ". "}${esc(sec.short || sec.name)}</span><em>0/${order[i].length}</em></div>
    <div class="g">${order[i].map(n => `<button type="button" class="gb" data-n="${n}">${disp[n]}</button>`).join("")}</div></div>`).join("");
}
function itemHtml(n) {
  const it = QM[n];
  let body = "";
  if (it.kind === "mc") body = `<div class="opts" role="radiogroup">${opt[n].map((k, pos) =>
    `<label class="opt"><input type="radio" name="mc${n}" data-k="mc" data-n="${n}" value="${L[k]}"><span class="k">${L[pos]}</span><span>${esc(it.o[k])}</span></label>`).join("")}</div>`;
  else if (it.kind === "tf") body = `<div class="opts tf" role="radiogroup">${[["B", "Benar"], ["S", "Salah"]].map(([v, t]) =>
    `<label class="opt"><input type="radio" name="tf${n}" data-k="tf" data-n="${n}" value="${v}"><span class="k">${v}</span><span>${t}</span></label>`).join("")}</div>
    <label class="ta-l" for="r${n}">Alasan</label><textarea id="r${n}" data-k="tfr" data-n="${n}" rows="3" placeholder="Tuliskan alasan Anda"></textarea>`;
  else if (it.kind === "short") body = `<input type="text" class="sa" data-k="txt" data-n="${n}" maxlength="200" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"${it.num ? ' inputmode="decimal"' : ""} placeholder="${esc(it.ph)}" aria-label="Jawaban soal ${disp[n]}"${frozen(n) ? " disabled" : ""}>`;
  else body = `<textarea data-k="txt" data-n="${n}" rows="6" aria-label="Jawaban soal ${disp[n]}" placeholder="Tuliskan jawaban Anda"></textarea>`;
  return `<article class="q${it.kind === "short" ? " short" : ""}" id="q${n}"><div class="q-top"><span class="qno">Soal ${disp[n]}${it.label ? " · " + esc(it.label) : ""}</span><button type="button" class="flag" data-f="${n}" aria-pressed="false">Ragu-ragu</button></div>
    <div class="qt">${esc(it.q)}${it.sub ? `<span class="qsub">${esc(it.sub)}</span>` : ""}</div>${body}${it.kind === "essay" || it.kind === "short" ? "" : `<div class="q-foot" hidden><button type="button" class="clear" data-c="${n}">Hapus pilihan</button></div>`}</article>`;
}
function renderPage() {
  const sec = BK.sections[page], ns = order[page], N = BK.sections.length, last = page === N - 1, toLock = !last && blocked(page + 1);
  let h = `<section><div class="page-h"><div><div class="ey">Bagian ${page + 1} dari ${N}</div><h2>${esc(sec.name)}</h2><p>Soal ${disp[ns[0]]}${ns.length > 1 ? "–" + disp[ns[ns.length - 1]] : ""}</p></div>
    <div class="page-prog"><b id="ppC">0</b> / ${ns.length} terjawab<div class="pbar"><i id="ppB" style="width:0"></i></div></div></div>
    ${BK.seq && ans.lk && sec.part === "1" ? `<div class="alert info">Jenis 1 sudah dikunci. Jawaban di halaman ini hanya dapat dilihat.</div>` : ""}
    ${sec.intro ? `<p class="intro">${esc(sec.intro)}</p>` : ""}${sec.scenario ? `<div class="scn"><div class="ey">Kasus</div>${esc(sec.scenario)}</div>` : ""}`;
  ns.forEach(n => h += itemHtml(n));
  h += `<div class="pager"><button type="button" class="btn ghost" data-go="${page - 1}" ${page === 0 ? "disabled" : ""}>Sebelumnya</button>
    <span class="mid">${page + 1} / ${N}</span>
    ${last ? `<button type="button" class="btn" data-submit>Tinjau &amp; Kirim</button>` : toLock ? `<button type="button" class="btn" data-lock>Kunci Jenis 1 &amp; Lanjut</button>` : `<button type="button" class="btn" data-go="${page + 1}">Berikutnya</button>`}</div></section>`;
  $("#exam").innerHTML = h; restore();
}
function restore() {
  $$("#exam [data-k]").forEach(el => {
    const v = (ans[el.dataset.k] || {})[el.dataset.n];
    if (el.type === "radio") el.checked = v === el.value; else if (el.value !== (v || "")) el.value = v || "";
  });
}
function goPage(i, n) {
  if (i < 0 || i >= BK.sections.length) return;
  if (blocked(i)) return toast(LOCKMSG, "warn");
  const changed = i !== page; page = i;
  if (changed) { renderPage(); writeCache(); }
  progress(); if (changed) focusGrid();
  if (n) requestAnimationFrame(() => { const el = $("#q" + n); if (!el) return; el.scrollIntoView({ block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); });
  else if (changed) window.scrollTo({ top: 0 });
}
const jump = n => { closeSide(); goPage(secOf[n], n); };
const focusGrid = () => { const s = $(`.gsec[data-s="${page}"]`), w = $("#grid"); if (s && w) w.scrollTo({ top: s.offsetTop - w.offsetTop - 4, behavior: "smooth" }); };
function touch() {
  dirty = true; writeCache(); progress();   // simpan lokal seketika
  setSt("menyimpan…"); clearTimeout(saveT); saveT = setTimeout(flush, 1200);
}
$("#exam").addEventListener("change", e => {
  const el = e.target; if (!el.dataset.k || done || el.type !== "radio" || !el.checked) return;
  ans[el.dataset.k][el.dataset.n] = el.value; touch();
});
$("#exam").addEventListener("input", e => {
  const el = e.target; if (!(el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type === "text")) || !el.dataset.k || done) return;
  ans[el.dataset.k][el.dataset.n] = el.value; touch();
});
$("#exam").addEventListener("keydown", e => {          // isian singkat: Enter pindah ke kolom berikutnya
  if (e.key !== "Enter" || !e.target.classList.contains("sa")) return;
  e.preventDefault(); const all = [...$$("#exam .sa:not([disabled])")], nx = all[all.indexOf(e.target) + 1];
  if (nx) { nx.focus(); nx.scrollIntoView({ block: "center", behavior: "smooth" }); }
});
$("#exam").addEventListener("click", e => {
  if (done) return;
  const f = e.target.closest("[data-f]"), c = e.target.closest("[data-c]"), g = e.target.closest("[data-go]");
  if (f) { const n = +f.dataset.f; ans.fl = isFl(n) ? ans.fl.filter(x => x !== n) : [...ans.fl, n]; touch(); }
  else if (c) { delete ans[KEY[QM[c.dataset.c].kind]][c.dataset.c]; restore(); touch(); }
  else if (g) goPage(+g.dataset.go);
  else if (e.target.closest("[data-submit]")) openConfirm();
  else if (e.target.closest("[data-lock]")) openLock();
});
$("#grid").addEventListener("click", e => {
  const b = e.target.closest(".gb"), h = e.target.closest("[data-p]"), sec = (b || h) && +(b || h).closest(".gsec").dataset.s;
  if ((b || h) && blocked(sec)) return toast(LOCKMSG, "warn");
  if (b) jump(+b.dataset.n); else if (h) { closeSide(); goPage(+h.dataset.p); }
});
const openSide = () => { $("#side").classList.add("open"); $("#scrim").hidden = false; };
const closeSide = () => { $("#side").classList.remove("open"); $("#scrim").hidden = true; };
$("#fab").onclick = openSide; $("#scrim").onclick = closeSide; $("#sideX").onclick = closeSide;
$("#bSubmit").onclick = openConfirm;

function count() {
  return BK.items.filter(it => answered(it.n)).length;
}
function progress() {
  const c = count();
  $("#pCount").textContent = c; $("#pBar").style.width = (c / BK.total * 100) + "%";
  $("#cA").textContent = c; $("#cF").textContent = ans.fl.length; $("#cU").textContent = BK.total - c;
  $("#fabTxt").textContent = `Navigasi soal · ${c}/${BK.total}`;
  const full = order.map(ns => ns.filter(answered).length);
  $$(".gsec").forEach(s => { const i = +s.dataset.s; s.querySelector("em").textContent = full[i] + "/" + order[i].length; s.classList.toggle("on", i === page); s.classList.toggle("lk", blocked(i)); });
  $$(".gb[data-n]").forEach(b => { b.classList.toggle("a", answered(b.dataset.n)); b.classList.toggle("f", isFl(b.dataset.n)); });
  $$("#exam .q").forEach(q => {
    const n = q.id.slice(1), a = answered(n), f = isFl(n), fb = q.querySelector(".flag");
    const qf = q.querySelector(".q-foot"); q.classList.toggle("fl", f); if (qf) qf.hidden = !a;
    fb.classList.toggle("on", f); fb.setAttribute("aria-pressed", f);
  });
  const pc = full[page];
  if ($("#ppC")) { $("#ppC").textContent = pc; $("#ppB").style.width = (pc / order[page].length * 100) + "%"; }
}

// ---- kirim jawaban ----
const byDisp = ns => [...ns].sort((a, b) => disp[a] - disp[b]);
const jl = (title, ns) => ns.length ? `<div class="jl"><h4>${title}</h4><div class="g">${ns.map(n =>
  `<button type="button" class="gb ${answered(n) ? "a" : ""} ${isFl(n) ? "f" : ""}" data-j="${n}">${disp[n]}</button>`).join("")}</div></div>` : "";
let mMode = "submit";
function openConfirm() {
  closeSide(); mMode = "submit"; $("#mYes").textContent = "Kirim Final";
  const all = order.flat(), un = byDisp(all.filter(n => !answered(n))), fl = byDisp(ans.fl.filter(n => QM[n])), c = count(), block = S.require_all && un.length > 0;
  $("#mTitle").textContent = block ? "Masih ada soal kosong" : "Kirim jawaban?";
  $("#mInfo").textContent = un.length ? `${un.length} soal belum dijawab.${block ? " Semua soal wajib dijawab sebelum mengirim." : " Soal kosong dinilai 0."}` : fl.length ? "Semua soal terjawab, masih ada soal bertanda ragu-ragu." : "Semua soal terjawab. Jawaban tidak dapat diubah setelah dikirim.";
  $("#mSum").innerHTML = `<div class="sumrow"><div class="c-a"><b>${c}</b><span>Terjawab</span></div><div class="c-f"><b>${fl.length}</b><span>Ragu-ragu</span></div><div><b>${un.length}</b><span>Belum</span></div></div>`
    + jl("Belum dijawab", un) + jl("Ragu-ragu", fl);
  $("#ckRow").hidden = block; $("#mBtns").hidden = false; $("#mYes").hidden = block; $("#mX").hidden = false;
  $("#mNo").textContent = block ? "Lanjutkan" : "Kembali"; $("#mErr").textContent = "";
  $("#ck").checked = false; $("#mYes").disabled = true; $("#mConfirm").hidden = false;
}
function openLock() {                                 // hafalan klausul: kunci jenis 1 sebelum jenis 2 dibuka
  closeSide(); mMode = "lock";
  const p1 = BK.items.filter(it => it.part === "1").map(it => it.n), un = p1.filter(n => !answered(n)), fl = p1.filter(isFl), block = S.require_all && un.length > 0;
  $("#mTitle").textContent = block ? "Jenis 1 belum lengkap" : "Kunci Jenis 1?";
  $("#mInfo").textContent = (un.length ? `${un.length} soal Jenis 1 belum dijawab.${block ? " Semua soal wajib dijawab." : ""} ` : "")
    + (block ? "" : "Setelah dikunci, jawaban Jenis 1 tidak dapat diubah lagi dan halaman Jenis 2 dibuka.");
  $("#mSum").innerHTML = jl("Belum dijawab", un) + jl("Ragu-ragu", fl);
  $("#ckRow").hidden = true; $("#mBtns").hidden = false; $("#mYes").hidden = block; $("#mX").hidden = false;
  $("#mYes").textContent = "Kunci & Lanjut"; $("#mYes").disabled = false;
  $("#mNo").textContent = block ? "Lanjutkan" : "Kembali"; $("#mErr").textContent = ""; $("#mConfirm").hidden = false;
}
function doLock() {
  ans.lk = 1; $("#mConfirm").hidden = true; touch();
  goPage(BK.sections.findIndex(sc => sc.part === "2"));
}
function showSending(msg) {
  $("#ckRow").hidden = true; $("#mBtns").hidden = true; $("#mX").hidden = true; $("#mSum").innerHTML = ""; $("#mConfirm").hidden = false;
  $("#mTitle").textContent = "Mengirim jawaban";
  $("#mInfo").textContent = msg || "Mengirim jawaban…";
  $("#mErr").textContent = navigator.onLine ? "" : "Tidak ada koneksi. Jawaban aman di perangkat ini dan akan dikirim otomatis saat tersambung. Jangan tutup halaman ini.";
}
function closeModal() { if (!pending) $("#mConfirm").hidden = true; }
$("#mSum").addEventListener("click", e => { const b = e.target.closest("[data-j]"); if (b) { closeModal(); jump(+b.dataset.j); } });
$("#ck").onchange = e => $("#mYes").disabled = !e.target.checked;
$("#mNo").onclick = closeModal; $("#mX").onclick = closeModal;
$("#mYes").onclick = () => { if (mMode === "lock") return doLock(); clearTimeout(saveT); pending = true; writeCache(); lockUI(); showSending(); flush(); };

// ---- selesai: nilai tampil bila trainer mengaktifkan "tampilkan nilai" ----
function showDone() { view("vDone"); window.scrollTo(0, 0); loadResult(); checkRemedial(); }
async function loadResult() {
  if (!attempt || !sb) return;
  try {
    const { data, error } = await sb.rpc("my_result", { p_attempt: attempt.id });
    if (error || !data) return;
    if (data.pending) { $("#doneMsg").textContent = "Terima kasih. Sebagian jawaban Anda dinilai oleh trainer; nilai akan tampil di halaman ini setelah penilaian selesai."; return; }
    const pass = data.score >= data.pass_mark, what = data.kind === "clause" ? "soal klausul" : "pilihan ganda";
    const rem = data.remedial ? ` · remidi ke-${data.remedial}${data.raw !== undefined && +data.raw !== +data.score ? ` (nilai remidi ${data.raw})` : ""}` : "";
    $("#doneMsg").textContent = data.manual ? "Terima kasih. Penilaian jawaban Anda telah selesai." : "Terima kasih. Jawaban Anda telah diterima dan dinilai otomatis.";
    $("#result").innerHTML = `<div class="result"><div class="score"><div class="big">${data.score}<small> /100</small></div>
      <div><div class="b">${esc(cat(data.score))}</div><div class="small mut">${data.right} dari ${data.total} ${what} benar · nilai lulus ${data.pass_mark}${rem}</div>
      <div style="margin-top:8px"><span class="badge ${pass ? "b-ok" : "b-bad"}">${pass ? "Lulus" : "Belum lulus"}</span></div></div></div></div>`;
  } catch {}
}
init();
})();
