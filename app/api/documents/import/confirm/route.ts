import { ApiError, json, route } from '@/lib/api'
import { validateFile } from '@/lib/documents/import-service'
import { createImportedDocument } from '@/lib/documents/service'
import { documentInputSchema } from '@/lib/documents/schemas'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Konfirmasi import: buat dokumen (selalu draft) + simpan file sumber sebagai lampiran privat. */
export const POST = route(async (req, ctx) => {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'File wajib diunggah.', { file: 'File tidak ditemukan.' })
  const payload = form.get('data')
  if (typeof payload !== 'string') throw new ApiError(422, 'Data dokumen wajib dikirim.', { data: 'Data tidak ditemukan.' })

  let raw: unknown
  try { raw = JSON.parse(payload) } catch { throw new ApiError(400, 'Data dokumen bukan JSON valid.') }
  const input = documentInputSchema.parse(raw)

  const buffer = Buffer.from(await file.arrayBuffer())
  validateFile(file.name, file.type || 'application/octet-stream', buffer.length)

  return json(await createImportedDocument(ctx, input, { fileName: file.name, mimeType: file.type || 'application/octet-stream', content: buffer }), 201)
})
