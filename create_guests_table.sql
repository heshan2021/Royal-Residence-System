-- Create the guests table
CREATE TABLE IF NOT EXISTS guests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    nic_number VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster searching
CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);
CREATE INDEX IF NOT EXISTS idx_guests_nic ON guests(nic_number);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone_number);

-- Insert sample guest data
INSERT INTO guests (name, phone_number, nic_number) VALUES
('John Silva', '0771234567', '199012345678'),
('Kumari Perera', '0712345678', '198576543210'),
('Ranjith Fernando', '0761122334', '197834567890')
ON CONFLICT (nic_number) DO NOTHING;

-- Verify the table was created
SELECT 'Guests table created successfully' as message;