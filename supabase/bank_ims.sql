-- =====================================================================
-- BANK SOAL "TRAINING IMS" (Integrated Management System)
--   7 studi kasus × 3 soal esai = 21 soal, seluruhnya dinilai trainer dengan rubrik.
--   Setiap soal bernilai 0 sampai 4 (skala di "scale"); nilai akhir = total skor / 84 × 100.
--   "crit" = poin jawaban yang diharapkan (panduan trainer, bukan redaksi baku).
-- Jalankan di Supabase → SQL Editor SETELAH supabase/settings.sql. Aman dijalankan ulang.
-- Hanya menambah/memperbarui rubrik bank ini (grading_config id = 4) dan fungsi my_result
-- (agar peserta bank esai dapat melihat nilainya bila "tampilkan nilai" aktif).
-- Bank lain, data peserta, dan batch tidak disentuh.
-- =====================================================================

insert into public.grading_config (id, config) values (4, $cfg${
 "version": "ims-2026-v1",
 "essay": true,
 "scale": [
  "Skor 4: tepat dan lengkap sesuai poin kunci, disertai alasan/contoh yang relevan",
  "Skor 3: tepat, tetapi kurang lengkap atau alasannya kurang kuat",
  "Skor 2: sebagian benar; poin kunci baru terjawab sebagian",
  "Skor 1: menjawab, tetapi kurang tepat atau terlalu umum",
  "Skor 0: salah, tidak relevan, atau tidak dijawab"
 ],
 "manual": [
  { "id": "Q1", "sec": "1", "label": "Soal 1 · Penyebab kembali ke kebiasaan lama", "max": 4, "qs": [1], "crit": [
    "Tidak ada standar & sistem pemeliharaan (Seiketsu): jadwal, checklist, PIC, audit/pengecekan rutin",
    "Belum terbentuk disiplin/kebiasaan (Shitsuke): 5S diperlakukan sebagai program sesaat, bukan budaya kerja",
    "Mengaitkan dengan pernyataan \"tidak ada yang mengecek\": kerapian bergantung pada pengawasan, tanpa komitmen & teladan pimpinan" ] },
  { "id": "Q2", "sec": "1", "label": "Soal 2 · Takut diawasi vs kesadaran sendiri", "max": 4, "qs": [2], "crit": [
    "Takut diawasi: motivasi dari luar, hanya dilakukan saat ada atasan, hasil tidak konsisten/sementara",
    "Kesadaran sendiri: motivasi dari dalam, memahami manfaat (keselamatan, efisiensi, mutu), konsisten walau tanpa pengawasan",
    "Kesadaran sendiri adalah wujud Shitsuke, yaitu menjadi kebiasaan/budaya yang berkelanjutan" ] },
  { "id": "Q3", "sec": "1", "label": "Soal 3 · 2 cara praktis menjaga kerapian", "max": 4, "qs": [3], "crit": [
    "Dua cara yang praktis dan dapat langsung diterapkan, misalnya: visual management (label, garis lantai, foto standar, shadow board); checklist & piket 5S harian (5 menit sebelum/sesudah kerja)",
    "Atau: audit/patroli 5S berkala dengan skor dan umpan balik; apresiasi/penghargaan area terbaik; teladan pimpinan; melibatkan tim menyusun standar area",
    "Setiap cara dijelaskan singkat bagaimana membuat tim terbiasa tanpa disuruh (2 poin per cara)" ] },
  { "id": "Q4", "sec": "2", "label": "Soal 4 · Generating Type vs Setting Type", "max": 4, "qs": [4], "crit": [
    "Situasi A = Generating Type: standar lama (SOP, kondisi mesin) tidak tercapai/dibiarkan menurun",
    "Situasi B = Setting Type: standar/target baru dinaikkan sehingga kapasitas saat ini tidak mencukupi",
    "Alasan singkat untuk masing-masing (2 poin per situasi)" ] },
  { "id": "Q5", "sec": "2", "label": "Soal 5 · Pentingnya mencari akar penyebab", "max": 4, "qs": [5], "crit": [
    "Akar penyebab menentukan jenis solusi: A → kembalikan ke standar (perbaikan mesin, perbarui SOP, preventive maintenance); B → tingkatkan kapasitas/standar baru (tambah orang/mesin, perbaikan proses)",
    "Tanpa analisis akar penyebab solusi bisa salah sasaran, membuang biaya, dan masalah berulang",
    "Nilai tambah: menyebut alat analisis (5 Why, diagram fishbone) atau berbasis data/fakta" ] },
  { "id": "Q6", "sec": "2", "label": "Soal 6 · Contoh penyelesaian PDCA", "max": 4, "qs": [6], "crit": [
    "Plan: identifikasi masalah & akar penyebab, tetapkan target, susun rencana tindakan (apa, siapa, kapan)",
    "Do: laksanakan rencana (mis. perbaiki mesin & perbarui SOP, atau tambah kapasitas/atur shift), latih operator",
    "Check: bandingkan hasil dengan target (output, downtime, pencapaian produksi)",
    "Act: standarisasi bila berhasil; bila belum, perbaiki rencana dan ulangi siklus. Jawaban konsisten dengan situasi yang dipilih (1 poin per tahap)" ] },
  { "id": "Q7", "sec": "3", "label": "Soal 7 · Jenis pemborosan (waste)", "max": 4, "qs": [7], "crit": [
    "1 = Waiting (bahan baku menunggu antrian)",
    "2 = Motion (bolak-balik mengambil alat)",
    "3 = Inventory (stok bahan kimia menumpuk hingga kedaluwarsa)",
    "4 = Overprocessing (data ditulis dua kali). Skor: 1 poin per kecocokan" ] },
  { "id": "Q8", "sec": "3", "label": "Soal 8 · Alasan Overproduction/Inventory merugikan", "max": 4, "qs": [8], "crit": [
    "Satu alasan yang tepat dan dijelaskan, misalnya: modal/uang tertahan di stok (arus kas terganggu); biaya penyimpanan & penanganan",
    "Atau: risiko rusak, kedaluwarsa, usang (seperti bahan kimia menggumpal); menyembunyikan masalah lain; memicu waste lain (transportasi, gerakan, cacat)",
    "Penjelasan dikaitkan dengan kerugian bagi perusahaan" ] },
  { "id": "Q9", "sec": "3", "label": "Soal 9 · Cara mudah mengatasi satu masalah", "max": 4, "qs": [9], "crit": [
    "Memilih satu masalah dan solusinya sesuai jenis waste: Waiting → jadwal panen/pengolahan diselaraskan dengan kapasitas pabrik (FIFO); Motion → tata letak alat di dekat titik kerja, shadow board/5S",
    "Inventory → pembelian sesuai kebutuhan, stok minimum dan maksimum, FIFO/FEFO; Overprocessing → hilangkan pencatatan ganda (satu formulir/input digital sekali)",
    "Solusi praktis, dapat langsung diterapkan, dan menjelaskan dampaknya" ] },
  { "id": "Q10", "sec": "4", "label": "Soal 10 · Pengelompokan VAA / NVAA", "max": 4, "qs": [10], "crit": [
    "Aktivitas 1 (mengolah bahan baku menjadi produk jadi) = VAA",
    "Aktivitas 2 (menunggu instruksi/izin) = NVAA",
    "Aktivitas 3 (mencatat lalu mengetik ulang) = NVAA",
    "Aktivitas 4 (rapat tanpa keputusan) = NVAA. Skor: 1 poin per aktivitas" ] },
  { "id": "Q11", "sec": "4", "label": "Soal 11 · Mengefisienkan pencatatan ganda", "max": 4, "qs": [11], "crit": [
    "Data dicatat satu kali saja, langsung diinput ke komputer/tablet/formulir digital, atau buku tulis ditiadakan",
    "Menghilangkan duplikasi pekerjaan (satu orang, satu kali input; template/sistem terintegrasi)",
    "Menjelaskan manfaat: lebih cepat, mengurangi salah ketik, menghemat tenaga" ] },
  { "id": "Q12", "sec": "4", "label": "Soal 12 · Tujuan Lean terkait waste", "max": 4, "qs": [12], "crit": [
    "Mengidentifikasi lalu menghilangkan/mengurangi aktivitas pemborosan (NVAA)",
    "Agar proses fokus pada aktivitas bernilai tambah bagi pelanggan",
    "Hasilnya: efisiensi meningkat, lead time lebih cepat, biaya turun, mutu terjaga; dilakukan berkelanjutan (continuous improvement)" ] },
  { "id": "Q13", "sec": "5", "label": "Soal 13 · Perhitungan gap kompetensi", "max": 4, "qs": [13], "crit": [
    "Gap = level aktual - level standar (atau sebaliknya, dengan tanda yang konsisten)",
    "Pengendalian Mesin: 2 - 4 = -2 (kurang 2 level dari standar)",
    "Kedisiplinan 5S: 3 - 3 = 0 (sudah memenuhi standar). Skor: 2 poin per kompetensi" ] },
  { "id": "Q14", "sec": "5", "label": "Soal 14 · Prioritas pengembangan", "max": 4, "qs": [14], "crit": [
    "Prioritas: Pengendalian Mesin",
    "Alasan: gap terbesar (-2), masih di bawah standar; kompetensi teknis kritis yang berdampak pada produksi, mutu, dan keselamatan",
    "Kedisiplinan 5S sudah memenuhi standar sehingga cukup dipertahankan" ] },
  { "id": "Q15", "sec": "5", "label": "Soal 15 · Beda Level 2 dan Level 4", "max": 4, "qs": [15], "crit": [
    "Level 2: kemampuan dasar, dapat mengerjakan tugas rutin, masih perlu bimbingan, arahan, dan pengawasan",
    "Level 4: mahir/mandiri, mampu menangani masalah kompleks & troubleshooting, dapat mengajari/membimbing orang lain, menjadi rujukan",
    "Perbedaan dijelaskan dengan contoh kerja sehari-hari (definisi level dapat mengikuti matriks perusahaan)" ] },
  { "id": "Q16", "sec": "6", "label": "Soal 16 · Unsur kompetensi yang lemah", "max": 4, "qs": [16], "crit": [
    "Attitude (sikap/perilaku) adalah kelemahan utama Budi",
    "Alasan: Knowledge dan Skill teknis sudah baik (\"sangat pintar secara teknis\"), masalahnya pada perilaku (membentak, marah-marah)",
    "Dampak perilaku pada tim: takut dan tidak produktif" ] },
  { "id": "Q17", "sec": "6", "label": "Soal 17 · Training kelas bukan satu-satunya solusi", "max": 4, "qs": [17], "crit": [
    "Setuju (atau kombinasi dengan alasan kuat): perubahan sikap/perilaku lebih efektif melalui praktik langsung, pembiasaan, dan umpan balik berkelanjutan di tempat kerja",
    "Training kelas efektif untuk menambah pengetahuan, tetapi belum tentu mengubah perilaku tanpa tindak lanjut",
    "Nilai tambah: menyebut pembelajaran 70-20-10 atau perlunya pemantauan setelah training" ] },
  { "id": "Q18", "sec": "6", "label": "Soal 18 · 2 metode pengembangan selain training", "max": 4, "qs": [18], "crit": [
    "Dua metode yang tepat, misalnya: coaching oleh atasan; mentoring oleh senior/pemimpin teladan",
    "Atau: on-the-job guidance/bimbingan langsung, umpan balik rutin (termasuk 360°), konseling, role play, shadowing",
    "Setiap metode dijelaskan singkat penerapannya untuk memperbaiki komunikasi Budi (2 poin per metode)" ] },
  { "id": "Q19", "sec": "7", "label": "Soal 19 · Kekuatan & kelemahan kompetensi Dani", "max": 4, "qs": [19], "crit": [
    "Kekuatan masa lalu: Functional (teknis) Competency (perbaikan mesin, troubleshooting)",
    "Kelemahan saat ini: Leadership Competency: perencanaan/jadwal shift, pembagian tugas (delegasi), komunikasi/memberi instruksi, mengelola konflik",
    "Penjelasan dikaitkan dengan fakta kasus (2 poin per jenis)" ] },
  { "id": "Q20", "sec": "7", "label": "Soal 20 · Keahlian teknis bukan jaminan sukses memimpin", "max": 4, "qs": [20], "crit": [
    "Peran berubah dari mengerjakan sendiri (individual contributor) menjadi memimpin dan mengelola orang",
    "Memimpin membutuhkan kompetensi yang berbeda: merencanakan, mendelegasikan, berkomunikasi, memotivasi, mengelola konflik",
    "Promosi sebaiknya didasarkan pada asesmen kompetensi untuk peran baru dan disertai persiapan (nilai tambah: Peter Principle)" ] },
  { "id": "Q21", "sec": "7", "label": "Soal 21 · Solusi pengembangan untuk Dani", "max": 4, "qs": [21], "crit": [
    "Program pengembangan kepemimpinan (leadership/supervisory development): penjadwalan shift, delegasi, komunikasi, manajemen konflik",
    "Didampingi coaching/mentoring oleh atasan atau supervisor senior, dengan rencana pengembangan individu (IDP) dan evaluasi berkala",
    "Nilai tambah: alternatif jalur karier teknis (dual career path) bila tidak berkembang sebagai pemimpin" ] }
 ]
}$cfg$::jsonb)
on conflict (id) do update set config = excluded.config;

