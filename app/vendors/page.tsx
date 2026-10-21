import Dashboard from '@/components/dashboard'
import VendorManager from '@/components/documents/vendor-manager'
import { requireSession } from '@/lib/session'

export default async function VendorsPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="vendors"><VendorManager role={role} /></Dashboard>
}
