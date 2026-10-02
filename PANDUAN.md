# Panduan Setup — Final Assessment ISO 9001:2026

Aplikasi statis (HTML/JS) + Supabase. Tidak ada server yang perlu Anda kelola.

## Isi paket
| File | Fungsi |
|---|---|
| `index.html` | Halaman peserta (bagikan tautan ini) |
| `admin.html` | Konsol trainer (jangan dibagikan) |
| `assets/config.js` | **Tempat Anda mengisi kredensial Supabase** |
| `assets/questions.js` | Bank soal (50 butir) |
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

## Cara kerja penilaian
- **Section A (50) dan B-pilihan B/S (5)**: otomatis dari kunci.
- **Section B-alasan (5), C (20), D (20)**: dinilai manual oleh trainer per item rubrik. Status menjadi *Selesai dinilai* setelah seluruh 19 item terisi; sebelum itu berstatus draft.
- Kategori nilai mengikuti tabel interpretasi pada Trainer Answer Key. Jika **Application (Section C) < 12/20** dan total ≥ 70, muncul peringatan guardrail.
- Rekomendasi remedial muncul untuk kompetensi pilihan ganda < 60% dan untuk Section D < 12/20 (ambang 60% adalah asumsi saya; ubah di `admin.js` bila perlu).
- No. 50 (Management Question) **tidak punya bobot** pada rubrik sumber, sehingga ditampilkan untuk dibaca tetapi tidak dinilai.

## Batasan yang perlu Anda ketahui
- Timer berjalan di browser peserta (dihitung dari `started_at` yang dicatat server). Waktu submit juga dicatat server, jadi kelebihan durasi tetap terlihat di kolom Durasi, tetapi tidak diblokir.
- Peserta yang menghapus data browser atau berganti perangkat akan dianggap peserta baru; hapus entri ganda dari admin.
- Halaman admin memuat ulang data tiap 10 detik (tanpa Realtime agar setup tetap sederhana).

## Pemecahan masalah
| Gejala | Penyebab umum |
|---|---|
| "Anonymous sign-ins are disabled" | Langkah 2.1 belum diaktifkan |
| "Akun ini bukan admin…" saat login | Email di `schema.sql` tidak sama dengan email login, atau SQL belum dijalankan |
| "row-level security" saat peserta mulai | `schema.sql` belum dijalankan penuh |
| Halaman menampilkan "Konfigurasi belum lengkap" | `config.js` masih berisi teks GANTI_… |
