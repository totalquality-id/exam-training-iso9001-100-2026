# Panduan Setup — Total Quality Training Exam (ISO 9001:2026)

Aplikasi statis (HTML/JS) + Supabase. Tidak ada server yang perlu Anda kelola. Satu aplikasi dan satu database melayani **dua bank soal** yang dipilih per batch:

| Bank soal | Isi | Penilaian | Durasi bawaan |
|---|---|---|---|
| **100 soal pilihan ganda** | 100 PG dalam 9 area | Otomatis, 1 poin per soal | 90 menit |
| **50 soal campuran** | A: 25 PG · B: 5 benar/salah + alasan · C: 5 studi kasus · D: kasus terpadu | PG & benar/salah otomatis; alasan dan studi kasus dinilai trainer dengan rubrik | 75 menit |

## Untuk instalasi yang sudah berjalan — yang perlu dilakukan sekarang
Jalankan di Supabase → **SQL Editor** (semua aman dijalankan ulang; data peserta & batch tidak dihapus):
1. `supabase/settings.sql` — pengaturan per batch, termasuk **pilihan bank soal**, dan fungsi nilai untuk peserta. **Jalankan ulang walaupun sudah pernah**, karena fungsi `my_result` diperbarui agar mendukung bank 50 soal.
2. `supabase/bank_mix50.sql` — kunci jawaban & rubrik bank 50 soal (disimpan sebagai baris kedua tabel `grading_config`).
3. Deploy ulang situs (Vercel otomatis setelah push), lalu login ulang di `admin.html`.

Setelah itu, **Batch Baru → Bank soal** menampilkan kedua pilihan. Selama `bank_mix50.sql` belum dijalankan, pilihan 50 soal nonaktif dan tab Batch menampilkan peringatan.

## Isi paket
| File | Fungsi |
|---|---|
| `index.html` | Halaman peserta (bagikan tautan ini) |
| `admin.html` | Konsol trainer (jangan dibagikan) |
| `assets/config.js` | **Tempat Anda mengisi kredensial Supabase** |
| `assets/questions.js` | Bank soal 100 pilihan ganda (tanpa kunci) |
| `assets/questions-mix50.js` | Bank soal 50 soal campuran (tanpa kunci & rubrik) |
| `assets/banks.js` | Daftar bank soal; menyeragamkan struktur kedua bank untuk halaman peserta & admin |
| `assets/icons.js` | Ikon yang dipakai halaman peserta & admin |
| `assets/logo.png` | **Logo Anda** (lihat bagian Logo) |
| `sw.js` | Menyimpan aplikasi di browser agar bisa di-refresh saat offline |
| `supabase/schema.sql` | Tabel, keamanan (RLS), kunci jawaban bank 100 soal |
| `supabase/batch.sql` | Fitur batch per Copart |
| `supabase/settings.sql` | Pengaturan ujian per batch (bank soal, jadwal, acak soal/pilihan, nilai lulus, tampilkan nilai, wajib jawab semua) |
| `supabase/bank_mix50.sql` | Kunci jawaban & rubrik bank 50 soal campuran |
| `supabase/update_questions.sql` | Mengganti kunci bank 100 soal (untuk instalasi lama) |

## Instalasi baru
### Langkah 1 — Buat project Supabase
1. Masuk ke https://supabase.com → **New project**. Simpan database password Anda.
2. Tunggu project selesai dibuat.

### Langkah 2 — Atur Authentication
1. **Authentication → Sign In / Providers** → aktifkan **Allow anonymous sign-ins** (peserta tidak perlu akun, tetapi jawabannya tetap terikat ke satu sesi).
2. **Authentication → Users → Add user → Create new user**: isi email & password admin, centang **Auto Confirm User**. Email ini yang dipakai login di `admin.html`.

