// Identitas perusahaan sebagai satu sumber kebenaran untuk export dokumen, header, dan footer.
// Nilai dapat dioverride lewat variabel lingkungan bila perlu.
export const COMPANY = {
  name: process.env.COMPANY_NAME ?? 'PT.Palos',
  address: process.env.COMPANY_ADDRESS ?? 'Perumahan Bukit Bahagia Residence, Jl. Sunarna No. 9, Suka Mulya, Kec. Sematang Borang, Kota Palembang, Sumatera Selatan 30962',
  phone: process.env.COMPANY_PHONE ?? '083875934417',
  email: process.env.COMPANY_EMAIL ?? 'ptpalosos@gmail.com',
  website: process.env.COMPANY_WEBSITE ?? '',
  npwp: process.env.COMPANY_NPWP ?? '',
} as const

export const COMPANY_TAGLINE = process.env.COMPANY_TAGLINE ?? 'Palembang Security Operating System'
