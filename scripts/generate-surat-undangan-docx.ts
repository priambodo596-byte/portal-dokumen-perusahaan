import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { htmlToDocx } from '../lib/templates/convert'

async function main() {
  const [source, css, logo] = await Promise.all([
    readFile('public/surat-undangan-penawaran.html', 'utf8'),
    readFile('public/surat-undangan-penawaran.css', 'utf8'),
    readFile('public/pln-updl-palembang-kop.png'),
  ])
  const logoUri = `data:image/png;base64,${logo.toString('base64')}`
  const html = source
    .replace(/https:\/\/drive\.google\.com\/thumbnail\?id=16ALwXocbkWqSbjNf5rEjMhvAU2SbrHF6&amp;sz=w1000|https:\/\/drive\.google\.com\/thumbnail\?id=16ALwXocbkWqSbjNf5rEjMhvAU2SbrHF6&sz=w1000/g, logoUri)
    // Konverter HTML→Word tidak mempertahankan konten di dalam blok loop template.
    // DOCX referensi menampilkan daftar contoh; HTML di database tetap memiliki loop dinamis.
    .replace('<ol class="kelengkapan">{{#kelengkapan}}<li>{{nama}}</li>{{/kelengkapan}}</ol>', '<ol class="kelengkapan"><li>Persyaratan KAK</li><li>Formulir IDD</li><li>Sertifikat CSMS</li><li>Komitmen Anti Gratifikasi</li><li>Komitmen TKDN</li></ol>')
  // Placeholder surat selain daftar kelengkapan disimpan sebagai teks literal.
  const buffer = await htmlToDocx(html, css, '', '', {
    title: 'Template Surat Undangan Penawaran Pengadaan Barang/Jasa',
    subject: 'PLN Pusdiklat — UPDL Palembang',
  })
  await mkdir('templates', { recursive: true })
  const target = 'templates/surat-undangan-penawaran.docx'
  await writeFile(target, buffer)
  console.log(`DOCX dibuat: ${target} (${buffer.length} bytes)`)
}

main().catch((error) => {
  console.error('Gagal membuat DOCX:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