### Langkah 3 — Jalankan SQL (urut)
1. Buka `supabase/schema.sql`, pastikan email admin di bagian `insert into public.admins` sama dengan email dari Langkah 2.
2. Supabase → **SQL Editor → New query** → tempel seluruh isi file → **Run**. Harus muncul "Success".
3. Jalankan dengan cara yang sama, berurutan: `supabase/batch.sql` → `supabase/settings.sql` → `supabase/bank_mix50.sql`.
4. Cek di **Table Editor**: ada tabel `attempts`, `batches`, `grading_config` (2 baris), `admins`.

> Kunci jawaban, pembahasan, dan rubrik tersimpan di tabel `grading_config` dan hanya bisa dibaca akun admin. Peserta tidak dapat melihatnya lewat browser.

### Langkah 4 — Isi kredensial
1. Supabase → **Project Settings → API** (atau tombol **Connect**).
2. Salin **Project URL** dan **anon / public key** ke `assets/config.js`.
3. **Jangan pernah** memakai `service_role` key di file ini.

### Langkah 5 — Publikasikan
Pilih salah satu hosting statis (gratis): Vercel, Netlify, Cloudflare Pages, atau GitHub Pages. Upload seluruh isi folder ini.
- Peserta: `https://domain-anda/` (atau `index.html`)
- Trainer: `https://domain-anda/admin.html`

### Langkah 6 — Uji sebelum dipakai
1. Buat **dua batch uji**: satu dengan bank 100 soal, satu dengan bank 50 soal.
2. Untuk masing-masing, buka tautan peserta, isi beberapa jawaban (termasuk esai pada bank 50 soal), tutup tab, buka lagi (harus lanjut dari posisi terakhir), lalu kirim.
3. Di `admin.html`: peserta bank 100 soal langsung **Selesai** dengan nilai; peserta bank 50 soal berstatus **Perlu dinilai**. Buka detailnya, isi rubrik sampai lengkap, pastikan status berubah menjadi **Selesai**. Coba **Ekspor Excel**.
4. Hapus data uji lewat tombol **Hapus peserta** dan hapus batch uji.

## Memilih bank soal per batch
1. Tab **Batch → Batch Baru** (atau **Pengaturan** pada kartu batch).
2. Pilih **Bank soal**. Durasi otomatis menyesuaikan (90 menit untuk 100 soal, 75 menit untuk 50 soal) selama Anda belum mengubahnya.
3. Bank soal tercatat di data peserta saat ia menekan **Mulai Ujian**. Mengganti bank pada batch yang sudah berjalan hanya berlaku untuk peserta berikutnya; peserta yang sudah mulai tetap memakai bank lamanya.
4. Kartu batch dan judul halaman Peserta menampilkan bank soal yang dipakai.

## Alur penilaian bank 50 soal
1. Setelah peserta mengirim, bagian otomatis langsung dihitung (A: 2 poin per PG, B: 1 poin per benar/salah yang tepat — maksimal 55 poin). Status peserta **Perlu dinilai**.
2. Daftar Peserta menampilkan **"Menunggu penilaian · otomatis x/55 · rubrik y/19"**. Gunakan filter **Perlu dinilai** atau lihat penanda di menu samping.
3. Buka detail peserta → bagian **Jawaban & penilaian**, pilih tab:
   - **A · Multiple Choice** — jawaban, kunci, dan hasil per soal (otomatis).
   - **B · True/False + Reasoning** — jawaban B/S (otomatis) dan alasan peserta; beri skor alasan 0–1.
   - **C · Case Analysis** — skenario, jawaban tiap kasus, dan kriteria rubrik; beri skor 0–4 per kasus.
   - **D · Integrated Transition Case** — skenario terpadu dan jawaban No. 41–50; beri skor sesuai rubrik (No. 50 tanpa bobot).
