import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'

/**
 * Renderer HTML -> PDF (A4) berbasis pdf-lib, tanpa biner eksternal.
 * Mendukung: paragraf, judul, tebal/miring/garis bawah, ukuran font inline, rata teks,
 * daftar bullet/nomor, tabel (colspan, baris header), garis pemisah, gambar data-URI PNG/JPG (logo/kop),
 * serta header/footer yang diulang di setiap halaman + nomor halaman.
 * Tidak mendukung: gambar http(s), float, CSS kompleks (diabaikan secara aman).
 */

const A4: [number, number] = [595.28, 841.89]
const MX = 50
const MT = 64
const MB = 60
const INK = rgb(0.12, 0.16, 0.22)
const MUTED = rgb(0.45, 0.5, 0.58)
const GRID = rgb(0.72, 0.76, 0.82)
const HEAD_BG = rgb(0.93, 0.95, 0.97)

type Run = { t: string; b: boolean; i: boolean; u: boolean; size?: number }
type Align = 'left' | 'center' | 'right'
type Img = { src: string; w?: number; h?: number }
type Cell = { runs: Run[]; images: Img[]; header: boolean; colspan: number; align: Align }
type Block =
  | { kind: 'p'; runs: Run[]; align: Align; size: number; indent: number; bullet?: string; before: number; after: number }
  | { kind: 'table'; rows: Cell[][] }
  | { kind: 'img'; img: Img; align: Align }
  | { kind: 'hr' }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m }
  return ENT[e.toLowerCase()] ?? m
})

// Helvetica (WinAnsi): petakan glyph umum, buang yang tidak didukung agar tidak crash.
const safe = (s: string) => s
  .replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/…/g, '...').replace(/[   ]/g, ' ').replace(/[•·]/g, '•')
  .replace(/[^\x20-\x7e¡-ÿ•\n]/g, '')

const HEADING: Record<string, number> = { h1: 20, h2: 16, h3: 13.5, h4: 12, h5: 11, h6: 10 }
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'blockquote', 'header', 'footer', 'figure', 'figcaption', 'pre', ...Object.keys(HEADING)])

function styleOf(attrs: string, prop: string): string | null {
  const m = /style\s*=\s*"([^"]*)"/i.exec(attrs) ?? /style\s*=\s*'([^']*)'/i.exec(attrs)
  if (!m) return null
  const r = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(m[1])
  return r ? r[1].trim().toLowerCase() : null
}
const alignOf = (attrs: string, fallback: Align): Align => {
  const a = styleOf(attrs, 'text-align')
  return a === 'center' || a === 'right' ? a : a === 'left' || a === 'justify' ? 'left' : fallback
}
const sizeOf = (attrs: string): number | undefined => {
  const f = styleOf(attrs, 'font-size')
  const m = f ? /^([\d.]+)(px|pt)$/.exec(f) : null
  return m ? (m[2] === 'px' ? parseFloat(m[1]) * 0.75 : parseFloat(m[1])) : undefined
}
const attrOf = (attrs: string, name: string): string | undefined => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs)
  return m ? (m[1] ?? m[2]) : undefined
}
const dimOf = (attrs: string, prop: 'width' | 'height'): number | undefined => {
  const v = (styleOf(attrs, prop) ?? attrOf(attrs, prop))?.trim()
  const m = v ? /^([\d.]+)(px|pt)?$/.exec(v) : null
  return m ? (m[2] === 'pt' ? parseFloat(m[1]) : parseFloat(m[1]) * 0.75) : undefined
}
/** Gambar yang didukung: data-URI PNG/JPG (hasil impor Word atau logo yang disisipkan). */
const imgOf = (attrs: string): Img | null => {
  const src = attrOf(attrs, 'src')
  if (!src || !/^data:image\/(png|jpe?g);base64,/i.test(src)) return null
  return { src, w: dimOf(attrs, 'width'), h: dimOf(attrs, 'height') }
}

