(() => {
const E = window.EXAM, CFG = window.APP_CONFIG, L = "ABCD", CK = "exam-cache";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let sb, attempt, ans, saveT, tick, loop, dirty = false, pending = false, saving = false, done = false;

const view = id => document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== id);
const fatal = (m, title, reload) => { $("#fatalTitle").textContent = title || "Konfigurasi belum lengkap"; $("#fatalMsg").textContent = m; $("#bReload").hidden = !reload; view("vFatal"); };
const setSt = t => $("#saveSt").textContent = t;

// ---- cache lokal: salinan jawaban di perangkat, aman dari refresh & putus koneksi ----
const readCache = () => { try { return JSON.parse(localStorage.getItem(CK)); } catch { return null; } };
const writeCache = () => { try {
  localStorage.setItem(CK, JSON.stringify({ attempt: { id: attempt.id, user_id: attempt.user_id, name: attempt.name, job_title: attempt.job_title, copart: attempt.copart, batch_id: attempt.batch_id, duration_minutes: attempt.duration_minutes, started_at: attempt.started_at }, answers: ans, dirty, pending, done }));
} catch {} };

async function init() {
  $("#sTitle").textContent = E.title; $("#sSub").textContent = E.training;
  $("#mQ").textContent = E.total; $("#mT").textContent = E.minutes; $("#pTotal").textContent = E.total;
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("GANTI")) return fatal("Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada assets/config.js.");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { storageKey: "exam-participant" } });
  const { data: { session } } = await sb.auth.getSession();
  const c = readCache();
  if (session && c && c.attempt && c.attempt.user_id === session.user.id) {          // lanjut dari perangkat ini, tanpa butuh internet
    attempt = c.attempt; dirty = !!c.dirty; pending = !!c.pending; done = !!c.done;
    if (done) return view("vDone");
    startExam(c.answers); if (pending) showSending(); syncFromServer(); return;
  }
  if (session) {                                                                      // perangkat/cache baru: ambil dari server
    const { data, error } = await sb.from("attempts").select("*").eq("user_id", session.user.id).order("started_at", { ascending: false }).limit(1);
    if (error) return fatal("Tidak dapat terhubung ke server. Jawaban Anda aman; periksa koneksi lalu muat ulang halaman ini.", "Koneksi terputus", true);
    if (data && data[0]) { attempt = data[0]; if (attempt.status !== "in_progress") { done = true; writeCache(); return view("vDone"); } startExam(attempt.answers); writeCache(); return; }
  }
  view("vStart"); showCode();
  const k = new URLSearchParams(location.search).get("kode");
  if (k) { $("#code").value = k.replace(/\D/g, "").slice(0, 6); lookup(k); }
}

let batch = null;
function showCode() { batch = null; $("#mT").textContent = E.minutes; $("#sSub").textContent = E.training; $("#fCode").hidden = false; $("#fStart").hidden = true; }
$("#code").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6));
$("#fCode").addEventListener("submit", e => { e.preventDefault(); lookup($("#code").value); });
$("#bChange").onclick = e => { e.preventDefault(); showCode(); $("#code").select(); };
async function lookup(raw) {
  const code = String(raw || "").replace(/\D/g, ""); $("#cErr").textContent = "";
  if (code.length !== 6) return $("#cErr").textContent = "Kode batch terdiri dari 6 angka.";
  $("#bCode").disabled = true;
  const { data, error } = await sb.rpc("get_batch", { p_code: code });
  $("#bCode").disabled = false;
  if (error) return $("#cErr").textContent = "Tidak dapat memeriksa kode. Periksa koneksi lalu coba lagi.";
  if (!data || !data.length) return $("#cErr").textContent = "Kode batch tidak ditemukan. Periksa kembali kode dari trainer.";
  if (!data[0].is_open) return $("#cErr").textContent = "Batch ini sudah ditutup. Hubungi trainer Anda.";
  batch = { code, copart: data[0].copart, minutes: data[0].duration_minutes || E.minutes }; $("#mT").textContent = batch.minutes;
  $("#sSub").textContent = E.training + " — " + batch.copart; $("#copart").value = batch.copart;
  $("#fCode").hidden = true; $("#fStart").hidden = false; $("#name").focus();
}

$("#fStart").addEventListener("submit", async e => {
  e.preventDefault(); $("#sErr").textContent = ""; $("#bStart").disabled = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    const { data, error } = await sb.rpc("join_batch", { p_code: batch.code, p_name: $("#name").value.trim(), p_job: $("#job").value.trim() });
    if (error) throw error;
    attempt = data; startExam({}); writeCache();
  } catch (err) { $("#sErr").textContent = "Gagal memulai: " + (err.message || err); $("#bStart").disabled = false; }
});

