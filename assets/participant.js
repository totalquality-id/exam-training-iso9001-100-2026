(() => {
const E = window.EXAM, CFG = window.APP_CONFIG, L = "ABCD", CK = "exam-cache", ic = window.ic;
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let sb, attempt, ans, S = {}, saveT, tick, loop, chk, dirty = false, pending = false, saving = false, done = false;
let page = 0, order = [], disp = {}, opt = {}, secOf = {}, QM = {}, warned = {}, hiddenAt = 0;

const view = id => document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== id);
const fatal = (m, title, reload) => { $("#fatalTitle").textContent = title || "Konfigurasi belum lengkap"; $("#fatalMsg").textContent = m; $("#bReload").hidden = !reload; view("vFatal"); };
const setSt = t => $("#saveSt").textContent = t;
const fmtDT = d => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const cat = t => t >= 90 ? "EXCELLENT" : t >= 80 ? "VERY GOOD / COMPETENT" : t >= 70 ? "COMPETENT" : t >= 60 ? "NEEDS IMPROVEMENT" : "NOT YET COMPETENT";
function toast(msg, kind, icon) {
  const el = document.createElement("div"); el.className = "toast" + (kind ? " " + kind : "");
  el.innerHTML = ic(icon || (kind === "warn" ? "alert" : "info")) + `<span>${esc(msg)}</span>`;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), 6000);
}

// ---- cache lokal: salinan jawaban di perangkat, aman dari refresh & putus koneksi ----
const readCache = () => { try { return JSON.parse(localStorage.getItem(CK)); } catch { return null; } };
const writeCache = () => { try {
  localStorage.setItem(CK, JSON.stringify({ attempt: { id: attempt.id, user_id: attempt.user_id, name: attempt.name, job_title: attempt.job_title, copart: attempt.copart, batch_id: attempt.batch_id, duration_minutes: attempt.duration_minutes, started_at: attempt.started_at, settings: attempt.settings || {} }, answers: ans, dirty, pending, done, page }));
} catch {} };

async function init() {
  $("#sTitle").textContent = E.title; $("#sSub").textContent = E.training; $("#sTag").textContent = E.subtitle || "Ujian online";
  $("#mQ").textContent = E.total; $("#mT").textContent = E.minutes; $("#mS").textContent = E.areas.length; $("#pTotal").textContent = E.total;
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("GANTI")) return fatal("Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada assets/config.js.");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { storageKey: "exam-participant" } });
  const { data: { session } } = await sb.auth.getSession();
  const c = readCache();
  if (session && c && c.attempt && c.attempt.user_id === session.user.id) {          // lanjut dari perangkat ini, tanpa butuh internet
    attempt = c.attempt; dirty = !!c.dirty; pending = !!c.pending; done = !!c.done;
    if (done) return showDone();
    startExam(c.answers, c.page); if (pending) showSending(); syncFromServer(); return;
  }
  if (session) {                                                                      // perangkat/cache baru: ambil dari server
    const { data, error } = await sb.from("attempts").select("*").eq("user_id", session.user.id).order("started_at", { ascending: false }).limit(1);
    if (error) return fatal("Tidak dapat terhubung ke server. Jawaban Anda aman; periksa koneksi lalu muat ulang halaman ini.", "Koneksi terputus", true);
    if (data && data[0]) { attempt = data[0]; if (attempt.status !== "in_progress") { done = true; writeCache(); return showDone(); } startExam(attempt.answers, 0); writeCache(); return; }
  }
  view("vStart"); showCode();
  const k = new URLSearchParams(location.search).get("kode");
  if (k) { $("#code").value = k.replace(/\D/g, "").slice(0, 6); lookup(k); }
}

