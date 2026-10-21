import { z } from 'zod'
import { json, readJson, route } from '@/lib/api'
import { renderTemplate } from '@/lib/templates/render'
import { sanitizeTemplateHtml } from '@/lib/templates/sanitize'
import { sampleTemplateData } from '@/lib/templates/sample-data'

export const runtime = 'nodejs'

const schema = z.object({
  type: z.string().trim().min(1).max(100),
  bodyHtml: z.string().max(2_000_000),
  css: z.string().max(200_000).default(''),
  headerHtml: z.string().max(100_000).default(''),
  footerHtml: z.string().max(100_000).default(''),
})

/** Pratinjau live untuk konten editor yang belum disimpan, memakai data contoh. */
export const POST = route(async (req) => {
  const { type, bodyHtml, css, headerHtml, footerHtml } = schema.parse(await readJson(req))
  const data = sampleTemplateData(type)

  // Jika pengguna menempelkan satu dokumen HTML penuh (termasuk <style>, <header>, <main>, dan <footer>),
  // pecah menjadi bagian preview agar kop surat tidak hilang atau tertimbun di area isi.
  let source = bodyHtml
  let extractedCss = ''
  const styleBlocks = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  if (styleBlocks.length) {
    extractedCss = styleBlocks.map((m) => m[1]).join('\n')
    source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  }
  const extractedHeader = source.match(/<header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? ''
  const extractedFooter = source.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? ''
  if (extractedHeader) source = source.replace(extractedHeader, '')
  if (extractedFooter) source = source.replace(extractedFooter, '')
  source = source.replace(/<!doctype[^>]*>/gi, '').replace(/<\/?(?:html|head|body|main)\b[^>]*>/gi, '')

  const finalHeader = headerHtml || extractedHeader
  const finalFooter = footerHtml || extractedFooter
  return json({
    body: sanitizeTemplateHtml(renderTemplate(source, data)),
    header: sanitizeTemplateHtml(renderTemplate(finalHeader, data)),
    footer: sanitizeTemplateHtml(renderTemplate(finalFooter, data)),
    css: [extractedCss, css].filter(Boolean).join('\n'),
  })
})
