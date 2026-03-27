// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Force Drizzle to load environment variables from .env.local
dotenv.config({ path: '.env.local' });

export default defineConfig({
  // Path to the schema file
  schema: './src/db/schema.ts',
  
  // Output directory for migrations
  out: './drizzle',
  
  // Database dialect
  dialect: 'postgresql',
  
  // Database connection configuration
  dbCredentials: {
    // This will now successfully pull from .env.local!
    url: process.env.NEXT_PUBLIC_NEON_DATABASE_URL!,
  },
  
  // Verbose output for debugging
  verbose: true,
  
  // Strict mode for schema validation
  strict: true,
});