# Panduan Setup — Final Assessment ISO 9001:2026

Aplikasi statis (HTML/JS) + Supabase. Tidak ada server yang perlu Anda kelola.

## Isi paket
| File | Fungsi |
|---|---|
| `index.html` | Halaman peserta (bagikan tautan ini) |
| `admin.html` | Konsol trainer (jangan dibagikan) |
| `assets/config.js` | **Tempat Anda mengisi kredensial Supabase** |
| `assets/questions.js` | Bank soal: 100 butir pilihan ganda (tanpa kunci) |
| `assets/logo.png` | **Logo Anda** (letakkan sendiri; lihat bagian Logo) |
| `sw.js` | Menyimpan aplikasi di browser agar bisa di-refresh saat offline |
| `supabase/schema.sql` | Tabel, keamanan (RLS), kunci jawaban & pembahasan |
| `supabase/batch.sql` | Fitur batch per Copart |
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

> Kunci jawaban dan pembahasan tersimpan di tabel `grading_config` dan hanya bisa dibaca akun admin. Peserta tidak dapat melihatnya lewat browser.

> **Sudah pernah menjalankan `schema.sql` sebelumnya?** Cukup jalankan `supabase/batch.sql` (aman dijalankan ulang). Data peserta lama tetap utuh dan tampil sebagai "Tanpa batch".

> **Fitur durasi per batch memerlukan `supabase/batch.sql` dijalankan ulang** (aman diulang; instalasi lama cukup file ini).

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

## Logo
Simpan logo Anda sebagai `assets/logo.png` (disarankan PNG transparan, rasio lebar ≥ tinggi, minimal 300 px lebar). Logo tampil di halaman peserta, halaman admin, dan favicon. Jika file belum ada, otomatis tampil kotak teks "QMS". Setelah mengganti logo, naikkan angka versi `exam-shell-v2` di `sw.js` (mis. `v3`) agar browser peserta memuat logo baru.

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

## Pemecahan masalah
| Gejala | Penyebab umum |
|---|---|
| "Anonymous sign-ins are disabled" | Langkah 2.1 belum diaktifkan |
| "Akun ini bukan admin…" saat login | Email di `schema.sql` tidak sama dengan email login, atau SQL belum dijalankan |
| "row-level security" saat peserta mulai | `schema.sql` belum dijalankan penuh |
| Halaman menampilkan "Konfigurasi belum lengkap" | `config.js` masih berisi teks GANTI_… |
