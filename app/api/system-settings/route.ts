import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { auditLogs, systemSettings } from '@/lib/db/schema'

export const runtime = 'nodejs'
const settingsSchema = z.object({
  companyName: z.string().trim().min(2).max(180), companyLegalName: z.string().trim().max(180), companyEmail: z.string().trim().email().or(z.literal('')), companyPhone: z.string().trim().max(50), companyAddress: z.string().trim().max(600), companyWebsite: z.string().trim().max(180), companyTaxId: z.string().trim().max(60), companyDocumentPrefix: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/), timezone: z.string().trim().min(1).max(80), currency: z.enum(['IDR']), dateFormat: z.enum(['dd/MM/yyyy','yyyy-MM-dd','dd MMMM yyyy']), numberingPattern: z.enum(['PREFIX-YEAR-SEQUENCE','PREFIX/TYPE/YEAR/SEQUENCE','TYPE/PREFIX/SEQUENCE']), sequenceDigits: z.number().int().min(3).max(8), sequenceReset: z.enum(['yearly','never']), requireDocumentTitle: z.boolean(), requireClient: z.boolean(), requireProject: z.boolean(), enableVersioning: z.boolean(), allowDraftDelete: z.boolean(), requireApprovalBeforeExport: z.boolean(), approvalLevels: z.number().int().min(1).max(5), requireApprovalNotes: z.boolean(), allowSelfApproval: z.boolean(), sessionTimeoutMinutes: z.number().int().min(5).max(1440), maxUploadMb: z.number().int().min(1).max(100), enforceStrongPasswords: z.boolean(), notifyOnSubmission: z.boolean(), notifyOnApproval: z.boolean(), notifyOnRejection: z.boolean(), notificationEmail: z.string().trim().email().or(z.literal('')), retentionYears: z.number().int().min(1).max(100), archiveAfterPublish: z.boolean(), watermarkDrafts: z.boolean(), updatedAt: z.string().optional(),
})
const defaults = { companyName:'PT Palos Nusantara', companyLegalName:'PT Palos Nusantara', companyEmail:'', companyPhone:'', companyAddress:'', companyWebsite:'', companyTaxId:'', companyDocumentPrefix:'PAL', timezone:'Asia/Jakarta', currency:'IDR' as const, dateFormat:'dd/MM/yyyy' as const, numberingPattern:'PREFIX-YEAR-SEQUENCE' as const, sequenceDigits:3, sequenceReset:'yearly' as const, requireDocumentTitle:true, requireClient:false, requireProject:false, enableVersioning:true, allowDraftDelete:true, requireApprovalBeforeExport:true, approvalLevels:2, requireApprovalNotes:true, allowSelfApproval:false, sessionTimeoutMinutes:60, maxUploadMb:20, enforceStrongPasswords:true, notifyOnSubmission:true, notifyOnApproval:true, notifyOnRejection:true, notificationEmail:'', retentionYears:7, archiveAfterPublish:true, watermarkDrafts:true }
const adminOnly = (role: string) => { if (role !== 'admin') throw new ApiError(403, 'Hanya Administrator yang dapat mengubah pengaturan sistem.') }

export const GET = route(async (_req, _ctx) => {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1)
  return json({ settings: { ...defaults, ...(row?.value as Record<string, unknown> ?? {}) }, updatedAt: row?.updatedAt?.toISOString() ?? null, updatedBy: row?.updatedBy ?? null, defaults })
})

export const PUT = route(async (req, ctx) => {
  adminOnly(ctx.role)
  const parsed = settingsSchema.safeParse(await readJson(req))
  if (!parsed.success) throw new ApiError(422, 'Beberapa pengaturan belum valid.', Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.') || '_', issue.message])))
  const [previous] = await db.select().from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1)
  const previousValue = (previous?.value ?? {}) as Record<string, unknown>
  const changedKeys = Object.keys(parsed.data).filter(key => JSON.stringify(previousValue[key]) !== JSON.stringify((parsed.data as Record<string, unknown>)[key]))
  const value = { ...parsed.data, updatedAt: new Date().toISOString() }
  const now = new Date()
  await db.transaction(async tx => {
    await tx.insert(systemSettings).values({ id: 'global', value, updatedBy: ctx.userId, updatedAt: now }).onConflictDoUpdate({ target: systemSettings.id, set: { value, updatedBy: ctx.userId, updatedAt: now } })
    await tx.insert(auditLogs).values({ id: randomUUID(), userId: ctx.userId, action: 'update', entityType: 'system_settings', entityId: 'global', detail: { changedKeys, changedCount: changedKeys.length } })
  })
  return json({ ok: true, settings: value, updatedAt: value.updatedAt, updatedBy: ctx.userName })
})
