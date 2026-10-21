import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { auth } from '@/lib/auth'
import { getRole, type Role } from '@/lib/permissions'

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message) }
}

export type Ctx = { userId: string; userName: string; role: Role }

/** Bungkus route handler: autentikasi, role, dan penanganan error yang konsisten. */
export function route<P = Record<string, string>>(handler: (req: Request, ctx: Ctx, params: P) => Promise<Response>) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers })
      if (!session?.user) throw new ApiError(401, 'Sesi berakhir. Silakan masuk kembali.')
      const role = await getRole(session.user.id)
      return await handler(req, { userId: session.user.id, userName: session.user.name, role }, await params)
    } catch (e) {
      return errorResponse(e)
    }
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status })
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const i of e.issues) fields[i.path.join('.') || '_'] ??= i.message
    return NextResponse.json({ error: 'Data tidak valid.', details: fields }, { status: 422 })
  }
  const dbError = e as { code?: string; message?: string; cause?: { code?: string; message?: string } }
  const code = dbError?.code ?? dbError?.cause?.code
  const detail = dbError?.message ?? dbError?.cause?.message ?? ''
  if (code === '23505') return NextResponse.json({ error: 'Data dengan kode atau nomor tersebut sudah digunakan.' }, { status: 409 })
  if (code === '23503') return NextResponse.json({ error: 'Data tidak dapat disimpan karena masih terkait dengan data lain.' }, { status: 409 })
  if (code === '23502') return NextResponse.json({ error: 'Kolom wajib belum diisi. Periksa kembali data yang dikirim.' }, { status: 400 })
  if (code === '22001') return NextResponse.json({ error: 'Ada nilai yang melebihi batas panjang kolom.' }, { status: 400 })
  if (code === '42P01') {
    console.error('[api] Tabel database belum tersedia:', detail, e)
    return NextResponse.json({ error: 'Tabel database belum tersedia. Jalankan migrasi database terbaru lalu coba kembali.' }, { status: 500 })
  }
  if (code === '42703') {
    console.error('[api] Kolom database tidak cocok dengan schema:', detail, e)
    return NextResponse.json({ error: 'Struktur database belum sesuai dengan aplikasi. Periksa dan jalankan migrasi database terbaru.' }, { status: 500 })
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(code ?? '')) {
    console.error('[api] Koneksi database gagal:', detail, e)
    return NextResponse.json({ error: 'Database tidak dapat dihubungi. Periksa DATABASE_URL dan pastikan server database berjalan.' }, { status: 503 })
  }
  const errorId = crypto.randomUUID()
  const technicalMessage = e instanceof Error ? e.message : String(e)
  console.error(`[api] errorId=${errorId}`, e instanceof Error ? { name: e.name, message: e.message, stack: e.stack, cause: e.cause } : e)
  const message = process.env.NODE_ENV !== 'production'
    ? `Kesalahan server (${errorId}): ${technicalMessage}`
    : `Terjadi kesalahan di server. Kode laporan: ${errorId}. Periksa log server dengan kode tersebut.`
  return NextResponse.json({ error: message, errorId }, { status: 500 })
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })

export async function readJson(req: Request) {
  try { return await req.json() } catch { throw new ApiError(400, 'Body permintaan bukan JSON yang valid.') }
}
