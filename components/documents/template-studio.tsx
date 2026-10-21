'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Check, ChevronDown, Copy, Download, Ellipsis, FileText,
  History, Italic, Link2, List, ListOrdered, Palette, Redo2, RotateCcw, Share2, Underline as UnderlineIcon, Undo2, Upload, X,
} from 'lucide-react'
import { DOCUMENT_TYPES } from '@/lib/documents/constants'
import { fromEditorHtml, toEditorHtml } from '@/lib/templates/loop'
import { ITEM_FIELDS, TOKEN_GROUPS } from '@/lib/templates/tokens'
import { api, ConfirmDialog, downloadFile, postForm, Toast } from './shared'
import { FONT_FAMILIES, FONT_SIZES, templateExtensions } from './template-editor-extensions'

export type TemplateRecord = { id: string; name: string; type: string; description: string | null; bodyHtml: string; css: string; headerHtml: string; footerHtml: string; mode: string; sourceFileName: string | null; isDefault: boolean; updatedAt: Date | string }
export type Draft = { name: string; type: string; description: string; bodyHtml: string; css: string; headerHtml: string; footerHtml: string; mode: string; sourceFileName: string | null; isDefault: boolean }
type Version = { id: string; version: number; name: string; savedByName: string | null; createdAt: string }
type MenuId = 'download' | 'share' | 'more' | 'vars' | 'font' | 'size' | 'color' | 'link' | null
type Preview = { body: string; header: string; footer: string; css: string }

