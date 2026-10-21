// Versi murni (tanpa akses database) dari aturan hak akses, aman dipakai di komponen client.
// Hanya untuk menyembunyikan tombol; server tetap memeriksa lewat lib/permissions.ts.
export type Role = 'admin' | 'manager' | 'staff' | 'viewer'
export type Action = 'read' | 'create' | 'edit' | 'delete' | 'submit' | 'approve' | 'publish' | 'manage-templates'

export function can(role: Role, action: Action, opts?: { userId: string; ownerId: string }): boolean {
  if (action === 'read') return true
  if (action === 'manage-templates') return role === 'admin'
  if (role === 'viewer') return false
  if (action === 'create') return true
  // Mengajukan dokumen sendiri untuk persetujuan: pemilik dokumen atau admin/manager.
  if (action === 'submit') return role === 'admin' || role === 'manager' || (!!opts && opts.userId === opts.ownerId)
  // Keputusan persetujuan dan penerbitan hanya untuk admin/manager.
  if (action === 'approve' || action === 'publish') return role === 'admin' || role === 'manager'
  if (role === 'admin' || role === 'manager') return true
  return !!opts && opts.userId === opts.ownerId
}
