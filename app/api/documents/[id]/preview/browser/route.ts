import mammoth from 'mammoth'
import { ApiError, route } from '@/lib/api'
import { safeFileName } from '@/lib/documents/filenames'
import { getDocumentDetail } from '@/lib/documents/service'
import { buildTemplateData } from '@/lib/templates/service'
import { renderStandardDocx } from '@/lib/templates/standard-docx'
import { findStandardDocument, standardDocumentIsVisible } from '@/lib/templates/standard-registry'
import { getStandardTemplateFile } from '@/lib/templates/standard-files'
import { renderDocumentHtml } from '@/lib/templates/export'
import { sanitizeTemplateHtml } from '@/lib/templates/sanitize'

export const runtime = 'nodejs'

const pageCss = `
  @page { size: A4; margin: 18mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; color: #172238; background: #e9edf4; font: 12pt/1.55 Arial, Helvetica, sans-serif; }
  .paper { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; padding: 18mm 20mm; background: white; box-shadow: 0 4px 24px #17223820; }
  .notice { margin: 0 auto 14px; width: min(210mm, 100%); padding: 9px 12px; border: 1px solid #e7d79e; border-radius: 6px; background: #fff8df; color: #70551e; font: 12px/1.5 Arial, sans-serif; }
  table { max-width: 100%; border-collapse: collapse; } img { max-width: 100%; height: auto; }
  @media print { body { padding: 0; background: white; } .paper { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } .notice { display: none; } }
`

const safeCss = (css: string) => css
  .replace(/<\/style/gi, '')
  .replace(/@import[^;]*;?/gi, '')
  .replace(/url\s*\([^)]*\)/gi, 'none')
  .replace(/expression\s*\([^)]*\)/gi, '')

function htmlPage(title: string, content: string, css = '', notice = '') {
  const safeTitle = title.replace(/[<>&"']/g, '')
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${pageCss}${safeCss(css)}</style></head><body>${notice ? `<div class="notice">${notice}</div>` : ''}<article class="paper">${content}</article></body></html>`
}

export const GET = route<{ id: string }>(async (_request, ctx, { id }) => {
  const detail = await getDocumentDetail(id, ctx.role)
  const title = `${detail.documentNumber} — ${detail.title}`
  let html: string

  if (detail.templateId?.startsWith('standard:')) {
    const code = detail.templateId.slice('standard:'.length)
    const standard = findStandardDocument(code)
    if (!standard || !standardDocumentIsVisible(standard, ctx.role)) throw new ApiError(404, 'Template standar tidak ditemukan.')
    const source = await getStandardTemplateFile(code)
    if (!source) throw new ApiError(409, 'Master DOCX standar tidak tersedia.')
    if (detail.fields._standard_template_sha256 !== source.sha256) throw new ApiError(409, 'Master DOCX berubah setelah draf dibuat. Buat draf baru untuk meninjau versi yang sesuai.')
    const data = await buildTemplateData(detail)
    const rendered = await renderStandardDocx(source.content, detail, standard, data.company as unknown as Record<string, unknown>)
    const converted = await mammoth.convertToHtml({ buffer: rendered.buffer })
    const body = sanitizeTemplateHtml(converted.value)
    const warning = 'Pratinjau browser untuk master DOCX adalah konversi tampilan. Buka hasil DOCX di Word atau LibreOffice untuk memeriksa tata letak, kop, dan halaman sebelum diterbitkan.'
    html = htmlPage(title, body, '', warning)
  } else {
    const rendered = await renderDocumentHtml(ctx, id)
    const content = `${sanitizeTemplateHtml(rendered.header)}${sanitizeTemplateHtml(rendered.body)}${sanitizeTemplateHtml(rendered.footer)}`
    html = htmlPage(title, content, rendered.css)
  }

  const name = `${safeFileName(`${detail.documentNumber}-${detail.title}`)}-preview.html`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  })
})