4. **Setiap perubahan skor tersimpan otomatis.** Bar di bawah menampilkan jumlah item rubrik terisi (19 item) dan nilai sementara.
5. Begitu ke-19 item terisi, status otomatis menjadi **Selesai**, nilai akhir dan status lulus muncul, dan peserta ikut dihitung dalam rata-rata dan kelulusan. Mengosongkan salah satu skor mengembalikan status ke **Perlu dinilai**.
6. Gunakan **Sebelumnya / Berikutnya** (atau tombol ← →) untuk berpindah antar peserta dengan cepat; filter **Perlu dinilai** membuat urutan ini hanya berisi peserta yang belum dinilai.
7. Detail juga menampilkan rincian per bagian (A/B/C/D), Knowledge (/60) · Application (/20) · Transition (/20), peringatan bila Application < 60% meskipun total ≥ 70, serta rekomendasi workshop remedial.
8. Jika **Tampilkan nilai ke peserta** aktif, peserta melihat pesan "nilai akan tampil setelah penilaian selesai"; setelah status **Selesai**, nilai muncul saat peserta membuka ulang halaman.

## Data peserta lama
Peserta yang dulu mengerjakan bank 50 soal sebelum sistem ini (sebelumnya tertulis **"Soal versi lama"**) kini dikenali otomatis sebagai bank 50 soal, berstatus **Perlu dinilai**, dan bisa dinilai dengan rubrik seperti biasa — setelah `bank_mix50.sql` dijalankan. Skor rubrik yang dulu sudah diisi tetap terbaca.

## Batch per Copart
1. Tab **Batch → Batch Baru**: isi nama Copart, bank soal, durasi, dan pengaturan lain; klik **Buat Batch**. Muncul kode 6 angka, misalnya `482915`.
2. Bagikan **kode** atau **tautan** (tombol Salin tautan; peserta langsung masuk dengan kode terisi, misalnya `https://domain-anda/?kode=482915`).
3. Peserta memasukkan kode → melihat nama Copart, jumlah soal, dan durasi → mengisi nama dan jabatan.
4. **Tutup batch** menghentikan pendaftaran peserta baru. Peserta yang sudah mulai tetap bisa menyelesaikan ujiannya.
5. Pilihan **Batch** di menu samping membatasi daftar, statistik, analisis, dan **Ekspor Excel** ke satu Copart.
6. **Hapus batch** hanya menghapus kodenya. Data peserta tetap tersimpan dengan nama Copart-nya.

## Pengaturan ujian per batch
| Pengaturan | Keterangan |
|---|---|
| Bank soal | 100 soal pilihan ganda atau 50 soal campuran. |
| Durasi | 5–600 menit (tombol cepat 45/60/90/120/150). |
| Nilai minimal lulus | 0–100, bawaan 70. Dipakai untuk status **Lulus / Belum lulus** di konsol, Excel, dan hasil peserta. |
| Dibuka mulai / Ditutup pada | Opsional. Di luar rentang ini peserta tidak bisa **mulai**; yang sudah mulai tetap bisa menyelesaikan. |
| Acak urutan soal | Soal pilihan ganda diacak di dalam tiap bagian, berbeda per peserta tetapi tetap sama saat halaman dibuka ulang. Benar/salah dan studi kasus tidak diacak. Di konsol admin soal selalu memakai nomor bank soal. |
| Acak pilihan jawaban | Urutan A–D diacak per peserta. Pilihan "Semua benar"/"Ketiganya" tetap di posisinya, dan soal yang pilihannya merujuk huruf lain (mis. "A dan B") tidak diacak. Penilaian tidak terpengaruh. |
| Tampilkan nilai ke peserta | Bank 100 soal: nilai tampil setelah mengirim. Bank 50 soal: nilai tampil setelah trainer selesai menilai. Dihitung di server; kunci jawaban tidak pernah dikirim ke browser peserta. |
| Wajib menjawab semua soal | Tombol kirim terkunci sampai semua soal (termasuk esai) terjawab. Saat waktu habis jawaban tetap terkirim otomatis. |

