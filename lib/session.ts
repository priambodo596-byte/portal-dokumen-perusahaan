import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getRole } from '@/lib/permissions'

const TRANSIENT_DATABASE_CODES = new Set(['EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'])

function isTransientDatabaseError(error: unknown, depth = 0): boolean {
  if (!error || depth > 4 || typeof error !== 'object') return false
  const value = error as { code?: unknown; cause?: unknown; message?: unknown }
  if (typeof value.code === 'string' && TRANSIENT_DATABASE_CODES.has(value.code)) return true
  const message = String(value.message ?? '')
  if ([...TRANSIENT_DATABASE_CODES].some((code) => message.includes(code))) return true
  return isTransientDatabaseError(value.cause, depth + 1)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Untuk server component: wajib login, dengan retry terbatas untuk gangguan koneksi DB sementara. */
export async function requireSession() {
  let session
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      session = await auth.api.getSession({ headers: await headers() })
      break
    } catch (error) {
      if (!isTransientDatabaseError(error)) throw error
      console.error(`[session] Database belum dapat dijangkau (percobaan ${attempt + 1}/3).`)
      if (attempt === 2) redirect('/sign-in?error=database-unavailable')
      await wait(400 * (attempt + 1))
    }
  }
  if (!session?.user) redirect('/sign-in')
  try {
    return { userId: session.user.id, userName: session.user.name, role: await getRole(session.user.id) }
  } catch (error) {
    if (isTransientDatabaseError(error)) redirect('/sign-in?error=database-unavailable')
    throw error
  }
}
