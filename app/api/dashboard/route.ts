import { json, route } from '@/lib/api'
import { getReportsSummary, listDocuments } from '@/lib/documents/service'

export const GET = route(async (_request, ctx) => {
  const [summary, recent] = await Promise.all([
    getReportsSummary(ctx.role),
    listDocuments({ sort: 'updatedAt', dir: 'desc', page: 1, pageSize: 5 }, ctx.role),
  ])
  const pendingCount = summary.byStatus
    .filter((row) => row.status === 'pending' || row.status === 'review')
    .reduce((total, row) => total + row.n, 0)
  const publishedCount = summary.byStatus
    .filter((row) => row.status === 'published')
    .reduce((total, row) => total + row.n, 0)
  return json({
    documentCount: summary.documentCount,
    totalValue: summary.totalValue,
    pendingCount,
    publishedCount,
    latest: recent.rows,
  })
})
