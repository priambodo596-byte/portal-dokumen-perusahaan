'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Copy, FileDown, Pencil, RotateCcw, Send, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react'
import { DELETABLE_STATUSES, EDITABLE_STATUSES, transitionsFor, type TransitionAction } from '@/lib/documents/constants'
import { can, type Role } from '@/lib/permissions-client'
import { api, ConfirmDialog, downloadFile, Toast } from './shared'

const ICONS: Record<TransitionAction, React.ReactNode> = {
  submit: <Send />, review: <ShieldCheck />, approve: <CheckCircle2 />, reject: <XCircle />, 'request-revision': <RotateCcw />, publish: <Upload />, archive: <Trash2 />,
}

export default function DocumentActions({ id, number, title, status, ownerId, userId, role }: { id: string; number: string; title: string; status: string; ownerId: string; userId: string; role: Role }) {
  const router = useRouter(); const own = { userId, ownerId }
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const [noteAction, setNoteAction] = useState<TransitionAction | null>(null); const [note, setNote] = useState(''); const [noteError, setNoteError] = useState<string | null>(null)

  async function duplicate() {
    setBusy(true)
    try { const r = await api<{ id: string }>(`/api/documents/${id}/duplicate`, { method: 'POST' }); router.push(`/documents/${r.id}/edit`) }
    catch (e) { setToast({ m: (e as Error).message, k: 'error' }); setBusy(false) }
  }
  async function remove() {
    setBusy(true); setError(null)
    try { await api(`/api/documents/${id}`, { method: 'DELETE' }); router.push('/documents'); router.refresh() }
    catch (e) { setError((e as Error).message); setBusy(false) }
  }
  async function transition(action: TransitionAction, withNote?: string) {
    setBusy(true); setNoteError(null)
    try {
      await api(`/api/documents/${id}/transition`, { method: 'POST', body: JSON.stringify({ action, note: withNote ?? undefined }) })
      setNoteAction(null); setNote(''); router.refresh()
      setToast({ m: 'Status dokumen diperbarui.', k: 'ok' })
    } catch (e) {
      const msg = (e as Error).message
      if (noteAction) setNoteError(msg); else setError(msg)
    } finally { setBusy(false) }
  }

  const def = noteAction ? transitionsFor(status).find((t) => t.action === noteAction) : null

  async function exportAs(format: 'docx' | 'pdf') {
    setBusy(true)
    try { await downloadFile(`/api/documents/${id}/export/${format}`, {}, `${number}.${format}`); setToast({ m: `File ${format.toUpperCase()} berhasil diunduh.`, k: 'ok' }) }
    catch (e) { setToast({ m: (e as Error).message, k: 'error' }) } finally { setBusy(false) }
  }

  return <div className="toolbar-actions">
    {transitionsFor(status).map((t) => can(role, t.permission, own) && (
      <button key={t.action} className={t.destructive ? 'secondary-button' : 'primary-button'} onClick={() => (t.requiresNote ? (setNote(''), setNoteError(null), setNoteAction(t.action)) : transition(t.action))} disabled={busy}>
        {ICONS[t.action]} {t.label}
      </button>
    ))}
    {EDITABLE_STATUSES.includes(status) && can(role, 'edit', own) && <Link href={`/documents/${id}/edit`} className="secondary-button"><Pencil /> Edit</Link>}
    <button className="secondary-button" onClick={() => exportAs('docx')} disabled={busy}><FileDown /> Export Word</button>
    <button className="secondary-button" onClick={() => exportAs('pdf')} disabled={busy}><FileDown /> Export PDF</button>
    {can(role, 'create') && <button className="secondary-button" onClick={duplicate} disabled={busy}><Copy /> Duplikat</button>}
    {DELETABLE_STATUSES.includes(status) && can(role, 'delete', own) && <button className="secondary-button" onClick={() => { setError(null); setConfirm(true) }} disabled={busy}><Trash2 /> Hapus</button>}

    <ConfirmDialog open={confirm} title="Hapus dokumen?" confirmLabel="Hapus" busy={busy} error={error} onConfirm={remove} onCancel={() => setConfirm(false)}>
      Dokumen <strong>{number}</strong> — {title} akan dihapus dari daftar. Tindakan ini tercatat di audit log.</ConfirmDialog>

    <ConfirmDialog open={!!def} title={def?.label ?? ''} confirmLabel={def?.label ?? 'Kirim'} busy={busy} error={noteError} onConfirm={() => def && transition(def.action, note)} onCancel={() => setNoteAction(null)}>
      Berikan catatan untuk dokumen <strong>{number}</strong>.
      <textarea className="field-input" style={{ width: '100%', marginTop: 10, minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan / alasan" aria-label="Catatan" />
    </ConfirmDialog>
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </div>
}
