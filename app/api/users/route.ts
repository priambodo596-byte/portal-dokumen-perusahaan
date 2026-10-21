import { asc, eq } from 'drizzle-orm'
import { json, route } from '@/lib/api'
import { db } from '@/lib/db'
import { user, userRole } from '@/lib/db/schema'

export const GET = route(async () => {
  const rows = await db.select({
    id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, role: userRole.role,
  }).from(user).leftJoin(userRole, eq(user.id, userRole.userId)).orderBy(asc(user.createdAt))
  return json(rows)
})
