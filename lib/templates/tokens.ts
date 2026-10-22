/** Data yang tersedia untuk merender template dokumen. */
export type TemplateData = {
  documentNumber: string
  title: string
  type: string
  typeLabel: string
  status: string
  documentDate: string
  company: { name: string; address: string; phone: string; email: string; website: string; npwp: string; tagline?: string; leaderName?: string; leaderTitle?: string }
  client: { name: string; address: string; contactPerson: string; email: string; phone: string } | null
  project: { name: string; code: string } | null
  creatorName: string
  notes: string
  subtotal: number
  discount: number
  taxRate: string
  taxAmount: number
  total: number
  items: { position: number; description: string; unit: string; quantity: string; unitPrice: number; amount: number }[]
  /** Field tambahan untuk template surat undangan yang disimpan pada documents.fields. */
  fields?: Record<string, string>
  kelengkapan?: { no: number; nama: string }[]
  nomor_urut?: string
  kode_klasifikasi?: string
  kode_unit?: string
  tahun?: string
  tanggal_surat?: string
  jumlah_lampiran?: string
  perihal?: string
  nama_perusahaan?: string
  alamat_perusahaan?: string
  jenis_pekerjaan?: string
  batas_tanggal?: string
  batas_jam?: string
  zona_waktu?: string
  alamat_pengiriman?: string
  email_vendor?: string
  telepon?: string
  team_leader?: string
  /** Placeholder khusus surat undangan; nilai kosong dapat diisi dari form dokumen jika tersedia. */
  Nomor_Urut?: string
  Kode_Klasifikasi?: string
  Kode_Unit?: string
  Tahun?: string
  Tanggal_Surat?: string
  'Hhh/ddd/yyyy'?: string
  Jumlah_Lampiran?: string
  prihal?: string
  Nama_Perusahaan_dan_alamat?: string
  Jenis_Pekerjaan?: string
  Current_Date?: string
  Current_Time?: string
  Time_Zone?: string
  AlamatVendor?: string
  EmailVendorTujuan?: string
  Email_Vendor_Tujuan?: string
  Alamat_Kantor?: string
  Telp_Kantor?: string
  Email_Kantor?: string
  No?: string
  Persyaratan_KAK?: string
  Formulir_IDD?: string
  Sertifikat_CSMS?: string
  Komitmen_Anti_Gratifikasi?: string
  Komitmen_TKDN?: string
  Phone_Nomber?: string
  Team_Leader?: string
}

/** Token loop yang dapat dipakai di dalam blok {{#items}}...{{/items}}. */
export const ITEM_FIELDS = [
  { token: 'position', label: 'No' },
  { token: 'description', label: 'Uraian' },
  { token: 'unit', label: 'Satuan' },
  { token: 'quantity', label: 'Kuantitas' },
  { token: 'unitPrice', label: 'Harga Satuan' },
  { token: 'amount', label: 'Jumlah' },
] as const