// ---- kode batch & data peserta ----
let batch = null;
function showCode() { batch = null; $("#mT").textContent = E.minutes; $("#sSub").textContent = E.training; $("#fCode").hidden = false; $("#fStart").hidden = true; }
$("#code").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6));
$("#fCode").addEventListener("submit", e => { e.preventDefault(); lookup($("#code").value); });
$("#bChange").onclick = e => { e.preventDefault(); showCode(); $("#code").select(); };
async function lookup(raw) {
  const code = String(raw || "").replace(/\D/g, ""), err = m => $("#cErr").textContent = m; err("");
  if (code.length !== 6) return err("Kode batch terdiri dari 6 angka.");
  $("#bCode").disabled = true;
  const { data, error } = await sb.rpc("get_batch", { p_code: code });
  $("#bCode").disabled = false;
  if (error) return err("Tidak dapat memeriksa kode. Periksa koneksi lalu coba lagi.");
  if (!data || !data.length) return err("Kode batch tidak ditemukan. Periksa kembali kode dari trainer.");
  const d = data[0], now = Date.now();
  if (!d.is_open) return err("Batch ini sudah ditutup. Hubungi trainer Anda.");
  if (d.open_from && now < new Date(d.open_from).getTime()) return err(`Batch ini baru dibuka pada ${fmtDT(d.open_from)}. Silakan kembali pada waktu tersebut.`);
  if (d.open_until && now > new Date(d.open_until).getTime()) return err("Batch ini sudah ditutup. Hubungi trainer Anda.");
  batch = { code, copart: d.copart, minutes: d.duration_minutes || E.minutes, settings: d.settings || {}, open_until: d.open_until };
  $("#mT").textContent = batch.minutes;
  $("#sSub").textContent = E.training + " — " + batch.copart; $("#copart").value = batch.copart;
  rules(batch);
  $("#fCode").hidden = true; $("#fStart").hidden = false; $("#name").focus();
}
function rules(b) {
  const s = b.settings, r = [
    ["clock", `Durasi <b>${b.minutes} menit</b>, berjalan sejak tombol Mulai Ujian ditekan dan tidak dapat dijeda. Jawaban terkirim otomatis saat waktu habis.`],
    ["layers", `${E.total} soal pilihan ganda dalam ${E.areas.length} bagian, satu bagian per halaman.`],
  ];
  if (s.shuffle_q || s.shuffle_opt) r.push(["shuffle", `${s.shuffle_q && s.shuffle_opt ? "Urutan soal dan pilihan jawaban" : s.shuffle_q ? "Urutan soal" : "Urutan pilihan jawaban"} diacak untuk setiap peserta.`]);
  if (s.require_all) r.push(["check", "Semua soal wajib dijawab sebelum jawaban dapat dikirim."]);
  if (s.track_focus) r.push(["monitor", "Perpindahan ke tab atau aplikasi lain selama ujian <b>dicatat dan dilaporkan</b> ke trainer.", "w"]);
  if (b.open_until) r.push(["calendar", `Pendaftaran batch ditutup pada ${esc(fmtDT(b.open_until))}.`]);
  r.push(["info", "Jawaban tersimpan otomatis. Jika halaman tertutup atau koneksi terputus, buka kembali tautan ini di perangkat yang sama untuk melanjutkan."]);
  $("#rules").innerHTML = r.map(([i, t, c]) => `<li class="${c || ""}">${ic(i)}<span>${t}</span></li>`).join("");
}

$("#fStart").addEventListener("submit", async e => {
  e.preventDefault(); $("#sErr").textContent = ""; $("#bStart").disabled = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    const { data, error } = await sb.rpc("join_batch", { p_code: batch.code, p_name: $("#name").value.trim(), p_job: $("#job").value.trim() });
    if (error) throw error;
    attempt = data; startExam({}, 0); writeCache();
  } catch (err) { $("#sErr").textContent = "Gagal memulai: " + (err.message || err); $("#bStart").disabled = false; }
});

