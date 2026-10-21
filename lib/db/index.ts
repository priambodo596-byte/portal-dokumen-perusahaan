import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Neon dapat mengalami kegagalan DNS sesaat (EAI_AGAIN). Timeout dan keep-alive
// mencegah request menggantung terlalu lama; retry koneksi dilakukan pada session layer.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
})

pool.on('error', (error) => {
  // Jangan log connection string, kredensial, atau detail sensitif dari konfigurasi DB.
  const code = (error as Error & { code?: string }).code
  console.error('[database] Koneksi pool terputus:', code ?? error.name ?? 'UNKNOWN')
})

export const db = drizzle(pool, { schema })
