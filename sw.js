// Menyimpan "cangkang" aplikasi agar halaman peserta tetap bisa dibuka/di-refresh saat koneksi putus.
const C = "exam-shell-v8";
const SHELL = ["./", "index.html", "assets/style.css", "assets/icons.js", "assets/config.js", "assets/questions.js", "assets/participant.js", "assets/logo.png"];
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(C).then(c => Promise.allSettled([...SHELL.map(u => c.add(u)), c.add(new Request(CDN, { mode: "no-cors" }))])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (r.url === CDN) { e.respondWith(caches.match(r).then(h => h || fetch(r).then(x => { caches.open(C).then(c => c.put(r, x.clone())); return x; }))); return; }
  if (u.origin !== location.origin || u.pathname.includes("admin")) return;
  e.respondWith(fetch(r).then(x => { if (x.ok) { const y = x.clone(); caches.open(C).then(c => c.put(r, y)); } return x; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || (r.mode === "navigate" ? caches.match("index.html") : undefined))));
});