/** Kelompok token untuk panel drag & drop di editor template. */
export const TOKEN_GROUPS: { label: string; tokens: { token: string; label: string }[] }[] = [
  {
    label: 'Surat Undangan Penawaran PLN',
    tokens: [
      { token: 'nomor_urut', label: 'Nomor urut surat' },
      { token: 'kode_klasifikasi', label: 'Kode klasifikasi' },
      { token: 'kode_unit', label: 'Kode unit' },
      { token: 'tahun', label: 'Tahun surat' },
      { token: 'tanggal_surat', label: 'Tanggal surat' },
      { token: 'jumlah_lampiran', label: 'Jumlah lampiran' },
      { token: 'perihal', label: 'Perihal surat' },
      { token: 'nama_perusahaan', label: 'Nama perusahaan/vendor' },
      { token: 'alamat_perusahaan', label: 'Alamat perusahaan/vendor' },
      { token: 'jenis_pekerjaan', label: 'Jenis pekerjaan' },
      { token: 'batas_tanggal', label: 'Batas tanggal penawaran' },
      { token: 'batas_jam', label: 'Batas waktu penawaran' },
      { token: 'zona_waktu', label: 'Zona waktu' },
      { token: 'alamat_pengiriman', label: 'Alamat pengiriman' },
      { token: 'email_vendor', label: 'Email vendor' },
      { token: 'telepon', label: 'Telepon Team Leader' },
      { token: 'team_leader', label: 'Nama Team Leader' },
    ],
  },
  {
    label: 'Informasi Surat',
    tokens: [
      { token: 'Nomor_Urut', label: 'Nomor urut surat (contoh: 00023)' },
      { token: 'Kode_Klasifikasi', label: 'Kode klasifikasi (contoh: DAN.01.02)' },
      { token: 'Kode_Unit', label: 'Kode unit (contoh: F29120000)' },
      { token: 'Tahun', label: 'Tahun surat (contoh: 2026)' },
      { token: 'Tanggal_Surat', label: 'Tanggal surat (pengganti format Hhh/ddd/yyyy)' },
      { token: 'Hhh/ddd/yyyy', label: 'Format tanggal lama (disarankan gunakan Tanggal_Surat)' },
      { token: 'Jumlah_Lampiran', label: 'Jumlah berkas lampiran' },
      { token: 'prihal', label: 'Perihal surat' },
      { token: 'Nama_Perusahaan_dan_alamat', label: 'Nama dan alamat vendor/tujuan' },
    ],
  },
  {
    label: 'Undangan & Waktu',
    tokens: [
      { token: 'Jenis_Pekerjaan', label: 'Jenis pekerjaan' },
      { token: 'Current_Date', label: 'Tanggal saat ini (otomatis)' },
      { token: 'Current_Time', label: 'Waktu saat ini (otomatis)' },
      { token: 'Time_Zone', label: 'Zona waktu (contoh: WIB)' },
      { token: 'AlamatVendor', label: 'Alamat pengiriman penawaran' },
      { token: 'EmailVendorTujuan', label: 'Email tujuan penawaran' },
    ],
  },
  {
    label: 'Persyaratan Lampiran',
    tokens: [
      { token: 'No', label: 'Nomor urut persyaratan' },
      { token: 'Persyaratan_KAK', label: 'Persyaratan KAK' },
      { token: 'Formulir_IDD', label: 'Persyaratan Formulir IDD' },
      { token: 'Sertifikat_CSMS', label: 'Persyaratan Sertifikat CSMS' },
      { token: 'Komitmen_Anti_Gratifikasi', label: 'Komitmen anti gratifikasi' },
      { token: 'Komitmen_TKDN', label: 'Komitmen TKDN' },
    ],
  },
  {
    label: 'Kontak & Penutup',
    tokens: [
      { token: 'Phone_Nomber', label: 'Nomor telepon Team Leader' },
      { token: 'Team_Leader', label: 'Nama Team Leader (paragraf dan tanda tangan)' },
    ],
  },
  {
    label: 'Dokumen',
    tokens: [
      { token: 'documentNumber', label: 'Nomor Dokumen' },
      { token: 'title', label: 'Judul' },
      { token: 'typeLabel', label: 'Jenis Dokumen' },
      { token: 'status', label: 'Status' },
      { token: 'documentDate', label: 'Tanggal' },
      { token: 'creatorName', label: 'Pembuat' },
      { token: 'notes', label: 'Catatan' },
    ],
  },
  {
    label: 'Klien & Proyek',
    tokens: [
      { token: 'client.name', label: 'Nama Klien' },
      { token: 'client.address', label: 'Alamat Klien' },
      { token: 'client.contactPerson', label: 'Kontak Klien' },
      { token: 'client.email', label: 'Email Klien' },
      { token: 'client.phone', label: 'Telepon Klien' },
      { token: 'project.name', label: 'Nama Proyek' },
      { token: 'project.code', label: 'Kode Proyek' },
    ],
  },
  {
    label: 'Nilai',
    tokens: [
      { token: 'subtotal', label: 'Subtotal' },
      { token: 'discount', label: 'Diskon' },
      { token: 'taxRate', label: 'Tarif Pajak (%)' },
      { token: 'taxAmount', label: 'Pajak' },
      { token: 'total', label: 'Total' },
    ],
  },
  {
    label: 'Perusahaan',
    tokens: [
      { token: 'company.name', label: 'Nama Perusahaan' },
      { token: 'company.address', label: 'Alamat Perusahaan' },
      { token: 'company.phone', label: 'Telepon Perusahaan' },
      { token: 'company.email', label: 'Email Perusahaan' },
      { token: 'company.website', label: 'Website Perusahaan' },
      { token: 'company.npwp', label: 'NPWP Perusahaan' },
      { token: 'company.tagline', label: 'Tagline' },
      { token: 'company.leaderName', label: 'Nama Pimpinan' },
      { token: 'company.leaderTitle', label: 'Jabatan Pimpinan' },
    ],
  },
]

/** Semua token tunggal (tanpa loop) untuk validasi/otomatis-lengkap. */
export const ALL_TOKENS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.token))
