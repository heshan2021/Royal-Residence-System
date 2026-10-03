// lib/neonClient.ts
// Raw `pg` connection used by the guest registry endpoints.
//
// FIX (B1): this module used to read `process.env.NEON_DATABASE_URL`, a variable
// that does not exist in this project (.env.local and Vercel only define
// `NEXT_PUBLIC_NEON_DATABASE_URL`). `pg` therefore received `undefined` and
// silently fell back to localhost:5432, so `/api/guests/search` and
// `/api/guests/create` always failed with 500 in every environment.
//
// It now reads the same variable as src/db/index.ts and fails fast with an
// actionable message instead of quietly pointing at the wrong host.

import { Pool } from 'pg';

/** Resolve the Neon connection string, preferring the canonical name. */
export function getConnectionString(): string {
  const url = process.env.NEON_DATABASE_URL || process.env.NEXT_PUBLIC_NEON_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Database connection not configured: set NEON_DATABASE_URL or NEXT_PUBLIC_NEON_DATABASE_URL'
    );
  }
  return url;
}

let cached: { pool: Pool; url: string } | null = null;

/** Lazily created, reused connection pool. */
export function getPool(): Pool {
  const url = getConnectionString();
  if (!cached || cached.url !== url) {
    if (cached) {
      void cached.pool.end().catch(() => undefined);
    }
    cached = {
      pool: new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } }),
      url,
    };
  }
  return cached.pool;
}

/** Run a parameterised query. */
export const query = async (text: string, params?: unknown[]) => {
  const client = await getPool().connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
};

