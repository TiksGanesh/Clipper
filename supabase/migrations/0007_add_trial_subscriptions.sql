-- Add trial subscriptions for existing shops that don't have one
-- This is a one-time migration to ensure all shops have trial subscriptions

-- Insert trial subscriptions for shops without subscriptions
INSERT INTO subscriptions (
    shop_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
)
SELECT 
    s.id as shop_id,
    'trial'::subscription_status as status,
    (NOW() + INTERVAL '180 days')::timestamptz as trial_ends_at,
    NOW()::timestamptz as current_period_start,
    (NOW() + INTERVAL '180 days')::timestamptz as current_period_end,
    NOW()::timestamptz as created_at,
    NOW()::timestamptz as updated_at
FROM shops s
LEFT JOIN subscriptions sub ON sub.shop_id = s.id AND sub.deleted_at IS NULL
WHERE s.deleted_at IS NULL 
  AND sub.id IS NULL;

-- Log the number of subscriptions created
DO $$
DECLARE
    subscription_count INT;
BEGIN
    SELECT COUNT(*) INTO subscription_count
    FROM subscriptions
    WHERE created_at >= NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Created % trial subscriptions for existing shops', subscription_count;
END $$;
