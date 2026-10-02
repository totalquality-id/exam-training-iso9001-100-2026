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
  localStorage.setItem(CK, JSON.stringify({ attempt: { id: attempt.id, user_id: attempt.user_id, name: attempt.name, job_title: attempt.job_title, started_at: attempt.started_at }, answers: ans, dirty, pending, done }));
} catch {} };

async function init() {
  $("#sTitle").textContent = E.title; $("#sSub").textContent = E.subtitle;
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
  view("vStart");
}

$("#fStart").addEventListener("submit", async e => {
  e.preventDefault(); $("#sErr").textContent = ""; $("#bStart").disabled = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    const { data, error } = await sb.from("attempts").insert({ name: $("#name").value.trim(), job_title: $("#job").value.trim() }).select().single();
    if (error) throw error;
    attempt = data; startExam({}); writeCache();
  } catch (err) { $("#sErr").textContent = "Gagal memulai (periksa koneksi): " + (err.message || err); $("#bStart").disabled = false; }
});

function startExam(saved) {
  ans = Object.assign({ mc: {}, tf: {}, tfr: {}, txt: {} }, saved || {});
  $("#who").textContent = attempt.name + " · " + attempt.job_title;
  render(); restore(); progress(); view("vExam"); net();
  const end = new Date(attempt.started_at).getTime() + E.minutes * 60000;
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
  for (const k of ["mc", "tf", "tfr", "txt"]) for (const [n, v] of Object.entries((data.answers || {})[k] || {})) if (!(n in ans[k])) { ans[k][n] = v; added = true; }
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
  let h = `<section class="sec" id="secA"><div class="sec-h"><span class="tag">Section A</span><h2>Multiple Choice</h2><p>Pilih satu jawaban paling tepat. (50 poin)</p></div>`;
  E.mc.forEach(([n, q, o]) => {
    h += `<div class="q"><div class="qt"><b>${n}.</b> ${esc(q)}</div><div class="opts">${o.map((t, i) =>
      `<label class="opt"><input type="radio" name="mc${n}" data-k="mc" data-n="${n}" value="${L[i]}"><span class="k">${L[i]}</span><span>${esc(t)}</span></label>`).join("")}</div></div>`;
  });
  h += `</section><section class="sec" id="secB"><div class="sec-h"><span class="tag">Section B</span><h2>True / False + Reasoning</h2><p>Tentukan Benar atau Salah, lalu berikan alasan. (10 poin)</p></div>`;
  E.tf.forEach(([n, q]) => {
    h += `<div class="q"><div class="qt"><b>${n}.</b> ${esc(q)}</div><div class="tf">
      <label class="opt"><input type="radio" name="tf${n}" data-k="tf" data-n="${n}" value="B"><span class="k">B</span><span>Benar</span></label>
      <label class="opt"><input type="radio" name="tf${n}" data-k="tf" data-n="${n}" value="S"><span class="k">S</span><span>Salah</span></label></div>
      <textarea data-k="tfr" data-n="${n}" rows="2" placeholder="Alasan Anda…"></textarea></div>`;
  });
  h += `</section><section class="sec" id="secC"><div class="sec-h"><span class="tag">Section C</span><h2>Case Analysis</h2><p>Jawab berdasarkan analisis kasus. Yang dinilai adalah ketepatan reasoning dan penerapan, bukan redaksi baku. (20 poin)</p></div>`;
  E.cases.forEach((c, i) => {
    h += `<div class="case"><h3>Case ${i + 1} — ${esc(c.title)}</h3><div class="scn">${esc(c.scenario)}</div>`;
    c.qs.forEach(([n, q]) => h += `<div class="q"><div class="qt"><b>${n}.</b> ${esc(q)}</div><textarea data-k="txt" data-n="${n}" placeholder="Jawaban Anda…"></textarea></div>`);
    h += `</div>`;
  });
  h += `</section><section class="sec" id="secD"><div class="sec-h"><span class="tag">Section D</span><h2>Integrated Transition Case</h2><p>Analisis kasus terpadu berikut. (20 poin)</p></div>
    <div class="case"><h3>${esc(E.integrated.title)}</h3><div class="scn">${esc(E.integrated.scenario)}</div>`;
  E.integrated.qs.forEach(([n, lb, q]) => h += `<div class="q"><div class="qt"><b>${n}. ${esc(lb.toUpperCase())}</b> — ${esc(q)}</div><textarea data-k="txt" data-n="${n}" placeholder="Jawaban Anda…"></textarea></div>`);
  h += `</div></section><div class="submitbar"><span class="mut small">Periksa kembali jawaban Anda sebelum mengirim. Setelah dikirim, jawaban tidak dapat diubah.</span><button class="btn" id="bSubmit">Kirim Jawaban</button></div>`;
  $("#exam").innerHTML = h;
  $("#exam").addEventListener("input", onChange); $("#exam").addEventListener("change", onChange);
  $("#bSubmit").onclick = openConfirm;
}
function restore() {
  document.querySelectorAll("#exam [data-k]").forEach(el => {
    const v = (ans[el.dataset.k] || {})[el.dataset.n];
    if (el.type === "radio") el.checked = v === el.value; else if (v !== undefined && el.value !== v) el.value = v;
  });
}
function onChange(e) {
  const el = e.target, k = el.dataset.k; if (!k || done) return;
  if (el.type === "radio" && !el.checked) return;
  ans[k][el.dataset.n] = el.value; dirty = true; writeCache(); progress();   // simpan lokal seketika
  setSt("menyimpan…"); clearTimeout(saveT); saveT = setTimeout(flush, 1200);
}
function count() {
  const f = o => Object.values(o || {}).filter(v => String(v).trim()).length;
  return f(ans.mc) + f(ans.tf) + f(ans.txt);
}
const SEC = { A: E.mc.map(x => x[0]), B: E.tf.map(x => x[0]), C: E.cases.flatMap(c => c.qs.map(x => x[0])), D: E.integrated.qs.map(x => x[0]) };
const SRC = { A: "mc", B: "tf", C: "txt", D: "txt" };
function progress() {
  const c = count(); $("#pCount").textContent = c; $("#pBar").style.width = (c / E.total * 100) + "%";
  document.querySelectorAll(".pill").forEach(p => {
    const s = p.dataset.s, n = SEC[s].filter(i => String((ans[SRC[s]] || {})[i] ?? "").trim()).length;
    p.querySelector("em").textContent = n + "/" + SEC[s].length; p.classList.toggle("full", n === SEC[s].length);
  });
  document.querySelectorAll("#exam .q").forEach(q => {
    const t = q.querySelector("textarea[data-k=txt]"), r = q.querySelector("input[type=radio]");
    q.classList.toggle("done", !!(r ? q.querySelector("input:checked") : t && t.value.trim()));
  });
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