/** Parse HTML sederhana menjadi daftar blok. */
export function parseHtml(html: string): Block[] {
  const blocks: Block[] = []
  const tokens = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)

  let runs: Run[] = []
  let bold = 0, italic = 0, under = 0
  const sizeStack: (number | undefined)[] = []
  let align: Align = 'left'
  let blockSize = 10
  let before = 0, after = 6
  const lists: { ordered: boolean; n: number }[] = []
  let bullet: string | undefined
  let table: { rows: Cell[][]; row: Cell[] | null; cell: Cell | null } | null = null
  let nested = 0

  const curSize = () => { for (let k = sizeStack.length - 1; k >= 0; k--) if (sizeStack[k]) return sizeStack[k] }
  const push = (t: string) => {
    if (!t) return
    const run = { t, b: bold > 0, i: italic > 0, u: under > 0, size: curSize() }
    if (table?.cell) table.cell.runs.push(run); else runs.push(run)
  }
  const flush = () => {
    if (table) return
    const text = runs.map((r) => r.t).join('')
    if (text.trim() || bullet) blocks.push({ kind: 'p', runs, align, size: blockSize, indent: lists.length ? 16 * lists.length : 0, bullet, before, after })
    runs = []; bullet = undefined; before = 0; after = 6
  }

  for (const m of tokens) {
    const [, closing, rawTag, attrs = '', text] = m
    if (text !== undefined) { const t = decode(text.replace(/\s+/g, ' ')); push(table?.cell ? t : (runs.length || t.trim() ? t : '')); continue }
    const tag = rawTag.toLowerCase()
    const close = closing === '/'

    if (tag === 'table') {
      if (!close) { if (table) nested++; else table = { rows: [], row: null, cell: null } }
      else if (nested > 0) nested--
      else if (table) { flush(); const rows = table.rows.filter((r) => r.length); table = null; if (rows.length) blocks.push({ kind: 'table', rows }) }
      continue
    }
    if (table) {
      if (tag === 'tr') { if (!close) table.row = []; else if (table.row) { table.rows.push(table.row); table.row = null } }
      else if (tag === 'td' || tag === 'th') {
        if (!close) {
          table.cell = { runs: [], images: [], header: tag === 'th', colspan: Math.max(1, parseInt(/colspan\s*=\s*"?(\d+)/i.exec(attrs)?.[1] ?? '1', 10) || 1), align: alignOf(attrs, 'left') }
          if (tag === 'th') bold++
        } else if (table.cell) {
          if (tag === 'th') bold = Math.max(0, bold - 1)
          while (table.cell.runs.length && table.cell.runs[table.cell.runs.length - 1].t.trim() === '' ) table.cell.runs.pop() // buang baris kosong penutup (<p> di dalam sel)
          table.row?.push(table.cell); table.cell = null
        }
      } else if (table.cell) {
        if (tag === 'img') { if (!close) { const im = imgOf(attrs); if (im) table.cell.images.push(im) } }
        else if (tag === 'br' || (close && (BLOCK_TAGS.has(tag) || tag === 'li'))) push('\n')
        else if (tag === 'strong' || tag === 'b') bold = Math.max(0, bold + (close ? -1 : 1))
        else if (tag === 'em' || tag === 'i') italic = Math.max(0, italic + (close ? -1 : 1))
        else if (tag === 'u') under = Math.max(0, under + (close ? -1 : 1))
        else if (tag === 'span') { if (close) sizeStack.pop(); else sizeStack.push(sizeOf(attrs)) }
      }
      continue
    }

    if (tag === 'br') { push('\n'); continue }
    if (tag === 'img') {
      if (!close) { const im = imgOf(attrs); if (im) { flush(); blocks.push({ kind: 'img', img: im, align }) } }
      continue
    }
    if (tag === 'hr') { flush(); blocks.push({ kind: 'hr' }); continue }
    if (tag === 'strong' || tag === 'b') { bold = Math.max(0, bold + (close ? -1 : 1)); continue }
    if (tag === 'em' || tag === 'i') { italic = Math.max(0, italic + (close ? -1 : 1)); continue }
    if (tag === 'u') { under = Math.max(0, under + (close ? -1 : 1)); continue }
    if (tag === 'span') { if (close) sizeStack.pop(); else sizeStack.push(sizeOf(attrs)); continue }
    if (tag === 'ul' || tag === 'ol') { flush(); if (close) lists.pop(); else lists.push({ ordered: tag === 'ol', n: 0 }); continue }
    if (tag === 'li') {
      flush()
      if (!close && lists.length) { const l = lists[lists.length - 1]; l.n++; bullet = l.ordered ? `${l.n}.` : '•'; blockSize = 10; align = alignOf(attrs, 'left'); after = 3 }
      continue
    }
    if (HEADING[tag] || BLOCK_TAGS.has(tag)) {
      flush()
      if (!close) {
        blockSize = HEADING[tag] ?? 10
        align = alignOf(attrs, 'left')
        if (HEADING[tag]) { bold++; before = 6; after = 8 }
      } else if (HEADING[tag]) bold = Math.max(0, bold - 1)
      if (close) { align = 'left'; blockSize = 10 }
      continue
    }
  }
  flush()
  return blocks
}

type Fonts = { reg: PDFFont; bold: PDFFont; ital: PDFFont; boldItal: PDFFont }
const fontFor = (f: Fonts, r: { b: boolean; i: boolean }) => (r.b && r.i ? f.boldItal : r.b ? f.bold : r.i ? f.ital : f.reg)

type Word = { text: string; font: PDFFont; size: number; u: boolean; w: number }
type Line = { words: Word[]; width: number; size: number }

/** Pecah run menjadi baris dengan word-wrap. */
function wrap(runs: Run[], f: Fonts, baseSize: number, maxW: number, bold = false): Line[] {
  const lines: Line[] = []
  let cur: Line = { words: [], width: 0, size: baseSize }
  const nl = () => { lines.push(cur); cur = { words: [], width: 0, size: baseSize } }
  for (const r of runs) {
    const size = r.size ?? baseSize
    const font = fontFor(f, { b: r.b || bold, i: r.i })
    const parts = safe(r.t).split('\n')
    parts.forEach((part, pi) => {
      if (pi > 0) nl()
      for (const tok of part.split(/(\s+)/)) {
        if (!tok) continue
        const w = font.widthOfTextAtSize(tok, size)
        const isSpace = /^\s+$/.test(tok)
        if (isSpace && cur.words.length === 0) continue
        if (!isSpace && cur.width + w > maxW && cur.words.length) {
          while (cur.words.length && /^\s+$/.test(cur.words[cur.words.length - 1].text)) { cur.width -= cur.words.pop()!.w }
          nl()
        }
        // kata yang lebih panjang dari lebar baris dipotong per karakter
        if (!isSpace && w > maxW) {
          let chunk = ''
          for (const ch of tok) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxW && chunk) { cur.words.push({ text: chunk, font, size, u: r.u, w: font.widthOfTextAtSize(chunk, size) }); cur.width += font.widthOfTextAtSize(chunk, size); nl(); chunk = '' }
            chunk += ch
          }
          if (chunk) { const cw = font.widthOfTextAtSize(chunk, size); cur.words.push({ text: chunk, font, size, u: r.u, w: cw }); cur.width += cw }
          continue
        }
        cur.words.push({ text: tok, font, size, u: r.u, w }); cur.width += w
        cur.size = Math.max(cur.size, size)
      }
    })
  }
  if (cur.words.length || lines.length === 0) lines.push(cur)
  return lines
}

