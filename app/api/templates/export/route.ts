import { z } from 'zod'
import { readJson, route } from '@/lib/api'
import { DOCUMENT_TYPE_VALUES } from '@/lib/documents/constants'
import { safeFileName } from '@/lib/documents/filenames'
import { htmlToDocx } from '@/lib/templates/convert'
import { htmlToPdf } from '@/lib/templates/pdf'
import { extractTemplateParts, renderTemplate } from '@/lib/templates/render'
import { sanitizeTemplateHtml } from '@/lib/templates/sanitize'
import { sampleTemplateData } from '@/lib/templates/service'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  format: z.enum(['docx', 'pdf']),
  name: z.string().trim().max(150).default('template'),
  type: z.enum(DOCUMENT_TYPE_VALUES),
  bodyHtml: z.string().max(500_000),
  css: z.string().max(100_000).default(''),
  headerHtml: z.string().max(100_000).default(''),
  footerHtml: z.string().max(100_000).default(''),
})

/** Unduh isi template yang sedang diedit (belum tentu tersimpan) sebagai DOCX atau PDF, memakai data contoh. */
export const POST = route(async (req) => {
  const input = schema.parse(await readJson(req))
  const data = sampleTemplateData(input.type)
  const extracted = extractTemplateParts(input.bodyHtml)
  const [settingsRow] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1)
  const settings = (settingsRow?.value ?? {}) as Record<string, unknown>
  const configuredLetterhead = typeof settings.letterheadHtml === 'string' ? settings.letterheadHtml : ''
  const bodySource = extracted.body
  // Kop dari Pengaturan Sistem menjadi fallback agar tetap ikut saat template tidak memiliki header sendiri.
  const headerSource = input.headerHtml.trim() || extracted.header || configuredLetterhead
  const footerSource = input.footerHtml.trim() || extracted.footer
  const body = sanitizeTemplateHtml(renderTemplate(bodySource, data))
  const header = sanitizeTemplateHtml(renderTemplate(headerSource, data))
  const footer = sanitizeTemplateHtml(renderTemplate(footerSource, data))
  const css = [extracted.css, input.css].filter(Boolean).join('\n')
  const base = safeFileName(input.name.replace(/\.(docx|pdf)$/i, ''), 'template')

  const buffer = input.format === 'docx'
    ? await htmlToDocx(body, css, header, footer, { title: input.name || 'Template' })
    : await htmlToPdf(body, { title: input.name || 'Template', header, footer })

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': input.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
      'Content-Disposition': `attachment; filename="${base}.${input.format}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
})
