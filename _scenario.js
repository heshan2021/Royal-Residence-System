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
   afterwards or the B5 drift check would report the harness's own leftovers.
   It mirrors deriveRoomState() exactly: an active booking counts only once its
   guest has actually ARRIVED (checked_in_at) and its window covers this moment -
   a reservation (checked_in_at IS NULL) never counts as occupancy. */
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
        AND bb.checked_in_at IS NOT NULL
        AND bb.check_in_date <= NOW()
        AND (bb.check_out_date IS NULL OR bb.check_out_date >= NOW())
      ORDER BY bb.check_in_date DESC
      LIMIT 1
    ) b ON true
    LEFT JOIN guests g ON g.id = b.guest_id
  ) s
  WHERE s.id = r.id`;

const TEST_NICS = ['CLINETESTA0001', 'CLINETESTB0001', 'CLINETESTC0001', 'CLINETESTX0001', 'CLINETESTH0001', 'CLINETESTI0001',
  'CLINETESTJ0001', 'CLINETESTK0001', 'CLINETESTL0001', 'CLINETESTM0001', 'CLINETESTN0001', 'CLINETESTO0001', 'CLINETESTP0001'];
const results = [];
function check(id, desc, ok, detail) {
  results.push({ id, desc, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${desc}${detail ? ' :: ' + detail : ''}`);
}

/* A precondition the harness cannot satisfy itself - no room left free for a probe's
   fixed dates, a demo seed the live books no longer carry. Reported as SKIP with the
   reason instead of pretending a feature regressed. Keep it rare and specific. */