// ---- pengacakan: ditentukan oleh id peserta, sehingga urutannya tetap sama setiap kali halaman dibuka ----
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
function shuffle(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Pilihan seperti "Semua benar" tetap di posisinya; soal yang pilihannya merujuk huruf lain ("A dan B") tidak diacak.
const PIN = /^(semua (jawaban )?benar|ketiganya|keduanya benar|semua di atas)/i, REF = /\b[A-D]\s*(dan|atau|&|,)\s*[A-D]\b/;
function optOrder(n, o) {
  const idx = o.map((_, k) => k);
  if (!S.shuffle_opt || o.some(t => REF.test(t))) return idx;
  const free = idx.filter(k => !PIN.test(o[k].trim())), mixed = shuffle(free, seeded(attempt.id + ":o" + n));
  let f = 0; return idx.map(k => PIN.test(o[k].trim()) ? k : mixed[f++]);
}
function build() {
  QM = {}; E.mc.forEach(([n, q, o]) => QM[n] = { q, o });
  order = E.areas.map((ar, i) => {
    const ns = E.mc.filter(([n]) => n >= ar.from && n <= ar.to).map(([n]) => n);
    const sh = S.shuffle_q ? shuffle(ns, seeded(attempt.id + ":q" + i)) : ns;
    sh.forEach((n, j) => { disp[n] = ns[j]; secOf[n] = i; });            // nomor tampil tetap berurutan di tiap bagian
    return sh;
  });
  E.mc.forEach(([n, , o]) => opt[n] = optOrder(n, o));
}

function startExam(saved, pg) {
  // Jawaban dari versi soal lama (format berbeda) tidak dipakai agar tidak tercampur dengan kunci yang baru
  const same = !!saved && saved.v === E.version;
  ans = { v: E.version, mc: same ? Object.assign({}, saved.mc) : {}, fl: same && Array.isArray(saved.fl) ? saved.fl.map(Number) : [], ev: same && saved.ev ? Object.assign({}, saved.ev) : {} };
  if (saved && !same && Object.keys(saved).length) dirty = true;
  S = attempt.settings || {};
  $("#whoN").textContent = attempt.name; $("#whoM").textContent = attempt.job_title + (attempt.copart ? " · " + attempt.copart : "");
  build(); shell();
  page = Math.min(Math.max(0, pg | 0), E.areas.length - 1);
  renderPage(); progress(); view("vExam"); net(); focusGrid();
  const t = () => {
    const s = Math.max(0, Math.round((endAt() - Date.now()) / 1000));
    $("#timer").textContent = fmtT(s); $("#timerBox").classList.toggle("warn", s < 600);
    for (const m of [10, 5, 1]) if (!warned[m] && s > 0 && s <= m * 60 && s > m * 60 - 60) { warned[m] = true; toast(`Sisa waktu ${m} menit. Periksa kembali jawaban Anda.`, "warn", "clock"); }
    if (s === 0 && !pending && !done) { pending = true; writeCache(); showSending("Waktu habis. Jawaban Anda sedang dikirim…"); flush(); }
  };
  t(); tick = setInterval(t, 1000);
  loop = setInterval(() => { if ((dirty || pending) && !saving) flush(); }, 5000);
  chk = setInterval(checkServer, 30000);
}
const endAt = () => new Date(attempt.started_at).getTime() + (attempt.duration_minutes || E.minutes) * 60000;   // durasi dari batch; data lama pakai bawaan
const fmtT = s => { const p = v => String(v).padStart(2, "0"), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + p(m) : p(m)) + ":" + p(s % 60); };

// ---- sinkronisasi dengan server ----
function applyServer(d) {
  if (d.duration_minutes && d.duration_minutes !== attempt.duration_minutes) {
    const diff = d.duration_minutes - (attempt.duration_minutes || E.minutes);
    attempt.duration_minutes = d.duration_minutes; writeCache();
    toast(diff > 0 ? `Trainer menambah waktu ujian Anda ${diff} menit.` : "Durasi ujian diperbarui oleh trainer.", "ok", "clock");
  }
}
async function syncFromServer() {
  const { data, error } = await sb.from("attempts").select("status,answers,duration_minutes").eq("id", attempt.id).maybeSingle();
  if (error || !data) return;
  if (data.status !== "in_progress") return finish();
  applyServer(data);
  let added = false;
  if ((data.answers || {}).v !== E.version) return;
  for (const [n, v] of Object.entries(data.answers.mc || {})) if (!(n in ans.mc)) { ans.mc[n] = v; added = true; }
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
  writeCache(); $("#mConfirm").hidden = true; closeSide(); showDone();
}
const net = () => $("#net").hidden = navigator.onLine;
window.addEventListener("offline", net);
window.addEventListener("online", () => { net(); if (ans && !done) flush(); });
document.addEventListener("visibilitychange", () => {
  if (!ans || done) return;
  if (document.hidden) {
    if (S.track_focus && !pending) { hiddenAt = Date.now(); ans.ev.blur = (ans.ev.blur || 0) + 1; ans.ev.last = new Date().toISOString(); dirty = true; writeCache(); }
    return;
  }
  if (S.track_focus && hiddenAt && !pending) {
    ans.ev.away = (ans.ev.away || 0) + Math.round((Date.now() - hiddenAt) / 1000); hiddenAt = 0; dirty = true; writeCache();
    toast(`Anda meninggalkan halaman ujian. Tercatat ${ans.ev.blur} kali dan dilaporkan ke trainer.`, "warn", "monitor");
  }
  if (dirty || pending) flush();
});

