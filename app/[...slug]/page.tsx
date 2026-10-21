import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

// Catch-all: setiap rute yang punya halaman sendiri sudah ditangani folder-nya masing-masing.
// Simpan hanya untuk memastikan pengguna anonim diarahkan ke halaman masuk sebelum 404.
export default async function PortalRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  await params
  notFound()
}