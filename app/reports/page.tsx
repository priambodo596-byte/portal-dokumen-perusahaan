import { BarChart3, FileText } from 'lucide-react'
import Dashboard from '@/components/dashboard'
import { formatRupiah, statusMeta, typeLabel } from '@/lib/documents/constants'
import { getReportsSummary } from '@/lib/documents/service'
import { requireSession } from '@/lib/session'

export default async function ReportsPage() {
  await requireSession()
  const s = await getReportsSummary()
  const maxStatus = Math.max(1, ...s.byStatus.map((r) => r.n))
  const maxType = Math.max(1, ...s.byType.map((r) => r.n))

  return <Dashboard initialRoute="reports">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Proses / Laporan</div><h1>Laporan</h1><p>Ringkasan operasional dokumen perusahaan.</p></div></section>

    <section className="stat-grid">
      <div className="stat-card stat-accent"><div className="stat-top"><span>Total dokumen</span><FileText /></div><strong>{s.documentCount}</strong></div>
      <div className="stat-card"><div className="stat-top"><span>Nilai dokumen</span><BarChart3 /></div><strong style={{ fontSize: 20 }}>{formatRupiah(Number(s.totalValue))}</strong></div>
    </section>

    <div className="content-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Dokumen per status</h2><p>Distribusi seluruh dokumen aktif</p></div></div>
        <div className="report-bars">{s.byStatus.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</p> : s.byStatus.map((r) => <div className="report-bar" key={r.status}>
          <div className="report-bar-label"><span className="status-dot" style={{ background: 'var(--blue)' }} />{statusMeta(r.status).label}</div>
          <div className="report-bar-track"><div className="report-bar-fill" style={{ width: `${(r.n / maxStatus) * 100}%` }} /></div>
          <div className="report-bar-value">{r.n}</div></div>)}</div></section>

      <section className="panel"><div className="panel-heading"><div><h2>Dokumen per jenis</h2><p>Jumlah dan nilai per jenis</p></div></div>
        <div className="report-bars">{s.byType.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</p> : s.byType.map((r) => <div className="report-bar" key={r.type}>
          <div className="report-bar-label">{typeLabel(r.type)}</div>
          <div className="report-bar-track"><div className="report-bar-fill" style={{ width: `${(r.n / maxType) * 100}%` }} /></div>
          <div className="report-bar-value">{r.n}</div>
          <div className="report-bar-sub">{formatRupiah(Number(r.value))}</div></div>)}</div></section>
    </div>
  </Dashboard>
}
