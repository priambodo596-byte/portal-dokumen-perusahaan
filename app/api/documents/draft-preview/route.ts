import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { computeTotals } from '@/lib/documents/calc'
import { formatRupiah } from '@/lib/documents/constants'
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

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const show = (value: unknown, empty = '—') => escapeHtml(value || empty)
const plainDocument = (data: Awaited<ReturnType<typeof buildTemplateData>>) => {
  const items = data.items.length
    ? `<table class="fallback-items"><thead><tr><th>No.</th><th>Uraian</th><th>Satuan</th><th>Kuantitas</th><th>Harga satuan</th><th>Jumlah</th></tr></thead><tbody>${data.items.map((item) => `<tr><td>${item.position}</td><td>${show(item.description)}</td><td>${show(item.unit)}</td><td>${show(item.quantity)}</td><td class="money">${formatRupiah(item.unitPrice)}</td><td class="money">${formatRupiah(item.amount)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty-items">Rincian item akan tampil di sini setelah ditambahkan.</p>'
  return `<div class="fallback-notice">Template resmi untuk jenis dokumen ini belum aktif. Ini pratinjau dasar dari data yang diisi; ekspor akan mengikuti template setelah template resmi disiapkan.</div>
    <header class="fallback-company"><strong>${show(data.company.name)}</strong><span>${show(data.company.address)}</span><span>${[data.company.phone, data.company.email].filter(Boolean).map(escapeHtml).join(' · ')}</span></header>
    <div class="fallback-title"><h1>${show(data.title, 'Judul dokumen')}</h1><p>${show(data.typeLabel)}</p></div>
    <dl class="fallback-meta"><div><dt>Nomor dokumen</dt><dd>${show(data.documentNumber)}</dd></div><div><dt>Tanggal</dt><dd>${show(data.documentDate)}</dd></div><div><dt>Klien</dt><dd>${show(data.client?.name)}</dd></div><div><dt>Proyek</dt><dd>${show(data.project?.name)}</dd></div></dl>
    <h2>Rincian</h2>${items}
    <dl class="fallback-totals"><div><dt>Subtotal</dt><dd>${formatRupiah(data.subtotal)}</dd></div><div><dt>Diskon</dt><dd>${formatRupiah(data.discount)}</dd></div><div><dt>Pajak (${show(data.taxRate)}%)</dt><dd>${formatRupiah(data.taxAmount)}</dd></div><div class="total"><dt>Total</dt><dd>${formatRupiah(data.total)}</dd></div></dl>
    ${data.notes ? `<section class="fallback-notes"><h2>Catatan</h2><p>${show(data.notes)}</p></section>` : ''}`
}

function pageHtml(content: string, css = '') {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><style>
    *{box-sizing:border-box}html,body{margin:0;background:#eef1f5;color:#1b2432;font:11pt Arial,sans-serif}body{padding:20px}.paper{width:210mm;min-height:297mm;margin:0 auto;padding:20mm;background:#fff;box-shadow:0 2px 14px #17203320;overflow-wrap:anywhere}.document-header{margin-bottom:18px}.document-footer{margin-top:24px}.document-body{min-height:180mm}table{border-collapse:collapse;max-width:100%}img{max-width:100%;height:auto}${css}
  </style></head><body><article class="paper">${content}</article></body></html>`
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
  if (!template) {
    const fallbackCss = `.fallback-notice{margin:0 0 22px;padding:10px 12px;border:1px solid #e9d59a;background:#fff9e8;color:#765c20;font-size:9pt;line-height:1.5}.fallback-company{display:grid;gap:4px;padding-bottom:14px;border-bottom:3px double #27364f;font-size:9pt}.fallback-company strong{font-size:14pt}.fallback-title{text-align:center;margin:30px 0 24px}.fallback-title h1{margin:0 0 5px;font-size:16pt}.fallback-title p{margin:0;color:#5b6471}.fallback-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0 26px}.fallback-meta div,.fallback-totals div{display:flex;justify-content:space-between;gap:14px;padding:7px 9px;background:#f8f9fb}.fallback-meta dt,.fallback-totals dt{color:#5b6471}.fallback-meta dd,.fallback-totals dd{margin:0;text-align:right}.fallback-items{width:100%;font-size:9pt}.fallback-items th,.fallback-items td{border:1px solid #cfd5df;padding:7px;text-align:left}.fallback-items th{background:#f0f3f8}.fallback-items .money{text-align:right;white-space:nowrap}.empty-items{color:#777}.fallback-totals{width:min(320px,100%);margin:18px 0 0 auto}.fallback-totals .total{border-top:2px solid #27364f;background:#edf2fa;font-weight:bold}.fallback-notes{margin-top:30px}.fallback-notes p{white-space:pre-wrap}`
    return json({ templateName: null, html: pageHtml(plainDocument(data), fallbackCss), message: 'Template resmi belum aktif. Pratinjau dasar ini sudah menampilkan isian Anda, tetapi hasil ekspor memerlukan template resmi.' })
  }
  const body = sanitizeTemplateHtml(renderTemplate(template.bodyHtml, data))
  const header = sanitizeTemplateHtml(renderTemplate(template.headerHtml ?? '', data))
  const footer = sanitizeTemplateHtml(renderTemplate(template.footerHtml ?? '', data))
  const css = safeCss(template.css ?? '')
  const html = pageHtml(`<header class="document-header">${header}</header><main class="document-body">${body}</main><footer class="document-footer">${footer}</footer>`, `${css}.paper{padding-bottom:22mm}`)
  return json({ templateName: template.name, html, message: null })
})