const contentOf = (d: Draft) => JSON.stringify([d.name, d.type, d.description, d.bodyHtml, d.css, d.headerHtml, d.footerHtml, d.isDefault])
const fmtTime = (iso: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U'
const safeCss = (css: string) => css.replace(/<\/style/gi, '<\\/style')

export default function TemplateStudio({ initial, editingId: initialId, canManage, userName, onClose, onSaved }: {
  initial: Draft; editingId: string | null; canManage: boolean; userName: string
  onClose: () => void; onSaved: (t: TemplateRecord) => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [editingId, setEditingId] = useState<string | null>(initialId)
  const [saved, setSaved] = useState(() => contentOf(initial))
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)
  const [lastFormat, setLastFormat] = useState<'docx' | 'pdf'>('docx')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)
  const [menu, setMenu] = useState<MenuId>(null)
  const [tab, setTab] = useState<'preview' | 'source'>('preview')
  const [view, setView] = useState<'visual' | 'html'>('visual')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewTick, setPreviewTick] = useState(0)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Version | null>(null)
  const [closeAsk, setCloseAsk] = useState(false)
  const [localDraft, setLocalDraft] = useState<Draft | null>(null)
  const suppress = useRef(false)
  const dirty = contentOf(draft) !== saved
  const draftKey = `palos:template-draft:${editingId ?? 'new'}`

  const notify = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => { setToast({ message, kind }); window.setTimeout(() => setToast(null), 3200) }, [])
  const set = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), [])

  const editor = useEditor({
    extensions: templateExtensions(),
    content: toEditorHtml(initial.bodyHtml),
    immediatelyRender: false,
    editable: canManage,
    editorProps: {
      attributes: { class: 'studio-prose', 'aria-label': 'Isi template dokumen', spellcheck: 'false' },
      handleDrop: (view, event) => {
        const token = event.dataTransfer?.getData('application/x-palos-token')
        if (!token) return false
        event.preventDefault()
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (at) view.dispatch(view.state.tr.insertText(`{{${token}}}`, at.pos))
        return true
      },
    }, 
    onUpdate: ({ editor: ed }) => { if (!suppress.current) set({ bodyHtml: fromEditorHtml(ed.getHTML()) }) },
  })

  /** Ganti isi editor dari sumber luar (impor DOCX, pulihkan versi, mode HTML). */
  const applyBody = useCallback((html: string) => {
    suppress.current = true
    editor?.commands.setContent(toEditorHtml(html), { emitUpdate: false })
    suppress.current = false
    set({ bodyHtml: html })
  }, [editor, set])

  const st = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed ? {
      bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), bullet: ed.isActive('bulletList'), ordered: ed.isActive('orderedList'),
      left: ed.isActive({ textAlign: 'left' }), center: ed.isActive({ textAlign: 'center' }), right: ed.isActive({ textAlign: 'right' }), justify: ed.isActive({ textAlign: 'justify' }),
      link: ed.isActive('link'), href: (ed.getAttributes('link').href as string | undefined) ?? '',
      font: (ed.getAttributes('textStyle').fontFamily as string | undefined) ?? '', size: (ed.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      color: (ed.getAttributes('textStyle').color as string | undefined) ?? '', inTable: ed.isActive('table'), loopRow: ed.isActive('tableRow', { dataEach: 'items' }),
      canUndo: ed.can().undo(), canRedo: ed.can().redo(),
    } : null,
  })

  // Tutup menu saat klik di luar.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-menu-root]')) setMenu(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('mousedown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [menu])

  // Pratinjau langsung (data contoh) dari server.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const p = await api<Preview>('/api/templates/preview', { method: 'POST', body: JSON.stringify({ type: draft.type, bodyHtml: draft.bodyHtml, css: draft.css, headerHtml: draft.headerHtml, footerHtml: draft.footerHtml }) })
        if (!cancelled) { setPreview(p); setPreviewError(null) }
      } catch (e) {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : 'Terjadi kesalahan yang tidak diketahui.')
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [draft.type, draft.bodyHtml, draft.css, draft.headerHtml, draft.footerHtml, previewTick])

  // Auto-save draf ke perangkat (belum ke server) agar pekerjaan tidak hilang.
  useEffect(() => {
    if (!dirty) { try { localStorage.removeItem(draftKey) } catch { /* abaikan */ } return }
    const t = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* penyimpanan penuh/diblokir */ } }, 800)
    return () => clearTimeout(t)
  }, [draft, dirty, draftKey])

  // Tawarkan pemulihan draf lokal yang berbeda dari isi saat ini.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw) as Draft
      if (typeof d?.bodyHtml === 'string' && contentOf(d) !== contentOf(initial)) setLocalDraft(d)
    } catch { /* draf rusak diabaikan */ }
    // hanya saat dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { editor?.setEditable(canManage) }, [editor, canManage])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = useCallback(async () => {
    if (!canManage) { setError('Hanya admin yang dapat menyimpan template.'); return }
    if (draft.name.trim().length < 3) { setError('Nama template minimal 3 karakter.'); return }
    setBusy(true); setError(null)
    try {
      const payload = { ...draft, name: draft.name.trim(), description: draft.description || null }
      const result = await api<TemplateRecord>(editingId ? `/api/templates/${editingId}` : '/api/templates', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      try { localStorage.removeItem(draftKey) } catch { /* abaikan */ }
      // Isi yang dibersihkan server menjadi acuan "tersimpan".
      const next: Draft = { ...draft, name: result.name, bodyHtml: result.bodyHtml, headerHtml: result.headerHtml, footerHtml: result.footerHtml, css: result.css, isDefault: result.isDefault }
      setDraft(next); setSaved(contentOf(next)); setEditingId(result.id); setVersions(null)
      if (result.bodyHtml !== draft.bodyHtml) applyBody(result.bodyHtml)
      onSaved(result)
      notify('Template berhasil disimpan.')
    } catch (e) {
      const err = e as Error & { details?: Record<string, string> }
      setError(err.details ? `${err.message} ${Object.values(err.details).join(' ')}` : err.message)
    } finally { setBusy(false) }
  }, [applyBody, canManage, draft, draftKey, editingId, notify, onSaved])

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!busy) void save() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [busy, save])

  async function download(format: 'docx' | 'pdf') {
    setMenu(null); setExporting(format); setLastFormat(format)
    try {
      await downloadFile('/api/templates/export', { format, name: draft.name || 'template', type: draft.type, bodyHtml: draft.bodyHtml, css: draft.css, headerHtml: draft.headerHtml, footerHtml: draft.footerHtml }, `${draft.name || 'template'}.${format}`)
      notify(`File ${format.toUpperCase()} berhasil dibuat (memakai data contoh).`)
    } catch (e) { notify((e as Error).message, 'error') } finally { setExporting(null) }
  }

  async function uploadDocx(file?: File) {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await postForm<{ html: string; headerHtml: string; footerHtml: string; fileName: string; parts?: { header: boolean; footer: boolean } }>('/api/templates/upload-docx', fd)
      applyBody(r.html); set({ mode: 'docx', sourceFileName: r.fileName, headerHtml: r.headerHtml ?? '', footerHtml: r.footerHtml ?? '' })
      notify(r.parts?.header ? 'Template Word dan header/kop surat berhasil diimpor. Periksa hasilnya sebelum menyimpan.' : 'Isi Word diimpor, tetapi header/kop surat tidak ditemukan pada bagian Header Word.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function copyLink() {
    if (!editingId) return
    try { await navigator.clipboard.writeText(`${window.location.origin}/templates?edit=${editingId}`); notify('Tautan template disalin.') }
    catch { notify('Tidak dapat menyalin ke clipboard. Salin alamat dari browser.', 'error') }
    setMenu(null)
  }

  function downloadPackage() {
    const pkg = { format: 'palos-template', version: 1, name: draft.name, type: draft.type, description: draft.description, bodyHtml: draft.bodyHtml, css: draft.css, headerHtml: draft.headerHtml, footerHtml: draft.footerHtml }
    const url = URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${(draft.name || 'template').replace(/[^\w.-]+/g, '-')}.template.json`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    setMenu(null); notify('Paket template diunduh.')
  }

  async function openHistory() {
    setHistoryOpen(true); setVersionsError(null)
    if (!editingId) { setVersions([]); return }
    try { setVersions(await api<Version[]>(`/api/templates/${editingId}/versions`)) } catch (e) { setVersionsError((e as Error).message) }
  }

  async function restore(v: Version) {
    if (!editingId) return
    setBusy(true)
    try {
      const r = await api<TemplateRecord>(`/api/templates/${editingId}/versions`, { method: 'POST', body: JSON.stringify({ versionId: v.id }) })
      const next: Draft = { ...draft, name: r.name, bodyHtml: r.bodyHtml, css: r.css, headerHtml: r.headerHtml, footerHtml: r.footerHtml }
      setDraft(next); setSaved(contentOf(next)); applyBody(r.bodyHtml); onSaved(r)
      setRestoreTarget(null); notify(`Template dipulihkan ke versi ${v.version}.`)
      setVersions(await api<Version[]>(`/api/templates/${editingId}/versions`))
    } catch (e) { notify((e as Error).message, 'error'); setRestoreTarget(null) } finally { setBusy(false) }
  }

  function insertToken(token: string) {
    setMenu(null)
    if (view === 'html') { set({ bodyHtml: `${draft.bodyHtml}{{${token}}}` }); return }
    editor?.chain().focus().insertContent(`{{${token}}}`).run()
  }

  function toggleLoopRow() {
    setMenu(null)
    if (!editor) return
    if (!st?.inTable) { notify('Letakkan kursor di dalam baris tabel yang ingin diulang per item.', 'error'); return }
    editor.chain().focus().updateAttributes('tableRow', { dataEach: st.loopRow ? null : 'items' }).run()
  }

  function applyLink() {
    if (!editor) return
    const raw = linkUrl.trim()
    if (!raw) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setMenu(null); return }
    const href = /^(https?:|mailto:)/i.test(raw) ? raw : `https://${raw}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setMenu(null)
  }

  function requestClose() { if (dirty) setCloseAsk(true); else onClose() }

  const ch = () => editor?.chain().focus()
  const tb = (active: boolean | undefined, title: string, onClick: () => void, icon: React.ReactNode, disabled = false) =>
    <button type="button" title={title} aria-label={title} aria-pressed={!!active} className={active ? 'on' : ''} disabled={disabled || !canManage || view === 'html'} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</button>

  const fontLabel = FONT_FAMILIES.find((f) => f.value.replace(/['"]/g, '') === (st?.font ?? '').replace(/['"]/g, ''))?.label ?? 'Font'
  const sizeLabel = st?.size ? st.size.replace('px', '') : '14'
  const fileTitle = draft.name || 'Template_Dokumen_Baru'
  const paper = preview
    ? `<!doctype html><html><head><meta charset="utf-8"><style>body{padding:28px 32px;max-width:800px;margin:auto}</style><style>${safeCss(preview.css)}</style></head><body>${preview.header}${preview.body}${preview.footer}</body></html>`
    : '<p style="font:14px sans-serif;padding:20px;color:#64748b">Memuat pratinjau…</p>'

  return <section className="template-studio">
    <header className="studio-topbar">
      <div className="studio-brand"><span className="studio-logo"><FileText size={19} /></span><strong>DocuTemplate</strong></div>
      <div className="studio-file">
        <input className="studio-title-input" aria-label="Nama template" value={draft.name} disabled={!canManage} onChange={(e) => set({ name: e.target.value })} placeholder="Nama template, mis. Surat Penawaran Resmi" />
        <small title="Draf otomatis disimpan di perangkat ini sampai Anda menekan Save & Continue">{dirty ? 'Draft / Auto-saved · belum disimpan ke server' : editingId ? 'Tersimpan' : 'Draft baru'}</small>
      </div>
      <div className="studio-breadcrumb">Templates <span>›</span> {editingId ? 'Edit Template' : 'Create New'}</div>
      <div className="studio-top-actions">
        <div className="studio-menu-wrap" data-menu-root>
          <button type="button" className="studio-share" aria-haspopup="menu" aria-expanded={menu === 'share'} onClick={() => setMenu(menu === 'share' ? null : 'share')}><Share2 size={15} /> Share</button>
          {menu === 'share' && <div className="studio-menu studio-menu-right" role="menu">
            <button type="button" role="menuitem" disabled={!editingId} onClick={() => void copyLink()}><Copy size={15} /> Salin tautan template</button>
            <button type="button" role="menuitem" onClick={downloadPackage}><Download size={15} /> Unduh paket (.template.json)</button>
            <p className="studio-menu-note">{editingId ? 'Tautan hanya dapat dibuka oleh pengguna portal yang sudah masuk.' : 'Simpan template terlebih dahulu untuk mendapatkan tautan.'}</p>
          </div>}
        </div>
        <button type="button" className="studio-ghost" onClick={() => void openHistory()}><History size={15} /> History</button>
        <span className="studio-avatar" title={userName} aria-label={`Pengguna: ${userName}`}>{initials(userName)}</span>
      </div>
    </header>

    {!canManage && <div className="studio-banner" role="status">Mode lihat saja — hanya admin yang dapat mengubah dan menyimpan template. Anda tetap dapat mengunduh contoh DOCX/PDF.</div>}
    {localDraft && <div className="studio-banner studio-banner-info" role="status">
      <span>Ditemukan draf lokal yang belum disimpan ke server.</span>
      <button type="button" onClick={() => { setDraft(localDraft); applyBody(localDraft.bodyHtml); setLocalDraft(null) }}><RotateCcw size={13} /> Pulihkan</button>
      <button type="button" onClick={() => { try { localStorage.removeItem(draftKey) } catch { /* abaikan */ } setLocalDraft(null) }}>Buang</button>
    </div>}

    <div className="studio-main">
      <section className="studio-editor-panel">
        <div className="studio-toolbar" role="toolbar" aria-label="Formatting toolbar">
          {tb(st?.bold, 'Tebal (Ctrl+B)', () => ch()?.toggleBold().run(), <Bold size={16} />)}
          {tb(st?.italic, 'Miring (Ctrl+I)', () => ch()?.toggleItalic().run(), <Italic size={16} />)}
          {tb(st?.underline, 'Garis bawah (Ctrl+U)', () => ch()?.toggleUnderline().run(), <UnderlineIcon size={16} />)}
          <span className="studio-tool-divider" />
          {tb(st?.bullet, 'Daftar poin', () => ch()?.toggleBulletList().run(), <List size={16} />)}
          {tb(st?.ordered, 'Daftar nomor', () => ch()?.toggleOrderedList().run(), <ListOrdered size={16} />)}
          {tb(st?.left, 'Rata kiri', () => ch()?.setTextAlign('left').run(), <AlignLeft size={16} />)}
          {tb(st?.center, 'Rata tengah', () => ch()?.setTextAlign('center').run(), <AlignCenter size={16} />)}
          {tb(st?.right, 'Rata kanan', () => ch()?.setTextAlign('right').run(), <AlignRight size={16} />)}
          {tb(st?.justify, 'Rata kiri-kanan', () => ch()?.setTextAlign('justify').run(), <AlignJustify size={16} />)}
          <span className="studio-tool-divider" />
          <div className="studio-menu-wrap" data-menu-root>
            <button type="button" className="studio-drop" disabled={!canManage || view === 'html'} aria-haspopup="menu" aria-expanded={menu === 'font'} onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'font' ? null : 'font')}>{fontLabel} <ChevronDown size={12} /></button>
            {menu === 'font' && <div className="studio-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { ch()?.unsetFontFamily().run(); setMenu(null) }}>Bawaan</button>
              {FONT_FAMILIES.map((f) => <button key={f.label} type="button" role="menuitem" style={{ fontFamily: f.value }} onClick={() => { ch()?.setFontFamily(f.value).run(); setMenu(null) }}>{f.label}</button>)}
            </div>}
          </div>
          <div className="studio-menu-wrap" data-menu-root>
            <button type="button" className="studio-drop" disabled={!canManage || view === 'html'} aria-haspopup="menu" aria-expanded={menu === 'size'} aria-label="Ukuran font" onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'size' ? null : 'size')}>{sizeLabel} <ChevronDown size={12} /></button>
            {menu === 'size' && <div className="studio-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { ch()?.unsetFontSize().run(); setMenu(null) }}>Bawaan</button>
              {FONT_SIZES.map((s) => <button key={s} type="button" role="menuitem" onClick={() => { ch()?.setFontSize(s).run(); setMenu(null) }}>{s.replace('px', '')}</button>)}
            </div>}
          </div>
          <label className="studio-color" title="Warna teks" style={{ color: st?.color || undefined }}>
            <Palette size={16} /><input type="color" aria-label="Warna teks" disabled={!canManage || view === 'html'} value={/^#[0-9a-f]{6}$/i.test(st?.color ?? '') ? st!.color : '#1f2937'} onChange={(e) => ch()?.setColor(e.target.value).run()} />
          </label>
          <span className="studio-tool-divider" />
          <div className="studio-menu-wrap" data-menu-root>
            <button type="button" className={st?.link ? 'on' : ''} title="Tautan" aria-label="Tautan" disabled={!canManage || view === 'html'} onMouseDown={(e) => e.preventDefault()} onClick={() => { setLinkUrl(st?.href || 'https://'); setMenu(menu === 'link' ? null : 'link') }}><Link2 size={16} /></button>
            {menu === 'link' && <div className="studio-menu studio-menu-form">
              <label>Alamat tautan<input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }} placeholder="https://contoh.co.id" /></label>
              <div><button type="button" onClick={applyLink}>Terapkan</button>{st?.link && <button type="button" onClick={() => { ch()?.extendMarkRange('link').unsetLink().run(); setMenu(null) }}>Hapus tautan</button>}</div>
            </div>}
          </div>
          <div className="studio-menu-wrap" data-menu-root>
            <button type="button" className="studio-drop" disabled={!canManage} aria-haspopup="menu" aria-expanded={menu === 'vars'} onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'vars' ? null : 'vars')}><Braces size={15} /> Variabel <ChevronDown size={12} /></button>
            {menu === 'vars' && <div className="studio-menu studio-menu-wide" role="menu">
              <p className="studio-menu-note">Klik variabel untuk menyisipkan di posisi kursor, atau seret (drag) ke lokasi yang diinginkan pada editor.</p>
              {TOKEN_GROUPS.map((g) => <div key={g.label} className="studio-menu-group"><strong>{g.label}</strong>{g.tokens.map((t) => <button key={t.token} type="button" role="menuitem" draggable={canManage} title="Klik untuk sisipkan atau seret ke editor" onDragStart={(e) => { e.dataTransfer.setData('application/x-palos-token', t.token); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => insertToken(t.token)}><code>{`{{${t.token}}}`}</code> <span>{t.label}</span></button>)}</div>)}
              <div className="studio-menu-group"><strong>Kolom item (dalam baris berulang)</strong>{ITEM_FIELDS.map((t) => <button key={t.token} type="button" role="menuitem" draggable={canManage} title="Klik untuk sisipkan atau seret ke editor" onDragStart={(e) => { e.dataTransfer.setData('application/x-palos-token', t.token); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => insertToken(t.token)}><code>{`{{${t.token}}}`}</code> <span>{t.label}</span></button>)}</div>
            </div>}
          </div>
          <div className="studio-menu-wrap" data-menu-root>
            <button type="button" title="Lainnya" aria-label="Lainnya" aria-haspopup="menu" aria-expanded={menu === 'more'} disabled={!canManage} onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'more' ? null : 'more')}><Ellipsis size={16} /></button>
            {menu === 'more' && <div className="studio-menu studio-menu-right" role="menu">
              <button type="button" role="menuitem" disabled={view === 'html'} onClick={() => { ch()?.setParagraph().run(); setMenu(null) }}>Paragraf biasa</button>
              {([1, 2, 3] as const).map((l) => <button key={l} type="button" role="menuitem" disabled={view === 'html'} onClick={() => { ch()?.toggleHeading({ level: l }).run(); setMenu(null) }}>Judul {l}</button>)}
              <hr />
              <button type="button" role="menuitem" disabled={view === 'html'} onClick={() => { ch()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setMenu(null) }}>Sisipkan tabel 3×3</button>
              <button type="button" role="menuitem" disabled={!st?.inTable} onClick={() => { ch()?.addRowAfter().run(); setMenu(null) }}>Tambah baris di bawah</button>
              <button type="button" role="menuitem" disabled={!st?.inTable} onClick={() => { ch()?.addColumnAfter().run(); setMenu(null) }}>Tambah kolom di kanan</button>
              <button type="button" role="menuitem" disabled={!st?.inTable} onClick={() => { ch()?.deleteRow().run(); setMenu(null) }}>Hapus baris</button>
              <button type="button" role="menuitem" disabled={!st?.inTable} onClick={() => { ch()?.deleteColumn().run(); setMenu(null) }}>Hapus kolom</button>
              <button type="button" role="menuitem" disabled={!st?.inTable} onClick={() => { ch()?.deleteTable().run(); setMenu(null) }}>Hapus tabel</button>
              <button type="button" role="menuitem" disabled={view === 'html'} onClick={toggleLoopRow}>{st?.loopRow ? 'Lepas baris berulang (item)' : 'Jadikan baris berulang (item)'}</button>
              <hr />
              <button type="button" role="menuitem" disabled={view === 'html'} onClick={() => { ch()?.setHorizontalRule().run(); setMenu(null) }}>Garis pemisah</button>
              <button type="button" role="menuitem" disabled={view === 'html'} onClick={() => { ch()?.unsetAllMarks().clearNodes().run(); setMenu(null) }}>Bersihkan format</button>
              <button type="button" role="menuitem" disabled={view === 'html' || !st?.canUndo} onClick={() => { ch()?.undo().run(); setMenu(null) }}><Undo2 size={14} /> Urungkan</button>
              <button type="button" role="menuitem" disabled={view === 'html' || !st?.canRedo} onClick={() => { ch()?.redo().run(); setMenu(null) }}><Redo2 size={14} /> Ulangi</button>
            </div>}
          </div>
          <label className={`studio-upload ${!canManage || busy ? 'disabled' : ''}`} title="Impor template Word (.docx atau .dotx) sebagai isi template"><Upload size={16} /><input type="file" accept=".docx,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.wordprocessingml.template" hidden disabled={!canManage || busy} onChange={(e) => { void uploadDocx(e.target.files?.[0]); e.currentTarget.value = '' }} /></label>
        </div>

        <div className="studio-editor-meta">
          <div className="studio-view-switch" role="tablist" aria-label="Mode editor">
            <button type="button" role="tab" aria-selected={view === 'visual'} className={view === 'visual' ? 'active' : ''} onClick={() => { if (view === 'html') applyBody(draft.bodyHtml); setView('visual') }}>Visual</button>
            <button type="button" role="tab" aria-selected={view === 'html'} className={view === 'html' ? 'active' : ''} onClick={() => setView('html')}>HTML</button>
          </div>
          <span>{draft.sourceFileName ? `Sumber DOCX: ${draft.sourceFileName}` : 'Token variabel ditandai ungu'}</span>
        </div>

        {view === 'visual'
          ? <EditorContent editor={editor} className="studio-editor-surface" />
          : <textarea className="studio-source-editor" aria-label="Sumber HTML template" value={draft.bodyHtml} disabled={!canManage} onChange={(e) => set({ bodyHtml: e.target.value })} spellCheck={false} />}

        <details className="studio-advanced">
          <summary>Pengaturan lanjutan (jenis dokumen, deskripsi, CSS, header, footer, default)</summary>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="tpl-type">Jenis dokumen *</label><select id="tpl-type" className="field-select" disabled={!canManage} value={draft.type} onChange={(e) => set({ type: e.target.value })}>{DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="form-field"><label htmlFor="tpl-desc">Deskripsi</label><input id="tpl-desc" className="field-input" disabled={!canManage} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Keterangan penggunaan template" /></div>
            <div className="form-field span-2"><label htmlFor="tpl-css">CSS dokumen</label><textarea id="tpl-css" className="field-textarea" disabled={!canManage} value={draft.css} onChange={(e) => set({ css: e.target.value })} rows={4} /></div>
            <div className="form-field"><label htmlFor="tpl-head">Header HTML</label><textarea id="tpl-head" className="field-textarea" disabled={!canManage} value={draft.headerHtml} onChange={(e) => set({ headerHtml: e.target.value })} rows={3} /></div>
            <div className="form-field"><label htmlFor="tpl-foot">Footer HTML</label><textarea id="tpl-foot" className="field-textarea" disabled={!canManage} value={draft.footerHtml} onChange={(e) => set({ footerHtml: e.target.value })} rows={3} /></div>
          </div>
          <label className="studio-default-check"><input type="checkbox" disabled={!canManage} checked={draft.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} /> Jadikan template default untuk jenis dokumen ini</label>
        </details>
      </section>

      <section className="studio-preview-panel">
        <div className="studio-preview-top">
          <div className="studio-preview-tabs" role="tablist" aria-label="Mode pratinjau">
            <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button>
            <button type="button" role="tab" aria-selected={tab === 'source'} className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>Source View</button>
            <span>{tab === 'preview' ? 'PREVIEW' : 'SOURCE'}</span>
          </div>
          <div className="studio-menu-wrap" data-menu-root>
            <button type="button" className="studio-download" aria-haspopup="menu" aria-expanded={menu === 'download'} disabled={!!exporting} onClick={() => setMenu(menu === 'download' ? null : 'download')}><Download size={15} /> {exporting ? `Membuat ${exporting.toUpperCase()}…` : 'Download'} <ChevronDown size={12} /></button>
            {menu === 'download' && <div className="studio-menu studio-menu-right" role="menu">
              <button type="button" role="menuitem" onClick={() => void download('docx')}><FileText size={15} /> DOCX {lastFormat === 'docx' && <Check size={14} className="studio-check" />}</button>
              <button type="button" role="menuitem" onClick={() => void download('pdf')}><FileText size={15} /> PDF {lastFormat === 'pdf' && <Check size={14} className="studio-check" />}</button>
              <p className="studio-menu-note">Memakai data contoh dari isi editor saat ini.</p>
            </div>}
          </div>
        </div>
        {tab === 'source'
          ? <div className="studio-source-view"><pre>{draft.bodyHtml || '(kosong)'}</pre></div>
          : <div className="studio-paper-scroll">
            <article className="studio-paper">
              <div className="studio-paper-header"><strong>DocuTemplate</strong><small>{fileTitle}.docx</small></div>
              {previewError && <div className="studio-preview-error" role="alert">Pratinjau gagal dimuat: {previewError} <button type="button" onClick={() => setPreviewTick((n) => n + 1)}>Coba lagi</button></div>}
              <iframe title="Pratinjau langsung dokumen" sandbox="" srcDoc={paper} />
            </article>
          </div>}
      </section>
    </div>

    {historyOpen && <aside className="studio-drawer" aria-label="Riwayat versi template">
      <div className="studio-drawer-head"><strong>Riwayat versi</strong><button type="button" aria-label="Tutup riwayat" onClick={() => setHistoryOpen(false)}><X size={16} /></button></div>
      {!editingId && <p className="studio-drawer-empty">Template belum disimpan. Versi pertama dibuat saat Anda menekan Save &amp; Continue.</p>}
      {editingId && versionsError && <p className="studio-drawer-empty" role="alert">{versionsError} <button type="button" onClick={() => void openHistory()}>Coba lagi</button></p>}
      {editingId && !versionsError && versions === null && <p className="studio-drawer-empty">Memuat riwayat…</p>}
      {editingId && versions && versions.length === 0 && <p className="studio-drawer-empty">Belum ada versi tercatat. Versi dibuat setiap template disimpan.</p>}
      <ul>{versions?.map((v, i) => <li key={v.id}>
        <div><strong>Versi {v.version}{i === 0 ? ' · terbaru' : ''}</strong><small>{fmtTime(v.createdAt)} · {v.savedByName ?? 'Pengguna'}</small><small className="studio-ver-name">{v.name}</small></div>
        {i > 0 && canManage && <button type="button" disabled={busy} onClick={() => setRestoreTarget(v)}><RotateCcw size={13} /> Pulihkan</button>}
      </li>)}</ul>
    </aside>}

    {error && <div className="banner-error studio-error" role="alert">{error}</div>}
    <footer className="studio-bottom-actions">
      <button type="button" className="studio-cancel" onClick={requestClose}>Cancel</button>
      <button type="button" className="studio-continue" disabled={busy || !canManage} onClick={() => void save()}>{busy ? 'Saving…' : 'Save & Continue'}</button>
    </footer>

    <ConfirmDialog open={closeAsk} title="Tutup tanpa menyimpan?" confirmLabel="Tutup editor" onConfirm={() => { setCloseAsk(false); onClose() }} onCancel={() => setCloseAsk(false)}>Perubahan pada “{fileTitle}” belum disimpan ke server dan akan hilang dari editor.</ConfirmDialog>
    <ConfirmDialog open={!!restoreTarget} title="Pulihkan versi ini?" confirmLabel="Pulihkan" busy={busy} onConfirm={() => restoreTarget && void restore(restoreTarget)} onCancel={() => setRestoreTarget(null)}>Isi template akan diganti dengan versi {restoreTarget?.version}{dirty ? ' dan perubahan yang belum disimpan akan tertimpa' : ''}. Pemulihan dicatat sebagai versi baru.</ConfirmDialog>
    <Toast message={toast?.message ?? null} kind={toast?.kind} />
  </section>
}
