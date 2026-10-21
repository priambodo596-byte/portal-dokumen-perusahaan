import { json, route } from '@/lib/api'
import { listProjectsWithStats } from '@/lib/documents/service'

export const GET = route(async () => json(await listProjectsWithStats()))
