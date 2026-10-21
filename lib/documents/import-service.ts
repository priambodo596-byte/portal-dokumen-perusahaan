import { randomUUID } from 'crypto'
import { ApiError } from '@/lib/api'

/** Batas ukuran file import (8 MB) dan lampiran. */
export const MAX_FILE_SIZE = 8 * 1024 * 1024

export const ALLOWED_IMPORT = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc', // .doc lama: hanya disimpan sebagai lampiran
} as const

export type DetectedKind = 'pdf' | 'docx' | 'doc'

export function detectKind(fileName: string, mimeType: string): DetectedKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  const byMime = (ALLOWED_IMPORT as Record<string, DetectedKind>)[mimeType]
  return byMime ?? null
}

export function validateFile(fileName: string, mimeType: string, size: number): DetectedKind {
  const kind = detectKind(fileName, mimeType)
  if (!kind) throw new ApiError(422, 'Jenis file tidak didukung. Gunakan .docx atau .pdf.', { file: 'Ekstensi/MIME tidak didukung.' })
  if (size <= 0) throw new ApiError(422, 'File kosong.', { file: 'File kosong.' })
  if (size > MAX_FILE_SIZE) throw new ApiError(422, `Ukuran file melebihi ${MAX_FILE_SIZE / 1024 / 1024} MB.`, { file: 'Terlalu besar.' })
  return kind
}

export type Extracted = { title?: string; documentNumber?: string; documentDate?: string; client?: string; project?: string; total?: number; notes?: string; text: string; parsed: boolean; ocr?: boolean }

const ISO = /\b(20\d{2})-(\d{2})-(\d{2})\b/
const DMY = /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/
// Toleransi OCR: izinkan spasi di sekitar pemisah, mis. "PENAWARAN -2026-099".
const NUMBER = /\b([A-Z]{2,12})\s*[-/]\s*(\d{4})\s*[-/]\s*(\d{3,4})\b/
const MONEY = /(?:rp\.?|idr)\s*([\d.,]{4,})/i
const MONTHS_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember']
const ID_DATE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_ID.join('|')})\\s+(20\\d{2})\\b`, 'i')

function toIso(d: string): string | undefined {
  let m = ISO.exec(d)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = DMY.exec(d)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = ID_DATE.exec(d)
  if (m) { const idx = MONTHS_ID.indexOf(m[2].toLowerCase()) + 1; if (idx) return `${m[3]}-${String(idx).padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return undefined
}

function parseMoney(v: string): number | undefined {
  const digits = v.replace(/[^\d]/g, '')
  if (!digits) return undefined
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Ekstraksi best-effort dari teks dokumen. Tidak menyimpulkan lebih dari yang terlihat. */
export function extractFields(text: string): Extracted {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const head = lines.slice(0, 40)
  const numMatch = NUMBER.exec(text)
  const dateMatch = ISO.exec(text) ?? DMY.exec(text) ?? ID_DATE.exec(text)
  const moneyMatch = MONEY.exec(text)
  const clientLine = head.find((l) => /^(pt|cv|kepada|klien|kepada yth)/i.test(l))
  const projectLine = head.find((l) => /^(proyek|project|pekerjaan|perihal)/i.test(l))
  const titleLine = head.find((l) => l.length >= 5 && l.length <= 120 && /penawaran|rab|kontrak|invoice|berita acara|surat|bast|spk/i.test(l)) ?? head[0]
  // Baris "total" diutamakan, lalu subtotal/jumlah; ambil nilai rupiah terakhir pada baris tersebut.
  const totalLine = lines.find((l) => /^(total|grand total|jumlah total|total akhir)/i.test(l))
  const totalMoney = (totalLine ? [...totalLine.matchAll(new RegExp(MONEY, 'gi'))].pop()?.[1] : undefined) ?? moneyMatch?.[1]

  const ext: Extracted = { text, parsed: true }
  if (numMatch) ext.documentNumber = `${numMatch[1]}-${numMatch[2]}-${numMatch[3]}`
  if (dateMatch) ext.documentDate = toIso(dateMatch[0])
  if (titleLine) ext.title = titleLine.slice(0, 200)
  if (clientLine) ext.client = clientLine.replace(/^(pt|cv|kepada( yth)?|klien)[\s:.-]*/i, '').slice(0, 150)
  if (projectLine) ext.project = projectLine.replace(/^(proyek|project|pekerjaan|perihal)[\s:.-]*/i, '').slice(0, 150)
  if (totalMoney) ext.total = parseMoney(totalMoney)
  return ext
}

async function extractDocx(buffer: Buffer): Promise<Extracted> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer })
  return extractFields(value)
}

/** Batas halaman yang diproses OCR (performa & waktu respons). */
const OCR_MAX_PAGES = 5
const OCR_MAX_MS = 45_000

/**
 * OCR PDF hasil scan: render tiap halaman jadi gambar lalu baca dengan Tesseract.js.
 * Dianggap berhasil bila ada teks yang terbaca; hasilnya tetap ditinjau pengguna sebelum disimpan.
 */
async function ocrPdf(buffer: Buffer): Promise<Extracted> {
  const started = Date.now()
  const [{ pdf }, { createWorker }] = await Promise.all([import('pdf-to-img'), import('tesseract.js')])
  const images: Buffer[] = []
  const doc = await pdf(buffer, { scale: 2 })
  for await (const page of doc) {
    images.push(page)
    if (images.length >= OCR_MAX_PAGES || Date.now() - started > OCR_MAX_MS) break
  }
  if (!images.length) return { text: '', parsed: false }

  const worker = await createWorker(['ind', 'eng'])
  try {
    const parts: string[] = []
    for (const img of images) {
      if (Date.now() - started > OCR_MAX_MS) break
      const { data } = await worker.recognize(img)
      parts.push(data.text)
    }
    const text = parts.join('\n').trim()
    if (!text) return { text: '', parsed: false, ocr: true }
    return { ...extractFields(text), ocr: true }
  } finally {
    await worker.terminate()
  }
}

async function extractPdf(buffer: Buffer): Promise<Extracted> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise
  let text = ''
  const max = Math.min(doc.numPages, 30)
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  const trimmed = text.trim()
  if (trimmed) return extractFields(trimmed)
  // Tidak ada lapisan teks → kemungkinan hasil scan; coba OCR.
  try {
    return await ocrPdf(buffer)
  } catch (e) {
    console.error('[import] OCR gagal', e)
    return { text: '', parsed: false }
  }
}

/** Ekstraksi teks dari file. parsed=false bila tidak ada teks sama sekali (mis. scan tanpa hasil OCR) atau jenis tak didukung. */
export async function extractFromFile(kind: DetectedKind, buffer: Buffer): Promise<Extracted> {
  try {
    if (kind === 'docx') return await extractDocx(buffer)
    if (kind === 'pdf') return await extractPdf(buffer)
  } catch (e) {
    console.error('[import] gagal ekstraksi', e)
    return { text: '', parsed: false }
  }
  return { text: '', parsed: false }
}

export const newFileId = () => randomUUID()
