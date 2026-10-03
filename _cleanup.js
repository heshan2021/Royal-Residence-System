/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, not bundled */
/* Dev-only cleanup for the _scenario.js harness rows (CLINETEST*).
   Usage: `node _cleanup.js` after `node _scenario.js`. */
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const TEST_NICS = ['CLINETESTA0001', 'CLINETESTB0001', 'CLINETESTC0001', 'CLINETESTX0001', 'CLINETESTH0001'];

/* rooms.* is a display cache of `bookings` (lib/roomState.ts); deleting rows
   out-of-band must be followed by re-deriving it. */
const RECONCILE_ROOMS = `UPDATE rooms r SET
    is_occupied   = COALESCE(s.occupied, false),
    guest_name    = s.guest_name,
    phone_number  = s.phone_number,
    nic_number    = s.nic_number,
    check_out_time= s.check_out_time,
    updated_at    = NOW()
  FROM (
    SELECT r2.id,
           (b.id IS NOT NULL) AS occupied,
           g.name             AS guest_name,
           g.phone_number     AS phone_number,
           g.nic_number       AS nic_number,
           b.check_out_date   AS check_out_time
    FROM rooms r2
    LEFT JOIN LATERAL (
      SELECT bb.id, bb.guest_id, bb.check_out_date
      FROM bookings bb
      WHERE bb.room_id = r2.id AND bb.status = 'active'
        AND bb.check_in_date <= NOW()
        AND (bb.check_out_date IS NULL OR bb.check_out_date > NOW())
      ORDER BY bb.check_in_date DESC
      LIMIT 1
    ) b ON true
    LEFT JOIN guests g ON g.id = b.guest_id
  ) s
  WHERE s.id = r.id`;

(async () => {
  const t = await pool.query(
    `DELETE FROM transactions WHERE booking_id IN (
       SELECT b.id FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE g.nic_number = ANY($1))
     RETURNING id`, [TEST_NICS]);
  const b = await pool.query(
    `DELETE FROM bookings WHERE guest_id IN (SELECT id FROM guests WHERE nic_number = ANY($1)) RETURNING id`,
    [TEST_NICS]);
  const g = await pool.query(`DELETE FROM guests WHERE nic_number = ANY($1) RETURNING id`, [TEST_NICS]);
  const e = await pool.query(`DELETE FROM expenses WHERE description LIKE 'CLINE TEST%' RETURNING id`);
  console.log(`deleted: transactions=${t.rowCount} bookings=${b.rowCount} guests=${g.rowCount} expenses=${e.rowCount}`);
  const rc = await pool.query(RECONCILE_ROOMS);
  console.log(`reconciled rooms: ${rc.rowCount}`);

  for (const tbl of ['rooms', 'guests', 'bookings', 'transactions', 'expenses']) {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ${tbl}`);
    console.log(`  ${tbl}: ${r.rows[0].n}`);
  }
  const s = await pool.query('SELECT COALESCE(SUM(amount),0)::int AS s FROM transactions');
  const es = await pool.query('SELECT COALESCE(SUM(amount),0)::int AS s FROM expenses');
  console.log(`  sum(transactions.amount): ${s.rows[0].s}`);
  console.log(`  sum(expenses.amount): ${es.rows[0].s}`);

  const leftover = await pool.query(
    `SELECT r.number, r.is_occupied, r.guest_name FROM rooms r WHERE r.is_occupied = true ORDER BY r.number`);
  console.log('  rooms still flagged occupied:', JSON.stringify(leftover.rows));

  await pool.end();
})().catch((e) => { console.error('CLEANUP ERROR:', e.message); process.exit(1); });
