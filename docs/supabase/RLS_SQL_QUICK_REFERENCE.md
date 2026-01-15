# RLS Quick Reference & SQL Commands

Use this document for quick lookups and testing.

---

## Quick Command Palette

### Check RLS Status

```sql
-- See which tables have RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### List All Policies

```sql
-- Show all RLS policies in public schema
SELECT 
    tablename,
    policyname,
    roles,
    qual AS select_condition,
    with_check AS write_condition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Specific Table Policies

```sql
-- Example: payments table
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'payments' AND schemaname = 'public';
```

---

## Enable/Disable RLS

### Enable RLS on a Table

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Disable RLS (Rollback)

```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

---

## Create Policies

### Template: Owner Can Read Own Data

```sql
CREATE POLICY policy_name ON table_name
FOR SELECT TO authenticated
USING (owner_id = auth.uid());
```

### Template: Owner Can Write Own Data

```sql
CREATE POLICY policy_name ON table_name
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
```

### Template: Owner Can Update Own Data

```sql
CREATE POLICY policy_name ON table_name
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
```

### Template: Service Role Full Access

```sql
CREATE POLICY policy_name ON table_name
FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

### Template: Public Read Access

```sql
CREATE POLICY policy_name ON table_name
FOR SELECT TO public, authenticated, anon
USING (deleted_at IS NULL);
```

---

## Manage Policies

### Drop a Specific Policy

```sql
DROP POLICY policy_name ON table_name;
```

### Drop All Policies on a Table

```sql
-- Warning: This will remove all security!
DROP POLICY * ON table_name;
```

### Alter a Policy

```sql
-- Drop and recreate (no direct ALTER)
DROP POLICY policy_name ON table_name;
CREATE POLICY policy_name ON table_name
FOR SELECT TO authenticated
USING (owner_id = auth.uid());
```

---

## Test RLS (As Specific User)

### Simulate User Access

```sql
-- Set JWT claims to simulate a specific user
SET REQUEST.JWT.CLAIMS = '{"sub":"user-uuid-here","email":"user@example.com"}';

-- Query as that user
SELECT * FROM shops;

-- Clear the simulation
RESET REQUEST.JWT.CLAIMS;
```

### Example: Test as Alice

```sql
-- Set as Alice
SET REQUEST.JWT.CLAIMS = '{"sub":"11111111-1111-1111-1111-111111111111"}';

-- Should see only Alice's shop
SELECT id, name FROM shops;

-- Should see empty (if she owns no other shop)
SELECT * FROM bookings WHERE shop_id = '22222222-2222-2222-2222-222222222222';

-- Reset
RESET REQUEST.JWT.CLAIMS;
```

---

## Check Views

### List All Views

```sql
SELECT schemaname, viewname, security_invoker
FROM pg_views
WHERE schemaname = 'public';
```

### Check Specific View

```sql
-- Is active_bookings using security_invoker?
SELECT security_invoker
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'active_bookings';
```

### Recreate View with security_invoker

```sql
DROP VIEW IF EXISTS active_bookings CASCADE;

CREATE VIEW active_bookings WITH (security_invoker = true) AS
SELECT * FROM bookings WHERE deleted_at IS NULL;
```

---

## Common RLS Patterns

### Pattern 1: Multi-Tenant Ownership

**Table**: `shops`, `barbers`, `services`  
**Model**: Each resource belongs to a shop, shop belongs to owner

```sql
CREATE POLICY owner_read ON shops
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY owner_manage_barbers ON barbers
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shops
        WHERE shops.id = barbers.shop_id
        AND shops.owner_id = auth.uid()
    )
);
```

### Pattern 2: Public + Authenticated

**Table**: `bookings`  
**Model**: Anonymous can create, authenticated can read own

```sql
CREATE POLICY anon_create ON bookings
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY owner_read ON bookings
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shops
        WHERE shops.id = bookings.shop_id
        AND shops.owner_id = auth.uid()
    )
);
```

### Pattern 3: Admin Override

**Table**: Any table  
**Model**: Admins can read all, users can read own

```sql
CREATE POLICY admin_read_all ON table_name
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY user_read_own ON table_name
FOR SELECT TO authenticated
USING (owner_id = auth.uid());
```

### Pattern 4: Service Role Bypass

**Table**: Any table  
**Model**: Service role for backend, authenticated for users

```sql
CREATE POLICY service_all ON table_name
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY user_specific ON table_name
FOR SELECT TO authenticated
USING (owner_id = auth.uid());
```

---

## Debugging RLS Issues

### Error: "permission denied for schema public"

