// Bank soal "Training IMS" (publik): 7 studi kasus, masing-masing 3 soal esai (21 soal).
// Sumber: "Examination - Training Integrated Management System". Rubrik penilaian TIDAK ada di sini, melainkan
// tersimpan di database (grading_config, baris id = 4). Lihat supabase/bank_ims.sql.
window.EXAM_IMS = {
  version: "ims-2026-v1",
  title: "Examination",
  subtitle: "Training Integrated Management System (IMS)",
  training: "Training Integrated Management System (IMS)",
  minutes: 90,
  cases: [
    { title: "5S dan Kebiasaan Kerja",
      scenario: "Sebuah tim operasional berhasil menjalankan 5S dengan baik selama satu bulan pertama setelah pelatihan. Area kerja menjadi rapi, bersih, dan teratur. Namun, tiga bulan kemudian kondisi perlahan kembali seperti semula. Ketika ditanya, beberapa pekerja menjawab: \"Dulu sempat ada program itu, tapi sekarang sudah tidak ada yang mengecek.\"",
      qs: [
        [1, "Di antara 5S, kegagalan ini berkaitan dengan Seiketsu (Rawat) dan Shitsuke (Rajin/Disiplin). Dari cerita di atas, apa penyebab utama tim kembali ke kebiasaan lamanya yang berantakan?"],
        [2, "Apa bedanya bekerja rapi karena \"takut diawasi atasan\" dengan bekerja rapi karena \"kesadaran sendiri\"?"],
        [3, "Sebutkan 2 (dua) cara praktis yang bisa Anda lakukan agar tim mau menjaga kerapian setiap hari tanpa harus terus-menerus disuruh!"]
      ] },
    { title: "Kaizen dan PDCA",
      scenario: "Di sebuah unit pengolahan, supervisor mendapati bahwa hasil produksi bulan ini lebih rendah dari target. Setelah ditelusuri, ada dua kemungkinan penyebab:\n\n• Situasi A: Standar operasional sudah lama tidak diperbarui, dan kondisi mesin memang sudah sering rusak sejak setahun lalu. Masalah ini sudah diketahui tapi dibiarkan.\n• Situasi B: Perusahaan baru saja menaikkan target produksi dua kali lipat untuk bulan ini, sehingga kapasitas mesin dan jumlah orang saat ini tidak lagi mencukupi.",
      qs: [
        [4, "Dalam Kaizen, ada masalah yang terjadi karena standar lama tidak tercapai (Generating Type), dan ada masalah karena standar baru ditingkatkan (Setting Type). Tentukan mana yang merupakan Generating Type dan mana yang Setting Type dari dua situasi di atas!"],
        [5, "Mengapa wajib mencari tahu akar penyebab sebenarnya (apakah karena mesin yang rusak atau karena target yang naik) sebelum mencari solusi?"],
        [6, "Buatlah contoh penyelesaian sederhana dengan pola P-D-C-A (Plan/Rencana - Do/Lakukan - Check/Periksa - Act/Tindak Lanjut) untuk salah satu situasi di atas!"]
      ] },
    { title: "Jenis Pemborosan (Waste)",
      scenario: "Sebuah perusahaan sedang mengevaluasi operasional hariannya. Dari pengamatan, ditemukan kondisi berikut:\n\n1. Bahan baku yang dipanen pagi hari tidak langsung diolah karena antrian pabrik, sehingga menunggu berjam-jam.\n2. Operator sering bolak-balik berjalan jauh mengambil alat kerja yang tidak disimpan di dekatnya.\n3. Stok bahan kimia dibeli dalam jumlah terlalu besar dan menumpuk di gudang hingga menggumpal dan kedaluwarsa.\n4. Ada satu tahap pengisian data yang harus ditulis dua kali oleh orang yang berbeda padahal hasilnya sama saja.",
      qs: [
        [7, "Tentukan jenis pemborosan (waste) dari 4 kejadian di atas dengan mencocokkannya dari pilihan ini: Waiting (Menunggu), Motion (Gerakan Berlebih), Inventory (Stok Berlebih), dan Overprocessing (Proses Berlebih)!"],
        [8, "Dari sekian banyak pemborosan, memproduksi/menyimpan barang melebihi kebutuhan (Overproduction/Inventory) dianggap sangat merugikan. Sebutkan satu alasannya!"],
        [9, "Jika Anda menjadi Supervisor di sana, pilih satu masalah dari daftar di atas dan sebutkan satu cara mudah yang akan langsung Anda terapkan untuk mengatasinya!"]
      ] },
    { title: "Aktivitas Bernilai Tambah (VAA/NVAA)",
      scenario: "Seorang Supervisor diminta untuk mengamati aktivitas timnya. Ia menemukan aktivitas berikut:\n\n1. Proses mengolah bahan baku mentah menjadi produk jadi yang siap jual.\n2. Duduk menunggu instruksi atau surat izin dari atasan sebelum bisa mulai bekerja.\n3. Mencatat data di buku tulis, lalu mengetik ulang data yang sama persis ke komputer.\n4. Rapat tiap pagi selama 1 jam yang isinya hanya ngobrol tanpa keputusan kerja yang jelas.",
      qs: [
        [10, "Kelompokkan 4 aktivitas di atas menjadi dua kategori: Aktivitas yang Memiliki Nilai Tambah (VAA) ATAU Aktivitas Pemborosan (NVAA)."],
        [11, "Untuk aktivitas nomor 3 (mencatat dua kali), bagaimana cara termudah agar pekerjaan ini menjadi lebih cepat dan efisien?"],
        [12, "Apa tujuan utama dari prinsip Lean Manufacturing terkait dengan aktivitas pemborosan (waste) di tempat kerja?"]
      ] },
    { title: "Gap Matriks Kompetensi",
      scenario: "Andi adalah seorang Supervisor di pabrik. Perusahaan memiliki Matriks Kompetensi yang mensyaratkan Andi untuk memiliki kemampuan sebagai berikut:\n\n• Kompetensi \"Pengendalian Mesin\": Standar yang diminta adalah Level 4. Namun, saat dievaluasi, kemampuan aktual Andi baru di Level 2.\n• Kompetensi \"Kedisiplinan 5S\": Standar yang diminta adalah Level 3. Saat dievaluasi, kemampuan aktual Andi sudah berada di Level 3.",
      qs: [
        [13, "Hitunglah berapa nilai Gap (Kesenjangan) untuk kompetensi \"Pengendalian Mesin\" dan kompetensi \"Kedisiplinan 5S\" yang dimiliki Andi!"],
        [14, "Dari hasil perhitungan tersebut, kompetensi manakah yang harus menjadi fokus utama (prioritas) untuk dilatih atau dikembangkan oleh atasan Andi? Berikan alasannya!"],
        [15, "Jelaskan secara singkat, apa bedanya karyawan yang berada di Level 2 dengan karyawan yang berada di Level 4 dalam bekerja sehari-hari?"]
      ] },
    { title: "Knowledge, Skill, Attitude",
      scenario: "Budi baru saja diangkat menjadi Kepala Regu. Ia sangat pintar secara teknis, namun ia sering membentak dan marah-marah kepada anak buahnya jika ada kesalahan kecil. Akibatnya, timnya menjadi takut dan tidak produktif. Tim HRD mengusulkan agar Budi dikirim mengikuti Training \"Komunikasi Efektif\" di kelas teori selama 3 hari. Namun, manajer pabrik merasa Budi lebih butuh dibimbing langsung saat bekerja di lapangan setiap harinya, bukan disuruh duduk di kelas mendengarkan teori.",
      qs: [
        [16, "Dalam konsep kompetensi, ada 3 unsur yaitu Knowledge (Pengetahuan), Skill (Keterampilan), dan Attitude (Sikap/Perilaku). Dari cerita di atas, unsur manakah yang menjadi kelemahan Budi?"],
        [17, "Apakah Anda setuju dengan manajer pabrik bahwa training di kelas teori bukan satu-satunya solusi untuk masalah Budi? Mengapa demikian?"],
        [18, "Sebutkan minimal 2 (dua) metode pengembangan karyawan selain Training yang lebih cocok untuk memperbaiki cara komunikasi Budi langsung di tempat kerja!"]
      ] },
    { title: "Talent Management dan Promosi",
      scenario: "Dani adalah seorang mekanik mesin yang sangat luar biasa. Ia menguasai segala jenis perbaikan mesin, gesit, dan selalu bisa menyelesaikan troubleshooting dengan cepat. Karena prestasinya, ia dipromosikan menjadi Supervisor Maintenance. Namun, setelah tiga bulan menjabat, tim Maintenance menjadi kacau. Dani ternyata tidak mampu membuat jadwal shift, kesulitan membagi tugas secara adil, dan sering berkonflik dengan anak buahnya saat memberikan instruksi.",
      qs: [
        [19, "Dalam Talent Management, kompetensi dibagi menjadi Core Competency, Leadership Competency, dan Functional Competency. Dari kasus Dani, jenis kompetensi manakah yang menjadi kekuatan utamanya di masa lalu, dan jenis kompetensi manakah yang menjadi kelemahannya saat ini?"],
        [20, "Mengapa keahlian tingkat tinggi (Expert) di satu bidang teknis tidak bisa dijadikan satu-satunya jaminan bahwa seseorang akan sukses ketika dipromosikan memimpin sebuah tim?"],
        [21, "Solusi pengembangan apa yang paling cocok diberikan kepada Dani saat ini agar ia bisa sukses menjalankan perannya sebagai Supervisor?"]
      ] }
  ]
};
(function(x){ x.total = x.cases.reduce((n, c) => n + c.qs.length, 0); })(window.EXAM_IMS);
