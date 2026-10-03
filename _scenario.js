/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, not bundled */
/* Dev-only end-to-end scenario harness for the booking lifecycle.
   Usage: start `npm run dev`, then `node _scenario.js` (expect all PASS),
   then `node _cleanup.js` to remove the CLINETEST rows it created.
   Creates only clearly-labelled CLINETEST rows. */
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const BASE = process.env.BASE || 'http://localhost:3000';

const pool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const sql = (t, p) => pool.query(t, p).then((r) => r.rows);

/* rooms.* is a display cache of the `bookings` table (see lib/roomState.ts).
   This harness deletes its rows with raw SQL, so it must re-derive the cache
   afterwards or the B5 drift check would report the harness's own leftovers. */
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

const TEST_NICS = ['CLINETESTA0001', 'CLINETESTB0001', 'CLINETESTC0001', 'CLINETESTX0001'];
const results = [];
function check(id, desc, ok, detail) {
  results.push({ id, desc, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${desc}${detail ? ' :: ' + detail : ''}`);
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}

const checkIn = (roomNumber, guestName, nic, phone, ci, co, total, adv, method) =>
  api('POST', '/api/rooms/checkin', {
    roomNumber, guestName, phoneNumber: phone, nicNumber: nic,
    checkInDate: ci, checkOutDate: co, totalAmount: total,
    advancePayment: adv, paymentMethod: method,
  });

async function roomOn(number, date) {
  const r = await api('GET', `/api/rooms?date=${date}`);
  return Array.isArray(r.json) ? r.json.find((x) => x.number === number) : null;
}

(async () => {
  console.log('=== PHASE 2 SCENARIO RUN ===\n');

  console.log('--- pre: clean any leftover CLINETEST rows ---');
  const pre = await sql(
    `DELETE FROM transactions WHERE booking_id IN (
       SELECT b.id FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE g.nic_number = ANY($1))
     RETURNING id`, [TEST_NICS]);
  const pre2 = await sql(
    `DELETE FROM bookings WHERE guest_id IN (SELECT id FROM guests WHERE nic_number = ANY($1)) RETURNING id`,
    [TEST_NICS]);
  const pre3 = await sql(`DELETE FROM guests WHERE nic_number = ANY($1) RETURNING id`, [TEST_NICS]);
  const pre4 = await pool.query(RECONCILE_ROOMS);
  console.log(`  removed txns=${pre.length} bookings=${pre2.length} guests=${pre3.length}, reconciled ${pre4.rowCount} room(s)\n`);

  // ---------------------------------------------------------------- A) guest registry
  console.log('--- A) guest registry (needs B1 fix) ---');
  let s = await api('GET', '/api/guests/search?q=CLINETESTA');
  check('A1', 'GET /api/guests/search?q=CLINETESTA -> 200 + array',
    s.status === 200 && Array.isArray(s.json), `status=${s.status} ${s.text.slice(0, 60)}`);
  s = await api('POST', '/api/guests/create', { name: 'Cline Test A', phone_number: '0770000001', nic_number: TEST_NICS[0] });
  check('A6', 'POST /api/guests/create (new NIC) -> 201', s.status === 201, `status=${s.status} ${s.text.slice(0, 80)}`);
  s = await api('POST', '/api/guests/create', { name: 'Cline Test A', phone_number: '0770000001', nic_number: TEST_NICS[0] });
  check('A7', 'POST same NIC identical -> 200 (idempotent)', s.status === 200, `status=${s.status}`);
  s = await api('POST', '/api/guests/create', { name: 'Cline Test A Renamed', phone_number: '0770000002', nic_number: TEST_NICS[0] });
  check('A8', 'POST same NIC changed name -> 200 + updated',
    s.status === 200 && s.json && s.json.name === 'Cline Test A Renamed', `name=${s.json && s.json.name}`);
  s = await api('POST', '/api/guests/create', { name: 'No Phone', nic_number: 'CLINETESTX0001' });
  check('A9', 'POST missing phone -> 400', s.status === 400, `status=${s.status}`);
  // ---------------------------------------------------------------- C) check-in validation
  console.log('\n--- C) check-in validation (needs B3/B13/B14/B15) ---');
  s = await checkIn('202', 'Cline Bad Dates', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-05', 5000, 0);
  check('C1', 'checkOut == checkIn -> 400', s.status === 400, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn('202', 'Cline Bad Dates', TEST_NICS[1], '0770000002', '2026-10-06', '2026-10-05', 5000, 0);
  check('C2', 'checkOut < checkIn -> 400', s.status === 400, `status=${s.status}`);
  s = await checkIn('999', 'Cline No Room', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 5000, 0);
  check('C4', 'unknown room 999 -> 404', s.status === 404, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn('202', 'Cline Overpay', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 5000, 99999, 'Cash');
  check('C6', 'advance > total -> 400 (no overpayment row)', s.status === 400, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn('202', 'Cline NoMethod', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 5000, 2000, undefined);
  const lost = await sql(
    `SELECT t.id FROM transactions t JOIN bookings b ON b.id=t.booking_id
     JOIN guests g ON g.id=b.guest_id WHERE g.nic_number=$1`, [TEST_NICS[1]]);
  check('C8', 'advance>0 with NO paymentMethod -> 400 (today: money silently dropped)',
    s.status === 400, `status=${s.status} txnsWritten=${lost.length}`);
  s = await checkIn('202', 'Cline Bad DateFmt', TEST_NICS[1], '0770000002', '2026-13-45', '2026-10-06', 5000, 0);
  check('C9', 'garbage date -> 400', s.status === 400, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn('202', 'Cline Lie Total', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 1, 0);
  const lied = await sql(
    `SELECT b.id FROM bookings b JOIN guests g ON g.id=b.guest_id
     WHERE g.nic_number=$1 AND b.total_price=1`, [TEST_NICS[1]]);
  check('C10', 'client-lying totalAmount rejected (server prices the stay)',
    s.status === 400 || lied.length === 0, `status=${s.status} rowsWithTotal1=${lied.length}`);
  // ---------------------------------------------------------------- D) early departure + re-admission
  console.log('\n--- D) early departure + re-admission (core scenario) ---');
  s = await checkIn('202', 'Cline Test A', TEST_NICS[0], '0770000001', '2026-10-02', '2026-10-08', 30000, 5000, 'Cash');
  check('D0', 'check-in Guest A room 202, 2->8 Oct (6n, total 30000, adv 5000)',
    s.status === 200, `status=${s.status} ${s.text.slice(0, 90)}`);
  const bookingA = s.json && s.json.booking ? s.json.booking.id : null;
  console.log(`        bookingA id=${bookingA}`);

  let r202 = await roomOn('202', '2026-10-03');
  check('D0b', 'rooms?date=3 Oct shows 202 occupied by Guest A',
    !!r202 && r202.isOccupied && /Cline Test A/.test(r202.guestName || ''),
    r202 ? `guest=${r202.guestName} total=${r202.totalAmount} paid=${r202.paidAmount}` : 'room missing');

  s = await api('POST', '/api/rooms/checkout', { roomNumber: '202', date: '2026-10-03', earlyDeparture: true });
  check('D1', 'POST /api/rooms/checkout early departure -> ==200 OR explicit 400 about balance',
    s.status === 200 || (s.status === 400 && /balance/i.test(s.text)),
    `status=${s.status} ${s.text.slice(0, 110)}`);

  const closed = await sql(
    `SELECT b.id, b.status, b.check_in_date::text AS ci, b.check_out_date::text AS co, b.total_price
     FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE r.number='202' ORDER BY b.id`);
  console.log('        room 202 bookings now:');
  closed.forEach((b) => console.log(`          #${b.id} ${b.status} ${b.ci} -> ${b.co} total=${b.total_price}`));

  const bA = await sql('SELECT id,status,check_out_date::text AS co,total_price FROM bookings WHERE id=$1', [bookingA]);
  check('D1b', 'Guest A booking (not a stale April row) is the one completed',
    bA.length === 1 && bA[0].status === 'completed', `bookingA status=${bA[0] && bA[0].status}`);
  check('D1c', 'departure stamp = 3 Oct 11:00 SLT (05:30Z), not a months-long span',
    bA.length === 1 && /^2026-10-03 (11:00|05:30)/.test(bA[0].co || ''), `check_out=${bA[0] && bA[0].co}`);
  check('D1d', 'early departure re-prices folio 30000 -> 5000 (1 night used)',
    bA.length === 1 && bA[0].total_price === 5000, `total_price=${bA[0] && bA[0].total_price}`);

  r202 = await roomOn('202', '2026-10-03');
  check('D2a', 'room 202 free again on 3 Oct after early departure',
    !!r202 && !r202.isOccupied, r202 ? `isOccupied=${r202.isOccupied} guest=${r202.guestName}` : 'room missing');

  s = await api('POST', '/api/rooms/checkin', {
    roomNumber: '202', guestName: 'Cline Test B', phoneNumber: '0770000003', nicNumber: TEST_NICS[1],
    checkInDate: '2026-10-03', checkOutDate: '2026-10-05', totalAmount: 10000, advancePayment: 2000, paymentMethod: 'Cash',
  });
  check('D2b', 'RE-ADMISSION same room+day after early departure -> 200',
    s.status === 200, `status=${s.status} ${s.text.slice(0, 110)}`);
  const bookingB = s.json && s.json.booking ? s.json.booking.id : null;

  r202 = await roomOn('202', '2026-10-03');
  check('D2c', 'room 202 now shows Guest B', !!r202 && /Cline Test B/.test(r202.guestName || ''),
    r202 ? `guest=${r202.guestName}` : 'room missing');

  s = await api('POST', '/api/rooms/checkout', { roomNumber: '202', date: '2026-10-04', earlyDeparture: true });
  check('D23a', 'Guest B early departure -> 200', s.status === 200, `status=${s.status} ${s.text.slice(0, 80)}`);
  s = await api('POST', '/api/rooms/checkin', {
    roomNumber: '202', guestName: 'Cline Test C', phoneNumber: '0770000004', nicNumber: TEST_NICS[2],
    checkInDate: '2026-10-04', checkOutDate: '2026-10-05', totalAmount: 5000, advancePayment: 5000, paymentMethod: 'Cash',
  });
  check('D23b', 'third guest admitted into same room on 4 Oct -> 200',
    s.status === 200, `status=${s.status} ${s.text.slice(0, 110)}`);

  const activeOn202 = await sql(
    `SELECT b.id, g.name FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN guests g ON g.id=b.guest_id
     WHERE r.number='202' AND b.status='active' ORDER BY b.id`);
  check('D23c', 'exactly ONE active booking left on room 202 after the chain',
    activeOn202.length === 1, `active=[${activeOn202.map((x) => '#' + x.id + ':' + x.name).join(', ')}]`);
  void bookingB;

  // ---------------------------------------------- D-R) early departure with an OVER-payment
  console.log('\n--- D-R) early departure that leaves the guest in credit (refund) ---');
  s = await checkIn('203', 'Cline Test D', TEST_NICS[3], '0770000005', '2026-10-02', '2026-10-08', 33000, 33000, 'Cash');
  check('DR0', 'check-in Guest D room 203, 2->8 Oct fully paid (6n, 33000)', s.status === 200,
    `status=${s.status} ${s.text.slice(0, 90)}`);
  const bookingD = s.json && s.json.booking ? s.json.booking.id : null;

  s = await api('POST', '/api/rooms/checkout', { roomNumber: '203', date: '2026-10-04', earlyDeparture: true });
  check('DR1', 'early departure of a fully-paid stay -> 200', s.status === 200,
    `status=${s.status} ${s.text.slice(0, 90)}`);
  check('DR2', 'response reports the refund due to the guest', !!s.json && s.json.refundDue === 22000,
    `refundDue=${s.json && s.json.refundDue}`);

  const bD = await sql('SELECT status, total_price FROM bookings WHERE id=$1', [bookingD]);
  check('DR3', 'folio re-priced 33000 -> 11000 (2 of 6 nights used)',
    bD.length === 1 && bD[0].total_price === 11000, `total_price=${bD[0] && bD[0].total_price}`);

  const dTx = await sql(
    `SELECT amount::int AS amount, payment_type FROM transactions WHERE booking_id=$1 ORDER BY id`, [bookingD]);
  const refundRow = dTx.find((x) => x.payment_type === 'refund');
  check('DR4', 'over-payment is tracked as a NEGATIVE refund row',
    !!refundRow && refundRow.amount === -22000, `rows=${JSON.stringify(dTx)}`);
  const netD = dTx.reduce((n, x) => n + x.amount, 0);
  check('DR5', 'ledger net for the folio == re-priced total (33000 - 22000)', netD === 11000, `net=${netD}`);

  // ---------------------------------------------------------------- E/F) occupancy + public engine
  console.log('\n--- E/F) occupancy + public booking engine ---');
  const avail = await api('GET', '/api/book/availability?checkIn=2026-10-04&checkOut=2026-10-05&guests=2');
  const nums = Array.isArray(avail.json) ? avail.json.map((x) => x.number) : [];
  check('B28', 'long-term room 301 excluded from public availability (NULL check-out)',
    !nums.includes('301'), `available=[${nums.join(',')}]`);
  check('D18', 'room 202 excluded from availability while Guest C stays there',
    !nums.includes('202'), `available=[${nums.join(',')}]`);

  const grid = await api('GET', '/api/book/rooms');
  check('B4', 'public room grid exposes availability/occupancy info',
    Array.isArray(grid.json) && grid.json.some((x) => 'isAvailable' in x || 'isOccupied' in x),
    `grid=${Array.isArray(grid.json) ? grid.json.length : 'err'} rooms, keys=${grid.json && grid.json[0] ? Object.keys(grid.json[0]).join('|') : 'n/a'}`);

  const flagDrift = await sql(
    `SELECT r.number, r.is_occupied,
       EXISTS (SELECT 1 FROM bookings b WHERE b.room_id=r.id AND b.status='active'
               AND b.check_in_date <= now() AND (b.check_out_date IS NULL OR b.check_out_date > now())) AS derived_occ
     FROM rooms r ORDER BY r.number`);
  const drifted = flagDrift.filter((x) => x.is_occupied !== x.derived_occ);
  check('B5', 'rooms.is_occupied agrees with booking-derived occupancy',
    drifted.length === 0, `drift=[${drifted.map((x) => x.number + '(flag=' + x.is_occupied + ',derived=' + x.derived_occ + ')').join(', ')}]`);

  // ---------------------------------------------------------------- G) accounting
  console.log('\n--- G) accounting surface ---');
  const tx = await api('GET', '/api/transactions');
  const testTx = (tx.json || []).filter((t) => TEST_NICS.includes(t.guestNic));
  console.log('        test transactions:');
  testTx.forEach((t) => console.log(`          #${t.transactionId} ${t.type} ${t.amount} ${t.method} room ${t.roomNumber} ${t.guestName}`));
  check('G1', 'test transactions visible in ledger', testTx.length >= 3, `count=${testTx.length}`);

  const statsBefore = await api('GET', '/api/admin/accounting-stats');
  const rawSum = await sql('SELECT COALESCE(SUM(amount),0)::int AS s FROM transactions');
  check('G3', 'accounting-stats totalRevenue == SUM(transactions.amount)',
    statsBefore.json && statsBefore.json.totalRevenue === rawSum[0].s,
    `stats=${statsBefore.json && statsBefore.json.totalRevenue} raw=${rawSum[0].s}`);

  s = await api('POST', '/api/admin/expenses', { amount: 1234, category: 'Maintenance', description: 'CLINE TEST expense' });
  check('G4', 'POST expense (valid) -> 200/201', s.status === 200 || s.status === 201, `status=${s.status} ${s.text.slice(0, 80)}`);
  s = await api('POST', '/api/admin/expenses', { amount: -50, category: 'Maintenance', description: 'CLINE TEST neg' });
  check('G5', 'POST expense negative amount -> 400', s.status === 400, `status=${s.status} ${s.text.slice(0, 80)}`);
  s = await api('POST', '/api/admin/expenses', { amount: 100, category: 'NotACategory', description: 'CLINE TEST badcat' });
  check('G6', 'POST expense invalid category -> 400', s.status === 400, `status=${s.status} ${s.text.slice(0, 80)}`);

  const rep = await api('GET', '/api/admin/monthly-report?year=2026&month=10');
  check('G7', 'monthly-report Oct 2026 renders CSV', rep.status === 200 && /October 2026/.test(rep.text),
    `status=${rep.status} bytes=${rep.text.length}`);
  check('G8', 'monthly-report labels refunds (Guest D over-paid then left early)',
    /refund/i.test(rep.text) && /Refund/.test(rep.text), `mentionsRefund=${/refund/i.test(rep.text)}`);

  const f = results.filter((r) => !r.ok);
  console.log(`\n=== SUMMARY: ${results.length - f.length}/${results.length} passed, ${f.length} failed ===`);
  f.forEach((r) => console.log(`  FAIL ${r.id}: ${r.desc}  [${r.detail}]`));

  const ids = await sql(
    `SELECT b.id FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE g.nic_number = ANY($1)`,
    [TEST_NICS]);
  console.log(`\nTEST ROWS CREATED: guests=${TEST_NICS.length} bookings=[${ids.map((x) => x.id).join(',')}]`);
  console.log('CLEANUP: node _cleanup.js');

  await pool.end();
  process.exitCode = f.length ? 1 : 0;
})().catch(async (e) => {
  console.error('SCENARIO ERROR:', e && e.stack ? e.stack : e);
  try { await pool.end(); } catch { /* ignore */ }
  process.exitCode = 1;
});
