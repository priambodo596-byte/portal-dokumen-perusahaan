import { eq } from 'drizzle-orm'
import { json, route } from '@/lib/api'
import { getReportsSummary } from '@/lib/documents/service'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'

export const GET = route(async (_request, ctx) => {
  const [summary, settingsRows] = await Promise.all([
    getReportsSummary(ctx.role),
    db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1),
  ])
  const settings = (settingsRows[0]?.value ?? {}) as Record<string, unknown>
  const pendingCount = summary.byStatus
    .filter((row) => row.status === 'pending' || row.status === 'review')
    .reduce((count, row) => count + row.n, 0)
  return json({
    userName: ctx.userName,
    role: ctx.role,
    companyName: String(settings.companyLegalName || settings.companyName || 'PT.Palos'),
    companyTagline: 'Palembang Security Operating System',
    pendingCount,
  })
})
