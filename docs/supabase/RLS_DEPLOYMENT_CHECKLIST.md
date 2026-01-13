# RLS Security Deployment Checklist

**Date**: 2025-01-13  
**Severity**: CRITICAL  
**Status**: Ready for Deployment

---

## Pre-Deployment

- [ ] Back up production Supabase database
- [ ] Notify team of maintenance window (migrations are safe, but verification may take time)
- [ ] Review RLS guide: [docs/SUPABASE_RLS_GUIDE.md](../docs/SUPABASE_RLS_GUIDE.md)
- [ ] Test migration in staging environment first

---

## Deployment Steps

### 1. Apply Migration

Run the migration file in **Supabase SQL Editor**:

```bash
# File location: supabase/migrations/0013_enable_rls_on_critical_tables.sql
```

**In Supabase Dashboard**:
1. Go to **SQL Editor** → **New Query**
2. Copy the entire migration script
3. Click **Run**
4. Check for errors (should complete without output)

**Via Supabase CLI** (if using local development):
```bash
supabase migration up
```

---

## Post-Deployment Verification

### ✅ Verification Queries

Run these in **Supabase SQL Editor** to confirm deployment:

#### 1. Confirm RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
  AND schemaname = 'public'
ORDER BY tablename;
```

**Expected**: All three tables show `rowsecurity = t`

```
      tablename      | rowsecurity
---------------------+-------------
 barber_leaves       | t
 payments            | t
 shop_closures       | t
(3 rows)
```

#### 2. Confirm Policies Exist

```sql
SELECT 
    tablename, 
    policyname, 
    CASE 
        WHEN qual IS NOT NULL THEN 'SELECT'
        WHEN with_check IS NOT NULL THEN 'INSERT/UPDATE'
        ELSE 'DELETE'
    END as operation
FROM pg_policies
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected**: Policies for each table (6+ total)

```
 tablename     |                 policyname                  | operation
---------------+--------------------------------------------+-----------
 barber_leaves | public_read_barber_leaves                  | SELECT
 barber_leaves | service_role_delete_barber_leaves          | DELETE
 barber_leaves | service_role_insert_barber_leaves          | INSERT/UPDATE
 barber_leaves | service_role_update_barber_leaves          | INSERT/UPDATE
 payments      | service_role_manage_payments               | INSERT/UPDATE
 payments      | shop_owners_read_own_payments              | SELECT
 shop_closures | public_read_shop_closures                  | SELECT
 shop_closures | service_role_delete_shop_closures          | DELETE
 shop_closures | service_role_insert_shop_closures          | INSERT/UPDATE
 shop_closures | service_role_update_shop_closures          | INSERT/UPDATE
(10 rows)
```

#### 3. Confirm Views Use security_invoker

```sql
SELECT schemaname, viewname, security_invoker
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'active_%'
ORDER BY viewname;
```

**Expected**: All views show `security_invoker = t`

```
 schemaname | viewname        | security_invoker
------------+-----------------+------------------
 public     | active_barbers  | t
 public     | active_bookings | t
 public     | active_services | t
 public     | active_shops    | t
(4 rows)
```

---

## Testing in Staging

### Test 1: Shop Owner Can See Own Payments

**Setup**:
- Log in as shop owner (Alice)
- Create a test booking
- Create a test payment linked to booking

**Test**:
```typescript
// pages/api/test/payments-alice.ts
const { data: payments } = await supabase
  .from('payments')
  .select('*');

// Should return payments linked to Alice's shop
console.log(payments);
```

**Expected**: Alice sees her payments ✓

---

### Test 2: Shop Owner CANNOT See Other Payments

**Setup**:
- Log in as shop owner (Bob)

**Test**:
```typescript
// Test: Try to see Alice's payments (different shop)
const { data: payments } = await supabase
  .from('payments')
  .select('*');

// Should return empty
console.log(payments); // []
```

**Expected**: Bob sees nothing (RLS blocks) ✓

---

### Test 3: Backend Can Create Payments (Service Role)

**Setup**:
- Use service role key (backend only)

**Test**:
```typescript
// pages/api/payments/webhook.ts (backend)
const { data: payment } = await supabaseAdmin
  .from('payments')
  .insert({
    booking_id: 'test-booking-id',
    razorpay_order_id: 'order-123',
    amount: 10000,
    status: 'created'
  })
  .single();

// Should succeed
console.log(payment);
```

**Expected**: Payment created successfully ✓

---

### Test 4: Public Can Read Shop Closures

**Setup**:
- No authentication (anonymous)

**Test**:
```typescript
// pages/book/[shopId].tsx (public page)
const { data: closures } = await supabase
  .from('shop_closures')
  .select('*')
  .eq('shop_id', 'test-shop-id');

// Should return active closures
console.log(closures);
```

