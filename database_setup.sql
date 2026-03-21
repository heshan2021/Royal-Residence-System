-- SQL commands to create the necessary tables for the receptionist dashboard
-- Run these in your Sequel Editor (Sequel Ace/Pro) connected to your Neon PostgreSQL database

-- Create the rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    number VARCHAR(10) NOT NULL UNIQUE,
    price NUMERIC(10,2),
    amenities JSONB DEFAULT '[]'::jsonb,
    is_occupied BOOLEAN DEFAULT FALSE,
    check_out_time TIMESTAMP,
    guest_name VARCHAR(255),
    phone_number VARCHAR(20),
    nic_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on room number for faster lookups
CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(number);

-- Create an index on is_occupied for filtering available/occupied rooms
CREATE INDEX IF NOT EXISTS idx_rooms_occupied ON rooms(is_occupied);

-- Optional: Insert some sample data (adjust as needed)
INSERT INTO rooms (number, price, amenities, is_occupied) VALUES
('301', NULL, '["Family Friend"]', TRUE),
('302', 5000, '["No Balcony"]', FALSE),
('303', 5500, '["Balcony"]', FALSE),
('201', 6000, '["Large Room", "Bathtub", "Balcony"]', FALSE),
('202', 5000, '["No Balcony"]', FALSE),
('203', 5500, '["Balcony"]', FALSE),
('101', 4500, '["No Balcony"]', FALSE)
ON CONFLICT (number) DO NOTHING;
