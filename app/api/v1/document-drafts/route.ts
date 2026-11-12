import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { createDocument } from '@/lib/documents/service'
import { can } from '@/lib/permissions'
import { findStandardDocument, sourceRequiresConfirmation, standardDocumentIsVisible } from '@/lib/templates/standard-registry'
import { getStandardTemplateFile } from '@/lib/templates/standard-files'

const draftSchema = z.object({
  template_code: z.string().trim().min(3).max(20),
  title: z.string().trim().min(3).max(200),
  document_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(5000).optional().default(''),
  data: z.record(z.string(), z.unknown()).default({}),
})
const AUTO_FIELDS = new Set(['document_number', 'document_status', 'document_title', 'document_date', 'document_version'])

/** Buat draft perusahaan dari schema standar. Field yang belum dikonfigurasi tidak pernah ditebak. */
export const POST = route(async (request, ctx) => {
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > 2 * 1024 * 1024) throw new ApiError(413, 'Data draf melebihi batas 2 MB.')
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Akun Anda tidak diizinkan membuat draf.')
  const input = draftSchema.parse(await readJson(request))
  const document = findStandardDocument(input.template_code)
  if (!document || !standardDocumentIsVisible(document, ctx.role)) throw new ApiError(404, 'Template standar tidak ditemukan.')
  const sourceFile = await getStandardTemplateFile(document.code)
  if (!sourceFile) throw new ApiError(409, 'Master DOCX standar belum tersedia. Admin perlu mengunggah DOCX sumber terlebih dahulu.')

  const fieldKeys = new Set(document.fields.map((field) => field.key))
  const repeatKeys = new Set(document.repeating_blocks)
  const allowedKeys = new Set([...fieldKeys, ...repeatKeys])
  const fields: Record<string, string> = {
    _standard_code: document.code,
    _standard_template_sha256: sourceFile.sha256,
  }
  for (const [key, value] of Object.entries(input.data)) {
    if (!allowedKeys.has(key)) throw new ApiError(422, 'Data draf memuat field yang tidak dikenal.', { [key]: 'Field tidak termasuk dalam skema template.' })
    if (fieldKeys.has(key) && (AUTO_FIELDS.has(key) || document.fields.find((field) => field.key === key)?.source_binding.status === 'controlled_system_value')) {
      throw new ApiError(422, 'Nilai sistem tidak dapat dimasukkan manual.', { [key]: 'Field ini diisi otomatis oleh portal.' })
    }
    if (repeatKeys.has(key)) {
      if (!Array.isArray(value) || value.length > 200) throw new ApiError(422, 'Blok berulang harus berupa daftar maksimal 200 baris.', { [key]: 'Format blok berulang tidak valid.' })
      const rows = value.map((row, index) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new ApiError(422, `Baris ${index + 1} pada blok ${key} tidak valid.`)
        const clean: Record<string, string> = {}
        for (const [field, cell] of Object.entries(row as Record<string, unknown>)) {
          if (!fieldKeys.has(field) || typeof cell !== 'string' && typeof cell !== 'number' && typeof cell !== 'boolean') throw new ApiError(422, `Field baris ${index + 1} pada blok ${key} tidak valid.`)
          clean[field] = String(cell).slice(0, 2000)
        }
        return clean
      })
      fields[key] = JSON.stringify(rows)
      continue
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new ApiError(422, 'Nilai field harus berupa teks atau angka.', { [key]: 'Format tidak valid.' })
    fields[key] = String(value).trim().slice(0, 2000)
  }

  const created = await createDocument(ctx, {
    type: 'other',
    title: `${document.code} — ${input.title}`.slice(0, 200),
    documentDate: input.document_date,
    templateId: `standard:${document.code}`,
    notes: input.notes || null,
    fields,
    discount: 0,
    taxRate: 0,
    items: [],
  })
  return json({
    ...created,
    templateCode: document.code,
    status: 'draft',
    missingFields: document.fields.filter(sourceRequiresConfirmation).filter((field) => !fields[field.key]).map((field) => field.key),
    approvalChain: document.approval_chain,
    humanApprovalRequired: true,
    agentMayPublish: false,
  }, 201)
})
