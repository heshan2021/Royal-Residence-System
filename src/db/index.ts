// src/db/index.ts
// Drizzle ORM Client for Neon PostgreSQL
// This file provides the database connection for all Drizzle operations
// Uses @neondatabase/serverless for Vercel compatibility

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Validate environment variable
if (!process.env.NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL environment variable is not set. Please set it in your Vercel environment variables.');
}

// Create Neon HTTP client - works in serverless environments (Vercel)
const sql = neon(process.env.NEON_DATABASE_URL);

// Create Drizzle instance with schema
// This enables type-safe queries with relation support
export const db = drizzle(sql, { schema });

// Export all schema types and tables for convenience
export * from './schema';
