import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard'
import { auth } from '@/lib/auth'

export default async function PortalRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const { slug } = await params
  return <Dashboard initialRoute={slug.join('/')} />
}
