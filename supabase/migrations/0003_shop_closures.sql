-- ========================================
-- Migration: Add Shop Closure Support
-- ========================================
-- This migration adds support for temporary shop closures
-- when barbers need to pause bookings for a specific date range

-- ========================================
-- SHOP CLOSURES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS shop_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    closed_from DATE NOT NULL,
    closed_to DATE NOT NULL,
    reason TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (closed_to >= closed_from)
);

-- Index for active closures by shop
CREATE INDEX IF NOT EXISTS idx_shop_closures_active ON shop_closures(shop_id) 
    WHERE deleted_at IS NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_shop_closures_dates ON shop_closures(shop_id, closed_from, closed_to) 
    WHERE deleted_at IS NULL;

-- Ensure only one active closure per shop at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_closure_per_shop 
    ON shop_closures(shop_id) 
    WHERE deleted_at IS NULL;

-- ========================================
-- UPDATED_AT TRIGGER FOR SHOP_CLOSURES
-- ========================================
DROP TRIGGER IF EXISTS update_shop_closures_timestamp ON shop_closures;
CREATE TRIGGER update_shop_closures_timestamp
BEFORE UPDATE ON shop_closures
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- MIGRATION LOG (Optional, for tracking)
-- ========================================
-- Timestamp: [Migration applied date]
-- Purpose: Add temporary shop closure feature
-- Tables affected: shop_closures (new)
-- Backward compatible: Yes
