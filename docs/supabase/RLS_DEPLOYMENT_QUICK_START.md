# DEPLOYMENT INSTRUCTIONS - RLS Security Fix

## What You Have

I've created a complete RLS security solution for your Supabase database. Here's everything:

### Files Created/Updated

1. **Migration File** (Execute This First)
   - `supabase/migrations/0013_enable_rls_on_critical_tables.sql`
   - Contains: Enable RLS + 10 Security Policies + View fixes

2. **Documentation** (Read These)
   - `docs/RLS_IMPLEMENTATION_SUMMARY.md` - 5-min overview
   - `docs/SUPABASE_RLS_GUIDE.md` - Complete 20-min guide
   - `docs/RLS_DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment
   - `docs/RLS_SQL_QUICK_REFERENCE.md` - SQL command reference

3. **Updated**
   - `DOCUMENTATION_INDEX.md` - Now includes RLS docs

---

## What Gets Fixed

| Table | Before | After |
|-------|--------|-------|
| **payments** | ❌ No RLS, everyone sees all payments | ✅ RLS enabled, owners see only their own |
| **shop_closures** | ❌ No RLS, anyone can modify | ✅ RLS enabled, only backend can write |
| **barber_leaves** | ❌ No RLS, anyone can modify | ✅ RLS enabled, only backend can write |
| **Views** | ⚠️ Bypass RLS (security hole) | ✅ Use `security_invoker` (RLS enforced) |

---

## Quick Deployment (5 Minutes)

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query** button

### Step 2: Copy & Execute the Migration

1. Open this file: `supabase/migrations/0013_enable_rls_on_critical_tables.sql`
2. Copy **entire contents**
3. Paste into Supabase SQL Editor
4. Click **Run** button

Expected: No error messages (migration completes silently)

### Step 3: Verify Deployment (Copy-Paste These 3 Queries)

**Query 1**: Check RLS is enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
  AND schemaname = 'public'
ORDER BY tablename;
```

Expected result:
```
      tablename      | rowsecurity
---------------------+-------------
 barber_leaves       | t
 payments            | t
 shop_closures       | t
```

**Query 2**: Check policies exist
```sql
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
  AND schemaname = 'public';
```

Expected: `policy_count = 10`

**Query 3**: Check views are secure
```sql
SELECT COUNT(*) as secure_views
FROM pg_views
WHERE security_invoker = true
  AND schemaname = 'public'
  AND viewname LIKE 'active_%';
```

Expected: `secure_views = 4`

**If all three queries pass → Deployment successful! ✅**

---

## Testing (7 Test Cases)

Follow the **Staging Tests** section in:
`docs/RLS_DEPLOYMENT_CHECKLIST.md`

Quick summary:
1. ✅ Shop owner sees own payments
2. ✅ Shop owner doesn't see other's payments
3. ✅ Backend can create payments
4. ✅ Public can read shop closures
5. ✅ Public can read barber leaves
6. ✅ Booking flow still works
7. ✅ Views work correctly

---

## Before You Deploy

- [ ] Read 5-min summary: `docs/RLS_IMPLEMENTATION_SUMMARY.md`
- [ ] Backup your Supabase database (optional but recommended)
- [ ] Plan for off-peak hours (lower booking traffic)
- [ ] Have team available for quick testing

---

## After Deployment

- [ ] Run 3 verification queries (above)
- [ ] Run 7 staging tests
- [ ] Monitor logs for errors (should be none)
- [ ] Check that booking flow still works
- [ ] Check that dashboard shows correct data

**Success = All checks pass, app works normally**

---

## If Something Goes Wrong

### Rollback (Disable RLS)

If critical issues occur, run this in Supabase SQL Editor:

```sql
-- Temporary disable RLS
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_closures DISABLE ROW LEVEL SECURITY;
ALTER TABLE barber_leaves DISABLE ROW LEVEL SECURITY;

-- Restore views to original
DROP VIEW IF EXISTS active_bookings CASCADE;
DROP VIEW IF EXISTS active_services CASCADE;
DROP VIEW IF EXISTS active_barbers CASCADE;
DROP VIEW IF EXISTS active_shops CASCADE;

CREATE VIEW active_shops AS SELECT * FROM shops WHERE deleted_at IS NULL;
CREATE VIEW active_barbers AS SELECT * FROM barbers WHERE deleted_at IS NULL;
CREATE VIEW active_services AS SELECT * FROM services WHERE deleted_at IS NULL;
CREATE VIEW active_bookings AS SELECT * FROM bookings WHERE deleted_at IS NULL;
```

Then: Investigate error logs and contact security team.

---

## Key Points

✅ **No code changes needed** - RLS is transparent to your app  
✅ **No user impact** - Only enforces what should already be happening  
✅ **Backward compatible** - Doesn't break existing functionality  
✅ **Database-level security** - Protects even if frontend fails  
✅ **Service role unaffected** - Backend APIs continue to work  

---

## Documentation Structure

**For Quick Start** (5 min):
- `docs/RLS_IMPLEMENTATION_SUMMARY.md`

**For Deep Understanding** (20 min):
- `docs/SUPABASE_RLS_GUIDE.md`

**For Deployment** (Follow step-by-step):
- `docs/RLS_DEPLOYMENT_CHECKLIST.md`

**For Quick Lookup**:
- `docs/RLS_SQL_QUICK_REFERENCE.md`

---

## What Each Policy Does

### Payments Table (Sensitive - Owner Only)
- **shop_owners_read_own_payments**: Owner sees payments from their shop's bookings
- **service_role_manage_payments**: Backend can create/update all payments

### Shop Closures (Public - Service-Role Write)
- **public_read_shop_closures**: Anyone can read (needed for public booking)
- **service_role_insert/update/delete**: Only backend can modify

### Barber Leaves (Public - Service-Role Write)
- **public_read_barber_leaves**: Anyone can read (needed for public booking)
- **service_role_insert/update/delete**: Only backend can modify

### Views (Now Secure)
- All `active_*` views use `security_invoker = true`
- This enforces RLS when querying through views
- Before: Views bypassed RLS (security hole!)
- After: Views respect owner-only access

---

## Need Help?

1. **Understanding RLS?** → Read `docs/SUPABASE_RLS_GUIDE.md`
2. **Deploying?** → Follow `docs/RLS_DEPLOYMENT_CHECKLIST.md`
3. **SQL commands?** → Use `docs/RLS_SQL_QUICK_REFERENCE.md`
4. **Troubleshooting?** → See guide's troubleshooting section

---

## Summary

**Total deployment time**: ~10 minutes
- SQL execution: < 1 minute
- Verification: 5 minutes
- Testing: 5 minutes

**Risk level**: Low (RLS only restricts, doesn't expand access)

**Status**: Ready to deploy 🚀

