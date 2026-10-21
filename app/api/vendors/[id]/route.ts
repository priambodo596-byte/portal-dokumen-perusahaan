import { and, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { auditLogs, vendors } from '@/lib/db/schema'
import { can } from '@/lib/permissions'
import { vendorSchema } from '@/lib/documents/schemas'

export const runtime = 'nodejs'

export const PATCH = route(async (req, ctx, { id }: { id: string }) => {
  const [current] = await db.select().from(vendors).where(and(eq(vendors.id, id), isNull(vendors.deletedAt))).limit(1)
  if (!current) throw new ApiError(404, 'Data vendor tidak ditemukan.')
  if (!can(ctx.role, 'edit', { userId: ctx.userId, ownerId: current.createdBy })) throw new ApiError(403, 'Anda tidak berhak mengubah vendor ini.')
  const input = vendorSchema.parse(await readJson(req))
  try {
    const [row] = await db.update(vendors).set({
      ...input,
      npwp: input.npwp || null, address: input.address || null,
      contactPerson: input.contactPerson || null, email: input.email || null,
      phone: input.phone || null, bankName: input.bankName || null,
      bankAccount: input.bankAccount || null, bankAccountName: input.bankAccountName || null,
      notes: input.notes || null, updatedAt: new Date(),
    }).where(eq(vendors.id, id)).returning()
    await db.insert(auditLogs).values({ id: randomUUID(), userId: ctx.userId, action: 'update', entityType: 'vendor', entityId: id, detail: { vendorCode: row.vendorCode, name: row.name } })
    return json(row)
  } catch (e) {
    if ((e as { code?: string })?.code === '23505') throw new ApiError(409, 'Kode vendor atau NPWP sudah digunakan oleh vendor lain.')
    throw e
  }
})

export const DELETE = route(async (_req, ctx, { id }: { id: string }) => {
  const [current] = await db.select().from(vendors).where(and(eq(vendors.id, id), isNull(vendors.deletedAt))).limit(1)
  if (!current) throw new ApiError(404, 'Data vendor tidak ditemukan.')
  if (!can(ctx.role, 'delete', { userId: ctx.userId, ownerId: current.createdBy })) throw new ApiError(403, 'Anda tidak berhak menghapus vendor ini.')
  await db.update(vendors).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(vendors.id, id))
  await db.insert(auditLogs).values({ id: randomUUID(), userId: ctx.userId, action: 'delete', entityType: 'vendor', entityId: id, detail: { vendorCode: current.vendorCode, name: current.name } })
  return json({ success: true })
})
