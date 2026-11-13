import Dashboard from '@/components/dashboard'
import SystemSettingsManager from '@/components/settings/system-settings-manager'
import { requireSession } from '@/lib/session'

export default async function SettingsPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="settings">
    <section className="page-heading settings-page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> Administrasi / Perusahaan</div><h1>Pengaturan Perusahaan</h1><p>Atur identitas, penomoran dokumen, alur persetujuan, keamanan, dan retensi arsip.</p></div></section>
    <SystemSettingsManager role={role}/>
  </Dashboard>
}
