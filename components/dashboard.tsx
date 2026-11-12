'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { Activity, Archive, Bell, BriefcaseBusiness, Calculator, ChevronRight, FileCheck2, FilePlus2, FileText, FolderKanban, LayoutDashboard, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Truck, Upload, Users, X } from 'lucide-react'
import { formatRupiah, statusMeta, typeLabel } from '@/lib/documents/constants'
import type { Role } from '@/lib/permissions-client'

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; createOnly?: boolean; adminOnly?: boolean }
const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'RUANG KERJA', items: [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Proyek', href: '/projects', icon: FolderKanban },
    { label: 'Semua Dokumen', href: '/documents', icon: FileText },
    { label: 'Buat Dokumen', href: '/documents/new', icon: FilePlus2, createOnly: true },
    { label: 'Impor Dokumen', href: '/documents/import', icon: Upload, createOnly: true },
  ] },
  { label: 'JENIS DOKUMEN', items: [
    { label: 'RAB & BoQ', href: '/rab', icon: Calculator },
    { label: 'Surat Penawaran', href: '/quotations', icon: FileText },
    { label: 'SPK PJ', href: '/spk-pj', icon: BriefcaseBusiness },
    { label: 'Kontrak', href: '/contracts', icon: FileCheck2 },
    { label: 'Invoice & Pembayaran', href: '/invoices', icon: FileText },
    { label: 'Berita Acara & BAST', href: '/minutes', icon: FileCheck2 },
  ] },
  { label: 'TINJAUAN', items: [
    { label: 'Persetujuan', href: '/approvals', icon: ShieldCheck },
    { label: 'Arsip Dokumen', href: '/archives', icon: Archive },
    { label: 'Laporan', href: '/reports', icon: Activity },
  ] },
  { label: 'DATA & ADMINISTRASI', items: [
    { label: 'Master Data Klien', href: '/master-data', icon: Users },
    { label: 'Data Vendor', href: '/vendors', icon: Truck },
    { label: 'Template Dokumen', href: '/templates', icon: SlidersHorizontal },
    { label: 'Standar PT.Palos', href: '/templates/standar', icon: ShieldCheck },
    { label: 'Variabel & Placeholder', href: '/templates/variables', icon: FileText },
    { label: 'Pengguna & Hak Akses', href: '/users', icon: Users, adminOnly: true },
    { label: 'Pengaturan Sistem', href: '/settings', icon: Settings2, adminOnly: true },
  ] },
]

const pageMeta: Record<string, { title: string; description: string; singular: string }> = {
  projects: { title: 'Proyek', description: 'Kelola proyek, anggota, dan dokumen terkait.', singular: 'proyek' },
  vendors: { title: 'Data Vendor', description: 'Kelola vendor, kontak, informasi pajak, dan rekening pembayaran.', singular: 'vendor' },
  documents: { title: 'Semua Dokumen', description: 'Cari, filter, dan kelola dokumen perusahaan.', singular: 'dokumen' },
  'documents/new': { title: 'Buat Dokumen', description: 'Susun dokumen baru sesuai kebutuhan perusahaan.', singular: 'dokumen' },
  'documents/import': { title: 'Impor Dokumen', description: 'Masukkan dokumen lama sebagai draf untuk diperiksa.', singular: 'dokumen' },
  'documents/standard/new': { title: 'Buat Dokumen Standar', description: 'Buat draf dari standar perusahaan.', singular: 'dokumen' },
  panduan: { title: 'Panduan Penggunaan', description: 'Panduan alur kerja portal dokumen perusahaan.', singular: 'panduan' },
  rab: { title: 'RAB & BoQ', description: 'Rencana anggaran biaya dan daftar kuantitas pekerjaan.', singular: 'RAB' },
  quotations: { title: 'Surat Penawaran', description: 'Kelola penawaran komersial berdasarkan proyek.', singular: 'surat penawaran' },
  'spk-pj': { title: 'SPK PJ', description: 'Kelola surat perintah kerja sesuai template perusahaan.', singular: 'SPK PJ' },
  contracts: { title: 'Kontrak', description: 'Kelola kontrak, nilai, termin, dan masa berlaku.', singular: 'kontrak' },
  invoices: { title: 'Invoice & Pembayaran', description: 'Pantau tagihan dan status pembayaran proyek.', singular: 'invoice' },
  minutes: { title: 'Berita Acara & BAST', description: 'Kelola berita acara pemeriksaan dan serah terima.', singular: 'berita acara' },
  archives: { title: 'Arsip Dokumen', description: 'Akses dokumen final dan riwayat penerbitannya.', singular: 'arsip' },
  approvals: { title: 'Persetujuan', description: 'Tinjau dokumen yang menunggu tindakan Anda.', singular: 'pengajuan' },
  reports: { title: 'Laporan', description: 'Ringkasan data operasional perusahaan.', singular: 'laporan' },
  'master-data': { title: 'Master Data Klien', description: 'Kelola data referensi yang digunakan dokumen.', singular: 'klien' },
  templates: { title: 'Template Dokumen', description: 'Kelola template dan standar dokumen perusahaan.', singular: 'template' },
  'templates/standar': { title: 'Pustaka Dokumen Standar', description: 'Katalog standar, skema field, dan persetujuan PT.Palos.', singular: 'dokumen standar' },
  'templates/variables': { title: 'Variabel & Placeholder', description: 'Referensi token template surat dan dokumen.', singular: 'placeholder' },
  users: { title: 'Pengguna & Hak Akses', description: 'Kelola akun, role, dan akses portal.', singular: 'pengguna' },
  settings: { title: 'Pengaturan Sistem', description: 'Konfigurasi portal dan kebijakan perusahaan.', singular: 'pengaturan' },
}

