import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { ApiError } from '@/lib/api'
import { db } from '@/lib/db'
import { standardTemplateFiles } from '@/lib/db/schema'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function tableNotMigrated(error: unknown) {
  const dbError = error as { code?: string; cause?: { code?: string } }
  return dbError?.code === '42P01' || dbError?.cause?.code === '42P01'
}

function storageConfig() {
  const baseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '')
  const apiKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? 'company-document-standards'
  if (!baseUrl || !apiKey) {
    throw new ApiError(503, 'Supabase Storage belum dikonfigurasi. Isi URL proyek dan secret key di environment Vercel.')
  }
  return { baseUrl, apiKey, bucket }
}

function encodedObjectPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function storageRequest(path: string, init: RequestInit = {}) {
  const { baseUrl, apiKey, bucket } = storageConfig()
  const response = await fetch(`${baseUrl}/storage/v1/${path.replaceAll('{bucket}', encodeURIComponent(bucket))}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...init.headers,
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const hint = response.status === 404
      ? ` Bucket "${bucket}" belum dibuat; buat sebagai private bucket di Supabase Storage.`
      : ''
    throw new ApiError(502, `Permintaan ke Supabase Storage gagal (${response.status}).${hint}`, detail.slice(0, 500))
  }
  return response
}

async function uploadObject(path: string, content: Buffer) {
  await storageRequest(`object/{bucket}/${encodedObjectPath(path)}`, {
    method: 'POST',
    headers: { 'content-type': DOCX_MIME, 'x-upsert': 'true' },
    body: new Uint8Array(content),
  })
}

async function downloadObject(path: string) {
  const response = await storageRequest(`object/{bucket}/${encodedObjectPath(path)}`)
  return Buffer.from(await response.arrayBuffer())
}

async function deleteObject(path: string) {
  await storageRequest(`object/{bucket}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  })
}

export async function listUploadedStandardTemplateCodes() {
  try {
    const rows = await db.select({ code: standardTemplateFiles.code, sha256: standardTemplateFiles.sha256, size: standardTemplateFiles.size, updatedAt: standardTemplateFiles.updatedAt }).from(standardTemplateFiles)
    return Object.fromEntries(rows.map((row) => [row.code, { sha256: row.sha256, size: row.size, updatedAt: row.updatedAt }]))
  } catch (error) {
    if (tableNotMigrated(error)) return {}
    throw error
  }
}

export async function hasUploadedStandardTemplate(code: string) {
  try {
    const [row] = await db.select({ code: standardTemplateFiles.code }).from(standardTemplateFiles).where(eq(standardTemplateFiles.code, code)).limit(1)
    return !!row
  } catch (error) {
    if (tableNotMigrated(error)) return false
    throw error
  }
}

export async function getStandardTemplateFile(code: string) {
  try {
    const [row] = await db.select().from(standardTemplateFiles).where(eq(standardTemplateFiles.code, code)).limit(1)
    if (!row) return null
    const content = await downloadObject(row.storagePath)
    const sha256 = createHash('sha256').update(content).digest('hex')
    if (sha256 !== row.sha256) throw new ApiError(502, 'Checksum master DOCX di Supabase Storage tidak cocok dengan metadata.')
    return { ...row, content }
  } catch (error) {
    if (tableNotMigrated(error)) return null
    throw error
  }
}

export async function saveStandardTemplateFile(input: { code: string; fileName: string; content: Buffer; uploadedBy: string }) {
  const sha256 = createHash('sha256').update(input.content).digest('hex')
  const [previous] = await db.select().from(standardTemplateFiles).where(eq(standardTemplateFiles.code, input.code)).limit(1)
  const storagePath = previous?.sha256 === sha256 ? previous.storagePath : `${input.code}/${sha256}/${input.fileName}`

  if (previous?.storagePath !== storagePath) await uploadObject(storagePath, input.content)
  try {
    const [row] = await db.insert(standardTemplateFiles).values({
      code: input.code,
      fileName: input.fileName,
      mimeType: DOCX_MIME,
      size: input.content.length,
      sha256,
      storagePath,
      uploadedBy: input.uploadedBy,
    }).onConflictDoUpdate({
      target: standardTemplateFiles.code,
      set: { fileName: input.fileName, mimeType: DOCX_MIME, size: input.content.length, sha256, storagePath, uploadedBy: input.uploadedBy, updatedAt: new Date() },
    }).returning({ code: standardTemplateFiles.code, sha256: standardTemplateFiles.sha256, size: standardTemplateFiles.size, updatedAt: standardTemplateFiles.updatedAt })

    if (previous && previous.storagePath !== storagePath) {
      try { await deleteObject(previous.storagePath) }
      catch (error) { console.error('[standard-template] Penyimpanan master lama belum terhapus dari Storage.', error) }
    }
    return row
  } catch (error) {
    if (previous?.storagePath !== storagePath) {
      try { await deleteObject(storagePath) }
      catch (cleanupError) { console.error('[standard-template] Gagal membersihkan unggahan Storage yang belum tercatat.', cleanupError) }
    }
    throw error
  }
}
