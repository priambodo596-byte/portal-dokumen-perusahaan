import { formatRupiah } from '@/lib/documents/constants'
import type { TemplateData } from './tokens'

const fmtDate = (iso: string) => iso
  ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
  : ''

/** Escape nilai teks agar tidak merusak struktur HTML. */
export function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function resolveToken(path: string, data: TemplateData, item?: Record<string, unknown>): string {
  if (item) {
    const itemPath = path.startsWith('this.') ? path.slice(5) : path
    const raw = itemPath === 'No' ? item.position : item[itemPath]
    if (raw === undefined || raw === null) return ''
    if (path === 'unitPrice' || path === 'amount') return formatRupiah(Number(raw))
    if (path === 'quantity') return Number(raw).toLocaleString('id-ID')
    return escapeHtml(String(raw))
  }
  const now = new Date()
  const today = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now)
  const aliases: Record<string, unknown> = {
    Nomor_Urut: data.Nomor_Urut ?? data.documentNumber,
    Kode_Klasifikasi: data.Kode_Klasifikasi,
    Kode_Unit: data.Kode_Unit,
    Tahun: data.Tahun ?? new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now),
    Tanggal_Surat: data.Tanggal_Surat || fmtDate(data.documentDate) || today,
    'Hhh/ddd/yyyy': data['Hhh/ddd/yyyy'] ?? today,
    Jumlah_Lampiran: data.Jumlah_Lampiran,
    prihal: data.prihal ?? data.title,
    Nama_Perusahaan_dan_alamat: data.Nama_Perusahaan_dan_alamat ?? [data.client?.name, data.client?.address].filter(Boolean).join(', '),
    Jenis_Pekerjaan: data.Jenis_Pekerjaan ?? data.project?.name ?? data.title,
    Current_Date: today,
    Current_Time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(now),
    Time_Zone: data.Time_Zone ?? 'WIB',
    AlamatVendor: data.AlamatVendor ?? data.client?.address,
    // Mendukung nama placeholder persis dari HTML template Surat Undangan.
    Email_Vendor_Tujuan: data.Email_Vendor_Tujuan ?? data.EmailVendorTujuan ?? data.client?.email,
    EmailVendorTujuan: data.EmailVendorTujuan ?? data.Email_Vendor_Tujuan ?? data.client?.email,
    Alamat_Kantor: data.Alamat_Kantor ?? data.company?.address,
    Telp_Kantor: data.Telp_Kantor ?? data.company?.phone,
    Email_Kantor: data.Email_Kantor ?? data.company?.email,
    No: data.No,
    Persyaratan_KAK: data.Persyaratan_KAK,
    Formulir_IDD: data.Formulir_IDD,
    Sertifikat_CSMS: data.Sertifikat_CSMS,
    Komitmen_Anti_Gratifikasi: data.Komitmen_Anti_Gratifikasi,
    Komitmen_TKDN: data.Komitmen_TKDN,
    Phone_Nomber: data.Phone_Nomber ?? data.client?.phone,
    Team_Leader: data.Team_Leader ?? data.client?.contactPerson ?? data.creatorName,
    // Placeholder Surat Undangan Penawaran; nama lowercase dipertahankan persis seperti template.
    nomor_urut: data.nomor_urut ?? data.fields?.nomor_urut ?? data.Nomor_Urut ?? data.documentNumber,
    kode_klasifikasi: data.kode_klasifikasi ?? data.fields?.kode_klasifikasi ?? data.Kode_Klasifikasi,
    kode_unit: data.kode_unit ?? data.fields?.kode_unit ?? data.Kode_Unit,
    tahun: data.tahun ?? data.fields?.tahun ?? data.Tahun ?? new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now),
    tanggal_surat: data.tanggal_surat ?? data.fields?.tanggal_surat ?? data.Tanggal_Surat ?? today,
    jumlah_lampiran: data.jumlah_lampiran ?? data.fields?.jumlah_lampiran ?? data.Jumlah_Lampiran,
    perihal: data.perihal ?? data.fields?.perihal ?? data.prihal ?? data.title,
    nama_perusahaan: data.nama_perusahaan ?? data.fields?.nama_perusahaan ?? data.client?.name,
    alamat_perusahaan: data.alamat_perusahaan ?? data.fields?.alamat_perusahaan ?? data.client?.address,
    jenis_pekerjaan: data.jenis_pekerjaan ?? data.fields?.jenis_pekerjaan ?? data.Jenis_Pekerjaan ?? data.project?.name ?? data.title,
    batas_tanggal: data.batas_tanggal ?? data.fields?.batas_tanggal,
    batas_jam: data.batas_jam ?? data.fields?.batas_jam,
    zona_waktu: data.zona_waktu ?? data.fields?.zona_waktu ?? 'WIB',
    alamat_pengiriman: data.alamat_pengiriman ?? data.fields?.alamat_pengiriman ?? data.AlamatVendor ?? data.client?.address,
    email_vendor: data.email_vendor ?? data.fields?.email_vendor ?? data.Email_Vendor_Tujuan ?? data.EmailVendorTujuan ?? data.client?.email,
    telepon: data.telepon ?? data.fields?.telepon ?? data.Phone_Nomber ?? data.client?.phone,
    team_leader: data.team_leader ?? data.fields?.team_leader ?? data.Team_Leader ?? data.client?.contactPerson ?? data.creatorName,
  }
  const v = Object.prototype.hasOwnProperty.call(aliases, path)
    ? aliases[path]
    : path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), data as unknown)
  if (v === undefined || v === null) return ''
  if (path === 'documentDate') return escapeHtml(fmtDate(String(v)))
  if (path === 'subtotal' || path === 'discount' || path === 'taxAmount' || path === 'total') return formatRupiah(Number(v))
  if (path === 'notes') return escapeHtml(String(v)).replace(/\n/g, '<br/>')
  return escapeHtml(String(v))
}

