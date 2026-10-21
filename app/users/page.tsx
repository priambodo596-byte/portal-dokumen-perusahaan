import Dashboard from '@/components/dashboard'
import UserManager from '@/components/documents/user-manager'
import { requireSession } from '@/lib/session'

export default async function UsersPage() {
  const { userId, role } = await requireSession()
  return <Dashboard initialRoute="users">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Administrasi / Pengguna</div><h1>Pengguna & Hak Akses</h1><p>Kelola akun dan peran pengguna portal.</p></div></section>
    <UserManager userId={userId} role={role} />
  </Dashboard>
}
