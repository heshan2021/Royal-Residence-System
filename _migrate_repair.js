/* Dev-only: record the migrations this database already has.
   `drizzle.__drizzle_migrations` is empty (the schema was created with
   `drizzle-kit push`, which does not journal), so `drizzle-kit migrate` would
   replay 0000-0003 against tables that already exist. Backfill the ledger with
   the migrations whose effects are present, so migrate applies only 0004.
   drizzle orders by `created_at` (= the journal's `when`), the hash is just an
   audit value: sha256 of the migration file, exactly as drizzle computes it. */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const APPLIED = [
  { file: '0000_noisy_silverclaw.sql', when: 1774116227057 },
  { file: '0001_add_expenses_table.sql', when: 1774127674006 },
  { file: '0002_greedy_midnight.sql', when: 1774781610465 },
  { file: '0003_folio_discounts.sql', when: 1791058088798 },
];

(async () => {
  const existing = await pool.query('SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at');
  console.log('ledger before:', JSON.stringify(existing.rows));
  for (const m of APPLIED) {
    const content = fs.readFileSync(path.join(__dirname, 'drizzle', m.file), 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    await pool.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [hash, m.when]);
    console.log(`  recorded ${m.file} (when=${m.when})`);
  }
  const after = await pool.query('SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at');
  console.log('ledger after:', JSON.stringify(after.rows));
  await pool.end();
})().catch((e) => { console.error('MIGRATE-REPAIR ERROR:', e.message); process.exit(1); });
