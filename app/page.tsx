import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard'
import { auth } from '@/lib/auth'
import { getDashboardSummary } from '@/lib/documents/service'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const summary = await getDashboardSummary()
  return <Dashboard summary={summary} />
}
