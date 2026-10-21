import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { COMPANY } from '@/lib/company'
import { formatRupiah, statusMeta, typeLabel } from './constants'
import type { ExportData } from './export-service'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48
const BLUE = rgb(0.255, 0.412, 0.882)
const NAVY = rgb(0.094, 0.157, 0.271)
const MUTED = rgb(0.403, 0.451, 0.541)
const LINE = rgb(0.86, 0.88, 0.91)

// Helvetica (WinAnsi) tidak mengenal beberapa glyph; ganti agar tidak crash.
const ascii = (s: string) => s.replace(/[\u2013\u2014]/g, '-').replace(/[\u00b7\u2022]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x00-\xFF]/g, '')

const fmtDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))

type Ctx = { doc: PDFDocument; page: PDFPage; y: number; font: PDFFont; bold: PDFFont }

function newPage(c: Ctx): PDFPage {
  const p = c.doc.addPage(A4)
  drawHeader(c, p)
  c.page = p; c.y = A4[1] - MARGIN - 40
  return p
}

function text(c: Ctx, s: string, opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' | 'center' } = {}) {
  const size = opts.size ?? 9
  const font = opts.bold ? c.bold : c.font
  const t = ascii(s)
  let x = opts.x ?? MARGIN
  if (opts.align === 'right') x = A4[0] - MARGIN - font.widthOfTextAtSize(t, size)
  if (opts.align === 'center') x = (A4[0] - font.widthOfTextAtSize(t, size)) / 2
  c.page.drawText(t, { x, y: c.y, size, font, color: opts.color ?? NAVY })
  return font.widthOfTextAtSize(t, size)
}

function drawHeader(c: Ctx, page: PDFPage) {
  page.drawText(ascii(COMPANY.name), { x: MARGIN, y: A4[1] - MARGIN, size: 12, font: c.bold, color: NAVY })
  page.drawText(ascii(`${COMPANY.address}  |  ${COMPANY.phone}  |  ${COMPANY.email}`), { x: MARGIN, y: A4[1] - MARGIN - 14, size: 7.5, font: c.font, color: MUTED })
  page.drawLine({ start: { x: MARGIN, y: A4[1] - MARGIN - 22 }, end: { x: A4[0] - MARGIN, y: A4[1] - MARGIN - 22 }, thickness: 1, color: BLUE })
}

function footer(c: Ctx, page: PDFPage, pageNo: number, total: number) {
  const label = ascii(`${COMPANY.name} - ${COMPANY.website}   |   Halaman ${pageNo} / ${total}`)
  const w = c.font.widthOfTextAtSize(label, 7.5)
  page.drawText(label, { x: (A4[0] - w) / 2, y: MARGIN - 18, size: 7.5, font: c.font, color: MUTED })
}

