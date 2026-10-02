# Panduan Setup — Final Assessment ISO 9001:2026

Aplikasi statis (HTML/JS) + Supabase. Tidak ada server yang perlu Anda kelola.

## Isi paket
| File | Fungsi |
|---|---|
| `index.html` | Halaman peserta (bagikan tautan ini) |
| `admin.html` | Konsol trainer (jangan dibagikan) |
| `assets/config.js` | **Tempat Anda mengisi kredensial Supabase** |
| `assets/questions.js` | Bank soal (50 butir) |
| `assets/logo.png` | **Logo Anda** (letakkan sendiri; lihat bagian Logo) |
| `sw.js` | Menyimpan aplikasi di browser agar bisa di-refresh saat offline |
| `supabase/schema.sql` | Tabel, keamanan (RLS), kunci jawaban & rubrik |

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

> Kunci jawaban dan rubrik tersimpan di tabel `grading_config` dan hanya bisa dibaca akun admin. Peserta tidak dapat melihatnya lewat browser.

> **Sudah pernah menjalankan `schema.sql` sebelumnya?** Cukup jalankan `supabase/batch.sql` (aman dijalankan ulang). Data peserta lama tetap utuh dan tampil sebagai "Tanpa batch".

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
2. Buka `admin.html`, login, pastikan peserta uji muncul, buka detail, beri nilai, klik **Simpan Penilaian**, lalu **Ekspor Excel**.
3. Hapus data uji lewat tombol **Hapus peserta**.

## Batch per Copart
1. Di `admin.html` buka tab **Batch**, isi nama Copart (dan keterangan bila perlu), klik **Buat Batch**. Muncul kode 6 angka, misalnya `482915`.
2. Bagikan **kode** atau **tautan** (tombol Salin tautan; peserta langsung masuk dengan kode terisi, misalnya `https://domain-anda/?kode=482915`).
3. Peserta membuka halaman peserta → memasukkan kode → melihat nama Copart pada judul ("Training ISO 9001:2026 — nama Copart") → mengisi nama dan jabatan; kolom Copart terisi otomatis dan tidak bisa diubah.
4. **Tutup batch** menghentikan pendaftaran peserta baru. Peserta yang sudah mulai tetap bisa menyelesaikan ujiannya.
5. Di tab **Peserta**, filter **Semua batch** membatasi daftar, statistik, dan **Ekspor Excel** ke satu Copart. Excel memuat kolom Copart dan Kode Batch di setiap sheet; nama file memuat nama Copart.
6. **Hapus batch** hanya menghapus kodenya. Data peserta tetap tersimpan dengan nama Copart-nya.

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
- **Section A (50) dan B-pilihan B/S (5)**: otomatis dari kunci.
- **Section B-alasan (5), C (20), D (20)**: dinilai manual oleh trainer per item rubrik. Status menjadi *Selesai dinilai* setelah seluruh 19 item terisi; sebelum itu berstatus draft.
- Kategori nilai mengikuti tabel interpretasi pada Trainer Answer Key. Jika **Application (Section C) < 12/20** dan total ≥ 70, muncul peringatan guardrail.
- Rekomendasi remedial muncul untuk kompetensi pilihan ganda < 60% dan untuk Section D < 12/20 (ambang 60% adalah asumsi saya; ubah di `admin.js` bila perlu).
- No. 50 (Management Question) **tidak punya bobot** pada rubrik sumber, sehingga ditampilkan untuk dibaca tetapi tidak dinilai.

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
