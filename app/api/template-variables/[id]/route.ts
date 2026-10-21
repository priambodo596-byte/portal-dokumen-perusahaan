import { randomUUID } from 'crypto'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { templateVariables } from '@/lib/db/schema'
import { can } from '@/lib/permissions'

export const runtime = 'nodejs'
type Params = { id: string }
const schema = z.object({
  token: z.string().trim().min(2).max(80).regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, 'Token harus diawali huruf dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.').optional(),
  label: z.string().trim().min(2).max(120).optional(),
  group: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  sampleValue: z.string().trim().max(500).optional(),
})

export const PATCH = route<Params>(async (req, ctx, { id }) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola variabel placeholder.')
  const input = schema.parse(await readJson(req))
  if (input.token && !id.startsWith('builtin:')) {
    const [duplicate] = await db.select({ id: templateVariables.id }).from(templateVariables).where(and(eq(templateVariables.token, input.token), ne(templateVariables.id, id), isNull(templateVariables.deletedAt))).limit(1)
    if (duplicate) throw new ApiError(409, 'Token sudah digunakan. Gunakan nama token yang berbeda.')
  }
  if (id.startsWith('builtin:')) {
    const token = decodeURIComponent(id.slice('builtin:'.length))
    const [existing] = await db.select({ id: templateVariables.id }).from(templateVariables).where(and(eq(templateVariables.token, token), isNull(templateVariables.deletedAt))).limit(1)
    const values = { ...input, token, updatedAt: new Date() }
    if (existing) {
      const [updated] = await db.update(templateVariables).set(values).where(eq(templateVariables.id, existing.id)).returning()
      return json(updated)
    }
    const [created] = await db.insert(templateVariables).values({ id: randomUUID(), token, label: input.label ?? token, group: input.group ?? 'Variabel Kustom', description: input.description ?? 'Placeholder bawaan sistem', sampleValue: input.sampleValue ?? '', createdBy: ctx.userId }).returning()
    return json(created)
  }
  const [updated] = await db.update(templateVariables).set({ ...input, updatedAt: new Date() }).where(and(eq(templateVariables.id, id), isNull(templateVariables.deletedAt))).returning()
  if (!updated) throw new ApiError(404, 'Placeholder tidak ditemukan.')
  return json(updated)
})

export const DELETE = route<Params>(async (_req, ctx, { id }) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola variabel placeholder.')
  const [deleted] = await db.update(templateVariables).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(templateVariables.id, id), isNull(templateVariables.deletedAt))).returning({ id: templateVariables.id })
  if (!deleted) throw new ApiError(404, 'Placeholder tidak ditemukan.')
  return json({ ok: true })
})
