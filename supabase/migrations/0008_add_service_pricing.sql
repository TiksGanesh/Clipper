-- Add price and advance payment configuration to services table

-- Check if columns already exist and add them if they don't
DO $$
BEGIN
    -- Add advance_amount column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'advance_amount'
    ) THEN
        ALTER TABLE services 
        ADD COLUMN advance_amount INTEGER NOT NULL DEFAULT 0 CHECK (advance_amount >= 0);
    END IF;

    -- Add requires_advance column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'requires_advance'
    ) THEN
        ALTER TABLE services 
        ADD COLUMN requires_advance BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Update existing services to have proper defaults
UPDATE services 
SET advance_amount = 0, requires_advance = false 
WHERE advance_amount IS NULL OR requires_advance IS NULL;