function startExam(saved) {
  // Jawaban dari versi soal lama (format berbeda) tidak dipakai agar tidak tercampur dengan kunci yang baru
  const same = !!saved && saved.v === E.version;
  ans = { v: E.version, mc: same ? Object.assign({}, saved.mc) : {} };
  if (saved && !same && Object.keys(saved).length) dirty = true;
  $("#who").textContent = attempt.name + " · " + attempt.job_title + (attempt.copart ? " · " + attempt.copart : "");
  render(); restore(); progress(); view("vExam"); net();
  const end = new Date(attempt.started_at).getTime() + (attempt.duration_minutes || E.minutes) * 60000;   // durasi dari batch; data lama pakai bawaan
  const t = () => {
    const s = Math.max(0, Math.round((end - Date.now()) / 1000));
    $("#timer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    $("#timer").classList.toggle("warn", s < 600);
    if (s === 0 && !pending && !done) { pending = true; writeCache(); showSending("Waktu habis. Jawaban Anda sedang dikirim…"); flush(); }
  };
  t(); tick = setInterval(t, 1000);
  loop = setInterval(() => { if ((dirty || pending) && !saving) flush(); }, 5000);
}

// ---- sinkronisasi dengan server ----
async function syncFromServer() {
  const { data, error } = await sb.from("attempts").select("status,answers").eq("id", attempt.id).maybeSingle();
  if (error || !data) return;
  if (data.status !== "in_progress") return finish();
  let added = false;
  if ((data.answers || {}).v !== E.version) return;
  for (const [n, v] of Object.entries(data.answers.mc || {})) if (!(n in ans.mc)) { ans.mc[n] = v; added = true; }
  if (added) { restore(); progress(); dirty = true; writeCache(); }
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
  done = true; pending = false; dirty = false; clearInterval(tick); clearInterval(loop); clearTimeout(saveT);
  writeCache(); $("#mConfirm").hidden = true; view("vDone"); window.scrollTo(0, 0);
}
const net = () => $("#net").hidden = navigator.onLine;
window.addEventListener("offline", net);
window.addEventListener("online", () => { net(); if (ans && !done) flush(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && ans && !done && (dirty || pending)) flush(); });

// ---- tampilan soal ----
function render() {
  let h = "", pills = "";
  E.areas.forEach((ar, i) => {
    const tot = ar.to - ar.from + 1;
    pills += `<a class="pill" href="#sec${i}" data-s="${i}">${i + 1} · ${esc(ar.short || ar.name)} <em>0/${tot}</em></a>`;
    h += `<section class="sec" id="sec${i}"><div class="sec-h"><span class="tag">Bagian ${i + 1}</span><h2>${esc(ar.name)}</h2><p>Soal ${ar.from}–${ar.to}${i === 0 ? " · Pilih satu jawaban yang paling tepat. Setiap soal bernilai 1 poin." : ""}</p></div>`;
    E.mc.filter(([n]) => n >= ar.from && n <= ar.to).forEach(([n, q, o]) => {
      h += `<div class="q"><div class="qt"><b>${n}.</b> ${esc(q)}</div><div class="opts">${o.map((t, k) =>
        `<label class="opt"><input type="radio" name="mc${n}" data-n="${n}" value="${L[k]}"><span class="k">${L[k]}</span><span>${esc(t)}</span></label>`).join("")}</div></div>`;
    });
    h += `</section>`;
  });
  h += `<div class="submitbar"><span class="mut small">Periksa kembali jawaban Anda sebelum mengirim. Setelah dikirim, jawaban tidak dapat diubah.</span><button class="btn" id="bSubmit">Kirim Jawaban</button></div>`;
  $("#subnav").innerHTML = pills;
  $("#exam").innerHTML = h;
  $("#exam").addEventListener("change", onChange);
  $("#bSubmit").onclick = openConfirm;
}
function restore() {
  document.querySelectorAll("#exam input[type=radio]").forEach(el => { el.checked = ans.mc[el.dataset.n] === el.value; });
}
function onChange(e) {
  const el = e.target; if (!el.dataset.n || done) return;
  if (el.type !== "radio" || !el.checked) return;
  ans.mc[el.dataset.n] = el.value; dirty = true; writeCache(); progress();   // simpan lokal seketika
  setSt("menyimpan…"); clearTimeout(saveT); saveT = setTimeout(flush, 1200);
}
function count() {
  return Object.values(ans.mc || {}).filter(v => String(v).trim()).length;
}
function progress() {
  const c = count(); $("#pCount").textContent = c; $("#pBar").style.width = (c / E.total * 100) + "%";
  document.querySelectorAll(".pill").forEach(p => {
    const ar = E.areas[p.dataset.s], tot = ar.to - ar.from + 1;
    const n = Object.keys(ans.mc).filter(k => +k >= ar.from && +k <= ar.to && String(ans.mc[k]).trim()).length;
    p.querySelector("em").textContent = n + "/" + tot; p.classList.toggle("full", n === tot);
  });
  document.querySelectorAll("#exam .q").forEach(q => q.classList.toggle("done", !!q.querySelector("input:checked")));
}

// ---- kirim jawaban ----
function openConfirm() {
  const left = E.total - count();
  $("#mInfo").textContent = left ? `Masih ada ${left} soal yang belum dijawab. Soal kosong dinilai 0.` : "Semua soal sudah terjawab.";
  $("#ckRow").hidden = false; $("#mBtns").hidden = false;
  $("#ck").checked = false; $("#mYes").disabled = true; $("#mErr").textContent = ""; $("#mConfirm").hidden = false;
}
function showSending(msg) {
  $("#ckRow").hidden = true; $("#mBtns").hidden = true; $("#mConfirm").hidden = false;
  $("#mInfo").textContent = msg || "Mengirim jawaban…";
  $("#mErr").textContent = navigator.onLine ? "" : "Tidak ada koneksi. Jawaban Anda aman di perangkat ini dan akan dikirim otomatis saat tersambung. Jangan tutup halaman ini.";
}
$("#ck").onchange = e => $("#mYes").disabled = !e.target.checked;
$("#mNo").onclick = () => $("#mConfirm").hidden = true;
$("#mYes").onclick = () => { clearTimeout(saveT); pending = true; writeCache(); showSending(); flush(); };
init();
})();
