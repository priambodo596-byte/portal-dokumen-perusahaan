'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  FileCheck2,
  FilePlus2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'

const navGroups = [
  { label: 'WORKSPACE', items: [{ label: 'Dashboard', icon: LayoutDashboard }, { label: 'Proyek', icon: FolderKanban }, { label: 'Buat Dokumen', icon: FilePlus2, badge: '2' }] },
  { label: 'DOKUMEN', items: [{ label: 'Surat Penawaran', icon: FileText }, { label: 'RAB & BoQ', icon: Calculator }, { label: 'SPK & Kontrak', icon: BriefcaseBusiness }, { label: 'Dokumen Keuangan', icon: BookOpen }, { label: 'Berita Acara', icon: FileCheck2 }, { label: 'Surat-Menyurat', icon: Copy }] },
  { label: 'MANAJEMEN', items: [{ label: 'Arsip Dokumen', icon: Archive }, { label: 'Persetujuan', icon: ShieldCheck, badge: '4' }, { label: 'Laporan', icon: Activity }] },
  { label: 'PENGATURAN', items: [{ label: 'Master Data', icon: Users }, { label: 'Template Dokumen', icon: SlidersHorizontal }, { label: 'Pengguna & Hak Akses', icon: Settings2 }] },
]

const documents = [
  { no: 'SPK/014/PALOS/X/2026', title: 'Pekerjaan Renovasi Gedung Kantor Pusat', type: 'SPK', project: 'Renovasi Gedung Kantor Pusat', owner: 'Raka Pratama', date: '18 Okt 2026', status: 'Menunggu persetujuan', tone: 'amber' },
  { no: 'PEN/028/PALOS/X/2026', title: 'Penawaran Pengadaan Material Baja', type: 'Surat Penawaran', project: 'Pengadaan Material Baja', owner: 'Dina Lestari', date: '17 Okt 2026', status: 'Disetujui', tone: 'green' },
  { no: 'RAB/031/PALOS/X/2026', title: 'RAB Pembangunan Workshop Tahap II', type: 'RAB', project: 'Pembangunan Workshop Tahap II', owner: 'Raka Pratama', date: '16 Okt 2026', status: 'Dalam pemeriksaan', tone: 'blue' },
  { no: 'INV/009/PALOS/X/2026', title: 'Tagihan Termin 02 — Proyek Workshop', type: 'Invoice', project: 'Pembangunan Workshop Tahap II', owner: 'Sari Wulandari', date: '15 Okt 2026', status: 'Draft', tone: 'slate' },
  { no: 'BAST/006/PALOS/IX/2026', title: 'Serah Terima Pekerjaan Interior Lantai 3', type: 'Berita Acara', project: 'Interior Lantai 3', owner: 'Dina Lestari', date: '12 Okt 2026', status: 'Diterbitkan', tone: 'purple' },
]

