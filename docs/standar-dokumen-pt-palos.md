# Integrasi standar dokumen PT.Palos

Katalog di aplikasi bersumber dari `lib/templates/standard-registry.json`, salinan metadata `agent_document_registry.json` dari pustaka dokumen PT.Palos. Perbarui sumber ini saat registri utama berubah. Jangan menyunting isi DOCX master lewat halaman katalog.

## Penggunaan

- Buka `/templates` untuk mencari kode standar dan melihat skema field; editor template produksi berada sesudah katalog.
- Buka `/templates/standar` untuk tampilan katalog saja.
- `GET /api/v1/templates` mengembalikan ringkasan dokumen yang diizinkan untuk akun aktif. Filter opsional: `q` dan `category`.
- `GET /api/v1/templates/{code}/schema` mengembalikan metadata dan field lengkap untuk kode seperti `ADM-01`.
- Admin mengunggah master DOCX secara batch dari katalog. Nama file harus sama dengan nama pada registri; berkas divalidasi sebagai DOCX, di-hash, lalu disimpan privat di PostgreSQL.
- Pilih **Buat draf** pada kode yang master DOCX-nya sudah tersedia. Draf masuk ke modul dokumen biasa sebagai status `draft`; token tanpa data tetap terlihat sebagai `[ISI: nama_field]` saat DOCX diekspor.
- `POST /api/v1/document-drafts` menerima `template_code`, `title`, `document_date`, `notes`, dan `data`; nilai blok berulang dikirim sebagai JSON array.
- Kedua endpoint memakai sesi autentikasi portal melalui middleware `route()`; endpoint tidak menerima token agent khusus.

## Gerbang standar

- Semua draf wajib mendapat persetujuan manusia. Agent tidak dapat menerbitkan.
- Field `required: null` tetap perlu ditentukan per alur kerja. Sumber berstatus belum dipetakan atau saran harus dikonfirmasi pemilik proses.
- Klasifikasi `confidential` dan `restricted` hanya terlihat oleh role portal `admin` dan `manager`, karena aplikasi belum memiliki role fungsional legal, HR, keuangan, pajak, dan keamanan.
- Master DOCX tidak berada di GitHub. Setelah migrasi database `0007_organic_slyde.sql` diterapkan, admin perlu mengunggah 114 file master satu kali di katalog.
- Portal membuat DOCX dari master asli. Ekspor PDF dari master DOCX belum tersedia di server Vercel; gunakan DOCX untuk pemeriksaan dan konversi PDF dengan LibreOffice sampai renderer PDF server dikonfigurasi.
- Approval portal saat ini memakai role `admin`/`manager`; pemetaan rantai reviewer fungsional pada registri masih perlu dikonfigurasi sebelum alur tersebut dianggap sebagai approval berjenjang penuh.

## Aktivasi lanjutan

Terapkan migration `0007_organic_slyde.sql`, unggah master DOCX melalui katalog, buat pemetaan role agent ke role bisnis, finalisasi field wajib dan sumber data per workflow, lalu konfigurasi approval chain. Jangan menambahkan endpoint penerbitan otomatis.
