import { ApiError, json, route } from '@/lib/api'
import { extractFromFile, validateFile } from '@/lib/documents/import-service'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Terima file import (multipart) dan kembalikan hasil ekstraksi untuk diperiksa pengguna. */
export const POST = route(async (req, ctx) => {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'File wajib diunggah.', { file: 'File tidak ditemukan.' })

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = validateFile(file.name, file.type || 'application/octet-stream', buffer.length)

  if (kind === 'doc') {
    return json({ kind, fileName: file.name, size: buffer.length, parsed: false, text: '', message: 'File .doc lama disimpan sebagai lampiran tanpa ekstraksi.' })
  }

  const extracted = await extractFromFile(kind, buffer)
  void ctx
  return json({
    kind,
    fileName: file.name,
    size: buffer.length,
    mimeType: file.type || (kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ...extracted,
    message: extracted.parsed
      ? (extracted.ocr ? 'Teks dibaca dengan OCR dari dokumen hasil scan. Periksa kembali hasilnya.' : undefined)
      : 'Tidak ada teks yang dapat diekstrak (kemungkinan PDF hasil scan tanpa lapisan teks). File tetap dapat disimpan sebagai lampiran.',
  })
})
