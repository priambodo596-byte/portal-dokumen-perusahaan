import Dashboard from '@/components/dashboard'
import SystemSettingsManager from '@/components/settings/system-settings-manager'
import { requireSession } from '@/lib/session'

export default async function SettingsPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="settings">
    <section className="page-heading settings-page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> ADMINISTRASI / PENGATURAN SISTEM</div><h1>Pengaturan Sistem</h1><p>Pusat kendali konfigurasi perusahaan, kebijakan dokumen, persetujuan, keamanan, dan arsip.</p></div></section>
    <SystemSettingsManager role={role}/>
  </Dashboard>
}
