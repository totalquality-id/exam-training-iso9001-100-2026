# Panduan Setup — Final Assessment ISO 9001:2026

Aplikasi statis (HTML/JS) + Supabase. Tidak ada server yang perlu Anda kelola.

## Isi paket
| File | Fungsi |
|---|---|
| `index.html` | Halaman peserta (bagikan tautan ini) |
| `admin.html` | Konsol trainer (jangan dibagikan) |
| `assets/config.js` | **Tempat Anda mengisi kredensial Supabase** |
| `assets/questions.js` | Bank soal: 100 butir pilihan ganda (tanpa kunci) |
| `assets/icons.js` | Ikon yang dipakai halaman peserta & admin |
| `assets/logo.png` | **Logo Anda** (letakkan sendiri; lihat bagian Logo) |
| `sw.js` | Menyimpan aplikasi di browser agar bisa di-refresh saat offline |
| `supabase/schema.sql` | Tabel, keamanan (RLS), kunci jawaban & pembahasan |
| `supabase/batch.sql` | Fitur batch per Copart |
| `supabase/settings.sql` | Pengaturan ujian per batch (jadwal, acak soal/pilihan, nilai lulus, tampilkan nilai, wajib jawab semua, pantau tab) |
| `supabase/update_questions.sql` | Mengganti kunci jawaban ke bank soal 100 PG (untuk instalasi yang sudah berjalan) |

## Langkah 1 — Buat project Supabase
1. Masuk ke https://supabase.com → **New project**. Simpan database password Anda.
2. Tunggu project selesai dibuat.

## Langkah 2 — Atur Authentication
1. **Authentication → Sign In / Providers** → aktifkan **Allow anonymous sign-ins** (dipakai agar peserta tidak perlu akun, tetapi jawabannya tetap terikat ke satu sesi).
2. **Authentication → Users → Add user → Create new user**: isi email & password admin, centang **Auto Confirm User**. Email ini yang nanti dipakai login di `admin.html`.

## Langkah 3 — Jalankan skema database
1. Buka `supabase/schema.sql`, **ganti `GANTI_EMAIL_ADMIN@perusahaan.com`** dengan email admin dari Langkah 2.
2. Supabase → **SQL Editor → New query** → tempel seluruh isi file → **Run**. Harus muncul "Success".
3. Cek di **Table Editor**: ada tabel `attempts`, `grading_config`, `admins`.
4. Jalankan juga `supabase/batch.sql`, lalu `supabase/settings.sql` (urutan ini; keduanya aman diulang).

> Kunci jawaban dan pembahasan tersimpan di tabel `grading_config` dan hanya bisa dibaca akun admin. Peserta tidak dapat melihatnya lewat browser.

> **Sudah pernah menjalankan `schema.sql` sebelumnya?** Cukup jalankan `supabase/batch.sql` (aman dijalankan ulang). Data peserta lama tetap utuh dan tampil sebagai "Tanpa batch".

> **Fitur durasi per batch memerlukan `supabase/batch.sql` dijalankan ulang** (aman diulang; instalasi lama cukup file ini).

> **Instalasi yang sudah berjalan: WAJIB jalankan `supabase/settings.sql`** (setelah `batch.sql`, aman diulang) untuk mengaktifkan pengaturan ujian per batch. Data peserta & batch tidak berubah; batch lama otomatis memakai pengaturan standar (tanpa pengacakan, nilai lulus 70). Selama file ini belum dijalankan, admin tetap bisa membuat batch (nama, keterangan, durasi) dan menampilkan peringatan di tab **Batch**.

> **Instalasi lama yang sekarang memakai bank soal 100 pilihan ganda: WAJIB jalankan `supabase/update_questions.sql`** di SQL Editor (aman dijalankan ulang). Tanpa ini, halaman admin menolak login dengan pesan bahwa kunci jawaban belum diperbarui. File ini hanya mengganti kunci jawaban; data peserta dan batch tidak disentuh. Peserta yang dikerjakan dengan bank soal lama ditandai **"Soal versi lama"** dan tidak ikut dinilai/dirata-rata; hapus bila hanya data uji.

## Langkah 4 — Isi kredensial
1. Supabase → **Project Settings → API** (atau tombol **Connect**).
2. Salin **Project URL** dan **anon / public key** ke `assets/config.js`.
3. **Jangan pernah** memakai `service_role` key di file ini.

