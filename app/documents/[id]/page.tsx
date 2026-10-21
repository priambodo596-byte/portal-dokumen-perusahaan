import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Dashboard from '@/components/dashboard'
import DocumentActions from '@/components/documents/document-actions'
import { DocumentStatusBadge } from '@/components/documents/shared'
import { ApiError } from '@/lib/api'
import { formatRupiah, typeLabel } from '@/lib/documents/constants'
import { getDocumentDetail } from '@/lib/documents/service'
import { requireSession } from '@/lib/session'

const fmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
const dateOnly = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
const ACTIONS: Record<string, string> = {
  create: 'Dibuat', update: 'Diubah', delete: 'Dihapus', duplicate: 'Disalin dari dokumen lain', import: 'Diimpor', export: 'Diekspor',
  'approval:submit': 'Diajukan untuk persetujuan', 'approval:review': 'Masuk tahap review', 'approval:approve': 'Disetujui', 'approval:reject': 'Ditolak',
  'approval:request-revision': 'Diminta revisi', 'approval:publish': 'Diterbitkan', 'approval:archive': 'Diarsipkan',
}
const KIND_LABEL: Record<string, string> = { attachment: 'Lampiran', 'import-source': 'Sumber impor', 'export-docx': 'Hasil export Word', 'export-pdf': 'Hasil export PDF' }

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, role } = await requireSession()
  const { id } = await params
  const d = await getDocumentDetail(id).catch((e) => { if (e instanceof ApiError && e.status === 404) notFound(); throw e })
  return <Dashboard initialRoute="documents">
    <Link href="/documents" className="back-link"><ChevronLeft size={13} /> Kembali ke daftar</Link>
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> {typeLabel(d.type)} · {d.documentNumber}</div><h1>{d.title}</h1><p><DocumentStatusBadge status={d.status} /> &nbsp;Versi {d.version}</p></div>
      <DocumentActions id={d.id} number={d.documentNumber} title={d.title} status={d.status} ownerId={d.createdBy} userId={userId} role={role} /></section>
    <div className="detail-grid">
      <div style={{ display: 'grid', gap: 17 }}>
        <section className="panel"><div className="panel-heading"><div><h2>Informasi utama</h2></div></div>
          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>Nomor dokumen</dt><dd>{d.documentNumber}</dd><dt>Jenis</dt><dd>{typeLabel(d.type)}</dd><dt>Tanggal</dt><dd>{dateOnly.format(new Date(d.documentDate))}</dd>
            <dt>Klien</dt><dd>{d.client?.name ?? '—'}</dd><dt>Proyek</dt><dd>{d.project?.name ?? '—'}</dd><dt>Pembuat</dt><dd>{d.creatorName ?? '—'}</dd><dt>Catatan</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{d.notes || '—'}</dd>
          </dl></section>
        <section className="panel"><div className="panel-heading"><div><h2>Rincian item</h2></div></div>
          {d.items.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 12 }}>Dokumen ini tidak memiliki rincian item.</p> : <div className="table-scroll"><table style={{ minWidth: 620 }}><thead><tr><th>#</th><th>Uraian</th><th>Satuan</th><th className="num">Kuantitas</th><th className="num">Harga satuan</th><th className="num">Jumlah</th></tr></thead>
            <tbody>{d.items.map((i) => <tr key={i.id}><td>{i.position}</td><td style={{ whiteSpace: 'normal' }}>{i.description}</td><td>{i.unit ?? '—'}</td><td className="num">{Number(i.quantity).toLocaleString('id-ID')}</td><td className="num">{formatRupiah(i.unitPrice)}</td><td className="num">{formatRupiah(i.amount)}</td></tr>)}</tbody></table></div>}
          <div className="totals"><div><span>Subtotal</span><span>{formatRupiah(d.subtotal)}</span></div><div><span>Diskon</span><span>{formatRupiah(d.discount)}</span></div><div><span>Pajak ({Number(d.taxRate)}%)</span><span>{formatRupiah(d.taxAmount)}</span></div><div className="grand"><span>Total</span><span>{formatRupiah(d.total)}</span></div></div></section>
      </div>
      <div style={{ display: 'grid', gap: 17 }}>
        <section className="panel"><div className="panel-heading"><div><h2>Lampiran &amp; File</h2></div></div>
          {d.files.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada file terlampir.</p>
            : <ul className="file-list">{d.files.map((f) => <li key={f.id}>
              <a href={`/api/documents/${d.id}/files/${f.id}/download`} download>{f.fileName}</a>
              <small>{KIND_LABEL[f.kind] ?? f.kind} · {(f.size / 1024).toFixed(1)} KB · {f.uploaderName ?? 'Pengguna'} · {fmt.format(f.createdAt)}</small>
            </li>)}</ul>}</section>
        <section className="panel"><div className="panel-heading"><div><h2>Riwayat versi</h2></div></div>
          <ol className="timeline">{d.versions.map((v) => <li key={v.version}><strong>Versi {v.version}</strong> — {v.changeNote ?? 'Perubahan disimpan'}<small>{v.userName ?? 'Pengguna'} · {fmt.format(v.createdAt)}</small></li>)}</ol></section>
        <section className="panel"><div className="panel-heading"><div><h2>Aktivitas</h2></div></div>
          <ol className="timeline">{d.logs.map((l, i) => <li key={i}><strong>{ACTIONS[l.action] ?? l.action}</strong><small>{l.userName ?? 'Pengguna'} · {fmt.format(l.createdAt)}</small></li>)}</ol></section>
      </div>
    </div>
  </Dashboard>
}
