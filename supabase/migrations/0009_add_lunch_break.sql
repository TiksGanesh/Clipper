-- Add lunch break support to shops table
ALTER TABLE shops 
ADD COLUMN lunch_start TIME,
ADD COLUMN lunch_end TIME;

-- Create index for queries filtering by lunch times
CREATE INDEX IF NOT EXISTS idx_shops_lunch ON shops(lunch_start, lunch_end);

-- Add comment for documentation
COMMENT ON COLUMN shops.lunch_start IS 'Start time for lunch break (e.g., 13:00)';
COMMENT ON COLUMN shops.lunch_end IS 'End time for lunch break (e.g., 14:00)';
