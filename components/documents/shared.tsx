'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, FileText, RefreshCw, X } from 'lucide-react'
import { statusMeta } from '@/lib/documents/constants'

export function DocumentStatusBadge({ status }: { status: string }) {
  const m = statusMeta(status)
  return <span className={`status-badge status-${m.tone}`}><span className="status-dot" />{m.label}</span>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="state-box"><FileText /><strong>{title}</strong>{description && <span>{description}</span>}{action}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="state-box state-error" role="alert"><AlertTriangle /><strong>Gagal memuat data</strong><span>{message}</span>{onRetry && <button className="secondary-button" onClick={onRetry}><RefreshCw /> Coba lagi</button>}</div>
}

export function LoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return <div aria-busy="true" aria-label="Memuat" style={{ display: 'grid', gap: 14, padding: '14px 8px' }}>{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ width: `${70 + ((i * 13) % 30)}%` }} />)}</div>
}

export function ConfirmDialog({ open, title, children, confirmLabel, busy, error, onConfirm, onCancel }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string; busy?: boolean; error?: string | null; onConfirm: () => void; onCancel: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) ref.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])
  if (!open) return null
  return <div className="modal-backdrop" onClick={() => !busy && onCancel()}><div className="create-modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
    <div className="modal-heading"><div><h2>{title}</h2><p>{children}</p></div><button className="icon-button" onClick={onCancel} disabled={busy} aria-label="Tutup"><X /></button></div>
    {error && <div className="banner-error" role="alert">{error}</div>}
    <div className="modal-footer" style={{ gap: 8 }}><button className="secondary-button" onClick={onCancel} disabled={busy}>Batal</button><button ref={ref} className="danger-button" onClick={onConfirm} disabled={busy}>{busy ? 'Memproses…' : confirmLabel}</button></div>
  </div></div>
}

export function Toast({ message, kind = 'ok' }: { message: string | null; kind?: 'ok' | 'error' }) {
  if (!message) return null
  return <div className={`toast ${kind === 'error' ? 'toast-error' : ''}`} role="status">{message}</div>
}

/** Panggil API; lempar Error dengan pesan server bila gagal. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error ?? 'Permintaan gagal.'), { status: res.status, details: body.details as Record<string, string> | undefined })
  return body as T
}

/** POST FormData (multipart) ke API; jangan set Content-Type agar boundary diisi browser. */
export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: form, cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error ?? 'Permintaan gagal.'), { status: res.status, details: body.details as Record<string, string> | undefined })
  return body as T
}

/** POST ke endpoint yang mengembalikan file, lalu unduh sebagai blob. */
export async function downloadFile(url: string, body: unknown, fallbackName: string): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? 'Gagal membuat file.')
  }
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl; a.download = match?.[1] ?? fallbackName
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(objectUrl)
}