/** Generator PDF A4 dari data dokumen, murni JS (tanpa binary eksternal). */
export async function buildDocumentPdf(d: ExportData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(`${d.documentNumber} - ${d.title}`)
  doc.setCreator(COMPANY.name)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage(A4)
  const c: Ctx = { doc, page, y: 0, font, bold }
  drawHeader(c, page)
  c.y = A4[1] - MARGIN - 46

  const need = (h: number) => { if (c.y - h < MARGIN + 24) newPage(c) }

  text(c, typeLabel(d.type).toUpperCase(), { size: 18, bold: true, align: 'center' }); c.y -= 20
  text(c, `Nomor: ${d.documentNumber}`, { size: 9, color: MUTED, align: 'center' }); c.y -= 13
  text(c, `Tanggal: ${fmtDate(d.documentDate)}   -   Status: ${statusMeta(d.status).label}   -   Versi ${d.version}`, { size: 8, color: MUTED, align: 'center' }); c.y -= 22

  if (d.client || d.project) {
    text(c, 'Kepada / Perihal', { size: 9, bold: true, color: BLUE }); c.y -= 13
    if (d.client) { text(c, `Klien: ${d.client.name}`, { size: 8.5 }); c.y -= 12 }
    if (d.client?.contactPerson) { text(c, `Kontak: ${d.client.contactPerson}`, { size: 8.5 }); c.y -= 12 }
    if (d.client?.address) { text(c, `Alamat: ${d.client.address}`, { size: 8.5, color: MUTED }); c.y -= 12 }
    if (d.project) { text(c, `Proyek: ${d.project.name}${d.project.code ? ` (${d.project.code})` : ''}`, { size: 8.5 }); c.y -= 12 }
    c.y -= 8
  }

  text(c, 'Rincian Item', { size: 9, bold: true, color: NAVY }); c.y -= 14
  const cols = [MARGIN, MARGIN + 22, MARGIN + 250, MARGIN + 300, MARGIN + 380, A4[0] - MARGIN]
  const header = ['#', 'Uraian', 'Satuan', 'Kuantitas', 'Harga', 'Jumlah']
  const drawRow = (vals: string[], strong = false) => {
    need(16)
    c.page.drawRectangle({ x: MARGIN, y: c.y - 4, width: A4[0] - 2 * MARGIN, height: strong ? 15 : 13, color: strong ? rgb(0.93, 0.95, 1) : undefined, borderColor: LINE, borderWidth: 0.5 })
    const xs = [cols[0] + 2, cols[1] + 2, cols[2] + 2, cols[3] + 2, cols[4] + 2, cols[5]]
    vals.forEach((v, i) => {
      const size = 7.6
      const t = ascii(v)
      const f = strong ? bold : font
      let x = xs[i]
      if (i >= 3) x = cols[i + 1] - f.widthOfTextAtSize(t, size) - 2
      if (i === 5) x = cols[5] - f.widthOfTextAtSize(t, size) - 2
      c.page.drawText(t.length > 60 ? t.slice(0, 60) + '..' : t, { x, y: c.y, size, font: f, color: NAVY })
    })
    c.y -= strong ? 17 : 14
  }
  drawRow(header, true)
  d.items.forEach((it) => drawRow([String(it.position), it.description, it.unit ?? '-', Number(it.quantity).toLocaleString('id-ID'), formatRupiah(it.unitPrice), formatRupiah(it.amount)]))
  if (!d.items.length) { text(c, 'Dokumen ini tidak memiliki rincian item.', { size: 8.5, color: MUTED }); c.y -= 14 }

  c.y -= 10
  const totalRow = (label: string, val: number, strong = false) => {
    need(14)
    text(c, label, { x: A4[0] - MARGIN - 220, size: strong ? 10 : 8.5, bold: strong, color: strong ? NAVY : MUTED })
    text(c, formatRupiah(val), { size: strong ? 10 : 8.5, bold: strong, color: strong ? BLUE : NAVY, align: 'right' })
    c.y -= strong ? 16 : 13
  }
  totalRow('Subtotal', d.subtotal)
  totalRow('Diskon', d.discount)
  totalRow(`Pajak (${Number(d.taxRate)}%)`, d.taxAmount)
  totalRow('TOTAL', d.total, true)

  if (d.notes) { c.y -= 12; text(c, 'Catatan', { size: 9, bold: true, color: BLUE }); c.y -= 13; text(c, d.notes.slice(0, 300), { size: 8.5, color: MUTED }); c.y -= 14 }

  need(140)
  c.y -= 30
  text(c, fmtDate(d.documentDate), { size: 8.5, align: 'right' })
  c.y -= 13; text(c, 'Hormat kami,', { size: 8.5, align: 'right' })
  c.y -= 50; text(c, `(${d.creatorName ?? '________________'})`, { size: 8.5, bold: true, align: 'right' })
  c.y -= 12; text(c, COMPANY.name, { size: 7.5, color: MUTED, align: 'right' })

  const pages = doc.getPages()
  pages.forEach((p, i) => footer({ ...c, page: p }, p, i + 1, pages.length))
  return Buffer.from(await doc.save())
}
