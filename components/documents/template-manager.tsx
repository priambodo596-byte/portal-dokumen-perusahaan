'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Copy, FileUp, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { DOCUMENT_TYPES } from '@/lib/documents/constants'
import { api, ConfirmDialog, EmptyState, postForm, Toast } from './shared'
import TemplateStudio, { type Draft, type TemplateRecord } from './template-studio'

const BLANK_BODY = '<h1 style="text-align:center">{{company.name}}</h1><h2 style="text-align:center">{{typeLabel}}</h2><p>Nomor: {{documentNumber}}</p><p>Tanggal: {{documentDate}}</p><p>Kepada: {{client.name}}</p><h3>{{title}}</h3><p>{{notes}}</p><table><thead><tr><th>No</th><th>Uraian</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>{{#items}}<tr><td>{{position}}</td><td>{{description}}</td><td>{{quantity}} {{unit}}</td><td>{{unitPrice}}</td><td>{{amount}}</td></tr>{{/items}}</tbody></table><p>Subtotal: {{subtotal}}</p><p>Diskon: {{discount}}</p><p>Pajak: {{taxAmount}}</p><h3>Total: {{total}}</h3>'
const BLANK_CSS = 'body{font-family:Arial,sans-serif;color:#1f2937;font-size:12px;line-height:1.6}h1{font-size:22px}h2{font-size:17px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}'
const blank = (): Draft => ({ name: '', type: 'quotation', description: '', bodyHtml: BLANK_BODY, css: BLANK_CSS, headerHtml: '', footerHtml: '', mode: 'html', sourceFileName: null, isDefault: false })
const toDraft = (t: TemplateRecord): Draft => ({ name: t.name, type: t.type, description: t.description ?? '', bodyHtml: t.bodyHtml, css: t.css, headerHtml: t.headerHtml, footerHtml: t.footerHtml, mode: t.mode, sourceFileName: t.sourceFileName, isDefault: t.isDefault })
const fmtDate = (v: Date | string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v))
const typeLabel = (v: string) => DOCUMENT_TYPES.find((x) => x.value === v)?.label ?? v

type Session = { draft: Draft; editingId: string | null; key: string }

