import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { userRole } from '@/lib/db/schema'

type P = { id: string }

const roleSchema = z.object({ role: z.enum(['admin', 'manager', 'staff', 'viewer']) })

export const PATCH = route<P>(async (req, ctx, { id }) => {
  if (ctx.role !== 'admin') throw new ApiError(403, 'Hanya admin yang dapat mengubah hak akses.')
  const { role } = roleSchema.parse(await readJson(req))
  if (id === ctx.userId && role !== 'admin') throw new ApiError(409, 'Anda tidak dapat menurunkan hak akses Anda sendiri.')
  const [existing] = await db.select().from(userRole).where(eq(userRole.userId, id)).limit(1)
  if (existing) await db.update(userRole).set({ role }).where(eq(userRole.userId, id))
  else await db.insert(userRole).values({ userId: id, role })
  return json({ id, role })
})
