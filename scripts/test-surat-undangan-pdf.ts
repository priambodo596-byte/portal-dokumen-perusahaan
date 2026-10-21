import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { htmlToPdf } from '../lib/templates/pdf'
import { renderTemplate } from '../lib/templates/render'
import { sampleTemplateData } from '../lib/templates/service'

async function main() {
  const [source, logo] = await Promise.all([
    readFile('public/surat-undangan-penawaran.html', 'utf8'),
    readFile('public/pln-updl-palembang-kop.png'),
  ])
  const uri = `data:image/png;base64,${logo.toString('base64')}`
  const html = source.replace(/https:\/\/drive\.google\.com\/thumbnail\?id=16ALwXocbkWqSbjNf5rEjMhvAU2SbrHF6&amp;sz=w1000|https:\/\/drive\.google\.com\/thumbnail\?id=16ALwXocbkWqSbjNf5rEjMhvAU2SbrHF6&sz=w1000/g, uri)
  const rendered = renderTemplate(html, sampleTemplateData('surat-undangan'))
  const pdf = await htmlToPdf(rendered, { title: 'Uji Surat Undangan Penawaran PLN UPDL Palembang' })
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Hasil ekspor bukan PDF yang valid.')
  const parsed = await PDFDocument.load(pdf)
  if (parsed.getPageCount() < 1) throw new Error('PDF tidak memiliki halaman.')
  console.log(`LULUS: PDF valid, ${parsed.getPageCount()} halaman, ${pdf.length} bytes.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