const LH = 1.35

function drawLine(page: PDFPage, line: Line, x: number, y: number, maxW: number, align: Align) {
  let cx = align === 'center' ? x + (maxW - line.width) / 2 : align === 'right' ? x + maxW - line.width : x
  for (const w of line.words) {
    page.drawText(w.text, { x: cx, y, size: w.size, font: w.font, color: INK })
    if (w.u && w.text.trim()) page.drawLine({ start: { x: cx, y: y - 1.5 }, end: { x: cx + w.w, y: y - 1.5 }, thickness: 0.5, color: INK })
    cx += w.w
  }
}

const plain = (html: string) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim()

export type PdfMeta = { title: string; header?: string; footer?: string }

/** Render HTML (sudah berisi nilai data) menjadi PDF A4. */
export async function htmlToPdf(bodyHtml: string, meta: PdfMeta): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(safe(meta.title) || 'Template')
  doc.setProducer('Portal Dokumen (PALOS)')
  const f: Fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique), boldItal: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  }
  let page = doc.addPage(A4)
  let y = A4[1] - MT
  const textW = A4[0] - MX * 2
  const bottom = MB
  const newPage = () => { page = doc.addPage(A4); y = A4[1] - MT }
  const ensure = (h: number) => { if (y - h < bottom) newPage() }

  // Render header lengkap sebagai bagian awal halaman, termasuk logo/kop yang disimpan sebagai data URI.
  const contentHtml = (meta.header ? '<div class="template-header-content">' + meta.header + '</div>' : '') + bodyHtml
  for (const block of parseHtml(contentHtml)) {
    if (block.kind === 'img') {
      const match = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(block.img.src)
      if (!match) continue
      try {
        const bytes = Buffer.from(match[2], 'base64')
        const embedded = match[1].toLowerCase() === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
        const maxWidth = textW
        const maxHeight = 105
        const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1)
        const width = Math.min(block.img.w ?? embedded.width, maxWidth, embedded.width) * scale
        const height = block.img.h ? Math.min(block.img.h, maxHeight) : width * embedded.height / embedded.width
        ensure(height + 10)
        const x = block.align === 'center' ? MX + (textW - width) / 2 : block.align === 'right' ? MX + textW - width : MX
        page.drawImage(embedded, { x, y: y - height, width, height })
        y -= height + 8
      } catch {
        // Gambar rusak/format tak didukung tidak boleh menggagalkan ekspor seluruh surat.
      }
      continue
    }
    if (block.kind === 'hr') { ensure(12); y -= 6; page.drawLine({ start: { x: MX, y }, end: { x: A4[0] - MX, y }, thickness: 0.7, color: GRID }); y -= 8; continue }

    if (block.kind === 'p') {
      const indent = block.indent + (block.bullet ? 14 : 0)
      const lines = wrap(block.runs, f, block.size, textW - indent)
      y -= block.before
      lines.forEach((ln, idx) => {
        const lh = ln.size * LH
        ensure(lh)
        y -= lh
        if (idx === 0 && block.bullet) page.drawText(block.bullet, { x: MX + block.indent, y, size: block.size, font: f.reg, color: INK })
        drawLine(page, ln, MX + indent, y, textW - indent, block.align)
      })
      y -= block.after
      continue
    }

    // Gambar inline saat ini diabaikan; lanjutkan hanya untuk blok tabel.
    if (block.kind !== 'table') continue

    // tabel
    const cols = Math.max(1, ...block.rows.map((r) => r.reduce((s, c) => s + c.colspan, 0)))
    // Lebar kolom proporsional terhadap panjang isi (minimum agar kolom sempit tetap terbaca).
    const weights = Array.from({ length: cols }, () => 4)
    for (const row of block.rows) {
      let ci = 0
      for (const c of row) {
        if (c.colspan === 1) { const len = Math.min(40, c.runs.reduce((s, r) => s + r.t.length, 0)); weights[ci] = Math.max(weights[ci], len) }
        ci += c.colspan
      }
    }
    const wSum = weights.reduce((s, w) => s + w, 0)
    const colWidth = weights.map((w) => (textW * w) / wSum)
    const PAD = 4, TS = 9
    for (const row of block.rows) {
      let x = MX
      let colIdx = 0
      const laid = row.map((c) => {
        const w = colWidth.slice(colIdx, colIdx + c.colspan).reduce((s, v) => s + v, 0)
        colIdx += c.colspan
        const lines = wrap(c.runs, f, TS, w - PAD * 2, c.header)
        return { c, w, lines, h: lines.reduce((s, l) => s + l.size * LH, 0) + PAD * 2 }
      })
      const rowH = Math.max(...laid.map((l) => l.h), TS * LH + PAD * 2)
      ensure(rowH)
      const top = y
      for (const l of laid) {
        page.drawRectangle({ x, y: top - rowH, width: l.w, height: rowH, borderColor: GRID, borderWidth: 0.5, color: l.c.header ? HEAD_BG : undefined })
        let ly = top - PAD
        for (const ln of l.lines) { ly -= ln.size * LH; drawLine(page, ln, x + PAD, ly + 2.2, l.w - PAD * 2, l.c.align) }
        x += l.w
      }
      y -= rowH
    }
    y -= 8
  }

  // Header, footer, dan nomor halaman pada setiap halaman.
  const pages = doc.getPages()
  const head = safe(plain(meta.header ?? '')).split('\n')[0]
  const foot = safe(plain(meta.footer ?? '')).split('\n')[0]
  pages.forEach((p, i) => {
    if (head) { const w = f.reg.widthOfTextAtSize(head, 8); p.drawText(head, { x: (A4[0] - w) / 2, y: A4[1] - 34, size: 8, font: f.reg, color: MUTED }) }
    if (foot) p.drawText(foot, { x: MX, y: 30, size: 8, font: f.reg, color: MUTED })
    const label = `Halaman ${i + 1} dari ${pages.length}`
    p.drawText(label, { x: A4[0] - MX - f.reg.widthOfTextAtSize(label, 8), y: 30, size: 8, font: f.reg, color: MUTED })
  })

  return Buffer.from(await doc.save())
}
