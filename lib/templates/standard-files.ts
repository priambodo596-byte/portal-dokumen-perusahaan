import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { standardTemplateFiles } from '@/lib/db/schema'

function tableNotMigrated(error: unknown) {
  const dbError = error as { code?: string; cause?: { code?: string } }
  return dbError?.code === '42P01' || dbError?.cause?.code === '42P01'
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

export async function getStandardTemplateFile(code: string) {
  try {
    const [row] = await db.select().from(standardTemplateFiles).where(eq(standardTemplateFiles.code, code)).limit(1)
    return row ?? null
  } catch (error) {
    if (tableNotMigrated(error)) return null
    throw error
  }
}

export async function saveStandardTemplateFile(input: { code: string; fileName: string; content: Buffer; uploadedBy: string }) {
  const sha256 = createHash('sha256').update(input.content).digest('hex')
  const [row] = await db.insert(standardTemplateFiles).values({
    code: input.code,
    fileName: input.fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: input.content.length,
    sha256,
    content: input.content,
    uploadedBy: input.uploadedBy,
  }).onConflictDoUpdate({
    target: standardTemplateFiles.code,
    set: { fileName: input.fileName, size: input.content.length, sha256, content: input.content, uploadedBy: input.uploadedBy, updatedAt: new Date() },
  }).returning({ code: standardTemplateFiles.code, sha256: standardTemplateFiles.sha256, size: standardTemplateFiles.size, updatedAt: standardTemplateFiles.updatedAt })
  return row
}