Bank soal, durasi, pengacakan, dan wajib jawab semua disalin ke data peserta saat ia menekan **Mulai Ujian**. Nilai lulus, tampilkan nilai, dan jadwal berlaku langsung.

## Mode ujian terkunci (selalu aktif)
- Saat peserta menekan **Mulai Ujian**, halaman masuk **layar penuh**. Jika peserta keluar dari layar penuh, soal langsung tertutup layar kunci dengan sisa waktu dan tombol **Lanjutkan Ujian**; timer tetap berjalan.
- Di Chrome/Edge, tombol Esc dan sebagian pintasan sistem ditahan (Keyboard Lock); Esc harus ditekan lama untuk keluar.
- Teks soal tidak bisa diseleksi, disalin, dicetak, atau diklik kanan. Di kolom jawaban esai peserta bisa mengetik dan menyunting (pilih teks, Ctrl+Z, dsb.), tetapi **tidak bisa menempel (paste)** teks dari luar.
- Setiap keluar halaman, lama di luar, dan keluar layar penuh **dicatat** serta tampil di konsol trainer dan Excel.
- Jika browser peserta tidak mendukung atau menolak layar penuh (mis. iPhone, atau tautan dibuka dari dalam aplikasi chat), ujian tetap bisa dikerjakan dan peserta ditandai **"tanpa layar penuh"**. Sarankan peserta memakai Chrome/Edge di laptop — terutama untuk bank 50 soal yang berisi esai.
- **Batasan:** situs web tidak dapat sepenuhnya mengunci perangkat. Alt+Tab, tombol Windows, Ctrl+Alt+Del, menutup browser, atau memotret layar dengan ponsel tetap mungkin. Untuk penguncian penuh diperlukan aplikasi khusus seperti Safe Exam Browser.

## Tampilan peserta
- Halaman awal hanya berisi logo, judul, kode batch, lalu nama dan jabatan.
- Soal ditampilkan **satu bagian per halaman**. Bank 50 soal: A (PG), B (benar/salah + kolom alasan), C1–C5 (setiap kasus satu halaman dengan skenario di atas), D (kasus terpadu).
- **Panel navigasi soal** (di ponsel: tombol di bawah layar): biru = terjawab, oranye = ragu-ragu, putih = belum. Esai dihitung terjawab bila kolomnya berisi teks.
- Tombol **Ragu-ragu** pada tiap soal; ringkasan sebelum mengirim; pengingat saat sisa waktu 10, 5, dan 1 menit.

## Fitur konsol trainer
- **Navigasi**: menu samping (Peserta, Batch, Analisis soal) dengan pilihan **Batch**. Setiap halaman punya alamat sendiri (mis. `admin.html#/peserta/<id>?batch=<id>`), sehingga Back/Forward, refresh, dan berbagi tautan tetap berfungsi.
- **Detail peserta**: breadcrumb, **Sebelumnya / Berikutnya**, pintasan `/` cari, `Esc` kembali, `←` `→` pindah peserta. Catatan trainer tersimpan otomatis.
- **Peserta yang sedang mengerjakan**: **Tambah waktu** dan **Kirim paksa**.
- **Analisis soal**: per bank soal (bila satu batch/filter berisi dua bank, ada tombol untuk berpindah bank). Persentase benar per area dan per soal (PG dan benar/salah), tingkat kesulitan, sebaran jawaban; untuk bank 50 soal ditambah **rata-rata skor tiap item rubrik**.
- **Excel**: bila data berisi dua bank, sheet dipisah per bank — *Rekap Nilai*, *Detail Jawaban* (termasuk teks esai), *Penilaian Rubrik* (bank 50 soal), dan *Analisis Soal*.

