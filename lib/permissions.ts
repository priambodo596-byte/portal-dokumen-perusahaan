import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userRole } from '@/lib/db/schema'

import type { Role } from './permissions-client'
export type { Role, Action } from './permissions-client'

/**
 * Role pengguna. Pengguna pertama yang masuk setelah tabel kosong menjadi admin (bootstrap);
 * selanjutnya default `staff`. Admin dapat mengubah role lewat tabel user_role.
 */
export async function getRole(userId: string): Promise<Role> {
  const [row] = await db.select().from(userRole).where(eq(userRole.userId, userId)).limit(1)
  if (row) return row.role as Role
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(userRole).where(eq(userRole.role, 'admin'))
  const role: Role = n === 0 ? 'admin' : 'staff'
  await db.insert(userRole).values({ userId, role }).onConflictDoNothing()
  const [again] = await db.select().from(userRole).where(eq(userRole.userId, userId)).limit(1)
  return (again?.role as Role) ?? role
}

// Aturan hak akses ada di permissions-client.ts (murni, tanpa database) agar satu sumber kebenaran.
export { can } from './permissions-client'
