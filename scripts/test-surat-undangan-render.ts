import { readFile } from 'node:fs/promises'
import { renderTemplate } from '../lib/templates/render'
import { sampleTemplateData } from '../lib/templates/service'

async function main() {
  const html = await readFile('public/surat-undangan-penawaran.html', 'utf8')
  const rendered = renderTemplate(html, sampleTemplateData('surat-undangan'))
  const unresolved = [...rendered.matchAll(/\{\{[^{}]+\}\}/g)].map((m) => m[0])
  const checklistCount = (rendered.match(/<li>/g) ?? []).length
  if (unresolved.length) throw new Error(`Placeholder belum terisi: ${[...new Set(unresolved)].join(', ')}`)
  if (checklistCount !== 5) throw new Error(`Jumlah item kelengkapan tidak sesuai: ${checklistCount}, seharusnya 5.`)
  if (!rendered.includes('PT ABC') || !rendered.includes('Budi Santoso')) throw new Error('Data vendor/penandatangan tidak ditemukan di hasil render.')
  console.log(`LULUS: ${checklistCount} kelengkapan, placeholder terisi, vendor dan penandatangan ditemukan.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