// ---- tampilan soal: satu bagian per halaman ----
const answered = n => !!String(ans.mc[n] || "").trim();
const isFl = n => ans.fl.includes(+n);
function shell() {
  $("#subnav").innerHTML = E.areas.map((ar, i) => `<button type="button" class="pill" data-p="${i}">${i + 1} · ${esc(ar.short || ar.name)} <em>0/${order[i].length}</em></button>`).join("");
  $("#grid").innerHTML = E.areas.map((ar, i) => `<div class="gsec" data-s="${i}"><div class="gsec-h" data-p="${i}"><span>${i + 1}. ${esc(ar.short || ar.name)}</span><em>0/${order[i].length}</em></div>
    <div class="g">${order[i].map(n => `<button type="button" class="gb" data-n="${n}" title="Soal ${disp[n]}">${disp[n]}</button>`).join("")}</div></div>`).join("");
}
function renderPage() {
  const ar = E.areas[page], ns = order[page], N = E.areas.length, last = page === N - 1;
  let h = `<section><div class="page-h"><div><span class="tag">Bagian ${page + 1} dari ${N}</span><h2>${esc(ar.name)}</h2><p>Soal ${disp[ns[0]]}–${disp[ns[ns.length - 1]]} · ${ns.length} soal</p></div>
    <div class="page-prog"><span><b id="ppC">0</b> / ${ns.length} terjawab</span><div class="pbar"><i id="ppB" style="width:0"></i></div></div></div>
    <div class="inst">${ic("info")}<span>Pilih satu jawaban yang paling tepat; setiap soal bernilai 1 poin. Tandai <b>Ragu-ragu</b> pada soal yang ingin Anda tinjau kembali.</span></div>`;
  ns.forEach(n => {
    const { q, o } = QM[n];
    h += `<article class="q" id="q${n}"><div class="q-top"><span class="qno">Soal ${disp[n]}</span><button type="button" class="flag" data-f="${n}" aria-pressed="false">${ic("flag")}<span>Ragu-ragu</span></button></div>
      <div class="qt">${esc(q)}</div><div class="opts" role="radiogroup">${opt[n].map((k, pos) =>
        `<label class="opt"><input type="radio" name="mc${n}" data-n="${n}" value="${L[k]}"><span class="k">${L[pos]}</span><span>${esc(o[k])}</span></label>`).join("")}</div>
      <div class="q-foot" hidden><button type="button" class="clear" data-c="${n}">Hapus jawaban</button></div></article>`;
  });
  h += `<div class="pager"><button type="button" class="btn ghost" data-go="${page - 1}" ${page === 0 ? "disabled" : ""}>${ic("chevL")}<span>Sebelumnya</span></button>
    <div class="mid">Bagian ${page + 1} dari ${N}<div class="dots">${E.areas.map((_, i) => `<i data-d="${i}"></i>`).join("")}</div></div>
    ${last ? `<button type="button" class="btn" data-submit>${ic("send")}<span>Tinjau &amp; Kirim</span></button>` : `<button type="button" class="btn" data-go="${page + 1}"><span>Berikutnya</span>${ic("chevR")}</button>`}</div></section>`;
  $("#exam").innerHTML = h; restore();
}
function restore() {
  $$("#exam input[type=radio]").forEach(el => { el.checked = ans.mc[el.dataset.n] === el.value; });
}
function goPage(i, n) {
  if (i < 0 || i >= E.areas.length) return;
  const changed = i !== page; page = i;
  if (changed) { renderPage(); writeCache(); }
  progress(); if (changed) focusGrid();
  const pill = $(`.pill[data-p="${i}"]`); if (pill) pill.scrollIntoView({ block: "nearest", inline: "center" });
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
  const el = e.target; if (!el.dataset.n || done || el.type !== "radio" || !el.checked) return;
  ans.mc[el.dataset.n] = el.value; touch();
});
$("#exam").addEventListener("click", e => {
  if (done) return;
  const f = e.target.closest("[data-f]"), c = e.target.closest("[data-c]"), g = e.target.closest("[data-go]");
  if (f) { const n = +f.dataset.f; ans.fl = isFl(n) ? ans.fl.filter(x => x !== n) : [...ans.fl, n]; touch(); }
  else if (c) { delete ans.mc[c.dataset.c]; restore(); touch(); }
  else if (g) goPage(+g.dataset.go);
  else if (e.target.closest("[data-submit]")) openConfirm();
});
$("#subnav").addEventListener("click", e => { const p = e.target.closest("[data-p]"); if (p) goPage(+p.dataset.p); });
$("#grid").addEventListener("click", e => {
  const b = e.target.closest(".gb"), h = e.target.closest("[data-p]");
  if (b) jump(+b.dataset.n); else if (h) { closeSide(); goPage(+h.dataset.p); }
});
const openSide = () => { $("#side").classList.add("open"); $("#scrim").hidden = false; };
const closeSide = () => { $("#side").classList.remove("open"); $("#scrim").hidden = true; };
$("#fab").onclick = openSide; $("#scrim").onclick = closeSide; $("#sideX").onclick = closeSide;
$("#bSubmit").onclick = openConfirm;

