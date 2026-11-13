import Link from 'next/link'
import { ArrowRight, FileCheck2, FilePlus2, FolderKanban, ShieldCheck, Upload } from 'lucide-react'
import Dashboard from '@/components/dashboard'
import { requireSession } from '@/lib/session'

const steps = [
  { title: 'Siapkan data proyek', text: 'Tambahkan klien melalui menu Klien & Pelanggan, lalu buat proyek agar dokumen terkait dengan pekerjaan yang tepat.', href: '/master-data', label: 'Buka Klien & Pelanggan', icon: FolderKanban },
  { title: 'Buat atau impor dokumen', text: 'Gunakan formulir dokumen untuk membuat draf baru. Dokumen lama dapat diimpor dan tetap berstatus draf sampai diperiksa.', href: '/documents/new', label: 'Buat dokumen', icon: FilePlus2 },
  { title: 'Periksa dan ajukan', text: 'Buka detail draf, periksa nilai dan lampiran, lalu ajukan untuk mengikuti proses persetujuan perusahaan.', href: '/documents', label: 'Buka dokumen', icon: FileCheck2 },
  { title: 'Tinjau persetujuan dan arsip', text: 'Pemberi persetujuan dapat memeriksa antrean. Dokumen yang diterbitkan tersedia pada halaman arsip.', href: '/approvals', label: 'Buka persetujuan', icon: ShieldCheck },
]

export default async function GuidePage() {
  await requireSession()
  return <Dashboard initialRoute="panduan">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Bantuan / Panduan penggunaan</div><h1>Panduan Portal Dokumen</h1><p>Alur singkat membuat, memeriksa, menyetujui, dan mengarsipkan dokumen perusahaan.</p></div></section>
    <section className="guide-grid">{steps.map(({ title, text, href, label, icon: Icon }, index) => <article className="panel guide-card" key={title}><span className="guide-step">Langkah {index + 1}</span><span className="guide-icon"><Icon size={19} /></span><h2>{title}</h2><p>{text}</p><Link href={href}>{label}<ArrowRight size={15} /></Link></article>)}</section>
    <section className="panel guide-import"><div><h2>Dokumen sudah tersedia dalam file?</h2><p>Impor DOCX atau PDF sebagai draf. Dokumen hasil impor tetap perlu ditinjau sebelum diajukan.</p></div><Link className="primary-button" href="/documents/import"><Upload size={15} /> Impor dokumen</Link></section>
    <section className="panel guide-note"><ShieldCheck size={18} /><p>Dokumen final hanya dapat diterbitkan oleh pengguna dengan hak persetujuan. File standar perusahaan disimpan privat dan aksesnya mengikuti role akun.</p></section>
  </Dashboard>
}
