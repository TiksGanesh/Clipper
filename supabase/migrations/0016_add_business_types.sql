-- ========================================
-- ADD BUSINESS TYPES SUPPORT
-- ========================================
-- Date: 2026-01-16
-- Purpose: Support multiple business types (Barber, Salon, Clinic) with custom terminology overrides
-- Migration Steps:
--   1. Create business_type_enum
--   2. Add business_type column to shops table
--   3. Add terminology_overrides column to shops table
--   4. Update all existing shops to have business_type = 'barber'

-- ========================================
-- 1. CREATE ENUM FOR BUSINESS TYPES
-- ========================================
DO $$ BEGIN
  CREATE TYPE business_type_enum AS ENUM ('barber', 'salon', 'clinic');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- 2. ADD BUSINESS_TYPE COLUMN TO SHOPS
-- ========================================
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS business_type business_type_enum NOT NULL DEFAULT 'barber';

-- ========================================
-- 3. ADD TERMINOLOGY_OVERRIDES COLUMN TO SHOPS
-- ========================================
-- This column stores optional custom labels as JSONB
-- Example: {"staff": "Therapist", "customer": "Client"}
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS terminology_overrides JSONB DEFAULT NULL;

-- ========================================
-- 4. DATA PATCH: SET BUSINESS_TYPE FOR EXISTING SHOPS
-- ========================================
UPDATE shops
SET business_type = 'barber'
WHERE business_type IS NULL
  AND deleted_at IS NULL;

-- Add index for faster business_type lookups
CREATE INDEX IF NOT EXISTS idx_shops_business_type ON shops(business_type) WHERE deleted_at IS NULL;

-- ========================================
-- 5. UPDATE TIMESTAMP
-- ========================================
-- Update the updated_at timestamp for existing records to reflect the migration
UPDATE shops
SET updated_at = NOW()
WHERE business_type = 'barber'
  AND deleted_at IS NULL;