function count() {
  return Object.values(ans.mc || {}).filter(v => String(v).trim()).length;
}
function progress() {
  const c = count(), pct = c / E.total * 100;
  $("#pCount").textContent = c; $("#pBar").style.width = pct + "%";
  $("#cA").textContent = c; $("#cF").textContent = ans.fl.length; $("#cU").textContent = E.total - c;
  $("#fabTxt").textContent = `${c}/${E.total} terjawab` + (ans.fl.length ? ` · ${ans.fl.length} ragu` : "");
  const full = order.map(ns => ns.filter(answered).length);
  $$(".pill").forEach(p => { const i = +p.dataset.p, tot = order[i].length; p.querySelector("em").textContent = full[i] + "/" + tot; p.classList.toggle("full", full[i] === tot); p.classList.toggle("on", i === page); });
  $$(".gsec").forEach(s => { const i = +s.dataset.s; s.querySelector("em").textContent = full[i] + "/" + order[i].length; s.classList.toggle("on", i === page); });
  $$(".gb[data-n]").forEach(b => { b.classList.toggle("a", answered(b.dataset.n)); b.classList.toggle("f", isFl(b.dataset.n)); });
  $$("#exam .q").forEach(q => {
    const n = q.id.slice(1), a = answered(n), f = isFl(n), fb = q.querySelector(".flag");
    q.classList.toggle("done", a); q.classList.toggle("fl", f); q.querySelector(".q-foot").hidden = !a;
    fb.classList.toggle("on", f); fb.setAttribute("aria-pressed", f);
  });
  const ns = order[page], pc = full[page];
  if ($("#ppC")) { $("#ppC").textContent = pc; $("#ppB").style.width = (pc / ns.length * 100) + "%"; }
  $$(".dots i").forEach(d => { const i = +d.dataset.d; d.classList.toggle("on", i === page); d.classList.toggle("f", full[i] === order[i].length); });
}

// ---- kirim jawaban ----
const byDisp = ns => [...ns].sort((a, b) => disp[a] - disp[b]);
const jl = (title, ns) => ns.length ? `<div class="jl"><h4>${title} — klik nomor untuk membuka</h4><div class="g">${ns.map(n =>
  `<button type="button" class="gb ${answered(n) ? "a" : ""} ${isFl(n) ? "f" : ""}" data-j="${n}">${disp[n]}</button>`).join("")}</div></div>` : "";