## Langkah 5 — Publikasikan
Pilih salah satu hosting statis (gratis): Netlify (drag & drop folder), Cloudflare Pages, Vercel, atau GitHub Pages. Upload seluruh isi folder ini.
- Peserta: `https://domain-anda/index.html`
- Trainer: `https://domain-anda/admin.html`

## Langkah 6 — Uji sebelum dipakai
1. Buka `index.html`, isi nama & jabatan, jawab beberapa soal, tutup tab, buka lagi (harus lanjut dari posisi terakhir), lalu kirim.
2. Buka `admin.html`, login, pastikan peserta uji muncul dengan nilai otomatis, buka detail (kunci, jawaban, pembahasan, rincian per area), lalu **Ekspor Excel**.
3. Hapus data uji lewat tombol **Hapus peserta**.

## Batch per Copart
1. Di `admin.html` buka tab **Batch**, isi nama Copart, **durasi pengerjaan (menit, 5–600; bawaan 90)**, dan keterangan bila perlu, klik **Buat Batch**. Muncul kode 6 angka, misalnya `482915`.
2. Bagikan **kode** atau **tautan** (tombol Salin tautan; peserta langsung masuk dengan kode terisi, misalnya `https://domain-anda/?kode=482915`).
3. Peserta membuka halaman peserta → memasukkan kode → melihat nama Copart pada judul ("Training ISO 9001:2026 — nama Copart") → mengisi nama dan jabatan; kolom Copart terisi otomatis dan tidak bisa diubah.
4. Durasi ditampilkan ke peserta setelah memasukkan kode, dan disalin ke data peserta saat ia menekan **Mulai Ujian**. Mengubah durasi tidak berlaku mundur untuk peserta yang sudah mulai. Peserta lama (sebelum fitur ini) memakai durasi bawaan di `questions.js`.
5. **Tutup batch** menghentikan pendaftaran peserta baru. Peserta yang sudah mulai tetap bisa menyelesaikan ujiannya.
6. Di tab **Peserta**, filter **Semua batch** membatasi daftar, statistik, dan **Ekspor Excel** ke satu Copart. Excel memuat kolom Copart dan Kode Batch di setiap sheet; nama file memuat nama Copart.
7. **Hapus batch** hanya menghapus kodenya. Data peserta tetap tersimpan dengan nama Copart-nya.

## Pengaturan ujian per batch
Klik **Batch Baru** atau tombol **Pengaturan** pada kartu batch:

| Pengaturan | Keterangan |
|---|---|
| Durasi | 5–600 menit (tombol cepat 45/60/90/120/150). |
| Nilai minimal lulus | 0–100, bawaan 70. Dipakai untuk status **Lulus / Belum lulus** di konsol, Excel, dan hasil peserta. |
| Dibuka mulai / Ditutup pada | Opsional. Di luar rentang ini peserta tidak bisa **mulai**; yang sudah mulai tetap bisa menyelesaikan. Status kartu: Dibuka, Terjadwal, Jadwal berakhir, Ditutup. |
| Acak urutan soal | Diacak di dalam tiap bagian, berbeda per peserta tetapi tetap sama saat halaman dibuka ulang. Nomor yang tampil ke peserta tetap 1, 2, 3…; di konsol admin soal selalu memakai nomor bank soal. |
| Acak pilihan jawaban | Urutan A–D diacak per peserta. Pilihan "Semua benar"/"Ketiganya" tetap di posisinya, dan soal yang pilihannya merujuk huruf lain (mis. "A dan B") tidak diacak. Penilaian tidak terpengaruh. |
| Tampilkan nilai ke peserta | Setelah mengirim, peserta melihat nilai, jumlah benar, kategori, dan status lulus. Dihitung di server; kunci jawaban tidak pernah dikirim ke browser peserta. Bisa diaktifkan belakangan — peserta cukup memuat ulang halaman. |
| Wajib menjawab semua soal | Tombol kirim terkunci sampai semua soal terjawab. Saat waktu habis jawaban tetap terkirim otomatis. |

Durasi, pengacakan, dan wajib jawab semua disalin ke data peserta saat ia menekan **Mulai Ujian** (perubahan berlaku untuk peserta berikutnya). Nilai lulus, tampilkan nilai, dan jadwal berlaku langsung.

