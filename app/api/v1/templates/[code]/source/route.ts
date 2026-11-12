import { randomUUID } from 'node:crypto'
import JSZip from 'jszip'
import { ApiError, json, route } from '@/lib/api'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { can } from '@/lib/permissions'
import { findStandardDocument } from '@/lib/templates/standard-registry'
import { saveStandardTemplateFile } from '@/lib/templates/standard-files'

export const runtime = 'nodejs'
export const maxDuration = 30
const MAX_FILE_SIZE = 20 * 1024 * 1024

/** Simpan master DOCX standar di bucket privat Supabase Storage, bukan di direktori publik atau GitHub. */
export const POST = route(async (request, ctx, params: { code: string }) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengunggah master template.')
  const document = findStandardDocument(params.code)
  if (!document) throw new ApiError(404, 'Kode template standar tidak ditemukan.')

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'Pilih berkas DOCX yang akan diunggah.')
  const expectedName = document.file.split('/').at(-1)?.toLocaleLowerCase('id-ID')
  if (file.name.toLocaleLowerCase('id-ID') !== expectedName) throw new ApiError(422, `Berkas harus bernama ${document.file.split('/').at(-1)}.`)
  if (file.size < 4 || file.size > MAX_FILE_SIZE) throw new ApiError(422, 'Ukuran DOCX harus di bawah 20 MB.')

  const content = Buffer.from(await file.arrayBuffer())
  if (content[0] !== 0x50 || content[1] !== 0x4b) throw new ApiError(422, 'Berkas bukan arsip DOCX yang valid.')
  try {
    const zip = await JSZip.loadAsync(content)
    if (!zip.file('word/document.xml')) throw new Error('DOCX tidak memiliki isi dokumen Word.')
  } catch {
    throw new ApiError(422, 'Berkas DOCX rusak atau tidak dapat dibaca.')
  }

  const saved = await saveStandardTemplateFile({ code: document.code, fileName: file.name, content, uploadedBy: ctx.userId })
  await db.insert(auditLogs).values({
    id: randomUUID(), userId: ctx.userId, action: 'standard-template:upload', entityType: 'standard_template', entityId: document.code,
    detail: { fileName: file.name, size: saved.size, sha256: saved.sha256 },
  })
  return json({ code: saved.code, fileName: file.name, size: saved.size, sha256: saved.sha256, updatedAt: saved.updatedAt }, 201)
})
