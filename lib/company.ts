// Identitas perusahaan sebagai satu sumber kebenaran untuk export dokumen, header, dan footer.
// Nilai dapat dioverride lewat variabel lingkungan bila perlu.
export const COMPANY = {
  name: process.env.COMPANY_NAME ?? 'PT Palos Nusantara',
  address: process.env.COMPANY_ADDRESS ?? 'Jl. Contoh Industri No. 88, Jakarta Selatan 12190',
  phone: process.env.COMPANY_PHONE ?? '(021) 555-0123',
  email: process.env.COMPANY_EMAIL ?? 'corporate@palos.co.id',
  website: process.env.COMPANY_WEBSITE ?? 'www.palos.co.id',
  npwp: process.env.COMPANY_NPWP ?? '01.234.567.8-901.000',
} as const

export const COMPANY_TAGLINE = process.env.COMPANY_TAGLINE ?? 'Solusi Terintegrasi Proyek & Pengadaan'
