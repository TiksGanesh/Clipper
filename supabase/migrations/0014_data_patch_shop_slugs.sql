-- ========================================
-- DATA PATCH: Set default slugs for existing shops
-- ========================================
-- Run this command after the migration to populate existing shop rows
-- Make sure to replace 'YOUR_SHOP_ID' with your actual shop ID

-- For a single shop (if you know the exact shop_id):
UPDATE shops 
SET slug = 'main-shop'
WHERE id = 'YOUR_SHOP_ID' AND slug IS NULL;

-- OR, if you want to auto-generate slugs for all shops without one:
UPDATE shops
SET slug = 'shop-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL OR slug = uuid_generate_v4()::text;

-- Verify the update:
SELECT id, owner_id, name, slug, brand_color FROM shops;
