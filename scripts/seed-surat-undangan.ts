import { readFile } from 'node:fs/promises'
import { and, eq, isNull } from 'drizzle-orm'

async function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const contents = await readFile(file, 'utf8')
      for (const line of contents.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
        if (!match || process.env[match[1]] !== undefined) continue
        let value = match[2]
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        process.env[match[1]] = value
      }
    } catch { /* file env opsional */ }
  }
}

const NAME = 'Surat Undangan Penawaran Pengadaan Barang/Jasa — PLN UPDL Palembang'
const TYPE = 'surat-undangan'

async function main() {
  await loadLocalEnv()
  // Impor koneksi setelah environment lokal dimuat agar DATABASE_URL dari .env.local terbaca.
  const [{ db, pool }, { templates }, service] = await Promise.all([
    import('../lib/db'), import('../lib/db/schema'), import('../lib/templates/service'),
  ])
  const [bodySource, css, logo] = await Promise.all([
    readFile('public/surat-undangan-penawaran.html', 'utf8'),
    readFile('public/surat-undangan-penawaran.css', 'utf8'),
    readFile('public/pln-updl-palembang-kop.png'),
  ])
  // Embed kop secara privat di template supaya Word/PDF tidak bergantung pada akses internet saat ekspor.
  const logoUri = `data:image/png;base64,${logo.toString('base64')}`
  const bodyHtml = bodySource.replace(/https:\/\/drive\.google\.com\/thumbnail\?id=16ALwXocbkWqSbjNf5rEjMhvAU2SbrHF6&amp;sz=w1000|https:\/\/drive\.google\.com\/thumbnail\?id=16ALwXocbkWqSbjNf5rEjMhvAU2SbrHF6&sz=w1000/g, logoUri)
  const [existing] = await db.select({ id: templates.id }).from(templates).where(and(eq(templates.name, NAME), eq(templates.type, TYPE), isNull(templates.deletedAt))).limit(1)
  let templateId: string
  const input = {
    name: NAME, type: TYPE, description: 'Template surat undangan penawaran dengan kop PLN UPDL Palembang dan placeholder terstandar.',
    bodyHtml, css, headerHtml: '', footerHtml: '', mode: 'html' as const, sourceFileName: 'surat-undangan-penawaran.html', isDefault: false,
  }
  if (existing) {
    templateId = existing.id
    await service.updateTemplate(templateId, input, { userId: 'system-template-seed', userName: 'Sistem' })
  } else {
    const created = await service.createTemplate('system-template-seed', input, 'Sistem')
    templateId = created.id
  }
  await service.setDefaultTemplate(templateId)
  console.log(`Template siap: ${NAME} (type=${TYPE}, default=true, id=${templateId})`)
  await pool.end()
}

main().catch((error) => {
  console.error('Gagal menyiapkan template Surat Undangan Penawaran:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