## Mode ujian terkunci (selalu aktif)
- Saat peserta menekan **Mulai Ujian**, halaman masuk **layar penuh**. Jika peserta keluar dari layar penuh (Esc, dsb.), soal langsung tertutup layar kunci dengan sisa waktu dan tombol **Lanjutkan Ujian**; timer tetap berjalan. Setelah halaman dimuat ulang, peserta juga harus menekan tombol ini untuk kembali ke layar penuh.
- Di Chrome/Edge, tombol Esc dan sebagian pintasan sistem ditahan (Keyboard Lock); Esc harus ditekan lama untuk keluar.
- Soal tidak bisa diseleksi, disalin, dipotong, ditempel, diseret, atau dicetak; klik kanan serta pintasan Ctrl/Alt/Cmd, F1–F12, dan PrintScreen diblokir. Peringatan muncul jika peserta mencoba menutup/memuat ulang halaman.
- Setiap keluar halaman (pindah tab/aplikasi), lama di luar, dan keluar layar penuh **dicatat** serta tampil di konsol trainer dan Excel.
- Jika browser peserta tidak mendukung atau menolak layar penuh (mis. iPhone, atau tautan dibuka dari dalam aplikasi chat), ujian tetap bisa dikerjakan dan peserta ditandai **"tanpa layar penuh"** di konsol trainer. Sarankan peserta membuka tautan di Chrome/Edge pada laptop.
- **Batasan:** situs web tidak dapat sepenuhnya mengunci perangkat. Alt+Tab, tombol Windows, Ctrl+Alt+Del, menutup browser, atau memotret layar dengan ponsel tetap mungkin dilakukan. Semua kejadian yang terdeteksi dicatat untuk trainer. Untuk penguncian penuh diperlukan aplikasi khusus seperti Safe Exam Browser.

## Tampilan peserta
- Halaman awal hanya berisi logo, judul, kode batch, lalu nama dan jabatan.
- Soal ditampilkan **satu bagian per halaman** dengan tombol Sebelumnya/Berikutnya; perpindahan bagian juga lewat panel navigasi soal.
- **Panel navigasi soal** di kanan (di ponsel: tombol "Daftar soal" di pojok bawah) menampilkan semua nomor: biru = terjawab, oranye = ragu-ragu, putih = belum dijawab. Klik nomor untuk langsung ke soalnya.
- Tombol **Ragu-ragu** pada tiap soal untuk menandai soal yang ingin ditinjau ulang; tanda ini ikut tersimpan dan tersinkron.
- **Hapus jawaban** untuk mengosongkan pilihan.
- Sebelum mengirim, ringkasan menampilkan jumlah terjawab, ragu-ragu, dan belum dijawab beserta nomor-nomornya.
- Pengingat otomatis saat sisa waktu 10, 5, dan 1 menit.

## Fitur konsol trainer
- **Navigasi**: menu samping (Peserta, Batch, Analisis soal) dengan pilihan **Batch** di bagian atas yang berlaku untuk halaman Peserta dan Analisis. Setiap halaman punya alamat sendiri (mis. `admin.html#/peserta/<id>?batch=<id>`), sehingga tombol Back/Forward browser, refresh, dan berbagi tautan ke peserta tertentu tetap berfungsi. Kembali dari detail mengembalikan posisi daftar.
- **Detail peserta** memiliki breadcrumb serta tombol **Sebelumnya / Berikutnya** sesuai urutan dan filter daftar. Pintasan: `/` cari peserta, `Esc` kembali ke daftar, `←` `→` pindah peserta. Catatan trainer tersimpan otomatis saat kolom ditinggalkan.
- **Peserta**: statistik (termasuk tingkat kelulusan), pencarian, filter status, urutan (terbaru / nilai / nama), sisa waktu peserta yang sedang mengerjakan, dan catatan keluar halaman / layar penuh.
- **Detail peserta yang sedang mengerjakan**: **Tambah waktu** (+5/+10/+15/+30 menit; timer peserta diperbarui otomatis dalam ±30 detik) dan **Kirim paksa** (jawaban yang sudah tersinkron dikirim dan dinilai).
- **Detail peserta selesai**: nilai, status lulus, rincian per area, filter jawaban (semua / salah-kosong / ragu-ragu), catatan trainer.
- **Analisis Soal**: persentase benar per area dan per soal, tingkat kesulitan (Mudah ≥ 80%, Sedang 50–79%, Sulit < 50%), sebaran pilihan A–D; pengecoh yang dipilih lebih banyak daripada kunci ditandai merah.
- **Excel**: sheet Rekap Nilai (kini dengan Nilai lulus, Lulus, Ragu-ragu, Keluar halaman, Keluar layar penuh, Tanpa layar penuh), Detail Jawaban, dan **Analisis Soal**.

