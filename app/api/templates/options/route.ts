import { json, route } from '@/lib/api'
import { DOCUMENT_TYPE_VALUES } from '@/lib/documents/constants'
import { listTemplateOptions } from '@/lib/templates/service'

export const GET = route(async (request) => {
  const type = new URL(request.url).searchParams.get('type') ?? ''
  if (!DOCUMENT_TYPE_VALUES.includes(type as typeof DOCUMENT_TYPE_VALUES[number])) return json([])
  return json(await listTemplateOptions(type))
})