**Check**:
```sql
-- Is the user authenticated?
SELECT auth.uid();  -- Should return a UUID, not NULL

-- Do policies exist?
SELECT COUNT(*) FROM pg_policies 
WHERE tablename = 'table_name' AND schemaname = 'public';
-- Should be > 0
```

### Error: "new row violates row-level security policy"

**Check**:
```sql
-- View the specific policy
SELECT policyname, with_check
FROM pg_policies
WHERE tablename = 'table_name';

-- Test the condition manually
SELECT owner_id = auth.uid() FROM shops WHERE id = 'shop-id';
```

### Error: Views return empty

**Check**:
```sql
-- Is security_invoker set?
SELECT security_invoker FROM pg_views WHERE viewname = 'active_bookings';

-- Recreate with security_invoker = true if needed
DROP VIEW active_bookings;
CREATE VIEW active_bookings WITH (security_invoker = true) AS
SELECT * FROM bookings WHERE deleted_at IS NULL;
```

---

## Useful Queries for Monitoring

### Count Records by User

```sql
-- How many bookings per shop owner?
SELECT 
    s.owner_id,
    COUNT(b.id) as booking_count
FROM shops s
LEFT JOIN bookings b ON s.id = b.shop_id
WHERE s.deleted_at IS NULL
GROUP BY s.owner_id
ORDER BY booking_count DESC;
```

### Find Payments Without Bookings (Orphaned)

```sql
-- Payments not linked to any booking (security concern)
SELECT * FROM payments
WHERE booking_id IS NULL;
```

### Check for Active Shop Closures

```sql
-- Shops currently closed
SELECT 
    sc.shop_id,
    sc.closed_from,
    sc.closed_to,
    sc.reason
FROM shop_closures sc
WHERE sc.deleted_at IS NULL
  AND CURRENT_DATE BETWEEN sc.closed_from AND sc.closed_to;
```

### List Barbers on Leave Today

```sql
-- Which barbers are unavailable today?
SELECT 
    bl.barber_id,
    b.name,
    b.shop_id
FROM barber_leaves bl
JOIN barbers b ON b.id = bl.barber_id
WHERE bl.leave_date = CURRENT_DATE;
```

---

## Performance Considerations

### Index RLS Policy Conditions

Common index patterns for RLS conditions:

```sql
-- Index for shop ownership queries
CREATE INDEX idx_shops_owner ON shops(owner_id) WHERE deleted_at IS NULL;

-- Index for barber shop lookups
CREATE INDEX idx_barbers_shop ON barbers(shop_id) WHERE deleted_at IS NULL;

-- Index for booking shop lookups
CREATE INDEX idx_bookings_shop ON bookings(shop_id) WHERE deleted_at IS NULL;

-- Index for foreign key relationships in policies
CREATE INDEX idx_admin_users_user ON admin_users(user_id);
```

These indexes speed up RLS policy evaluation.

### View Query Plans

```sql
-- See how a view query would be executed
EXPLAIN SELECT * FROM active_bookings WHERE shop_id = 'test-id';

-- With actual plan execution
EXPLAIN ANALYZE SELECT * FROM active_bookings WHERE shop_id = 'test-id';
```

---

## Supabase-Specific Tips

### Use Supabase CLI for Migrations

```bash
# Push migrations to Supabase
supabase db push

# Reset database (dev only!)
supabase db reset

# Generate TypeScript types after schema changes
supabase gen types typescript > types/database.ts
```

### Service Role in Next.js

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// For client (user) operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// For server (backend) operations - NEVER expose to client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Backend only!
);
```

---

## Quick Sanity Checks

Run these after deployment:

```sql
-- 1. RLS is enabled
SELECT COUNT(*) as rls_count
FROM pg_tables
WHERE rowsecurity = true AND schemaname = 'public';
-- Should be >= 10

-- 2. Policies exist
SELECT COUNT(DISTINCT tablename) as tables_with_policies
FROM pg_policies WHERE schemaname = 'public';
-- Should be >= 10

-- 3. Views are secure
SELECT COUNT(*) as secure_view_count
FROM pg_views
WHERE security_invoker = true AND schemaname = 'public';
-- Should be >= 4

-- 4. No policies are overly permissive
SELECT policyname, tablename
FROM pg_policies
WHERE qual = 'true'::text OR with_check = 'true'::text
  AND schemaname = 'public'
  AND tablename NOT IN ('admin_users', 'subscription', 'payments')
-- Should return only service_role policies
```

---

## Reference

- **Supabase RLS Docs**: https://supabase.com/docs/guides/auth/row-level-security
- **PostgreSQL RLS Docs**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Clipper Database Guide**: [docs/SUPABASE_RLS_GUIDE.md](../SUPABASE_RLS_GUIDE.md)
