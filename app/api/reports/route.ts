import { json, route } from '@/lib/api'
import { getReportsSummary } from '@/lib/documents/service'

export const GET = route(async () => json(await getReportsSummary()))