export default function TemplateManager({ initialTemplates, canManage, userName }: { initialTemplates: TemplateRecord[]; canManage: boolean; userName: string }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [query, setQuery] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const counter = useRef(0)
  const sp = useSearchParams()
  const deepLinked = useRef(false)

  const notify = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => { setToast({ message, kind }); window.setTimeout(() => setToast(null), 3200) }, [])
  const visible = templates.filter((t) => `${t.name} ${typeLabel(t.type)} ${t.description ?? ''} ${t.mode}`.toLowerCase().includes(query.trim().toLowerCase()))

  const open = useCallback((t: TemplateRecord) => setSession({ draft: toDraft(t), editingId: t.id, key: t.id }), [])
  const startNew = useCallback((draft: Draft = blank()) => setSession({ draft, editingId: null, key: `new-${++counter.current}` }), [])

  // Tautan langsung /templates?edit=<id>
  useEffect(() => {
    const id = sp.get('edit')
    if (!id || deepLinked.current) return
    deepLinked.current = true
    const t = templates.find((x) => x.id === id)
    if (t) open(t); else notify('Template pada tautan tidak ditemukan atau sudah dihapus.', 'error')
  }, [sp, templates, open, notify])

  function onSaved(saved: TemplateRecord) {
    setTemplates((list) => {
      const exists = list.some((t) => t.id === saved.id)
      const next = exists ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list]
      return next.map((t) => (saved.isDefault && t.type === saved.type && t.id !== saved.id ? { ...t, isDefault: false } : t))
    })
    // Simpan id agar penutupan/pembukaan ulang studio tetap merujuk template yang sama (tanpa remount editor).
    setSession((s) => (s && s.editingId !== saved.id ? { ...s, editingId: saved.id } : s))
  }

  async function makeDefault(t: TemplateRecord) {
    try {
      const saved = await api<TemplateRecord>(`/api/templates/${t.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) })
      setTemplates((l) => l.map((x) => ({ ...x, isDefault: x.id === saved.id ? true : x.type === saved.type ? false : x.isDefault })))
      notify(`“${t.name}” menjadi template default untuk ${typeLabel(t.type)}.`)
    } catch (e) { notify((e as Error).message, 'error') }
  }

  async function duplicate(t: TemplateRecord) {
    try {
      const copy = await api<TemplateRecord>('/api/templates', { method: 'POST', body: JSON.stringify({ ...toDraft(t), name: `${t.name} (Salinan)`.slice(0, 150), isDefault: false, description: t.description }) })
      setTemplates((l) => [copy, ...l]); notify('Template diduplikat sebagai draf baru.')
    } catch (e) { notify((e as Error).message, 'error') }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true); setDeleteError(null)
    try {
      await api(`/api/templates/${deleteTarget.id}`, { method: 'DELETE' })
      setTemplates((l) => l.filter((x) => x.id !== deleteTarget.id))
      notify('Template dihapus.'); setDeleteTarget(null)
    } catch (e) { setDeleteError((e as Error).message) } finally { setDeleteBusy(false) }
  }

  async function importWordTemplate(file?: File) {
    if (!file) return
    try {
      const extension = file.name.toLowerCase().split('.').pop()
      if (extension !== 'dotx' && extension !== 'docx') throw new Error('Format tidak didukung. Pilih template Microsoft Word .dotx atau .docx.')
      if (file.size > 20 * 1024 * 1024) throw new Error('Ukuran template Word maksimal 20 MB.')
      const form = new FormData()
      form.append('file', file)
      const result = await postForm<{ html: string; headerHtml: string; footerHtml: string; fileName: string; parts?: { header: boolean; footer: boolean } }>('/api/templates/upload-docx', form)
      const name = file.name.replace(/\.(dotx|docx)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Template Word'
      startNew({ ...blank(), name: name.slice(0, 150), description: `Diimpor dari template Word ${file.name}`, bodyHtml: result.html, headerHtml: result.headerHtml ?? '', footerHtml: result.footerHtml ?? '', mode: 'docx', sourceFileName: result.fileName })
      notify(result.parts?.header ? 'Template Word dan kop surat berhasil diimpor. Periksa logo/tata letak sebelum menyimpan.' : 'Template Word diimpor, tetapi bagian header/kop surat tidak ditemukan. Periksa apakah kop surat berada di area Header Word atau isi halaman.')
    } catch (e) { notify((e as Error).message || 'Template Word tidak dapat dibaca.', 'error') }
  }

  return <div className={`template-workspace ${session ? 'template-studio-open' : ''}`}>
    {session
      ? <TemplateStudio key={session.key} initial={session.draft} editingId={session.editingId} canManage={canManage} userName={userName} onClose={() => setSession(null)} onSaved={onSaved} />
      : <section className="panel form-section template-list-section">
        <div className="panel-heading">
          <div><h2>Daftar template</h2><p>Pilih template untuk diedit atau buat template baru. Template default dipakai saat dokumen diekspor ke Word/PDF.</p></div>
          {canManage && <div className="chip-row" style={{ gap: 8 }}>
            <button type="button" className="secondary-button" onClick={() => importRef.current?.click()}><FileUp size={15} /> Impor template Word</button>
            <input ref={importRef} type="file" accept=".dotx,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.template,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => { void importWordTemplate(e.target.files?.[0]); e.currentTarget.value = '' }} />
            <button type="button" className="primary-button" onClick={() => startNew()}><Plus size={15} /> Template baru</button>
          </div>}
        </div>
        <div className="template-list-toolbar">
          <div className="template-list-search"><Search size={16} /><input aria-label="Cari template" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, jenis, atau sumber template…" /></div>
          <span className="template-count">{visible.length} dari {templates.length} template</span>
        </div>
        {visible.length
          ? <div className="table-scroll"><table><thead><tr><th>Nama template</th><th>Jenis dokumen</th><th>Sumber</th><th>Terakhir diubah</th><th>Default</th><th>Aksi</th></tr></thead><tbody>{visible.map((t) => <tr key={t.id}>
            <td><strong>{t.name}</strong><div style={{ color: 'var(--muted)', fontSize: 11 }}>{t.description}</div></td>
            <td>{typeLabel(t.type)}</td>
            <td>{t.mode === 'docx' ? `DOCX${t.sourceFileName ? ` · ${t.sourceFileName}` : ''}` : 'HTML'}</td>
            <td>{fmtDate(t.updatedAt)}</td>
            <td>{t.isDefault ? <span className="status-badge status-approved">Default</span> : '—'}</td>
            <td><div className="row-actions">
              <button className="secondary-button" type="button" onClick={() => open(t)}><Pencil size={14} /> {canManage ? 'Edit' : 'Lihat'}</button>
              {canManage && <>
                <button className="icon-button" title="Duplikat template" aria-label={`Duplikat ${t.name}`} type="button" onClick={() => void duplicate(t)}><Copy size={15} /></button>
                {!t.isDefault && <button className="icon-button" title="Jadikan default" aria-label={`Jadikan ${t.name} default`} type="button" onClick={() => void makeDefault(t)}><Star size={15} /></button>}
                <button className="icon-button" title="Hapus template" aria-label={`Hapus ${t.name}`} type="button" onClick={() => { setDeleteError(null); setDeleteTarget(t) }}><Trash2 size={15} /></button>
              </>}
            </div></td>
          </tr>)}</tbody></table></div>
          : <EmptyState title={templates.length ? 'Tidak ada template yang cocok' : 'Belum ada template'} description={templates.length ? 'Ubah kata kunci pencarian.' : canManage ? 'Buat template pertama untuk mulai.' : 'Hubungi admin untuk membuat template.'} action={templates.length ? <button type="button" className="secondary-button" onClick={() => setQuery('')}>Reset pencarian</button> : canManage ? <button type="button" className="primary-button" onClick={() => startNew()}><Plus size={15} /> Template baru</button> : undefined} />}
      </section>}

    <ConfirmDialog open={!!deleteTarget} title="Hapus template?" confirmLabel="Hapus" busy={deleteBusy} error={deleteError} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)}>
      Template “{deleteTarget?.name}” akan dihapus dari daftar. Dokumen yang memakainya akan beralih ke template default jenisnya.
    </ConfirmDialog>
    <Toast message={toast?.message ?? null} kind={toast?.kind} />
  </div>
}
