import JSZip from 'jszip'
import { ApiError } from '@/lib/api'
import type { StandardDocument } from '@/lib/templates/standard-registry'
import type { getDocumentDetail } from '@/lib/documents/service'

type DocumentDetail = Awaited<ReturnType<typeof getDocumentDetail>>
type TemplateValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[]

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g

function xmlDecode(value: string) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function humanDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function fieldValue(key: string, raw: TemplateValue, typeHint?: string) {
  if (raw === null || raw === undefined || raw === '') return undefined
  const value = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : undefined
  if (value === undefined) return undefined
  if (typeHint === 'date_or_period') return humanDate(value)
  if (typeHint === 'numeric_or_currency' && /^\d+(\.\d+)?$/.test(value)) return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value))
  return value
}

function replaceTextNodes(paragraph: string, resolve: (key: string) => string | undefined, missing: Set<string>) {
  const textNode = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g
  const values = [...paragraph.matchAll(textNode)]
  if (!values.length) return paragraph
  const originalText = values.map((node) => xmlDecode(node[2])).join('')
  if (!originalText.includes('{{')) return paragraph
  const replaced = originalText.replace(TOKEN, (_token, rawKey: string) => {
    const key = rawKey.trim()
    if (key.startsWith('#') || key.startsWith('/')) return ''
    const value = resolve(key)
    if (value !== undefined && value !== '') return value
    missing.add(key)
    return `[ISI: ${key}]`
  })
  let index = 0
  return paragraph.replace(textNode, (_node, attrs: string) => {
    const content = index++ === 0 ? replaced : ''
    const space = content.startsWith(' ') || content.endsWith(' ') ? ' xml:space="preserve"' : ''
    return `<w:t${attrs.replace(/\s+xml:space="[^"]*"/g, '')}${space}>${xmlEscape(content)}</w:t>`
  })
}

function readBlockValue(fields: Record<string, string>, key: string): Record<string, unknown>[] {
  const raw = fields[key]
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : []
  } catch { return [] }
}

function makeContext(detail: DocumentDetail, standard: StandardDocument, company: Record<string, unknown>) {
  const fields = detail.fields ?? {}
  const hints = new Map(standard.fields.map((field) => [field.key, field.type_hint]))
  const data: Record<string, TemplateValue> = {
    ...fields,
    document_number: detail.documentNumber,
    document_status: detail.status,
    document_title: detail.title,
    document_date: String(detail.documentDate),
    document_version: String(detail.version),
    'document.number': detail.documentNumber,
    'document.status': detail.status,
    'document.title': detail.title,
    'document.date': String(detail.documentDate),
    'document.version': String(detail.version),
    'document.author': detail.creatorName ?? '',
    company,
    'company.name': company.name as string,
    'company.tagline': company.tagline as string,
    'company.address': company.address as string,
    'company.phone': company.phone as string,
    'company.email': company.email as string,
    'company.website': company.website as string,
    'company.npwp': company.npwp as string,
  }
  const resolve = (key: string, row?: Record<string, unknown>) => {
    const raw = (row && Object.prototype.hasOwnProperty.call(row, key) ? row[key] : data[key]) as TemplateValue
    const keyHint = hints.get(key)
    return fieldValue(key, raw, keyHint)
  }
  return { fields, data, resolve }
}

function processParagraphs(xml: string, resolve: (key: string) => string | undefined, missing: Set<string>) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => replaceTextNodes(paragraph, resolve, missing))
}

function processTableRows(xml: string, document: StandardDocument, fields: Record<string, string>, resolve: (key: string, row?: Record<string, unknown>) => string | undefined, missing: Set<string>) {
  return xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, (rowXml) => {
    const rowText = [...rowXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((item) => xmlDecode(item[1])).join('')
    const open = /\{\{#([a-zA-Z0-9_]+)\}\}/.exec(rowText)
    if (!open || !document.repeating_blocks.includes(open[1])) return rowXml
    const blockKey = open[1]
    const rows = readBlockValue(fields, blockKey)
    if (!rows.length) missing.add(`tabel:${blockKey}`)
    const outputRows = (rows.length ? rows : [{}]).map((entry, position) => {
      const item = { position: String(position + 1), No: String(position + 1), ...entry }
      const replacedMarkers = rowXml.replace(TOKEN, (_token, key: string) => key === `#${blockKey}` || key === `/${blockKey}` ? '' : _token)
      return processParagraphs(replacedMarkers, (key) => resolve(key, item), missing)
    })
    return outputRows.join('')
  })
}

/** Isi master DOCX asli agar kop, tabel, logo, margin, dan header/footer tetap mengikuti file perusahaan. */
export async function renderStandardDocx(content: Buffer, detail: DocumentDetail, standard: StandardDocument, company: Record<string, unknown>) {
  const sourceHash = detail.fields._standard_template_sha256
  if (!sourceHash) throw new ApiError(409, 'Versi master DOCX tidak tercatat pada draf ini.')
  const context = makeContext(detail, standard, company)
  const missing = new Set<string>()
  let zip: JSZip
  try { zip = await JSZip.loadAsync(content) }
  catch { throw new ApiError(422, 'Master DOCX rusak atau tidak dapat dibaca.') }

  const parts = Object.keys(zip.files).filter((name) => /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name))
  if (!parts.includes('word/document.xml')) throw new ApiError(422, 'Isi master DOCX tidak ditemukan.')
  for (const name of parts) {
    const file = zip.file(name)
    if (!file) continue
    let xml = await file.async('string')
    xml = processTableRows(xml, standard, context.fields, context.resolve, missing)
    xml = processParagraphs(xml, context.resolve, missing)
    zip.file(name, xml)
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { buffer, missingFields: [...missing].sort() }
}