const ITEM_BLOCK = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g
const KELENGKAPAN_BLOCK = /\{\{#kelengkapan\}\}([\s\S]*?)\{\{\/kelengkapan\}\}/g
const TOKEN = /\{\{\s*([a-zA-Z0-9_./-]+)\s*\}\}/g

function renderItemBlock(tpl: string, data: TemplateData): string {
  const rowTpl = tpl.replace(ITEM_BLOCK, '$1')
  return data.items.map((raw) => {
    const item = raw as unknown as Record<string, unknown>
    return rowTpl.replace(TOKEN, (m, path: string) => resolveToken(path, data, item) || m)
  }).join('')
}

/**
 * Render HTML template dengan data dokumen.
 * - Blok {{#items}}...{{/items}} diulang untuk tiap item.
 * - {{token}} diganti nilainya (di-escape). Token tak dikenal dibiarkan agar terlihat saat menyusun.
 */
export function renderTemplate(bodyHtml: string, data: TemplateData): string {
  // Loop kelengkapan terpisah dari items agar template pengadaan dapat memakai nama variabel aslinya.
  const defaultKelengkapan = [
    'Persyaratan KAK', 'Formulir IDD', 'Sertifikat CSMS', 'Komitmen Anti Gratifikasi', 'Komitmen TKDN',
  ].map((nama, index) => ({ no: index + 1, nama }))
  const source = bodyHtml.replace(KELENGKAPAN_BLOCK, (_match, rowTemplate: string) => {
    const rows = data.kelengkapan?.length ? data.kelengkapan : defaultKelengkapan
    return rows.map((row) => rowTemplate.replace(TOKEN, (token, path: string) => resolveToken(path, data, row as unknown as Record<string, unknown>) || token)).join('')
  })
  let out = ''
  let last = 0
  for (const m of source.matchAll(ITEM_BLOCK)) {
    out += source.slice(last, m.index).replace(TOKEN, (tok, path: string) => resolveToken(path, data) || tok)
    out += renderItemBlock(m[0], data)
    last = (m.index ?? 0) + m[0].length
  }
  out += source.slice(last).replace(TOKEN, (tok, path: string) => resolveToken(path, data) || tok)
  return out
}

export { resolveToken }