-- my_result: ditambah cabang bank esai (sama persis dengan supabase/settings.sql).
-- Bank esai: nilai tersedia setelah trainer selesai menilai; nilai = total skor rubrik / skor maksimum × 100.
create or replace function public.my_result(p_attempt uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; bs jsonb; k jsonb; d jsonb; n int; r int; n1 int; tfr int; man numeric; mx numeric; pm numeric; ver text; show boolean;
  raw numeric; sc numeric; best numeric; kind text := 'mc';
begin
  select * into a from public.attempts where id = p_attempt and user_id = auth.uid();
  if not found or a.status in ('in_progress', 'remedial') then return null; end if;
  select settings into bs from public.batches where id = a.batch_id;
  show := coalesce((bs ->> 'show_score')::boolean, (a.settings ->> 'show_score')::boolean, false);
  if not show then return null; end if;
  -- versi bank soal dari jawaban; jawaban lama tanpa versi (format campuran) = bank 50 soal
  ver := coalesce(a.answers ->> 'v', case when a.answers ? 'tf' or a.answers ? 'txt' then 'mix50-2026-v1' end);
  select config into k from public.grading_config where config ->> 'version' = ver limit 1;
  if k is null then return null; end if;
  pm := coalesce((bs ->> 'pass_mark')::numeric, (a.settings ->> 'pass_mark')::numeric, 70);
  if k ? 't1' then
    -- hafalan klausul: soal sesuai undian peserta, nomor soal 1..n berurutan (jenis 1 lalu jenis 2); koreksi trainer di manual_scores
    kind := 'clause'; d := coalesce(a.settings -> 'draw', '{}'::jsonb); n1 := jsonb_array_length(coalesce(d -> 'p1', '[]'::jsonb));
    select count(*), count(*) filter (where case when q.ov in ('0', '1') then q.ov = '1' else public.clause_ok(q.p, q.ref, q.v, k) end)
      into n, r from (
        select '1' p, x.ref, a.answers -> 'txt' ->> x.i::text v, a.manual_scores ->> ('1:' || x.ref) ov
        from jsonb_array_elements_text(coalesce(d -> 'p1', '[]'::jsonb)) with ordinality x(ref, i)
        union all
        select '2', y.ref, a.answers -> 'txt' ->> (y.i + n1)::text, a.manual_scores ->> ('2:' || y.ref)
        from jsonb_array_elements_text(coalesce(d -> 'p2', '[]'::jsonb)) with ordinality y(ref, i)
      ) q;
    if n = 0 then return null; end if;
    raw := round(r * 100.0 / n, 1);
  elsif k ? 'essay' then
    -- bank esai (Training IMS): seluruh soal dinilai trainer dengan rubrik
    if a.status <> 'graded' then return json_build_object('pending', true); end if;
    kind := 'essay';
    select coalesce(sum(nullif(a.manual_scores ->> (m ->> 'id'), '')::numeric), 0), coalesce(sum((m ->> 'max')::numeric), 0)
      into man, mx from jsonb_array_elements(k -> 'manual') m;
    if mx = 0 then return null; end if;
    r := round(man)::int; n := mx::int;
    raw := round(man * 100.0 / mx, 1);
  else
    select count(*), count(*) filter (where upper(coalesce(a.answers -> 'mc' ->> e.key, '')) = e.value)
      into n, r from jsonb_each_text(k -> 'mc') e;
    if n = 0 then return null; end if;
    if k ? 'manual' then
      -- bank dengan penilaian manual: nilai baru tersedia setelah trainer selesai menilai
      if a.status <> 'graded' then return json_build_object('pending', true); end if;
      kind := 'manual';
      select count(*) filter (where coalesce(a.answers -> 'tf' ->> e.key, '') = e.value) into tfr from jsonb_each_text(coalesce(k -> 'tf', '{}'::jsonb)) e;
      select coalesce(sum(nullif(a.manual_scores ->> (m ->> 'id'), '')::numeric), 0) into man from jsonb_array_elements(k -> 'manual') m;
      raw := r * 2 + tfr + man;
    else
      raw := round(r * 100.0 / n, 1);
    end if;
  end if;
  sc := raw;
  if jsonb_array_length(coalesce(a.history, '[]'::jsonb)) > 0 then
    select max((h ->> 'score')::numeric) into best from jsonb_array_elements(a.history) h;
    best := coalesce(best, 0);
    sc := case coalesce(bs ->> 'remedial_rule', 'kkm') when 'raw' then raw when 'best' then greatest(best, raw) else greatest(best, least(raw, pm)) end;
  end if;
  return json_build_object('right', r, 'total', n, 'score', sc, 'raw', raw, 'pass_mark', pm, 'kind', kind, 'manual', kind in ('manual', 'essay'), 'remedial', a.remedial);
end $$;
revoke execute on function public.my_result(uuid) from public, anon;
grant execute on function public.my_result(uuid) to authenticated;