const activity = [
  { initials: 'DL', name: 'Dina Lestari', action: 'mengajukan Surat Penawaran', time: '12 menit lalu', color: 'coral' },
  { initials: 'RP', name: 'Raka Pratama', action: 'memperbarui RAB Workshop', time: '1 jam lalu', color: 'blue' },
  { initials: 'SW', name: 'Sari Wulandari', action: 'membuat Invoice baru', time: '3 jam lalu', color: 'green' },
  { initials: 'AD', name: 'Andi Darmawan', action: 'menyetujui dokumen SPK', time: 'Kemarin, 16:42', color: 'purple' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function StatusBadge({ status, tone }: { status: string; tone: string }) {
  return <span className={`status-badge status-${tone}`}><span className="status-dot" />{status}</span>
}

export default function Page() {
  const [active, setActive] = useState('Dashboard')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [range, setRange] = useState('30 hari terakhir')

  const filteredDocuments = useMemo(() => documents.filter((doc) => `${doc.no} ${doc.title} ${doc.type} ${doc.project}`.toLowerCase().includes(query.toLowerCase())), [query])

  return (
    <div className="portal-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">P</div>
          <div className="brand-copy"><strong>PALOS</strong><span>Portal Dokumen</span></div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><PanelLeftClose /></button>
        </div>
        <div className="company-switcher"><div className="company-logo">P</div><div><strong>PT Palos Nusantara</strong><span>Perusahaan aktif</span></div><ChevronDown className="switcher-chevron" /></div>
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {navGroups.map((group) => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.items.map((item) => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => { setActive(item.label); setSidebarOpen(false) }}><Icon /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button> })}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp /></div><div><strong>Butuh bantuan?</strong><span>Lihat panduan penggunaan</span></div><ChevronRight /></div><div className="profile-row"><div className="avatar avatar-coral">RP</div><div className="profile-info"><strong>Raka Pratama</strong><span>Administrator</span></div><LogOut className="logout-icon" /></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight /><strong>{active}</strong></div><div className="topbar-actions"><button className="icon-button"><Search /></button><button className="icon-button notification"><Bell /><i /></button><div className="topbar-divider" /><div className="topbar-user"><div className="avatar avatar-coral">RP</div><ChevronDown /></div></div></header>
        <div className="page-wrap">
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Rabu, 21 Oktober 2026</div><h1>Selamat datang, Raka</h1><p>Berikut ringkasan aktivitas dokumen perusahaan Anda hari ini.</p></div><button className="primary-button" onClick={() => setShowCreate(true)}><Plus /> Buat dokumen</button></section>

          <section className="stat-grid" aria-label="Ringkasan dokumen">
            <div className="stat-card stat-accent"><div className="stat-top"><span>Total dokumen</span><div className="stat-icon"><FileText /></div></div><strong>248</strong><div className="stat-foot"><span className="trend-up"><ArrowUpRight /> 12,5%</span><span>dari bulan lalu</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Menunggu persetujuan</span><div className="stat-icon icon-amber"><Clock3 /></div></div><strong>12</strong><div className="stat-foot"><span className="trend-warning">4 perlu ditinjau</span><span>segera</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Dokumen diterbitkan</span><div className="stat-icon icon-green"><FileCheck2 /></div></div><strong>186</strong><div className="stat-foot"><span className="trend-up"><ArrowUpRight /> 8,2%</span><span>dari bulan lalu</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Nilai penawaran</span><div className="stat-icon icon-purple"><BriefcaseBusiness /></div></div><strong>{formatCurrency(2840000000)}</strong><div className="stat-foot"><span className="trend-up"><ArrowUpRight /> 18,4%</span><span>dari bulan lalu</span></div></div>
          </section>

          <section className="content-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h2>Aktivitas dokumen</h2><p>Jumlah dokumen berdasarkan status</p></div><select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Rentang aktivitas"><option>30 hari terakhir</option><option>90 hari terakhir</option><option>Tahun ini</option></select></div><div className="chart-legend"><span><i className="legend-dot legend-blue" /> Diterbitkan</span><span><i className="legend-dot legend-amber" /> Dalam proses</span><span><i className="legend-dot legend-slate" /> Draft</span></div><div className="chart-wrap"><div className="y-axis"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /><i /></div><div className="bars">{[22, 29, 24, 34, 27, 31, 38, 29, 25, 34, 31, 37].map((height, i) => <div className="bar-group" key={i}><div className="bar blue-bar" style={{ height: `${height * 2.1}px` }} /><div className="bar amber-bar" style={{ height: `${(height - 12) * 1.15}px` }} /><div className="bar slate-bar" style={{ height: `${(height - 18) * 0.7}px` }} /></div>)}</div><div className="x-axis">{['Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt'].map((month) => <span key={month}>{month}</span>)}</div></div></div></div>
            <div className="panel category-panel"><div className="panel-heading"><div><h2>Dokumen per kategori</h2><p>Distribusi semua dokumen</p></div><button className="more-button"><MoreHorizontal /></button></div><div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>248</strong><span>Total</span></div></div><div className="category-legend"><div><i className="legend-dot legend-blue" /><span>Administrasi</span><strong>92</strong></div><div><i className="legend-dot legend-amber" /><span>Komersial</span><strong>64</strong></div><div><i className="legend-dot legend-purple" /><span>Keuangan</span><strong>51</strong></div><div><i className="legend-dot legend-slate" /><span>Perjanjian</span><strong>41</strong></div></div></div></div></section>

          <section className="bottom-grid"><div className="panel documents-panel"><div className="panel-heading"><div><h2>Dokumen terbaru</h2><p>Dokumen yang baru dibuat dan diperbarui</p></div><button className="secondary-button" onClick={() => setActive('Arsip Dokumen')}>Lihat semua <ChevronRight /></button></div><div className="table-toolbar"><div className="search-field"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari dokumen..." aria-label="Cari dokumen" /></div><button className="filter-button"><SlidersHorizontal /> Filter</button></div><div className="table-scroll"><table><thead><tr><th>Dokumen</th><th>Jenis</th><th>Proyek</th><th>Dibuat oleh</th><th>Status</th><th>Tanggal</th><th /></tr></thead><tbody>{filteredDocuments.map((doc) => <tr key={doc.no}><td><div className="document-cell"><div className="doc-icon"><FileText /></div><div><strong>{doc.title}</strong><span>{doc.no}</span></div></div></td><td><span className="type-label">{doc.type}</span></td><td><span className="project-label">{doc.project}</span></td><td><div className="owner-cell"><div className="mini-avatar">{doc.owner.split(' ').map((n) => n[0]).join('')}</div>{doc.owner}</div></td><td><StatusBadge status={doc.status} tone={doc.tone} /></td><td className="date-cell">{doc.date}</td><td><button className="more-button"><MoreHorizontal /></button></td></tr>)}</tbody></table></div></div>
            <div className="panel activity-panel"><div className="panel-heading"><div><h2>Aktivitas terbaru</h2><p>Perubahan terakhir di portal</p></div><button className="more-button"><MoreHorizontal /></button></div><div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.name + item.time}><div className={`avatar avatar-${item.color}`}>{item.initials}</div><div><p><strong>{item.name}</strong> {item.action}</p><span>{item.time}</span></div></div>)}</div><button className="activity-link">Lihat semua aktivitas <ChevronRight /></button></div></section>
        </div>
      </main>
      {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><div className="create-modal" onClick={(e) => e.stopPropagation()}><div className="modal-heading"><div><h2>Buat dokumen baru</h2><p>Pilih jenis dokumen yang ingin Anda buat.</p></div><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Tutup"><X /></button></div><div className="document-options">{['Surat Penawaran', 'RAB & BoQ', 'SPK / Kontrak', 'Invoice', 'Berita Acara', 'Surat-Menyurat'].map((item, i) => <button key={item} onClick={() => setShowCreate(false)}><span className={`option-icon option-${i}`}><FileText /></span><span><strong>{item}</strong><small>{['Dokumen komersial', 'Rencana anggaran biaya', 'Perjanjian pekerjaan', 'Dokumen tagihan', 'Administrasi proyek', 'Surat resmi perusahaan'][i]}</small></span><ChevronRight /></button>)}</div><div className="modal-footer"><button className="secondary-button" onClick={() => setShowCreate(false)}>Batal</button></div></div></div>}
    </div>
  )
}