## Cara kerja penilaian
- **Bank 100 soal**: 1 poin per soal, otomatis; total = benar/100 × 100.
- **Bank 50 soal**: A = 2 × PG benar (maks. 50); B = benar/salah tepat (maks. 5) + skor alasan (maks. 5); C = 5 kasus × 4 (maks. 20); D = rubrik No. 41–49 (maks. 20). Total maks. 100.
- Kategori nilai sama untuk kedua bank: EXCELLENT ≥ 90, VERY GOOD / COMPETENT ≥ 80, COMPETENT ≥ 70, NEEDS IMPROVEMENT ≥ 60, selainnya NOT YET COMPETENT.
- Rekomendasi remedial muncul untuk area < 60% (ambang ini dapat diubah di `admin.js`).

## Mengganti atau menambah bank soal
- Soal ada di `assets/questions.js` / `assets/questions-mix50.js`; kunci, pembahasan, dan rubrik ada di `grading_config` (satu baris per bank). Keduanya dihubungkan oleh `version` yang **harus sama** di file soal dan di SQL.
- Jika Anda mengubah isi soal, ubah juga kunci di SQL, naikkan `version` di kedua tempat, lalu jalankan ulang SQL-nya. Jawaban dengan `version` yang tidak dikenal ditandai "Soal versi lama" dan tidak dinilai.
- Bank soal baru dapat ditambahkan dengan mendaftarkannya di `assets/banks.js` dan menambah baris baru di `grading_config` (id berikutnya).

## Logo
Simpan logo Anda sebagai `assets/logo.png` (PNG transparan, lebar ≥ 300 px). Setelah mengganti logo, naikkan angka versi `exam-shell-v9` di `sw.js` (mis. `v10`) agar browser peserta memuat file baru.

## Ketahanan saat koneksi putus
- Setiap perubahan jawaban (termasuk ketikan esai) langsung disimpan di perangkat peserta, lalu disinkronkan ke Supabase otomatis (debounce 1,2 detik, ulang tiap 5 detik jika gagal, dan segera saat koneksi kembali).
- Refresh atau menutup tab di tengah ujian aman: ujian dilanjutkan dari jawaban terakhir dan sisa waktu yang benar, bahkan saat offline.
- Jika koneksi putus saat menekan **Kirim** atau saat waktu habis, jawaban tetap aman dan terkirim otomatis begitu tersambung.
- Syarat: situs di-hosting **HTTPS** dan halaman peserta pernah dibuka sekali saat online. Tetap di perangkat dan browser yang sama saat melanjutkan.

## Batasan yang perlu Anda ketahui
- Timer berjalan di browser peserta (dihitung dari `started_at` yang dicatat server). Kelebihan durasi tetap terlihat di kolom Durasi.
- Peserta yang menghapus data browser saat ujian kehilangan sesi dan dianggap peserta baru; hapus entri ganda dari admin.
- Mode penyamaran/incognito menghapus data saat ditutup, jadi minta peserta tidak memakainya.
- Halaman admin memuat ulang data tiap 10 detik.
- Pencatatan keluar halaman bersifat indikasi (notifikasi sistem atau mengunci layar juga ikut tercatat).

## Pemecahan masalah
| Gejala | Penyebab umum |
|---|---|
| "Anonymous sign-ins are disabled" | Langkah 2.1 belum diaktifkan |
| "Akun ini bukan admin…" saat login | Email di `schema.sql` tidak sama dengan email login, atau SQL belum dijalankan |
| "Kunci jawaban bank 100 soal belum sesuai" | Jalankan `supabase/update_questions.sql` |
| Pilihan bank 50 soal nonaktif / peringatan di tab Batch | Jalankan `supabase/bank_mix50.sql` |
| Peserta bank 50 soal tidak melihat nilai setelah dinilai | Jalankan ulang `supabase/settings.sql` (fungsi `my_result` versi baru), pastikan **Tampilkan nilai** aktif |
| "row-level security" saat peserta mulai | `schema.sql` belum dijalankan penuh |
| Halaman menampilkan "Konfigurasi belum lengkap" | `config.js` masih berisi teks GANTI_… |
