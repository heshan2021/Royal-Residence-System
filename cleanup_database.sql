-- Cleanup script for Neon PostgreSQL database
-- Deletes all test data from all tables in correct order

-- Disable foreign key checks temporarily (PostgreSQL doesn't have this, so we use CASCADE)
-- Note: In PostgreSQL, we need to delete in reverse order of dependencies

-- 1. First, delete all transactions (depends on bookings)
DELETE FROM transactions;

-- 2. Delete all bookings (depends on guests and rooms)
DELETE FROM bookings;

-- 3. Delete all guests
DELETE FROM guests;

-- 4. Reset rooms to default state (clear guest info, mark as unoccupied)
UPDATE rooms SET 
  is_occupied = false,
  guest_name = NULL,
  phone_number = NULL,
  nic_number = NULL,
  check_out_time = NULL,
  updated_at = CURRENT_TIMESTAMP;

-- 5. Optional: Reset room prices to default if needed
-- UPDATE rooms SET price = NULL WHERE number IN ('301', '302', '303', '201', '202', '203', '101');

-- 6. Optional: Re-insert sample guest data (from database_setup.sql)
INSERT INTO guests (name, phone_number, nic_number) VALUES
('John Silva', '0771234567', '199012345678'),
('Kumari Perera', '0712345678', '198576543210'),
('Ranjith Fernando', '0761122334', '197834567890')
ON CONFLICT (nic_number) DO NOTHING;

-- 7. Optional: Reset room amenities to default
UPDATE rooms SET 
  amenities = '[]'::jsonb,
  updated_at = CURRENT_TIMESTAMP;

-- 8. Verify cleanup
SELECT 'Transactions count:' as table_name, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'Bookings count:', COUNT(*) FROM bookings
UNION ALL
SELECT 'Guests count:', COUNT(*) FROM guests
UNION ALL
SELECT 'Occupied rooms:', COUNT(*) FROM rooms WHERE is_occupied = true;