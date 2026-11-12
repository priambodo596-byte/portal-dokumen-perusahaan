import { json, route } from '@/lib/api'

export const GET = route(async (_request, ctx) => json({ userName: ctx.userName, role: ctx.role }))
