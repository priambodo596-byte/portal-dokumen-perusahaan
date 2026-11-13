import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { computeTotals } from '@/lib/documents/calc'
import { can } from '@/lib/permissions'
import { resolveTemplateForDocument, buildTemplateData } from '@/lib/templates/service'
import { renderTemplate } from '@/lib/templates/render'
import { sanitizeTemplateHtml } from '@/lib/templates/sanitize'

export const runtime = 'nodejs'

const schema = z.object({
  type: z.string().trim().min(1).max(100),
  templateId: z.string().uuid().nullable().optional(),
  documentNumber: z.string().max(100).optional().default(''),
  title: z.string().max(200).optional().default(''),
  documentDate: z.string().max(20).optional().default(''),
  clientId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  notes: z.string().max(5000).optional().default(''),
  discount: z.number().finite().nonnegative().default(0),
  taxRate: z.number().finite().min(0).max(100).default(0),
  items: z.array(z.object({
    description: z.string().max(500).default(''), unit: z.string().max(80).nullable().optional(),
    quantity: z.number().finite().nonnegative(), unitPrice: z.number().finite().nonnegative(),
  })).max(200).default([]),
})

function safeCss(css: string) {
  return css.replace(/<\/style/gi, '<\\/style').replace(/@import[^;]*;?/gi, '').replace(/url\s*\([^)]*\)/gi, 'none').replace(/expression\s*\([^)]*\)/gi, 'none')
}

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Akun Anda tidak diizinkan membuat dokumen.')
  if (Number(req.headers.get('content-length') ?? 0) > 2 * 1024 * 1024) throw new ApiError(413, 'Data pratinjau melebihi batas 2 MB.')
  const input = schema.parse(await readJson(req))
  const [template, clientRows, projectRows] = await Promise.all([
    resolveTemplateForDocument(input.type, input.templateId ?? null),
    input.clientId ? db.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt))).limit(1) : Promise.resolve([]),
    input.projectId ? db.select().from(projects).where(and(eq(projects.id, input.projectId), isNull(projects.deletedAt))).limit(1) : Promise.resolve([]),
  ])

  if (!template) return json({ templateName: null, html: '', message: 'Belum ada template aktif untuk jenis dokumen ini. Pilih atau atur template terlebih dahulu.' })

  const totals = computeTotals(input.items, Math.trunc(input.discount), input.taxRate)
  const normalizedItems = input.items.map((item, position) => ({
    position: position + 1, description: item.description, unit: item.unit ?? null,
    quantity: String(item.quantity), unitPrice: Math.trunc(item.unitPrice), amount: Math.round(item.quantity * item.unitPrice),
  }))
  const data = await buildTemplateData({
    documentNumber: input.documentNumber.trim() || 'Nomor dibuat saat dokumen disimpan',
    title: input.title.trim() || 'Judul dokumen', type: input.type, status: 'draft',
    documentDate: input.documentDate || new Date().toISOString().slice(0, 10), notes: input.notes || null,
    subtotal: totals.subtotal, discount: totals.discount, taxRate: String(input.taxRate), taxAmount: totals.taxAmount, total: totals.total,
    creatorName: ctx.userName,
    client: clientRows[0] ?? null, project: projectRows[0] ?? null,
    items: normalizedItems.map((item, index) => ({ ...item, amount: totals.lines[index] ?? 0 })),
  })
  const body = sanitizeTemplateHtml(renderTemplate(template.bodyHtml, data))
  const header = sanitizeTemplateHtml(renderTemplate(template.headerHtml ?? '', data))
  const footer = sanitizeTemplateHtml(renderTemplate(template.footerHtml ?? '', data))
  const css = safeCss(template.css ?? '')
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><style>
    *{box-sizing:border-box}html,body{margin:0;background:#eef1f5;color:#1b2432;font:11pt Arial,sans-serif}body{padding:20px}.paper{width:210mm;min-height:297mm;margin:0 auto;padding:20mm 20mm 22mm;background:#fff;box-shadow:0 2px 14px #17203320;overflow-wrap:anywhere}.document-header{margin-bottom:18px}.document-footer{margin-top:24px}.document-body{min-height:180mm}table{border-collapse:collapse;max-width:100%}img{max-width:100%;height:auto} ${css}
  </style></head><body><article class="paper"><header class="document-header">${header}</header><main class="document-body">${body}</main><footer class="document-footer">${footer}</footer></article></body></html>`
  return json({ templateName: template.name, html, message: null })
})