type DocumentRow = { id: string; documentNumber: string; title: string; type: string; status: string; updatedAt: string; total: number }
type DashboardData = { documentCount: number; totalValue: number; pendingCount: number; publishedCount: number; latest: DocumentRow[] }
type SearchResult = { id: string; documentNumber: string; title: string; type: string; status: string }
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('id-ID') || 'P'
const roleLabel: Record<Role, string> = { admin: 'Administrator', manager: 'Manajer', staff: 'Staf', viewer: 'Pembaca' }

export default function Dashboard({ initialRoute = '', children }: { initialRoute?: string; children?: React.ReactNode }) {
  const pathname = usePathname()
  const activePath = initialRoute ? `/${initialRoute}` : pathname
  const route = activePath.replace(/^\//, '')
  const isHome = !route
  const meta = pageMeta[route] ?? pageMeta.documents
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('Pengguna')
  const [role, setRole] = useState<Role>('staff')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchRows, setSearchRows] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [homeData, setHomeData] = useState<DashboardData | null>(null)
  const [homeError, setHomeError] = useState('')

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return
      const data = await response.json() as { userName: string; role: Role }
      setUserName(data.userName || 'Pengguna')
      setRole(data.role)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isHome) return
    fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ringkasan dashboard gagal dimuat.')
      setHomeData(data as DashboardData)
      setHomeError('')
    }).catch((error: Error) => setHomeError(error.message))
  }, [isHome])

  useEffect(() => {
    if (!searchOpen) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!search.trim()) { setSearchRows([]); return }
      setSearching(true)
      try {
        const response = await fetch(`/api/documents?q=${encodeURIComponent(search.trim())}&pageSize=7`, { signal: controller.signal, cache: 'no-store' })
        const data = await response.json()
        if (response.ok) setSearchRows(data.rows as SearchResult[])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setSearchRows([])
      } finally { setSearching(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, searchOpen])

  const nav = useMemo(() => navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => (!item.createOnly || role !== 'viewer') && (!item.adminOnly || role === 'admin')),
  })).filter((group) => group.items.length), [role])
  const activeTitle = isHome ? 'Dashboard' : meta.title
  const avatar = initials(userName)

  return <div className="portal-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-row"><div className="brand-mark">P</div><div className="brand-copy"><strong>PALOS</strong><span>Portal Dokumen</span></div><button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><X /></button></div>
      <div className="company-switcher"><div className="company-logo">P</div><div><strong>PT Palos Nusantara</strong><span>Perusahaan aktif</span></div></div>
      <nav className="sidebar-nav" aria-label="Navigasi utama">{nav.map((group) => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.items.map((item) => {
        const Icon = item.icon
        const active = item.href === '/' ? isHome : item.href === '/documents' ? activePath === '/documents' || activePath.startsWith('/documents/') && !['/documents/new', '/documents/import', '/documents/standard/new'].includes(activePath) : item.href === '/templates' ? activePath === '/templates' : activePath === item.href || activePath.startsWith(`${item.href}/`)
        return <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setSidebarOpen(false)}><Icon /><span>{item.label}</span></Link>
      })}</div>)}</nav>
      <div className="sidebar-bottom">
        <Link href="/panduan" className="help-card"><span className="help-icon">?</span><span><strong>Panduan penggunaan</strong><span>Alur kerja dan bantuan portal</span></span><ChevronRight /></Link>
        <div className="profile-row"><div className="avatar avatar-coral">{avatar}</div><div className="profile-info"><strong>{userName}</strong><span>{roleLabel[role]}</span></div><button className="icon-button" aria-label="Keluar" title="Keluar" onClick={() => signOut({ fetchOptions: { onSuccess: () => window.location.assign('/sign-in') } })}><LogOut className="logout-icon" /></button></div>
      </div>
    </aside>

    <main className="main-content"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu /></button><div className="breadcrumbs"><span>Ruang kerja</span><ChevronRight /><strong>{activeTitle}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Cari dokumen" title="Cari dokumen" onClick={() => setSearchOpen(true)}><Search /></button><Link className="icon-button" href="/approvals" aria-label="Buka persetujuan" title="Persetujuan"><Bell /></Link><div className="topbar-divider" /><div className="topbar-user"><div className="avatar avatar-coral">{avatar}</div><span>{userName}</span></div></div></header>
      <div className="page-wrap">{isHome ? <>
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Ruang kerja / Dashboard</div><h1>Selamat datang, {userName}</h1><p>Ringkasan dokumen dan aktivitas perusahaan dari data portal.</p></div>{role !== 'viewer' && <Link href="/documents/new" className="primary-button"><Plus /> Buat dokumen</Link>}</section>
        {homeError && <div className="banner-error" role="alert">{homeError}</div>}
        <section className="stat-grid"><div className="stat-card stat-accent"><div className="stat-top"><span>Total dokumen</span><FileText /></div><strong>{homeData?.documentCount ?? '—'}</strong><div className="stat-foot">Dokumen aktif di portal</div></div><div className="stat-card"><div className="stat-top"><span>Menunggu persetujuan</span><ShieldCheck /></div><strong>{homeData?.pendingCount ?? '—'}</strong><div className="stat-foot"><Link href="/approvals">Buka antrean persetujuan</Link></div></div><div className="stat-card"><div className="stat-top"><span>Dokumen diterbitkan</span><FileCheck2 /></div><strong>{homeData?.publishedCount ?? '—'}</strong><div className="stat-foot"><Link href="/archives">Lihat arsip</Link></div></div><div className="stat-card"><div className="stat-top"><span>Nilai dokumen</span><BriefcaseBusiness /></div><strong style={{ fontSize: 20 }}>{homeData ? formatRupiah(Number(homeData.totalValue)) : '—'}</strong><div className="stat-foot">Akumulasi seluruh dokumen aktif</div></div></section>
        <section className="content-grid"><div className="panel"><div className="panel-heading"><div><h2>Dokumen terbaru</h2><p>Perubahan terakhir yang tercatat</p></div><Link href="/documents">Semua dokumen <ChevronRight /></Link></div>{!homeData ? <p className="dashboard-loading">Memuat dokumen…</p> : homeData.latest.length === 0 ? <p className="dashboard-loading">Belum ada dokumen. Buat dokumen pertama untuk memulai.</p> : <div className="dashboard-recent-list">{homeData.latest.map((doc) => <Link href={`/documents/${doc.id}`} className="dashboard-recent-row" key={doc.id}><span className="doc-icon"><FileText /></span><span className="dashboard-recent-copy"><strong>{doc.title}</strong><small>{doc.documentNumber} · {typeLabel(doc.type)}</small></span><span className="dashboard-recent-status">{statusMeta(doc.status).label}</span></Link>)}</div>}</div><div className="panel"><div className="panel-heading"><div><h2>Alur kerja</h2><p>Kelola dokumen yang memerlukan tindakan</p></div><ShieldCheck /></div><div className="approval-summary"><strong>{homeData?.pendingCount ?? '—'}</strong><span>dokumen perlu ditinjau</span><Link href="/approvals">Buka persetujuan <ChevronRight /></Link></div><div className="dashboard-shortcuts"><Link href="/documents/import"><Upload size={15} /> Impor dokumen</Link><Link href="/templates/standar"><SlidersHorizontal size={15} /> Pustaka standar</Link></div></div></section>
      </> : children ? <>{children}</> : <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Ruang kerja / {meta.title}</div><h1>{meta.title}</h1><p>{meta.description}</p></div>{role !== 'viewer' && <Link className="primary-button" href="/documents/new"><Plus /> Buat dokumen</Link>}</section>}</div>
    </main>

    {searchOpen && <div className="global-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false) }}><section className="global-search-panel" role="dialog" aria-modal="true" aria-label="Cari dokumen"><div className="global-search-input"><Search /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor, judul, klien, proyek…" aria-label="Cari dokumen" /><button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Tutup pencarian"><X /></button></div><div className="global-search-results">{searching ? <p>Mencari dokumen…</p> : !search.trim() ? <p>Ketik kata kunci untuk mencari dokumen perusahaan.</p> : searchRows.length ? searchRows.map((row) => <Link href={`/documents/${row.id}`} key={row.id} onClick={() => setSearchOpen(false)}><FileText /><span><strong>{row.title}</strong><small>{row.documentNumber} · {typeLabel(row.type)} · {statusMeta(row.status).label}</small></span><ChevronRight /></Link>) : <p>Tidak ada dokumen yang cocok.</p>}</div><div className="global-search-footer">Pencarian mengikuti hak akses akun Anda.</div></section></div>}
  </div>
}