function openConfirm() {
  closeSide();
  const all = order.flat(), un = byDisp(all.filter(n => !answered(n))), fl = byDisp(ans.fl.filter(n => QM[n])), c = count(), block = S.require_all && un.length > 0;
  $("#mTitle").textContent = block ? "Masih ada soal kosong" : "Kirim jawaban?";
  $("#mInfo").textContent = un.length ? `Masih ada ${un.length} soal yang belum dijawab.${block ? "" : " Soal kosong dinilai 0."}` : fl.length ? "Semua soal sudah terjawab, tetapi masih ada soal bertanda ragu-ragu." : "Semua soal sudah terjawab. Setelah dikirim, jawaban tidak dapat diubah.";
  $("#mSum").innerHTML = `<div class="sumrow"><div class="c-a"><b>${c}</b><span>Terjawab</span></div><div class="c-f"><b>${fl.length}</b><span>Ragu-ragu</span></div><div><b>${un.length}</b><span>Belum dijawab</span></div></div>`
    + jl("Belum dijawab", un) + jl("Ditandai ragu-ragu", fl);
  $("#ckRow").hidden = block; $("#mBtns").hidden = false; $("#mYes").hidden = block; $("#mX").hidden = false;
  $("#mNo").textContent = block ? "Lanjutkan mengerjakan" : "Kembali";
  $("#mErr").textContent = block ? "Trainer mewajibkan semua soal dijawab sebelum jawaban dapat dikirim." : "";
  $("#ck").checked = false; $("#mYes").disabled = true; $("#mConfirm").hidden = false;
}
function showSending(msg) {
  $("#ckRow").hidden = true; $("#mBtns").hidden = true; $("#mX").hidden = true; $("#mSum").innerHTML = ""; $("#mConfirm").hidden = false;
  $("#mTitle").textContent = "Mengirim jawaban";
  $("#mInfo").textContent = msg || "Mengirim jawaban…";
  $("#mErr").textContent = navigator.onLine ? "" : "Tidak ada koneksi. Jawaban Anda aman di perangkat ini dan akan dikirim otomatis saat tersambung. Jangan tutup halaman ini.";
}
const closeModal = () => { if (!pending) $("#mConfirm").hidden = true; };
$("#mSum").addEventListener("click", e => { const b = e.target.closest("[data-j]"); if (b) { closeModal(); jump(+b.dataset.j); } });
$("#ck").onchange = e => $("#mYes").disabled = !e.target.checked;
$("#mNo").onclick = closeModal; $("#mX").onclick = closeModal;
$("#mYes").onclick = () => { clearTimeout(saveT); pending = true; writeCache(); showSending(); flush(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSide(); closeModal(); } });

// ---- selesai: nilai tampil bila trainer mengaktifkan "tampilkan nilai" ----
function showDone() { view("vDone"); window.scrollTo(0, 0); loadResult(); }
async function loadResult() {
  if (!attempt || !sb) return;
  try {
    const { data, error } = await sb.rpc("my_result", { p_attempt: attempt.id });
    if (error || !data) return;
    const pass = data.score >= data.pass_mark;
    $("#doneMsg").textContent = "Terima kasih. Jawaban Anda telah diterima dan dinilai otomatis. Anda dapat menutup halaman ini.";
    $("#result").innerHTML = `<div class="card result"><div class="score"><div class="ring" style="--p:${data.score}"><div><div><b>${data.score}</b><br><span>dari 100</span></div></div></div>
      <div><div class="small mut">Nilai Anda</div><h2 style="margin:4px 0 10px">${esc(cat(data.score))}</h2>
      <div class="chips"><span class="badge ${pass ? "b-ok" : "b-bad"}">${pass ? "Lulus" : "Belum lulus"}</span><span class="chip">${data.right}/${data.total} benar</span><span class="chip">Nilai lulus ${data.pass_mark}</span></div></div></div></div>`;
  } catch {}
}
init();
})();