function skip(id, desc, why) {
  results.push({ id, desc, ok: true, skipped: true, detail: why });
  console.log(`SKIP  ${id}  ${desc} :: ${why}`);
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

  /* Sri Lankan time helpers, used from here on: the hotel's day runs on UTC+05:30,
     so "today" and the 14:00 / 11:00 slots are SLT wall clock. */
  const SLT_MS = 330 * 60 * 1000;
  const sltDay = (backDays) => new Date(Date.now() + SLT_MS - backDays * 86400000).toISOString().slice(0, 10);
  const todaySLT = sltDay(0);
  const yesterdaySLT = sltDay(1);
  const twoDaysAgoSLT = sltDay(2);
  // Every booking column stores a UTC instant of a Sri Lankan hotel slot.
  const utcStamp = (isoWithOffset) =>
    new Date(isoWithOffset).toISOString().slice(0, 19).replace('T', ' ');
  /* Rooms the LIVE books leave free for a SLT window, using exactly the API's own
     overlap rule (A1 < B2 AND A2 > B1, a NULL check-out meaning open-ended). A probe
     must never run on a room a real folio already covers: it would collide, and the
     clash would be reported instead of the behaviour under test. */
  const roomsFreeFor = async (fromISO, toISO) => (await sql(
    `SELECT r.number FROM rooms r
      WHERE NOT EXISTS (SELECT 1 FROM bookings b
             WHERE b.room_id = r.id AND b.status = 'active'
               AND b.check_in_date < $2::timestamp
               AND (b.check_out_date IS NULL OR b.check_out_date > $1::timestamp))
      ORDER BY r.number`,
    [utcStamp(fromISO), utcStamp(toISO)])).map((x) => x.number);

  // ---------------------------------------------------------------- C) check-in validation
  console.log('\n--- C) check-in validation (needs B3/B13/B14/B15) ---');
  /* Every probe below must be REFUSED, so they run on a room the desk sees as free for
     5-6 Oct: a real folio sitting on the room (as on 202 right now) would produce the
     400 from an overlap instead of from the rule under test, and a test that passes
     for the wrong reason is worse than no test. */
  const cGrid = await api('GET', '/api/rooms?date=2026-10-05');
  const roomC = ((Array.isArray(cGrid.json) ? cGrid.json : [])
    .find((x) => !x.isOccupied && !x.isReserved && !x.isDueOut && (x.openFolios || []).length === 0) || {}).number
    || (await roomsFreeFor('2026-10-05T14:00:00+05:30', '2026-10-06T11:00:00+05:30'))[0] || '202';
  s = await checkIn(roomC, 'Cline Bad Dates', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-05', 5000, 0);
  check('C1', `checkOut == checkIn -> 400 (room ${roomC})`, s.status === 400, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn(roomC, 'Cline Bad Dates', TEST_NICS[1], '0770000002', '2026-10-06', '2026-10-05', 5000, 0);
  check('C2', `checkOut < checkIn -> 400 (room ${roomC})`, s.status === 400, `status=${s.status}`);
  s = await checkIn('999', 'Cline No Room', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 5000, 0);
  check('C4', 'unknown room 999 -> 404', s.status === 404, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn(roomC, 'Cline Overpay', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 5000, 99999, 'Cash');
  check('C6', 'advance > total -> 400 (no overpayment row)', s.status === 400, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn(roomC, 'Cline NoMethod', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 5000, 2000, undefined);
  const lost = await sql(
    `SELECT t.id FROM transactions t JOIN bookings b ON b.id=t.booking_id
     JOIN guests g ON g.id=b.guest_id WHERE g.nic_number=$1`, [TEST_NICS[1]]);
  check('C8', 'advance>0 with NO paymentMethod -> 400 (today: money silently dropped)',
    s.status === 400, `status=${s.status} txnsWritten=${lost.length}`);
  s = await checkIn(roomC, 'Cline Bad DateFmt', TEST_NICS[1], '0770000002', '2026-13-45', '2026-10-06', 5000, 0);
  check('C9', 'garbage date -> 400', s.status === 400, `status=${s.status} ${s.text.slice(0, 70)}`);
  s = await checkIn(roomC, 'Cline Lie Total', TEST_NICS[1], '0770000002', '2026-10-05', '2026-10-06', 1, 0);
  const lied = await sql(
    `SELECT b.id FROM bookings b JOIN guests g ON g.id=b.guest_id
     WHERE g.nic_number=$1 AND b.total_price=1`, [TEST_NICS[1]]);
  check('C10', 'client-lying totalAmount rejected (server prices the stay)',
    s.status === 400 || lied.length === 0, `status=${s.status} rowsWithTotal1=${lied.length}`);

/**
 * The chain under test: a stay is cut short at the desk, the room is handed straight
 * to the next guest, then cut short again the following day - the sequence that used
 * to leave stale `active` rows behind. Every expectation is about the room's state on
 * a fixed October day, so the two rooms only have to be free for 2-8 Oct; they are
 * passed in (chosen from the live books), never assumed. Money is derived from each
 * room's OWN nightly rate instead of a hard-coded figure: a probe must not depend on
 * which rates the room it was given happens to carry.
 */
async function earlyDepartureChain(roomD, roomE) {
  const rateD = Number((await sql('SELECT price FROM rooms WHERE number=$1', [roomD]))[0].price);
  const rateE = Number((await sql('SELECT price FROM rooms WHERE number=$1', [roomE]))[0].price);
  const aTotal = 6 * rateD; // Guest A: 2 -> 8 Oct, 6 nights
  const bTotal = 2 * rateD; // Guest B: 3 -> 5 Oct, 2 nights
  const dTotal = 6 * rateE; // Guest D: 2 -> 8 Oct, paid in full up front
  const dUsed = 2 * rateE;  // Guest D really uses 2 of those nights
  let s = await checkIn(roomD, 'Cline Test A', TEST_NICS[0], '0770000001', '2026-10-02', '2026-10-08', aTotal, rateD, 'Cash');
  check('D0', `check-in Guest A room ${roomD}, 2->8 Oct (6n x ${rateD} = ${aTotal}, adv ${rateD})`,
    s.status === 200, `status=${s.status} ${s.text.slice(0, 90)}`);
  const bookingA = s.json && s.json.booking ? s.json.booking.id : null;
  console.log(`        bookingA id=${bookingA}`);

  let rD = await roomOn(roomD, '2026-10-03');
  check('D0b', `rooms?date=3 Oct shows ${roomD} occupied by Guest A`,
    !!rD && rD.isOccupied && /Cline Test A/.test(rD.guestName || ''),
    rD ? `guest=${rD.guestName} total=${rD.totalAmount} paid=${rD.paidAmount}` : 'room missing');

  s = await api('POST', '/api/rooms/checkout', { roomNumber: roomD, date: '2026-10-03', earlyDeparture: true });
  check('D1', 'POST /api/rooms/checkout early departure -> ==200 OR explicit 400 about balance',
    s.status === 200 || (s.status === 400 && /balance/i.test(s.text)),
    `status=${s.status} ${s.text.slice(0, 110)}`);

  const closed = await sql(
    `SELECT b.id, b.status, b.check_in_date::text AS ci, b.check_out_date::text AS co, b.total_price
     FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE r.number=$1 ORDER BY b.id`, [roomD]);
  console.log(`        room ${roomD} bookings now:`);
  closed.forEach((b) => console.log(`          #${b.id} ${b.status} ${b.ci} -> ${b.co} total=${b.total_price}`));

  const bA = await sql('SELECT id,status,check_out_date::text AS co,total_price FROM bookings WHERE id=$1', [bookingA]);
  check('D1b', 'Guest A booking (not a stale April row) is the one completed',
    bA.length === 1 && bA[0].status === 'completed', `bookingA status=${bA[0] && bA[0].status}`);
  check('D1c', 'departure stamp = 3 Oct 11:00 SLT (05:30Z), not a months-long span',
    bA.length === 1 && /^2026-10-03 (11:00|05:30)/.test(bA[0].co || ''), `check_out=${bA[0] && bA[0].co}`);
  check('D1d', `early departure re-prices the folio ${aTotal} -> ${rateD} (1 night used)`,
    bA.length === 1 && bA[0].total_price === rateD, `total_price=${bA[0] && bA[0].total_price} wanted=${rateD}`);

  rD = await roomOn(roomD, '2026-10-03');
  check('D2a', `room ${roomD} free again on 3 Oct after early departure`,
    !!rD && !rD.isOccupied, rD ? `isOccupied=${rD.isOccupied} guest=${rD.guestName}` : 'room missing');

  s = await api('POST', '/api/rooms/checkin', {
    roomNumber: roomD, guestName: 'Cline Test B', phoneNumber: '0770000003', nicNumber: TEST_NICS[1],
    checkInDate: '2026-10-03', checkOutDate: '2026-10-05', totalAmount: bTotal, advancePayment: rateD, paymentMethod: 'Cash',
  });
  check('D2b', 'RE-ADMISSION same room+day after early departure -> 200',
    s.status === 200, `status=${s.status} ${s.text.slice(0, 110)}`);
  const bookingB = s.json && s.json.booking ? s.json.booking.id : null;

  rD = await roomOn(roomD, '2026-10-03');
  check('D2c', `room ${roomD} now shows Guest B`, !!rD && /Cline Test B/.test(rD.guestName || ''),
    rD ? `guest=${rD.guestName}` : 'room missing');

  s = await api('POST', '/api/rooms/checkout', { roomNumber: roomD, date: '2026-10-04', earlyDeparture: true });
  check('D23a', 'Guest B early departure -> 200', s.status === 200, `status=${s.status} ${s.text.slice(0, 80)}`);
  s = await api('POST', '/api/rooms/checkin', {
    roomNumber: roomD, guestName: 'Cline Test C', phoneNumber: '0770000004', nicNumber: TEST_NICS[2],
    checkInDate: '2026-10-04', checkOutDate: '2026-10-05', totalAmount: rateD, advancePayment: rateD, paymentMethod: 'Cash',
  });
  check('D23b', 'third guest admitted into same room on 4 Oct -> 200',
    s.status === 200, `status=${s.status} ${s.text.slice(0, 110)}`);

  const activeOnD = await sql(
    `SELECT b.id, g.name FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN guests g ON g.id=b.guest_id
     WHERE r.number=$1 AND b.status='active' ORDER BY b.id`, [roomD]);
  check('D23c', `exactly ONE active booking left on room ${roomD} after the chain`,
    activeOnD.length === 1, `active=[${activeOnD.map((x) => '#' + x.id + ':' + x.name).join(', ')}]`);
  void bookingB;

  // ---------------------------------------------- D-R) early departure with an OVER-payment
  console.log('\n--- D-R) early departure that leaves the guest in credit (refund) ---');
  s = await checkIn(roomE, 'Cline Test D', TEST_NICS[3], '0770000005', '2026-10-02', '2026-10-08', dTotal, dTotal, 'Cash');
  check('DR0', `check-in Guest D room ${roomE}, 2->8 Oct fully paid (6n x ${rateE} = ${dTotal})`, s.status === 200,
    `status=${s.status} ${s.text.slice(0, 90)}`);
  const bookingD = s.json && s.json.booking ? s.json.booking.id : null;

  s = await api('POST', '/api/rooms/checkout', { roomNumber: roomE, date: '2026-10-04', earlyDeparture: true });
  check('DR1', 'early departure of a fully-paid stay -> 200', s.status === 200,
    `status=${s.status} ${s.text.slice(0, 90)}`);
  check('DR2', `response reports the refund due to the guest (${dTotal} - ${dUsed})`,
    !!s.json && s.json.refundDue === dTotal - dUsed, `refundDue=${s.json && s.json.refundDue} wanted=${dTotal - dUsed}`);

  const bD = await sql('SELECT status, total_price FROM bookings WHERE id=$1', [bookingD]);
  check('DR3', `folio re-priced ${dTotal} -> ${dUsed} (2 of 6 nights used)`,
    bD.length === 1 && bD[0].total_price === dUsed, `total_price=${bD[0] && bD[0].total_price} wanted=${dUsed}`);

  const dTx = await sql(
    `SELECT amount::int AS amount, payment_type FROM transactions WHERE booking_id=$1 ORDER BY id`, [bookingD]);
  const refundRow = dTx.find((x) => x.payment_type === 'refund');
  check('DR4', 'over-payment is tracked as a NEGATIVE refund row',
    !!refundRow && refundRow.amount === -(dTotal - dUsed),
    `rows=${JSON.stringify(dTx)} wanted=${-(dTotal - dUsed)}`);
  const netD = dTx.reduce((n, x) => n + x.amount, 0);
  check('DR5', `ledger net for the folio == re-priced total (${dTotal} - ${dTotal - dUsed})`,
    netD === dUsed, `net=${netD} wanted=${dUsed}`);
}
  // ---------------------------------------------------------------- D) early departure + re-admission
  console.log('\n--- D) early departure + re-admission (core scenario) ---');
  /* The 2-8 Oct dates below are pinned to the harness's October-2026 calendar, so the
     probe has to run on rooms the LIVE books leave free for that whole span: a real
     folio on 202/203 currently covers the start of it, and a probe that collided with
     it would report the overlap instead of the chain under test. */
  const dWindow = ['2026-10-02T14:00:00+05:30', '2026-10-08T11:00:00+05:30'];
  const dFree = await roomsFreeFor(dWindow[0], dWindow[1]);
  const roomD = dFree[0] || null; // early departure + re-admission chain
  const roomE = dFree[1] || null; // the same chain, ending in a guest credit
  if (!roomD || !roomE) {
    const ids = ['D0', 'D0b', 'D1', 'D1b', 'D1c', 'D1d', 'D2a', 'D2b', 'D2c',
      'D23a', 'D23b', 'D23c', 'DR0', 'DR1', 'DR2', 'DR3', 'DR4', 'DR5'];
    for (const id of ids) {
      skip(id, 'early departure + re-admission chain',
        `no two rooms are free for ${dWindow[0].slice(0, 10)} -> ${dWindow[1].slice(0, 10)} in the live books`);
    }
  } else {
    console.log(`        probe rooms for 2-8 Oct: ${roomD} + ${roomE}`);
    await earlyDepartureChain(roomD, roomE);
  }

  // ---------------------------------------------------------------- E/F) occupancy + public engine
  console.log('\n--- E/F) occupancy + public booking engine ---');
  const avail = await api('GET', '/api/book/availability?checkIn=2026-10-04&checkOut=2026-10-05&guests=2');
  const nums = Array.isArray(avail.json) ? avail.json.map((x) => x.number) : [];

  /* B28 - a stay with no booked end (check_out_date NULL, i.e. long-term) must never
     be offered to the public engine. The dev books no longer carry such a folio on 301,
     so the probe seeds its own on a room that is free today (301 if it is free - it is
     the long-term room), asks the engine, then removes it again. Raw SQL because an
     open-ended stay is not something the desk UI can enter. */
  const ltGrid = await api('GET', '/api/rooms?date=2026-10-04');
  const ltFree = (Array.isArray(ltGrid.json) ? ltGrid.json : [])
    .filter((x) => !x.isOccupied && !x.isReserved && !x.isDueOut && (x.openFolios || []).length === 0)
    .map((x) => x.number);
  const ltRoom = ltFree.includes('301') ? '301' : ltFree[0] || null;
  if (!ltRoom) {
    skip('B28', 'open-ended (long-term) stay excluded from public availability',
      'no room is free on 4 Oct to seed the open-ended folio on');
  } else {
    const ltGuest = await sql(
      `INSERT INTO guests (name, phone_number, nic_number)
       VALUES ('Cline Test LongStay', '0770000015', 'CLINETESTO0001') RETURNING id`);
    const ltRows = await sql(
      `INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, total_price, status, checked_in_at)
       SELECT $1, r.id, $2::timestamp, NULL, 5000, 'active', $2::timestamp
       FROM rooms r WHERE r.number=$3 RETURNING id`,
      [ltGuest[0].id, utcStamp('2026-10-02T14:00:00+05:30'), ltRoom]);
    const ltBooking = ltRows[0] ? ltRows[0].id : null;
    const ltAvail = await api('GET', '/api/book/availability?checkIn=2026-10-04&checkOut=2026-10-05&guests=2');
    const ltNums = Array.isArray(ltAvail.json) ? ltAvail.json.map((x) => x.number) : [];
    check('B28', `open-ended (long-term) stay on room ${ltRoom} is excluded from public availability`,
      !ltNums.includes(ltRoom), `available=[${ltNums.join(',')}] seededFolio=${ltBooking}`);
    // The seed is the harness's own, so put the books back exactly as they were.
    await sql(`DELETE FROM transactions WHERE booking_id=$1`, [ltBooking]);
    await sql(`DELETE FROM bookings WHERE id=$1`, [ltBooking]);
    await pool.query(RECONCILE_ROOMS);
  }

  if (!roomD) {
    skip('D18', 'room excluded from availability while its guest is staying in it',
      'section D could not find a room free for 2-8 Oct');
  } else {
    check('D18', `room ${roomD} excluded from availability while Guest C stays there`,
      !nums.includes(roomD), `available=[${nums.join(',')}]`);
  }

  const grid = await api('GET', '/api/book/rooms');
  check('B4', 'public room grid exposes availability/occupancy info',
    Array.isArray(grid.json) && grid.json.some((x) => 'isAvailable' in x || 'isOccupied' in x),
    `grid=${Array.isArray(grid.json) ? grid.json.length : 'err'} rooms, keys=${grid.json && grid.json[0] ? Object.keys(grid.json[0]).join('|') : 'n/a'}`);

  const flagDrift = await sql(
    `SELECT r.number, r.is_occupied,
       EXISTS (SELECT 1 FROM bookings b WHERE b.room_id=r.id AND b.status='active'
               AND b.checked_in_at IS NOT NULL
               AND b.check_in_date <= now() AND (b.check_out_date IS NULL OR b.check_out_date >= now())) AS derived_occ
     FROM rooms r ORDER BY r.number`);
  const drifted = flagDrift.filter((x) => x.is_occupied !== x.derived_occ);
  check('B5', 'rooms.is_occupied agrees with booking-derived occupancy',
    drifted.length === 0, `drift=[${drifted.map((x) => x.number + '(flag=' + x.is_occupied + ',derived=' + x.derived_occ + ')').join(', ')}]`);

  // ------------------------------------------- H) an unclosed folio stays visible
  console.log('\n--- H) overdue folio stays on the dashboard until paid + checked out ---');
  // The exact production bug: a 1-night stay whose window has already ended is left
  // `active` (the guest was checked in late / the desk never ran the check-out).
  // Such a row used to vanish from every later day, so its money was uncollectable.
  // Seeded with raw SQL because it is a legacy accident - the API path that created
  // it is exactly what this fix makes visible again.
  // (todaySLT / yesterdaySLT / utcStamp are declared once, just above section C.)

  // Seed on a room that is genuinely free today, so this probe never collides with
  // a real folio that may already be sitting on the books.
  const gridToday = await api('GET', `/api/rooms?date=${todaySLT}`);
  const hFreeRoom = (Array.isArray(gridToday.json) ? gridToday.json : [])
    .find((x) => !x.isOccupied && x.number !== '301');
  const hRoom = hFreeRoom ? hFreeRoom.number : null;

  const hGuest = await sql(
    `INSERT INTO guests (name, phone_number, nic_number)
     VALUES ('Cline Test Overdue', '0770000007', 'CLINETESTH0001') RETURNING id`);
  const hRows = await sql(
    `INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, total_price, status)
     SELECT $1, r.id, $2::timestamp, $3::timestamp, 4500, 'active'
     FROM rooms r WHERE r.number = $4 RETURNING id`,
    [hGuest[0].id,
      utcStamp(`${twoDaysAgoSLT}T14:00:00+05:30`),
      utcStamp(`${yesterdaySLT}T11:00:00+05:30`),
      hRoom]);
  const hBooking = hRows[0] ? hRows[0].id : null;
  console.log(`        seeded unclosed folio #${hBooking}: room ${hRoom}, ${twoDaysAgoSLT} -> ${yesterdaySLT}, LKR 4500 unpaid`);

  let r101 = await roomOn(hRoom, todaySLT);
  check('H1', 'rooms?date=today surfaces the unclosed folio as "Not Checked Out"',
    !!r101 && r101.isOccupied === true && r101.isOverdue === true && r101.bookingId === hBooking,
    r101 ? `isOccupied=${r101.isOccupied} isOverdue=${r101.isOverdue} bookingId=${r101.bookingId} (folio #${hBooking})` : `room ${hRoom} missing`);
  check('H2', 'unclosed folio keeps its guest, total, unpaid balance and overdue age',
    !!r101 && /Cline Test Overdue/.test(r101.guestName || '')
      && r101.totalAmount === 4500 && r101.paidAmount === 0 && r101.overdueDays === 1,
    r101 ? `guest=${r101.guestName} total=${r101.totalAmount} paid=${r101.paidAmount} overdueDays=${r101.overdueDays}` : `room ${hRoom} missing`);
  check('H3', 'the overdue card is not mistaken for a guest departing today',
    !!r101 && r101.isDueOut === false && Array.isArray(r101.openFolios) && r101.openFolios.length === 0,
    r101 ? `isDueOut=${r101.isDueOut} openFolios=${JSON.stringify(r101.openFolios)}` : `room ${hRoom} missing`);

  const statsBeforeH = await api('GET', '/api/admin/accounting-stats');
  const owedBeforeH = statsBeforeH.json && statsBeforeH.json.pendingBalance;
  check('H4', 'unsettled folio is counted as money still owed',
    typeof owedBeforeH === 'number' && owedBeforeH >= 4500, `pendingBalance=${owedBeforeH}`);

  s = await api('POST', '/api/rooms/checkout', { roomNumber: hRoom, date: todaySLT });
  const hOpen = await sql(`SELECT status FROM bookings WHERE id=$1`, [hBooking]);
  check('H5', 'check-out without payment is refused and the folio stays open (D13)',
    s.status === 400 && /balance/i.test(s.text) && hOpen[0] && hOpen[0].status === 'active',
    `status=${s.status} bookingStatus=${hOpen[0] && hOpen[0].status} ${s.text.slice(0, 110)}`);

  r101 = await roomOn(hRoom, todaySLT);
  check('H6', 'the room is still on the grid after the refused check-out',
    !!r101 && r101.isOccupied === true && r101.isOverdue === true,
    r101 ? `isOccupied=${r101.isOccupied} isOverdue=${r101.isOverdue}` : `room ${hRoom} missing`);

  // ------------------------------------------------ H-b) settle the overdue folio
  console.log('\n--- H-b) settle the overdue folio (aimed at its own bookingId) ---');
  s = await api('POST', '/api/rooms/checkout', {
    roomNumber: hRoom, date: todaySLT, bookingId: hBooking, finalPayment: 4500, paymentMethod: 'Cash',
  });
  check('H7', 'paying the balance closes the folio -> 200 and reports it was overdue',
    s.status === 200 && s.json && s.json.wasOverdue === true,
    `status=${s.status} wasOverdue=${s.json && s.json.wasOverdue} ${s.text.slice(0, 110)}`);

  const hClosed = await sql(
    `SELECT status, check_out_date::text AS co FROM bookings WHERE id=$1`, [hBooking]);
  const wantedDeparture = new RegExp(`^${yesterdaySLT} (11:00|05:30)`);
  check('H8', "departure is stamped with the folio's OWN slot, not the viewed day",
    hClosed.length === 1 && hClosed[0].status === 'completed'
      && wantedDeparture.test(hClosed[0].co || ''),
    `status=${hClosed[0] && hClosed[0].status} check_out=${hClosed[0] && hClosed[0].co} wanted=${yesterdaySLT} 11:00`);

  const hTx = await sql(
    `SELECT amount::int AS amount, payment_type FROM transactions WHERE booking_id=$1 ORDER BY id`, [hBooking]);
  check('H9', 'the settlement reaches the ledger as a final_settlement row',
    hTx.some((t) => t.payment_type === 'final_settlement' && t.amount === 4500),
    `rows=${JSON.stringify(hTx)}`);

  r101 = await roomOn(hRoom, todaySLT);
  check('H10', 'the room flips back to Available once the folio is closed',
    !!r101 && r101.isOccupied === false && r101.isOverdue !== true && !r101.guestName,
    r101 ? `isOccupied=${r101.isOccupied} isOverdue=${r101.isOverdue} guest=${r101.guestName}` : `room ${hRoom} missing`);

  const statsAfterH = await api('GET', '/api/admin/accounting-stats');
  check('H11', 'pendingBalance drops by exactly the amount that was collected at the desk',
    !!statsAfterH.json && statsAfterH.json.pendingBalance === owedBeforeH - 4500,
    `before=${owedBeforeH} after=${statsAfterH.json && statsAfterH.json.pendingBalance}`);

  // ------------------------------------------------ I) discount at check-out
  console.log('\n--- I) discount with a mandatory reason at check-out (D14) ---');
  // The desk knocks money off a stay for a stated reason: a student rate, a night
  // with no cheaper room free, a repeating customer, goodwill. Three rules are
  // under test: the reason is mandatory, a discount may only ever forgive debt
  // (never hand cash back), and everything given away stays traceable afterwards.
  const iRoom = hRoom; // section H left this room free again
  if (!iRoom) {
    check('I1', 'discount scenario could not run: no free room today', false, 'see section H');
  } else {
    const iGross = 12000; // what the room would have cost: 2 nights @ 6000
    const iGuest = await sql(
      `INSERT INTO guests (name, phone_number, nic_number)
       VALUES ('Cline Test Discount', '0770000009', 'CLINETESTI0001') RETURNING id`);
    const iRows = await sql(
      `INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, total_price, status)
       SELECT $1, r.id, $2::timestamp, $3::timestamp, $4, 'active'
       FROM rooms r WHERE r.number = $5 RETURNING id`,
      [iGuest[0].id,
        utcStamp(`${yesterdaySLT}T14:00:00+05:30`),
        utcStamp(`${todaySLT}T11:00:00+05:30`),
        iGross, iRoom]);
    const iBooking = iRows[0] ? iRows[0].id : null;
    console.log(`        seeded discount folio #${iBooking}: room ${iRoom}, LKR ${iGross} owed, nothing paid`);

    // I1 - the reason is not decoration: an unexplained discount is refused.
    s = await api('POST', '/api/rooms/checkout', {
      roomNumber: iRoom, date: todaySLT, bookingId: iBooking,
      finalPayment: iGross - 2000, paymentMethod: 'Cash', discountAmount: 2000,
    });
    let iRow = await sql(
      `SELECT status, total_price::int AS total, discount_amount::int AS disc,
              discount_reason, discount_applied_at
       FROM bookings WHERE id=$1`, [iBooking]);
    check('I1', 'discount without a reason -> 400 and the folio stays open',
      s.status === 400 && /reason is required/i.test(s.text)
        && iRow[0].status === 'active' && iRow[0].disc === 0,
      `status=${s.status} booking=${iRow[0] && iRow[0].status} disc=${iRow[0] && iRow[0].disc} ${s.text.slice(0, 100)}`);

    // I2 - the cap is the debt, not the price: forgiving more than is owed would
    //      leave the folio in credit, i.e. a cash refund in disguise.
    s = await api('POST', '/api/rooms/checkout', {
      roomNumber: iRoom, date: todaySLT, bookingId: iBooking,
      finalPayment: 11000, paymentMethod: 'Cash', discountAmount: 2000, discountReason: 'Student',
    });
    check('I2', 'a discount larger than the outstanding balance -> 400 reporting the cap',
      s.status === 400 && /larger than the outstanding balance/i.test(s.text)
        && s.json && s.json.maxDiscount === 1000,
      `status=${s.status} maxDiscount=${s.json && s.json.maxDiscount} ${s.text.slice(0, 110)}`);

    // I3 - happy path: LKR 3000 off a 12000 folio, LKR 9000 collected, reason kept.
    s = await api('POST', '/api/rooms/checkout', {
      roomNumber: iRoom, date: todaySLT, bookingId: iBooking,
      finalPayment: 9000, paymentMethod: 'Cash', discountAmount: 3000,
      discountReason: 'Student — school group',
    });
    check('I3', 'a reasoned discount settles the folio and reports gross vs net',
      s.status === 200 && s.json
        && s.json.grossTotal === iGross && s.json.totalAmount === 9000
        && s.json.discountAmount === 3000 && s.json.settled === true
        && /discount/i.test(s.json.message || ''),
      `status=${s.status} gross=${s.json && s.json.grossTotal} net=${s.json && s.json.totalAmount} disc=${s.json && s.json.discountAmount} settled=${s.json && s.json.settled}`);

    iRow = await sql(
      `SELECT status, total_price::int AS total, discount_amount::int AS disc,
              discount_reason, discount_applied_at::text AS applied
       FROM bookings WHERE id=$1`, [iBooking]);
    check('I4', 'the folio keeps the NET price plus the concession audit trail',
      iRow[0].status === 'completed' && iRow[0].total === 9000 && iRow[0].disc === 3000
        && /^Student/.test(iRow[0].discount_reason || '') && !!iRow[0].applied,
      `status=${iRow[0] && iRow[0].status} total=${iRow[0] && iRow[0].total} disc=${iRow[0] && iRow[0].disc} reason=${iRow[0] && iRow[0].discount_reason} at=${iRow[0] && iRow[0].applied}`);

    const iTx = await sql(
      `SELECT amount::int AS amount, payment_type FROM transactions WHERE booking_id=$1 ORDER BY id`,
      [iBooking]);
    const iPaid = iTx.reduce((sum, t) => sum + t.amount, 0);
    check('I5', 'the ledger reconciles: cash collected = net price, discount = shortfall to gross',
      iTx.length === 1 && iPaid === 9000 && !iTx.some((t) => t.payment_type === 'refund')
        && iPaid + iRow[0].disc === iGross,
      `paid=${iPaid} disc=${iRow[0].disc} gross=${iGross} rows=${JSON.stringify(iTx)}`);

    const rDisc = await roomOn(iRoom, todaySLT);
    check('I6', 'the discounted folio releases its room like any other check-out',
      !!rDisc && rDisc.isOccupied === false && !rDisc.guestName,
      rDisc ? `isOccupied=${rDisc.isOccupied} guest=${rDisc.guestName}` : `room ${iRoom} missing`);

    // I7 - a folio that is already paid in full has nothing left to forgive:
    //      the desk cannot hand a discount out as if it were cash.
    const iPrepaidRows = await sql(
      `INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, total_price, status)
       SELECT $1, r.id, $2::timestamp, $3::timestamp, 5000, 'active'
       FROM rooms r WHERE r.number = $4 RETURNING id`,
      [iGuest[0].id,
        utcStamp(`${yesterdaySLT}T14:00:00+05:30`),
        utcStamp(`${todaySLT}T11:00:00+05:30`),
        iRoom]);
    const iPrepaid = iPrepaidRows[0] ? iPrepaidRows[0].id : null;
    await sql(
      `INSERT INTO transactions (booking_id, amount, payment_method, payment_type, created_at)
       VALUES ($1, 5000, 'Cash', 'advance', $2::timestamp)`,
      [iPrepaid, utcStamp(`${todaySLT}T09:30:00+05:30`)]);

    s = await api('POST', '/api/rooms/checkout', {
      roomNumber: iRoom, date: todaySLT, bookingId: iPrepaid,
      discountAmount: 500, discountReason: 'Repeating customer',
    });
    const iPrepaidBefore = await sql(
      `SELECT status, discount_amount::int AS disc FROM bookings WHERE id=$1`, [iPrepaid]);
    check('I7', 'a fully paid folio has nothing to discount -> 400, folio untouched',
      s.status === 400 && /nothing left to discount/i.test(s.text)
        && iPrepaidBefore[0].status === 'active' && iPrepaidBefore[0].disc === 0,
      `status=${s.status} booking=${iPrepaidBefore[0] && iPrepaidBefore[0].status} disc=${iPrepaidBefore[0] && iPrepaidBefore[0].disc} ${s.text.slice(0, 110)}`);

    // ...and the very same folio still closes cleanly with no discount, which
    // proves the refusal above was about the discount, not about the check-out.
    s = await api('POST', '/api/rooms/checkout', { roomNumber: iRoom, date: todaySLT, bookingId: iPrepaid });
    const iPrepaidAfter = await sql(
      `SELECT status, total_price::int AS total, discount_amount::int AS disc, discount_applied_at
       FROM bookings WHERE id=$1`, [iPrepaid]);
    check('I8', 'the same folio closes with no discount and no audit-trail noise',
      s.status === 200 && iPrepaidAfter[0].status === 'completed'
        && iPrepaidAfter[0].total === 5000 && iPrepaidAfter[0].disc === 0
        && iPrepaidAfter[0].discount_applied_at === null,
      `status=${s.status} booking=${iPrepaidAfter[0] && iPrepaidAfter[0].status} total=${iPrepaidAfter[0] && iPrepaidAfter[0].total} disc=${iPrepaidAfter[0] && iPrepaidAfter[0].disc}`);

    // I9/I10 - what was given away, and why, has to reach the owner's report.
    const pad2 = (n) => String(n).padStart(2, '0');
    const [sltYear, sltMonth] = todaySLT.split('-').map(Number);
    const nextSLTMonth = sltMonth === 12 ? { y: sltYear + 1, m: 1 } : { y: sltYear, m: sltMonth + 1 };
    const rawMonthDiscounts = await sql(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(discount_amount),0)::int AS s
       FROM bookings
       WHERE discount_amount > 0
         AND discount_applied_at >= $1::timestamp
         AND discount_applied_at < $2::timestamp`,
      [utcStamp(`${sltYear}-${pad2(sltMonth)}-01T00:00:00+05:30`),
        utcStamp(`${nextSLTMonth.y}-${pad2(nextSLTMonth.m)}-01T00:00:00+05:30`)]);

    const report = await api('GET', `/api/admin/monthly-report?month=${sltMonth}&year=${sltYear}`);
    const reportText = typeof report.text === 'string' ? report.text : '';
    const csvMoney = (label) => {
      const m = reportText.match(new RegExp(`"${label}","LKR ([0-9,]+)"`));
      return m ? Number(m[1].replace(/,/g, '')) : null;
    };
    const csvCount = (label) => {
      const m = reportText.match(new RegExp(`"${label}","([0-9]+)"`));
      return m ? Number(m[1]) : null;
    };

    check('I9', 'monthly report carries the concession with its folio id and reason',
      report.status === 200 && reportText.includes('DISCOUNT LEDGER')
        && reportText.includes(`,"${iBooking}",`) && reportText.includes('Student'),
      `status=${report.status} hasLedger=${reportText.includes('DISCOUNT LEDGER')} hasFolio=${reportText.includes(`,"${iBooking}",`)}`);

    check('I10', 'reported discount count and total match the database for that month',
      csvCount('Discounted Folios') === rawMonthDiscounts[0].n
        && csvMoney('Less: Guest Discounts Given') === rawMonthDiscounts[0].s
        && csvMoney('Net Revenue Collected') !== null,
      `count=${csvCount('Discounted Folios')} rawCount=${rawMonthDiscounts[0].n} total=${csvMoney('Less: Guest Discounts Given')} rawTotal=${rawMonthDiscounts[0].s}`);
  }

  // ------------------------------------------------ G) accounting
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

  // --- G9-G14: All Time / Monthly / Annual period scope on the stats API ---
  // Expected values are recomputed with Sri Lankan (UTC+05:30) half-open bounds,
  // the same convention the API must use on a UTC host.
  const slt = (from, to) => `>= '${from}T00:00:00+05:30' AND created_at < '${to}T00:00:00+05:30'`;
  const rawOctTx = await sql(`SELECT COALESCE(SUM(amount),0)::int AS s FROM transactions WHERE created_at ${slt('2026-10-01', '2026-11-01')}`);
  const rawOctExp = await sql(`SELECT COALESCE(SUM(amount),0)::int AS s FROM expenses WHERE expense_date ${slt('2026-10-01', '2026-11-01')}`);
  const rawYearTx = await sql(`SELECT COALESCE(SUM(amount),0)::int AS s FROM transactions WHERE created_at ${slt('2026-01-01', '2027-01-01')}`);

  const monthStats = await api('GET', '/api/admin/accounting-stats?period=month&month=10&year=2026');
  check('G9', 'period=month scopes revenue to that Sri Lankan month',
    !!monthStats.json && monthStats.json.period === 'month'
      && monthStats.json.periodLabel === 'October 2026'
      && monthStats.json.totalRevenue === rawOctTx[0].s
      && monthStats.json.rangeStart !== null && monthStats.json.rangeEnd !== null,
    `revenue=${monthStats.json && monthStats.json.totalRevenue} raw=${rawOctTx[0].s} label=${monthStats.json && monthStats.json.periodLabel}`);
  check('G10', 'period=month scopes expenses and reports period collection',
    !!monthStats.json
      && monthStats.json.totalExpenses === rawOctExp[0].s
      && monthStats.json.collection === monthStats.json.totalRevenue
      && monthStats.json.collectionLabel === "This Month's Collection",
    `expenses=${monthStats.json && monthStats.json.totalExpenses} raw=${rawOctExp[0].s} collection=${monthStats.json && monthStats.json.collection}`);

  const yearStats = await api('GET', '/api/admin/accounting-stats?period=year&year=2026');
  check('G11', 'period=year scopes revenue to that Sri Lankan year',
    !!yearStats.json && yearStats.json.period === 'year'
      && yearStats.json.periodLabel === '2026'
      && yearStats.json.totalRevenue === rawYearTx[0].s
      && yearStats.json.collection === yearStats.json.totalRevenue
      && yearStats.json.collectionLabel === "This Year's Collection",
    `revenue=${yearStats.json && yearStats.json.totalRevenue} raw=${rawYearTx[0].s}`);

  const allStats = await api('GET', '/api/admin/accounting-stats?period=all');
  check('G12', 'period=all matches the default no-param all-time snapshot',
    !!allStats.json && allStats.json.period === 'all'
      && allStats.json.periodLabel === 'All time'
      && allStats.json.rangeStart === null && allStats.json.rangeEnd === null
      && allStats.json.totalRevenue === statsBefore.json.totalRevenue
      && allStats.json.pendingBalance === statsBefore.json.pendingBalance
      && allStats.json.collection === allStats.json.todayCollection
      && allStats.json.collectionLabel === "Today's Collection",
    `all=${allStats.json && allStats.json.totalRevenue} default=${statsBefore.json && statsBefore.json.totalRevenue} pending=${allStats.json && allStats.json.pendingBalance}`);
  check('G13', 'period=month revenue <= period=year revenue <= all-time revenue',
    !!monthStats.json && !!yearStats.json
      && monthStats.json.totalRevenue <= yearStats.json.totalRevenue
      && yearStats.json.totalRevenue <= statsBefore.json.totalRevenue,
    `oct=${monthStats.json && monthStats.json.totalRevenue} year=${yearStats.json && yearStats.json.totalRevenue} all=${statsBefore.json && statsBefore.json.totalRevenue}`);

  const badPeriod = await api('GET', '/api/admin/accounting-stats?period=week');
  const badMonth = await api('GET', '/api/admin/accounting-stats?period=month&month=13&year=2026');
  check('G14', 'invalid period / out-of-range month -> 400',
    badPeriod.status === 400 && badMonth.status === 400,
    `periodStatus=${badPeriod.status} monthStatus=${badMonth.status}`);

  // ------------------------------------------- J) reservations (hold a room)
  console.log('\n--- J) reservations: hold a room for a guest who has not arrived ---');
  // A reservation is an ordinary `active` booking whose guest has not turned up
  // yet (`bookings.checked_in_at IS NULL`). The night is sold, so the room can
  // never be sold twice - but it is still EMPTY, so it must never read
  // "Occupied" and must never be counted as occupancy. These checks pin both
  // halves of that, plus the only way a hold may be overruled: the guest who is
  // physically in the room right now, on a stay that began on an earlier day,
  // and only for an arrival TODAY.
  const shiftDay = (dateOnly, days) => {
    const [y, m, d] = dateOnly.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
  };
  const reserve = (roomNumber, guestName, nic, phone, ci, co, total, adv, ack) =>
    api('POST', '/api/rooms/checkin', {
      roomNumber, guestName, phoneNumber: phone, nicNumber: nic,
      checkInDate: ci, checkOutDate: co, totalAmount: total,
      advancePayment: adv, paymentMethod: adv > 0 ? 'Cash' : undefined,
      reserve: true,
      overlapAcknowledgement: ack,
    });
  const arrival = (bookingId) => api('POST', `/api/bookings/${bookingId}/checkin`);
  const activeOn = async (roomNumber) =>
    (await sql(
      `SELECT COUNT(*)::int AS n FROM bookings b JOIN rooms r ON r.id=b.room_id
       WHERE r.number=$1 AND b.status='active'`, [roomNumber]))[0].n;

  const jGrid = await api('GET', `/api/rooms?date=${todaySLT}`);
  const jFree = (Array.isArray(jGrid.json) ? jGrid.json : [])
    .filter((x) => x.number !== '301' && !x.isOccupied && !x.isReserved
      && (x.openFolios || []).length === 0 && !x.isDueOut)
    .map((x) => x.number);
  const roomA = jFree[0] || null; // held today; that guest arrives
  const roomB = jFree[1] || null; // an in-house guest is turned around
  check('J0', 'two rooms are free today for the reservation scenario',
    !!(roomA && roomB), `free=[${jFree.join(',')}]`);

  if (!roomA || !roomB) {
    check('J1', 'reservation scenario could not run: needs two free rooms today', false,
      `free=[${jFree.join(',')}]`);
  } else {
    const rateA = Number((await sql(`SELECT price FROM rooms WHERE number=$1`, [roomA]))[0].price);
    const rateB = Number((await sql(`SELECT price FROM rooms WHERE number=$1`, [roomB]))[0].price);
    const tomorrowSLT = shiftDay(todaySLT, 1);
    const twoDaysSLT = shiftDay(todaySLT, 2);
    const fourDaysSLT = shiftDay(todaySLT, 4);

    // J1 - hold room A for two nights from today, with a deposit.
    const aTotal = rateA * 2;
    s = await reserve(roomA, 'Cline Test Reserved', TEST_NICS[6], '0770000008',
      todaySLT, twoDaysSLT, aTotal, 2000);
    const jBooking = s.json && s.json.booking ? s.json.booking.id : null;
    check('J1', 'POST /api/rooms/checkin?reserve=true -> 200 and a booking with NO arrival stamp',
      s.status === 200 && !!s.json && s.json.reserved === true
        && !!s.json.booking && s.json.booking.checkedInAt === null
        && s.json.nights === 2 && s.json.totalAmount === aTotal && s.json.paidAmount === 2000,
      `status=${s.status} booking=${jBooking} reserved=${s.json && s.json.reserved} checkedInAt=${s.json && s.json.booking && s.json.booking.checkedInAt} total=${s.json && s.json.totalAmount} ${s.text.slice(0, 70)}`);

    // J2 - the stored row is a reservation, priced by the server, deposit booked.
    const jRows = await sql(
      `SELECT b.status, b.checked_in_at, b.total_price::int AS total, b.check_in_date::text AS ci
       FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE r.number=$1 AND b.status='active'`,
      [roomA]);
    const jPaid = (await sql(
      `SELECT COALESCE(SUM(amount),0)::int AS s FROM transactions WHERE booking_id=$1`,
      [jBooking]))[0].s;
    check('J2', 'stored as active + checked_in_at NULL, at the 14:00 slot, deposit in the ledger',
      jRows.length === 1 && jRows[0].checked_in_at === null && jRows[0].total === aTotal
        && new RegExp(`^${todaySLT} (14:00|08:30)`).test(jRows[0].ci || '') && jPaid === 2000,
      `rows=${jRows.length} checkedInAt=${jRows[0] && jRows[0].checked_in_at} total=${jRows[0] && jRows[0].total} ci=${jRows[0] && jRows[0].ci} paid=${jPaid}`);

    // J3 - the card: sold, but never "Occupied", with the hold's guest and money.
    const rHold = await roomOn(roomA, todaySLT);
    check('J3', 'the room reads "Reserved": isReserved, NOT occupied, hold details attached',
      !!rHold && rHold.isReserved === true && rHold.isOccupied === false
        && rHold.isDueOut !== true && rHold.isOverdue !== true
        && !!rHold.reserved && rHold.reserved.bookingId === jBooking
        && /Cline Test Reserved/.test(rHold.reserved.guestName || '')
        && rHold.reserved.nights === 2 && rHold.reserved.totalAmount === aTotal
        && rHold.reserved.paidAmount === 2000 && rHold.guestName === rHold.reserved.guestName,
      rHold ? `isReserved=${rHold.isReserved} isOccupied=${rHold.isOccupied} guest=${rHold.guestName} nights=${rHold.reserved && rHold.reserved.nights} paid=${rHold.reserved && rHold.reserved.paidAmount}` : `room ${roomA} missing`);

    // J4 - rooms.* is a display cache that counts ARRIVALS only.
    const jCache = (await sql(`SELECT is_occupied, guest_name FROM rooms WHERE number=$1`,
      [roomA]))[0];
    check('J4', 'rooms.is_occupied stays false while the room is merely held',
      jCache.is_occupied === false && jCache.guest_name === null,
      `is_occupied=${jCache.is_occupied} guest_name=${jCache.guest_name}`);

    // J5 - the public booking engine must not offer a held room.
    const jAvail = await api('GET', `/api/book/availability?checkIn=${todaySLT}&checkOut=${twoDaysSLT}`);
    const jAvailNums = Array.isArray(jAvail.json) ? jAvail.json.map((x) => x.number) : [];
    check('J5', 'a held room is not offered by the public availability engine',
      !jAvailNums.includes(roomA), `available=[${jAvailNums.join(',')}]`);

    // J6 - the hold blocks the same night being sold again...
    s = await reserve(roomA, 'Cline Test Gatecrasher', TEST_NICS[10], '0770000012',
      todaySLT, tomorrowSLT, rateA, 0);
    const aActiveJ6 = await activeOn(roomA);
    check('J6', 'a second booking for a held room -> 400 naming the hold, nobody to acknowledge',
      s.status === 400 && !!s.json && !!s.json.overlap
        && s.json.overlap.bookingId === jBooking
        && s.json.overlap.inHouse === false && s.json.overlap.canAcknowledge === false
        && aActiveJ6 === 1,
      `status=${s.status} overlap=${JSON.stringify(s.json && s.json.overlap)} active=${aActiveJ6}`);

    // J7 - ...and a hold can never be "confirmed away": nobody is there to leave.
    s = await reserve(roomA, 'Cline Test Gatecrasher', TEST_NICS[10], '0770000012',
      todaySLT, tomorrowSLT, rateA, 0, { incumbentBookingId: jBooking });
    const aActiveJ7 = await activeOn(roomA);
    check('J7', 'confirming an early departure of a guest who never arrived -> still 400, nothing written',
      s.status === 400 && aActiveJ7 === 1,
      `status=${s.status} active=${aActiveJ7} ${s.text.slice(0, 90)}`);

    // J8 - the day's statistics: a hold is counted on its own, never as occupancy.
    const jGrid2 = await api('GET', `/api/rooms?date=${todaySLT}`);
    const jList2 = Array.isArray(jGrid2.json) ? jGrid2.json : [];
    const dbHeldToday = (await sql(
      `SELECT COUNT(*)::int AS n FROM bookings b
       WHERE b.status='active' AND b.checked_in_at IS NULL
         AND b.check_in_date <= $1::timestamp
         AND (b.check_out_date IS NULL OR b.check_out_date >= $2::timestamp)`,
      [utcStamp(`${todaySLT}T23:59:59+05:30`), utcStamp(`${todaySLT}T00:00:00+05:30`)]))[0].n;
    const shownHeld = jList2.filter((x) => x.isReserved).length;
    const bothFlags = jList2.filter((x) => x.isReserved && x.isOccupied).length;
    check('J8', 'held rooms are counted separately: no room is ever both Reserved and Occupied',
      bothFlags === 0 && shownHeld === dbHeldToday && shownHeld >= 1
        && jList2.find((x) => x.number === roomA).isOccupied === false,
      `held=${shownHeld} dbHeld=${dbHeldToday} both=${bothFlags} occupied=${jList2.filter((x) => x.isOccupied).length}`);

    // ----------------------- J-b) back-to-back holds on the same room
    const kIn = twoDaysSLT;
    const kOut = fourDaysSLT;
    s = await reserve(roomA, 'Cline Test Future', TEST_NICS[7], '0770000009',
      kIn, kOut, rateA * 2, 0);
    const kBooking = s.json && s.json.booking ? s.json.booking.id : null;
    check('J9', `a second hold for the moment the first one ends (${kIn} -> ${kOut}) -> 200`,
      s.status === 200 && !!s.json && s.json.reserved === true
        && !!s.json.booking && s.json.booking.checkedInAt === null && s.json.nights === 2,
      `status=${s.status} booking=${kBooking} nights=${s.json && s.json.nights} ${s.text.slice(0, 70)}`);

    // J10 - the turn-around day: one guest leaves, the next is already booked in.
    const rK = await roomOn(roomA, kIn);
    const waiting = rK && Array.isArray(rK.reservationsOnDay)
      ? rK.reservationsOnDay.find((x) => x.bookingId === kBooking) : null;
    check('J10', 'the hand-over day shows the departing hold AND lists the guest waiting for it',
      !!rK && rK.isReserved === true && rK.isOccupied === false && rK.isDueOut === false
        && !!rK.reserved && rK.reserved.bookingId === jBooking
        && !!waiting && /Cline Test Future/.test(waiting.guestName || '')
        && waiting.nights === 2 && String(waiting.checkInDate).startsWith(kIn)
        && waiting.paidAmount === 0,
      rK ? `isReserved=${rK.isReserved} reserved=${rK.reserved && rK.reserved.bookingId}(want ${jBooking}) waiting=${JSON.stringify(waiting)}` : `room ${roomA} missing on ${kIn}`);

    // J11 - the guest cannot be checked in before the day they reserved.
    s = await arrival(kBooking);
    const kRow = await sql(
      `SELECT status, checked_in_at, total_price::int AS total FROM bookings WHERE id=$1`,
      [kBooking]);
    check('J11', 'arrival before the reserved day -> 400 and the hold is untouched',
      s.status === 400 && /reserved from/i.test(s.text)
        && kRow[0].status === 'active' && kRow[0].checked_in_at === null
        && kRow[0].total === rateA * 2,
      `status=${s.status} folio=${kRow[0] && kRow[0].status}/${kRow[0] && kRow[0].checked_in_at} ${s.text.slice(0, 80)}`);

    // J12 - one hold also blocks the next: no queue-jumping onto the same nights.
    s = await reserve(roomA, 'Cline Test Queue', TEST_NICS[10], '0770000012',
      kIn, shiftDay(todaySLT, 3), rateA, 0);
    check('J12', 'a second hold for the same nights -> 400 naming the first hold, not acknowledgeable',
      s.status === 400 && !!s.json && !!s.json.overlap
        && s.json.overlap.bookingId === kBooking && s.json.overlap.canAcknowledge === false,
      `status=${s.status} overlap=${JSON.stringify(s.json && s.json.overlap)} ${s.text.slice(0, 80)}`);

    // J13 - a hold only blocks its own nights: after both holds the room sells again.
    const kAvail = await api('GET',
      `/api/book/availability?checkIn=${shiftDay(todaySLT, 5)}&checkOut=${shiftDay(todaySLT, 6)}`);
    const kAvailNums = Array.isArray(kAvail.json) ? kAvail.json.map((x) => x.number) : [];
    check('J13', 'the public engine offers the room again for nights beyond the holds',
      kAvailNums.includes(roomA), `available=[${kAvailNums.join(',')}]`);

    // J14 - a guest who was expected YESTERDAY and never turned up. The night is
    //       still sold, so the hold stands - but nobody is in the room.
    s = await reserve(roomB, 'Cline Test NoShow', TEST_NICS[11], '0770000013',
      yesterdaySLT, tomorrowSLT, rateB * 2, 0);
    const nBooking = s.json && s.json.booking ? s.json.booking.id : null;
    check('J14', 'a hold can also be taken for a day that has already begun (the guest is late)',
      s.status === 200 && !!s.json && s.json.reserved === true && !!nBooking,
      `status=${s.status} booking=${nBooking} ${s.text.slice(0, 70)}`);

    // J15 - the no-show cannot be "booked anyway": a guest who never arrived is
    //       not in the room, so there is nothing to cut short. `checkedInAt` is
    //       what proves a real arrival - a late guest is not an incumbent.
    s = await reserve(roomB, 'Cline Test Overrider', TEST_NICS[12], '0770000014',
      todaySLT, tomorrowSLT, rateB, 0, { incumbentBookingId: nBooking });
    const nRow = await sql(
      `SELECT status, checked_in_at, total_price::int AS total, check_out_date::text AS co
       FROM bookings WHERE id=$1`, [nBooking]);
    check('J15', 'a late guest who never arrived: inHouse/canAcknowledge false, folio NOT re-priced',
      s.status === 400 && !!s.json && !!s.json.overlap
        && s.json.overlap.inHouse === false && s.json.overlap.canAcknowledge === false
        && nRow[0].status === 'active' && nRow[0].checked_in_at === null
        && nRow[0].total === rateB * 2
        && new RegExp(`^${tomorrowSLT} (11:00|05:30)`).test(nRow[0].co || ''),
      `status=${s.status} overlap=${JSON.stringify(s.json && s.json.overlap)} folio=${nRow[0] && nRow[0].status}/${nRow[0] && nRow[0].total} co=${nRow[0] && nRow[0].co}`);

    // J16 - there is no cancel endpoint yet, so the harness removes its own
    //       no-show the way a cancellation would (rows + re-derived cache).
    await sql(`DELETE FROM transactions WHERE booking_id=$1`, [nBooking]);
    await sql(`DELETE FROM bookings WHERE id=$1`, [nBooking]);
    await pool.query(RECONCILE_ROOMS);
    const rFree = await roomOn(roomB, todaySLT);
    check('J16', 'once the no-show is cancelled the room is free today again (no ghost hold)',
      !!rFree && rFree.isOccupied === false && rFree.isReserved !== true
        && (rFree.reservationsOnDay || []).length === 0,
      rFree ? `isReserved=${rFree.isReserved} isOccupied=${rFree.isOccupied} onDay=${(rFree.reservationsOnDay || []).length}` : `room ${roomB} missing`);

    // ---------------- J-c) the only way a hold may be overruled: "book anyway"
    // A walk-in guest who checked in YESTERDAY is genuinely in the room tonight.
    const lIn = yesterdaySLT;
    const lOut = shiftDay(todaySLT, 3);
    const lTotal = rateB * 4;
    s = await checkIn(roomB, 'Cline Test InHouse', TEST_NICS[8], '0770000010',
      lIn, lOut, lTotal, lTotal, 'Cash');
    const lBooking = s.json && s.json.booking ? s.json.booking.id : null;
    check('J17', 'the guest already in the room: checked in yesterday for 4 nights, paid in full',
      s.status === 200 && !!s.json && s.json.reserved === false
        && !!s.json.booking && s.json.booking.checkedInAt !== null && s.json.nights === 4
        && s.json.totalAmount === lTotal && s.json.paidAmount === lTotal,
      `status=${s.status} booking=${lBooking} nights=${s.json && s.json.nights} checkedInAt=${s.json && s.json.booking && s.json.booking.checkedInAt} ${s.text.slice(0, 60)}`);

    // J18 - the card belongs to the guest who is actually in the room.
    const rL = await roomOn(roomB, todaySLT);
    check('J18', 'the card reads Occupied (not Reserved, not Due Out) for the in-house guest',
      !!rL && rL.isOccupied === true && rL.isReserved !== true && rL.isDueOut !== true
        && rL.bookingId === lBooking && /Cline Test InHouse/.test(rL.guestName || ''),
      rL ? `isOccupied=${rL.isOccupied} isReserved=${rL.isReserved} isDueOut=${rL.isDueOut} bookingId=${rL.bookingId} guest=${rL.guestName}` : `room ${roomB} missing`);

    // J18b - the arrival is what lights up the display cache: this guest checked in
    //        yesterday, so their stay covers this very moment and rooms.* must show
    //        them (it was vacant after the no-show was cancelled in J16).
    const lCache = (await sql(
      `SELECT is_occupied, guest_name, check_out_time::text AS cot FROM rooms WHERE number=$1`,
      [roomB]))[0];
    check('J18b', 'the arrival reconciled the display cache: occupied by the in-house guest',
      lCache.is_occupied === true && /Cline Test InHouse/.test(lCache.guest_name || ''),
      `is_occupied=${lCache.is_occupied} guest=${lCache.guest_name} checkOut=${lCache.cot}`);

    // J19 - a stay that does not begin today can never override the room, even if
    //       the desk ticks the box: the incumbent is not leaving today.
    s = await reserve(roomB, 'Cline Test NextWeek', TEST_NICS[10], '0770000012',
      tomorrowSLT, lOut, rateB * 2, 0, { incumbentBookingId: lBooking });
    check('J19', 'a future arrival can never override the room: inHouse but canAcknowledge false',
      s.status === 400 && !!s.json && !!s.json.overlap
        && s.json.overlap.bookingId === lBooking && s.json.overlap.inHouse === true
        && s.json.overlap.canAcknowledge === false,
      `status=${s.status} overlap=${JSON.stringify(s.json && s.json.overlap)} ${s.text.slice(0, 80)}`);

    // J20 - tonight's guest is refused while somebody is still in the room, but the
    //       desk is told it can be overruled once that guest confirms they leave.
    s = await reserve(roomB, 'Cline Test Arriving', TEST_NICS[9], '0770000011',
      todaySLT, tomorrowSLT, rateB, rateB);
    check('J20', 'an arrival today against an in-house guest -> 400 flagged canAcknowledge',
      s.status === 400 && !!s.json && !!s.json.overlap
        && s.json.overlap.bookingId === lBooking && s.json.overlap.inHouse === true
        && s.json.overlap.canAcknowledge === true,
      `status=${s.status} overlap=${JSON.stringify(s.json && s.json.overlap)} ${s.text.slice(0, 80)}`);

    // J21 - confirmed: the incumbent's stay is cut to today's 11:00 slot, re-priced
    //       for the night used, the over-payment refunded, and the room reserved
    //       for the new guest - who still has to arrive to occupy it.
    s = await reserve(roomB, 'Cline Test Arriving', TEST_NICS[9], '0770000011',
      todaySLT, tomorrowSLT, rateB, rateB, { incumbentBookingId: lBooking });
    const mBooking = s.json && s.json.booking ? s.json.booking.id : null;
    const cuts = s.json && s.json.overlapAcknowledged ? s.json.overlapAcknowledged : null;
    check('J21', 'confirmed turnaround: folio cut to tonight, re-priced, refunded, room now Reserved',
      s.status === 200 && !!s.json && s.json.reserved === true && !!mBooking
        && !!cuts && cuts.bookingId === lBooking && cuts.nights === 1 && cuts.bookedNights === 4
        && cuts.previousTotal === lTotal && cuts.totalAmount === rateB
        && cuts.paidAmount === lTotal && cuts.refunded === lTotal - rateB
        && cuts.outstandingBalance === 0
        && s.json.booking.checkedInAt === null && s.json.nights === 1 && s.json.paidAmount === rateB,
      `status=${s.status} booking=${mBooking} cuts=${JSON.stringify(cuts)} ${s.text.slice(0, 60)}`);

    // J22 - what the shortened folio looks like in the database and the ledger:
    //       still ACTIVE (the desk still has to collect and close it), re-priced,
    //       and the refund recorded so the ledger still sums to the folio.
    const lRow = await sql(
      `SELECT status, total_price::int AS total, check_out_date::text AS co
       FROM bookings WHERE id=$1`, [lBooking]);
    const lLedger = await sql(
      `SELECT amount::int AS amount, payment_type AS type FROM transactions
       WHERE booking_id=$1 ORDER BY id`, [lBooking]);
    const lNet = lLedger.reduce((sum, row) => sum + Number(row.amount), 0);
    check('J22', 'the shortened folio: active, cut to today 11:00, re-priced, refund in the ledger',
      lRow[0].status === 'active' && lRow[0].total === rateB
        && new RegExp(`^${todaySLT} (11:00|05:30)`).test(lRow[0].co || '')
        && lNet === rateB
        && lLedger.some((row) => row.type === 'refund' && Number(row.amount) === -3 * rateB),
      `folio=${lRow[0] && lRow[0].status}/${lRow[0] && lRow[0].total}/${lRow[0] && lRow[0].co} ledgerNet=${lNet} ledger=${JSON.stringify(lLedger)}`);

    // J23 - the day's card still belongs to the departing guest, with tonight's
    //       arrival listed underneath: two guests, one room, in the right order.
    const jGrid3 = await api('GET', `/api/rooms?date=${todaySLT}`);
    const jB = (Array.isArray(jGrid3.json) ? jGrid3.json : []).find((x) => x.number === roomB);
    const waitingB = jB && Array.isArray(jB.reservationsOnDay)
      ? jB.reservationsOnDay.find((x) => x.bookingId === mBooking) : null;
    check('J23', 'the card shows the departing guest as Due Out and lists tonight\'s arrival under it',
      !!jB && jB.isOccupied === true && jB.isReserved !== true && jB.isDueOut === true
        && jB.bookingId === lBooking
        && !!waitingB && /Cline Test Arriving/.test(waitingB.guestName || '')
        && waitingB.nights === 1 && waitingB.paidAmount === rateB,
      jB ? `isOccupied=${jB.isOccupied} isDueOut=${jB.isDueOut} isReserved=${jB.isReserved} bookingId=${jB.bookingId} waiting=${JSON.stringify(waitingB)}` : `room ${roomB} missing`);

    // J24 - the arriving guest cannot be checked in while the room is still taken.
    s = await arrival(mBooking);
    const mRow = await sql(`SELECT status, checked_in_at FROM bookings WHERE id=$1`, [mBooking]);
    check('J24', 'arriving while the previous guest is still there -> 409 and the hold is untouched',
      s.status === 409 && mRow[0].status === 'active' && mRow[0].checked_in_at === null,
      `status=${s.status} folio=${mRow[0] && mRow[0].status}/${mRow[0] && mRow[0].checked_in_at} ${s.text.slice(0, 80)}`);

    // J25 - the incumbent leaves: the folio closes at the re-priced total with
    //       nothing outstanding (the refund was already paid out in step 2b).
    s = await api('POST', '/api/rooms/checkout', {
      roomNumber: roomB, bookingId: lBooking, date: todaySLT, finalPayment: 0,
    });
    const lAfter = await sql(
      `SELECT status, total_price::int AS total FROM bookings WHERE id=$1`, [lBooking]);
    check('J25', 'the incumbent checks out: folio completed and settled, no balance invented',
      s.status === 200 && !!s.json && s.json.settled === true && s.json.nights === 1
        && s.json.totalAmount === rateB && s.json.refundDue === 0
        && lAfter[0].status === 'completed' && lAfter[0].total === rateB,
      `status=${s.status} settled=${s.json && s.json.settled} nights=${s.json && s.json.nights} refund=${s.json && s.json.refundDue} folio=${lAfter[0] && lAfter[0].status} ${s.text.slice(0, 80)}`);

    // J26 - the room is empty again, so the hold takes over the card - and the
    //       display cache must read vacant, not occupied.
    const rAfter = await roomOn(roomB, todaySLT);
    const rCache = (await sql(`SELECT is_occupied, guest_name FROM rooms WHERE number=$1`,
      [roomB]))[0];
    check('J26', 'with the room empty it flips to "Reserved" for tonight\'s guest, cache vacant',
      !!rAfter && rAfter.isReserved === true && rAfter.isOccupied === false
        && !!rAfter.reserved && rAfter.reserved.bookingId === mBooking
        && (rAfter.reservationsOnDay || []).length === 0
        && rCache.is_occupied === false && rCache.guest_name === null,
      rAfter ? `isReserved=${rAfter.isReserved} isOccupied=${rAfter.isOccupied} reserved=${rAfter.reserved && rAfter.reserved.bookingId}(want ${mBooking}) cache=${JSON.stringify(rCache)}` : `room ${roomB} missing`);

    // J27 - the held guest finally arrives. The day's card is authoritative (it
    //       covers the whole Sri Lankan day), while the display cache only counts a
    //       guest once their booked window covers THIS moment - a 2 PM arrival does
    //       not light it up at 3 AM. Expectation therefore mirrors lib/roomState.ts.
    s = await arrival(mBooking);
    const rM = await roomOn(roomB, todaySLT);
    const mCache = (await sql(
      `SELECT r.is_occupied, r.guest_name,
              (SELECT b.check_in_date FROM bookings b WHERE b.id=$1) AS ci
       FROM rooms r WHERE r.number=$2`, [mBooking, roomB]))[0];
    const mSlotStarted = new Date(mCache.ci).getTime() <= Date.now();
    check('J27', 'the held guest arrives: the room becomes Occupied by that guest, hold cleared',
      s.status === 200 && !!s.json && !!s.json.checkedInAt
        && !!rM && rM.isOccupied === true && rM.isReserved !== true
        && /Cline Test Arriving/.test(rM.guestName || '')
        && (rM.reservationsOnDay || []).length === 0
        && mCache.is_occupied === mSlotStarted
        && (mSlotStarted
          ? /Cline Test Arriving/.test(mCache.guest_name || '')
          : mCache.guest_name === null),
      `status=${s.status} isOccupied=${rM && rM.isOccupied} isReserved=${rM && rM.isReserved} guest=${rM && rM.guestName} slotStarted=${mSlotStarted} cache=${JSON.stringify(mCache)}`);

    // J28 - an arrival is stamped once, never twice.
    s = await arrival(mBooking);
    check('J28', 'a second arrival for the same booking -> 400 (already checked in)',
      s.status === 400 && /already checked in/i.test(s.text), `status=${s.status} ${s.text.slice(0, 80)}`);

    // J29 - room A: the hold's own guest arrives, and the NEXT hold is untouched.
    //       Same cache rule as J27 (the card leads, the cache follows this instant).
    s = await arrival(jBooking);
    const rH = await roomOn(roomA, todaySLT);
    const hCache = (await sql(
      `SELECT r.is_occupied, r.guest_name,
              (SELECT b.check_in_date FROM bookings b WHERE b.id=$1) AS ci
       FROM rooms r WHERE r.number=$2`, [jBooking, roomA]))[0];
    const hSlotStarted = new Date(hCache.ci).getTime() <= Date.now();
    const kStill = await sql(`SELECT checked_in_at FROM bookings WHERE id=$1`, [kBooking]);
    check('J29', 'the held room is handed over on arrival, and the next hold is left alone',
      s.status === 200 && !!s.json && !!s.json.checkedInAt
        && !!rH && rH.isOccupied === true && rH.isReserved !== true
        && /Cline Test Reserved/.test(rH.guestName || '')
        && (rH.reservationsOnDay || []).length === 0
        && hCache.is_occupied === hSlotStarted
        && (hSlotStarted
          ? /Cline Test Reserved/.test(hCache.guest_name || '')
          : hCache.guest_name === null)
        && kStill[0].checked_in_at === null,
      `status=${s.status} isOccupied=${rH && rH.isOccupied} isReserved=${rH && rH.isReserved} guest=${rH && rH.guestName} slotStarted=${hSlotStarted} cache=${JSON.stringify(hCache)} nextHold=${kStill[0] && kStill[0].checked_in_at}`);
  }

  const f = results.filter((r) => !r.ok);
  const sk = results.filter((r) => r.skipped);
  console.log(`\n=== SUMMARY: ${results.length - f.length - sk.length}/${results.length - sk.length} passed, ${f.length} failed, ${sk.length} skipped ===`);
  f.forEach((r) => console.log(`  FAIL ${r.id}: ${r.desc}  [${r.detail}]`));
  sk.forEach((r) => console.log(`  SKIP ${r.id}: ${r.desc}  [${r.detail}]`));

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
