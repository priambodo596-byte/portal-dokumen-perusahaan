import JSZip from 'jszip'
import { COMPANY, COMPANY_TAGLINE } from '@/lib/company'

type HtmlToDocxFn = (html: string, headerHtml: string, options: Record<string, unknown>, footerHtml?: string) => Promise<Buffer | Blob>

let cached: HtmlToDocxFn | null = null
async function loadConverter(): Promise<HtmlToDocxFn> {
  if (cached) return cached
  const mod = (await import('html-to-docx')) as unknown as { default?: HtmlToDocxFn } & HtmlToDocxFn
  cached = (mod.default ?? mod) as HtmlToDocxFn
  return cached
}

/** Bungkus body + CSS menjadi satu dokumen HTML untuk konverter. Header/footer dikirim terpisah agar menjadi header/footer Word asli. */
export function wrapHtml(bodyHtml: string, css: string) {
  const style = css ? `<style>${css}</style>` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${COMPANY.name}</title>${style}</head><body>${bodyHtml}</body></html>`
}

/** True bila HTML header/footer benar-benar berisi teks atau gambar (bukan sekadar whitespace/tag kosong). */
export function hasVisibleContent(html: string | undefined | null): boolean {
  if (!html) return false
  if (/<img\b/i.test(html) || /<hr\b/i.test(html)) return true
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|\s/g, '').length > 0
}

/**
 * html-to-docx 1.8 melempar "Invalid XML name: @w" bila <td>/<th> memakai lebar persen.
 * Ubah lebar persen sel menjadi piksel (relatif terhadap lebar area isi A4 ±880px).
 */
const CONTENT_WIDTH_PX = 880
export function normalizeCellWidths(html: string): string {
  const px = (n: string) => Math.max(1, Math.round((parseFloat(n) * CONTENT_WIDTH_PX) / 100))
  return html.replace(/<(td|th)\b([^>]*)>/gi, (_m, tag: string, attrs: string) => {
    const fixed = attrs
      .replace(/((?<![\w-])width\s*:\s*)([\d.]+)%/gi, (_x, p: string, n: string) => `${p}${px(n)}px`)
      .replace(/((?<![\w-])width\s*=\s*["']?)([\d.]+)%/gi, (_x, p: string, n: string) => `${p}${px(n)}`)
    return `<${tag}${fixed}>`
  })
}

/** Konversi HTML template yang sudah dirender menjadi buffer DOCX. */
export async function htmlToDocx(bodyHtml: string, css: string, headerHtml: string, footerHtml: string, meta: { title: string; subject?: string }): Promise<Buffer> {
  const convert = await loadConverter()
  const html = wrapHtml(normalizeCellWidths(bodyHtml), css)
  const withHeader = hasVisibleContent(headerHtml)
  const withFooter = hasVisibleContent(footerHtml)
  // Header/footer dipasang sebagai bagian header/footer Word sehingga tampil di SETIAP halaman.
  const partHtml = (inner: string) => `<div style="font-family:Arial,sans-serif">${normalizeCellWidths(inner)}</div>`
  const result = await convert(html, withHeader ? partHtml(headerHtml) : '', {
    orientation: 'portrait',
    pageSize: { width: 11906, height: 16838 },
    margins: { top: 1000, right: 1000, bottom: 1000, left: 1000, header: 500, footer: 500 },
    title: meta.title,
    subject: meta.subject ?? COMPANY_TAGLINE,
    creator: COMPANY.name,
    description: COMPANY_TAGLINE,
    header: withHeader,
    footer: withFooter,
    headerType: 'default',
    footerType: 'default',
    font: 'Arial',
    fontSize: 22,
    decodeUnicode: true,
    table: { row: { cantSplit: true } },
  }, withFooter ? partHtml(footerHtml) : undefined)
  const output = Buffer.isBuffer(result) ? result : Buffer.from(await (result as Blob).arrayBuffer())

  // Normalize the generated OOXML for better compatibility with Microsoft Word.
  const zip = await JSZip.loadAsync(output)
  const documentXml = zip.file('word/document.xml')
  if (documentXml) {
    let xml = await documentXml.async('string')
    const leadingSection = xml.match(/<w:body([^>]*)>(\s*)(<w:sectPr\b[\s\S]*?<\/w:sectPr>)/)
    if (leadingSection) {
      const sectionXml = leadingSection[3]
      xml = xml.replace(leadingSection[0], `<w:body${leadingSection[1]}>${leadingSection[2]}`)
      xml = xml.replace('</w:body>', `${sectionXml}</w:body>`)
    }
    xml = xml.replace(/\s+[\w:.-]+="undefined"/g, '')
    // Skema OOXML mewajibkan headerReference/footerReference berada SEBELUM pgSz/pgMar di dalam sectPr.
    xml = xml.replace(/<w:sectPr\b([^>]*)>([\s\S]*?)<\/w:sectPr>/g, (_m, attrs: string, inner: string) => {
      const refs = inner.match(/<w:(?:header|footer)Reference\b[^>]*\/>/g) ?? []
      const rest = inner.replace(/<w:(?:header|footer)Reference\b[^>]*\/>/g, '')
      return `<w:sectPr${attrs}>${refs.join('')}${rest}</w:sectPr>`
    })
    zip.file('word/document.xml', xml)
  }
  // Bersihkan atribut "undefined" juga pada bagian header/footer Word.
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/(header|footer)\d*\.xml$/i.test(name)) continue
    const part = await zip.file(name)!.async('string')
    zip.file(name, part.replace(/\s+[\w:.-]+="undefined"/g, ''))
  }
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
