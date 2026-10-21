import JSZip from 'jszip'
import { ApiError, json, route } from '@/lib/api'
import { can } from '@/lib/permissions'
import { sanitizeTemplateHtml } from '@/lib/templates/sanitize'
import { MAX_FILE_SIZE } from '@/lib/documents/import-service'

export const runtime = 'nodejs'
export const maxDuration = 60

// Mammoth hanya membaca document.xml. Konversi header/footer melalui salinan paket DOCX.
async function convertWordPart(zip: JSZip, partName: string, mammoth: typeof import('mammoth')): Promise<string> {
  if (!zip.file(partName)) return ''
  const xml = await zip.file(partName)!.async('string')
  const synthetic = new JSZip()
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || name === 'word/document.xml' || name === 'word/_rels/document.xml.rels') continue
    synthetic.file(name, await entry.async('uint8array'))
  }
  const normalized = xml
    .replace(/<w:(hdr|ftr)(\s[^>]*)?>/i, '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>')
    .replace(/<\/w:(hdr|ftr)>/i, '</w:body></w:document>')
  synthetic.file('word/document.xml', normalized)
  const relPath = partName.replace('word/', 'word/_rels/').replace('.xml', '.xml.rels')
  const rels = zip.file(relPath)
  if (rels) synthetic.file('word/_rels/document.xml.rels', await rels.async('uint8array'))
  const buffer = await synthetic.generateAsync({ type: 'nodebuffer' })
  const result = await mammoth.convertToHtml({ buffer }, { styleMap: ['table => table.table'] })
  return result.value
}

/** Unggah template Word DOCX/DOTX dan ambil isi, header (kop surat), serta footer. */
export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola template.')
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'File DOCX wajib diunggah.', { file: 'File tidak ditemukan.' })
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension !== 'docx' && extension !== 'dotx') throw new ApiError(422, 'Format Word tidak didukung. Unggah file .docx atau .dotx.', { file: 'Ekstensi harus .docx atau .dotx.' })
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_FILE_SIZE) throw new ApiError(422, 'Ukuran file melebihi ' + (MAX_FILE_SIZE / 1024 / 1024) + ' MB.')

  try {
    const mammoth = await import('mammoth')
    const zip = await JSZip.loadAsync(buffer)
    const options = {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        'table => table.table',
      ],
    }
    const main = await mammoth.convertToHtml({ buffer }, options)
    const headerParts = Object.keys(zip.files).filter((name) => /^word\/header\d+\.xml$/i.test(name)).sort()
    const footerParts = Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/i.test(name)).sort()
    const headerHtml = (await Promise.all(headerParts.map((name) => convertWordPart(zip, name, mammoth)))).filter(Boolean).join('')
    const footerHtml = (await Promise.all(footerParts.map((name) => convertWordPart(zip, name, mammoth)))).filter(Boolean).join('')
    return json({
      html: sanitizeTemplateHtml(main.value),
      headerHtml: sanitizeTemplateHtml(headerHtml),
      footerHtml: sanitizeTemplateHtml(footerHtml),
      fileName: file.name,
      parts: { header: Boolean(headerHtml), footer: Boolean(footerHtml) },
    })
  } catch (e) {
    console.error('[templates] gagal konversi docx', e)
    throw new ApiError(422, 'Gagal membaca file Word. Pastikan file DOCX/DOTX tidak rusak.')
  }
})