## Logo
Simpan logo Anda sebagai `assets/logo.png` (disarankan PNG transparan, rasio lebar ≥ tinggi, minimal 300 px lebar). Logo tampil di halaman peserta, halaman admin, dan favicon. Jika file belum ada, otomatis tampil kotak teks "QMS". Setelah mengganti logo, naikkan angka versi `exam-shell-v8` di `sw.js` (mis. `v9`) agar browser peserta memuat logo baru.

## Ketahanan saat koneksi putus
- Setiap perubahan jawaban langsung disimpan di perangkat peserta, lalu disinkronkan ke Supabase otomatis (debounce 1,2 detik, ulang tiap 5 detik jika gagal, dan segera saat koneksi kembali).
- Refresh atau menutup tab di tengah ujian aman: ujian dilanjutkan dari jawaban terakhir dan sisa waktu yang benar (dihitung dari waktu mulai di server), bahkan saat offline.
- Jika koneksi putus saat menekan **Kirim** atau saat waktu habis, jawaban tetap aman dan terkirim otomatis begitu tersambung; layar menampilkan pesan "jangan tutup halaman".
- Peserta tidak akan membuat entri ganda karena refresh. Entri baru hanya dibuat dari tombol **Mulai Ujian**.
- Syarat: situs harus di-hosting **HTTPS** (Netlify/Vercel/Cloudflare sudah HTTPS) dan halaman peserta pernah dibuka sekali saat online agar tersimpan di browser.
- Tetap di perangkat dan browser yang sama saat melanjutkan. Berganti perangkat saat online juga bisa (diambil dari server), tetapi jawaban yang belum sempat tersinkron di perangkat lama tidak ikut.

## Cara kerja penilaian
- Seluruh 100 soal pilihan ganda, **1 poin per soal**, dinilai **otomatis** begitu peserta mengirim jawaban. Tidak ada penilaian manual; status peserta langsung **Selesai**.
- Kategori nilai (EXCELLENT ≥ 90, VERY GOOD / COMPETENT ≥ 80, COMPETENT ≥ 70, NEEDS IMPROVEMENT ≥ 60, selainnya NOT YET COMPETENT) memakai ambang yang sama dengan versi sebelumnya.
- Detail peserta menampilkan rincian per area (FND, CTX, LDR, R&O, SUP, OPS, PER, PER/IMP) serta kunci dan pembahasan tiap soal; ada filter "hanya jawaban salah / kosong". Rekomendasi remedial muncul untuk area < 60% (ambang 60% adalah asumsi; ubah di `admin.js` bila perlu).
- Catatan trainer tetap bisa diisi per peserta.
- Excel berisi dua sheet: **Rekap Nilai** (termasuk skor per area) dan **Detail Jawaban** (jawaban, kunci, poin per soal).

## Mengganti atau mengubah soal
Soal ada di `assets/questions.js`; kunci dan pembahasan ada di database (`grading_config`). Keduanya dihubungkan oleh `version` yang harus sama di kedua tempat. Jika Anda mengubah soal, ubah juga kunci di SQL, naikkan `version`, lalu jalankan ulang SQL-nya. Jika berbeda, admin menolak login (pencegahan salah nilai). Jawaban yang tersimpan dengan `version` lain tidak dinilai.

## Batasan yang perlu Anda ketahui
- Timer berjalan di browser peserta (dihitung dari `started_at` yang dicatat server). Waktu submit juga dicatat server, jadi kelebihan durasi tetap terlihat di kolom Durasi, tetapi tidak diblokir.
- Peserta yang menghapus data browser (cookies/site data) saat ujian berlangsung kehilangan sesi dan dianggap peserta baru; hapus entri ganda dari admin.
- Mode penyamaran/incognito menghapus data saat ditutup, jadi minta peserta tidak memakainya.
- Halaman admin memuat ulang data tiap 10 detik (tanpa Realtime agar setup tetap sederhana).
- Pencatatan keluar halaman dilakukan oleh browser peserta, jadi bersifat indikasi (bukan bukti mutlak) — misalnya notifikasi sistem atau mengunci layar juga ikut tercatat.

## Pemecahan masalah
| Gejala | Penyebab umum |
|---|---|
| "Anonymous sign-ins are disabled" | Langkah 2.1 belum diaktifkan |
| "Akun ini bukan admin…" saat login | Email di `schema.sql` tidak sama dengan email login, atau SQL belum dijalankan |
| "row-level security" saat peserta mulai | `schema.sql` belum dijalankan penuh |
| Halaman menampilkan "Konfigurasi belum lengkap" | `config.js` masih berisi teks GANTI_… |
