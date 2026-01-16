-- ========================================
-- REVERT: Remove Shop Branding Columns
-- ========================================
-- Date: 2025-01-15
-- Purpose: Rollback the multi-tenant shop branding migration
-- Use this only if 0014_add_shop_branding.sql needs to be undone

-- ========================================
-- 1. DROP RLS POLICIES
-- ========================================

-- Drop public read policy
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'public_read_shop_branding' 
        AND tablename = 'shops'
        AND schemaname = 'public'
    ) THEN
        DROP POLICY public_read_shop_branding ON public.shops;
    END IF;
END $$;

-- Drop shop owner read/update policy
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'shop_owner_read_update_own' 
        AND tablename = 'shops'
        AND schemaname = 'public'
    ) THEN
        DROP POLICY shop_owner_read_update_own ON public.shops;
    END IF;
END $$;

-- Drop shop owner update branding policy
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'shop_owner_update_branding' 
        AND tablename = 'shops'
        AND schemaname = 'public'
    ) THEN
        DROP POLICY shop_owner_update_branding ON public.shops;
    END IF;
END $$;

-- ========================================
-- 2. DROP INDEX
-- ========================================

DROP INDEX IF EXISTS idx_shops_slug;

-- ========================================
-- 3. DROP COLUMNS FROM SHOPS TABLE
-- ========================================

ALTER TABLE shops
DROP COLUMN IF EXISTS slug,
DROP COLUMN IF EXISTS logo_url,
DROP COLUMN IF EXISTS brand_color,
DROP COLUMN IF EXISTS tagline,
DROP COLUMN IF EXISTS splash_image_url;

-- ========================================
-- 4. VERIFICATION
-- ========================================

-- Verify the shops table structure after revert
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shops' 
ORDER BY ordinal_position;