**Expected**: Closures visible for booking flow ✓

---

### Test 5: Public Can Read Barber Leaves

**Setup**:
- No authentication (anonymous)

**Test**:
```typescript
// pages/book/[shopId].tsx (public page)
const { data: leaves } = await supabase
  .from('barber_leaves')
  .select('*');

// Should return all leaves
console.log(leaves);
```

**Expected**: Leaves visible for availability calculation ✓

---

### Test 6: Booking Flow Still Works

**Setup**:
- Use public booking page
- Try to create a walk-in booking

**Test**:
```typescript
// components/booking/BookingForm.tsx
const { data: booking } = await supabase
  .from('bookings')
  .insert({
    shop_id: 'test-shop',
    barber_id: 'test-barber',
    service_id: 'test-service',
    customer_name: 'Test',
    customer_phone: '9999999999',
    start_time: '2025-01-14T10:00:00Z',
    end_time: '2025-01-14T10:30:00Z'
  })
  .single();

// Should succeed
console.log(booking);
```

**Expected**: Booking created (anon can insert) ✓

---

### Test 7: Views Work Correctly

**Setup**:
- Log in as shop owner (Alice)

**Test**:
```typescript
// Query active_bookings view (with security_invoker)
const { data: bookings } = await supabase
  .from('active_bookings')
  .select('*');

// Should return only Alice's bookings
console.log(bookings);
```

**Expected**: Only Alice's bookings returned (view respects RLS) ✓

---

## Production Deployment

### Safe to Deploy Because:

1. ✅ RLS policies are **additive**—they restrict access, don't open it
2. ✅ Service role is **unchanged**—backend continues to work
3. ✅ Existing authenticated users are **unchanged**—policies match existing behavior
4. ✅ Public access is **explicitly allowed**—no surprise blocks
5. ✅ Views use `security_invoker`—correct implementation

### Timeline:

- **Off-peak hours recommended** (lower booking volume)
- **Actual deployment**: < 1 minute (SQL execution)
- **Verification**: 5-10 minutes (run queries)
- **Monitoring**: 30 minutes (watch for errors)

### Monitoring Points:

After deployment, monitor:

1. **API Logs**: Watch for RLS errors (403/permission denied)
2. **Error Rate**: Should stay normal
3. **Booking Creation**: Public bookings should still work
4. **Admin Dashboard**: Owners should still see their data

**In Supabase Dashboard**:
- Go to **Logs** → **API** → Filter for `policy`
- Should see no RLS-related errors after successful tests

---

## Rollback Plan (If Issues Occur)

If critical issues arise, roll back with:

```sql
-- Disable RLS temporarily
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_closures DISABLE ROW LEVEL SECURITY;
ALTER TABLE barber_leaves DISABLE ROW LEVEL SECURITY;

-- Restore views to original (without security_invoker)
DROP VIEW IF EXISTS active_bookings CASCADE;
DROP VIEW IF EXISTS active_services CASCADE;
DROP VIEW IF EXISTS active_barbers CASCADE;
DROP VIEW IF EXISTS active_shops CASCADE;

CREATE VIEW active_shops AS SELECT * FROM shops WHERE deleted_at IS NULL;
CREATE VIEW active_barbers AS SELECT * FROM barbers WHERE deleted_at IS NULL;
CREATE VIEW active_services AS SELECT * FROM services WHERE deleted_at IS NULL;
CREATE VIEW active_bookings AS SELECT * FROM bookings WHERE deleted_at IS NULL;
```

**Then**: Investigate error logs and report to security team.

---

## Success Criteria

Deployment is successful when:

- ✅ All verification queries return expected results
- ✅ Shop owners can see their own data (payments, bookings, etc.)
- ✅ Shop owners CANNOT see other shops' data
- ✅ Public booking page works (can see closures/leaves)
- ✅ Backend APIs work (Razorpay webhook creates payments)
- ✅ No RLS-related errors in logs
- ✅ Error rate remains normal

---

## Post-Deployment Documentation

Update team on:

1. **Database is now secured** with RLS
2. **Code changes needed**: None (RLS is transparent to app code)
3. **Troubleshooting**: Refer to [docs/SUPABASE_RLS_GUIDE.md](../docs/SUPABASE_RLS_GUIDE.md)
4. **Questions**: Review the guide or contact security team

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Database Admin | _______ | _______ | _______ |
| Security Lead | _______ | _______ | _______ |
| Team Lead | _______ | _______ | _______ |

---

**Date Deployed**: ________________  
**Deployed By**: ________________  
**Status**: ☐ Pending | ☐ **In Progress** | ☐ Complete

