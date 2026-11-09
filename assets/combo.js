// Dropdown dengan pencarian untuk <select> yang daftarnya panjang (filter Copart/Training/Batch, pilihan training, bank soal).
// Elemen <select> asli tetap ada (disembunyikan) dan tetap menjadi sumber nilai: kode lain cukup memakai sel.value,
// sel.innerHTML, sel.disabled, dan event "change" seperti biasa, dan tampilan tombol ikut diperbarui otomatis.
// Pencarian mencocokkan semua kata yang diketik dengan teks opsi, nama grup (optgroup), dan induknya
// (opsi yang menjorok, mis. batch di bawah training), sehingga mengetik nama training juga menampilkan batch-batchnya.
(() => {
const VAL = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const escH = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHEV = `<svg class="ss-chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
let uid = 0, openOne = null;

window.searchSelect = function (sel, opt) {
  if (!sel || sel._ss) return;
  opt = opt || {};
  const id = "ss" + ++uid;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "ss-btn"; btn.id = (sel.id || id) + "-ss";
  btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
  ["aria-label", "aria-describedby"].forEach(a => sel.hasAttribute(a) && btn.setAttribute(a, sel.getAttribute(a)));
  btn.innerHTML = `<span class="ss-v"></span>${CHEV}`;
  sel.after(btn); sel.hidden = true; sel.tabIndex = -1;
  if (sel.id) document.querySelectorAll(`label[for="${sel.id}"]`).forEach(l => l.htmlFor = btn.id);

  const pop = document.createElement("div");
  pop.className = "ss-pop"; pop.hidden = true;
  pop.innerHTML = `<div class="ss-s"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m13.2 13.2 3.3 3.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
    <input type="search" class="ss-q" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="${id}-l" placeholder="${escH(opt.placeholder || "Cari…")}"></div>
    <div class="ss-l" role="listbox" id="${id}-l"></div><div class="ss-f"></div>`;
  document.body.appendChild(pop);
  const q = pop.querySelector(".ss-q"), list = pop.querySelector(".ss-l"), foot = pop.querySelector(".ss-f");
  let items = [], shown = [], act = -1;

  // daftar opsi: { o (option), text, lv (tingkat jorok), g (nama grup), hay (teks pencarian), par (induk) }
  function read() {
    items = []; const stack = [];
    [...sel.children].forEach(ch => {
      const grp = ch.tagName === "OPTGROUP" ? ch : null;
      if (grp) items.push({ head: true, text: grp.label, hay: norm(grp.label) });
      (grp ? [...grp.children] : [ch]).forEach(o => {
        if (o.tagName !== "OPTION") return;
        const raw = o.textContent, lv = (raw.match(/^\s*/)[0] || "").length, text = raw.trim();
        while (stack.length && stack[stack.length - 1].lv >= lv) stack.pop();
        const par = stack[stack.length - 1] || null;
        const it = { o, text, lv, g: grp ? grp.label : "", par, hay: norm([grp ? grp.label : "", ...stack.map(s => s.text), text].join(" ")) };
        items.push(it); stack.push(it);
      });
      if (grp) stack.length = 0;
    });
  }
  function sync() {
    const o = sel.selectedOptions[0];
    btn.querySelector(".ss-v").textContent = o ? o.textContent.trim() : opt.empty || "-";
    btn.title = o ? o.textContent.trim() : "";
    btn.disabled = sel.disabled;
  }
  function render() {
    const words = norm(q.value).split(" ").filter(Boolean), keep = new Set(), hit = new Set();
    let curHead = null;
    items.forEach(it => {
      if (it.head) { curHead = it; return; }
      if (words.every(w => it.hay.includes(w))) { hit.add(it); keep.add(it); for (let p = it.par; p; p = p.par) keep.add(p); if (curHead) keep.add(curHead); }
    });
    // grup tanpa opsi yang cocok tidak ditampilkan; nama grup yang cocok menampilkan semua opsinya (sudah lewat hay)
    shown = items.filter(it => keep.has(it));
    const cur = VAL.get.call(sel);
    list.innerHTML = shown.map((it, i) => it.head ? `<div class="ss-g" role="presentation">${escH(it.text)}</div>`
      : `<div class="ss-o${it.o.value === cur ? " sel" : ""}${it.o.disabled ? " dis" : ""}" role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${it.o.value === cur}"${it.o.disabled ? ' aria-disabled="true"' : ""} style="padding-left:${12 + Math.min(it.lv, 4) * 14}px">${escH(it.text)}</div>`).join("")
      || `<div class="ss-e">Tidak ada yang cocok dengan “${escH(q.value.trim())}”</div>`;
    const n = shown.filter(it => !it.head).length, tot = items.filter(it => !it.head).length;
    foot.textContent = words.length ? `${n} dari ${tot} pilihan` : `${tot} pilihan · ketik untuk mencari`;
    const selI = shown.findIndex(it => !it.head && it.o.value === cur);
    // saat mencari, sorot hasil yang langsung cocok (bukan induk yang hanya ditampilkan sebagai konteks)
    setAct(words.length ? shown.findIndex(it => hit.has(it) && !it.o.disabled) : selI, !words.length);
  }
  function setAct(i, center) {
    act = i;
    list.querySelectorAll(".ss-o.act").forEach(x => x.classList.remove("act"));
    const el = i >= 0 ? list.querySelector(`[data-i="${i}"]`) : null;
    if (el) { el.classList.add("act"); q.setAttribute("aria-activedescendant", el.id); el.scrollIntoView({ block: center ? "center" : "nearest" }); }
    else q.removeAttribute("aria-activedescendant");
  }
  function move(d) {
    const ok = shown.map((it, i) => !it.head && !it.o.disabled ? i : -1).filter(i => i >= 0);
    if (!ok.length) return;
    const p = ok.indexOf(act);
    setAct(ok[p < 0 ? (d > 0 ? 0 : ok.length - 1) : Math.max(0, Math.min(ok.length - 1, p + d))]);
  }
  function place() {
    const r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = Math.min(vw - 16, Math.max(r.width, opt.minWidth || 300));
    pop.style.width = w + "px";
    pop.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + "px";
    const below = vh - r.bottom - 12, above = r.top - 12, up = below < 260 && above > below;
    const room = Math.max(160, Math.min(420, up ? above : below));
    list.style.maxHeight = Math.max(100, room - 86) + "px";
    pop.style.top = up ? "" : r.bottom + 6 + "px";
    pop.style.bottom = up ? vh - r.top + 6 + "px" : "";
  }
  function open(initial) {
    if (sel.disabled) return;
    if (openOne && openOne !== api) openOne.close();
    openOne = api; read(); q.value = initial || ""; pop.hidden = false; btn.setAttribute("aria-expanded", "true"); btn.classList.add("on");
    place(); render(); q.focus();
  }
  function close(refocus) {
    if (pop.hidden) return;
    pop.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.classList.remove("on");
    if (openOne === api) openOne = null;
    if (refocus) btn.focus();
  }
  function choose(i) {
    const it = shown[i]; if (!it || it.head || it.o.disabled) return;
    const changed = VAL.get.call(sel) !== it.o.value;
    VAL.set.call(sel, it.o.value); sync(); close(true);
    if (changed) sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const api = { open, close, sync, btn, pop };

  btn.addEventListener("click", () => pop.hidden ? open() : close());
  btn.addEventListener("keydown", e => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(e.key); }
  });
  q.addEventListener("input", render);
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); if (act >= 0) choose(act); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (q.value) { q.value = ""; render(); } else close(true); }
    else if (e.key === "Tab") close();
  });
  list.addEventListener("mousedown", e => e.preventDefault());       // fokus tetap di kolom pencarian
  list.addEventListener("click", e => { const o = e.target.closest(".ss-o"); if (o) choose(+o.dataset.i); });
  list.addEventListener("mousemove", e => { const o = e.target.closest(".ss-o:not(.dis)"); if (o && +o.dataset.i !== act) setAct(+o.dataset.i); });
  document.addEventListener("mousedown", e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) close(); });
  window.addEventListener("resize", () => close());
  document.addEventListener("scroll", e => { if (!pop.hidden && !pop.contains(e.target)) place(); }, true);

  // nilai/isi/disabled yang diubah oleh kode lain langsung terlihat di tombol
  Object.defineProperty(sel, "value", { configurable: true, get() { return VAL.get.call(this); }, set(v) { VAL.set.call(this, v); sync(); } });
  new MutationObserver(() => { sync(); if (!pop.hidden) { read(); render(); } }).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
  sel.addEventListener("change", sync);
  sel.focus = () => btn.focus();
  sel._ss = api; sync();
  return api;
};
})();
