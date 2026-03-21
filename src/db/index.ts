// src/db/index.ts
// Drizzle ORM Client for Neon PostgreSQL
// This file provides the database connection for all Drizzle operations

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create PostgreSQL pool using Neon connection string
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL!,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

// Create Drizzle instance with schema
// This enables type-safe queries with relation support
export const db = drizzle(pool, { schema });

// Export pool for raw queries if needed (legacy support)
export { pool };

// Export all schema types and tables for convenience
export * from './schema';
