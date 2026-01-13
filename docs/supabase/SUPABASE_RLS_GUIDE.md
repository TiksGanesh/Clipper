# Supabase Row Level Security (RLS) - Comprehensive Guide

## Executive Summary

This document explains the RLS security model for Clipper's Supabase database. RLS ensures that users can only access data they own or are authorized to see.

---

## Table of Contents

1. [RLS Overview](#rls-overview)
2. [Table-by-Table Security Model](#table-by-table-security-model)
3. [View Security with security_invoker](#view-security-with-security_invoker)
4. [Service Role & Backend Access](#service-role--backend-access)
5. [Access Control Matrix](#access-control-matrix)
6. [Testing & Verification](#testing--verification)

---

## RLS Overview

### What is Row Level Security?

Row Level Security (RLS) is a PostgreSQL feature that restricts which rows a user can access. Each policy defines:
- **Who**: Which user role (authenticated, anon, service_role, etc.)
- **What**: Which operation (SELECT, INSERT, UPDATE, DELETE)
- **Which rows**: Using a boolean expression (e.g., `owner_id = auth.uid()`)

### Why RLS?

- **Multi-tenant safety**: Shops can only see their own data
- **Defense in depth**: If frontend validation fails, database still protects data
- **Prevents privilege escalation**: Service role cannot be fooled by frontend logic
- **Compliance**: Enforces data privacy at the database layer

---

## Table-by-Table Security Model

### 1. PAYMENTS Table (Critical)

**Status**: RLS **ENABLED**

**Use Case**: Tracks payment records for bookings via Razorpay

#### Policies:

| Policy | Role | Operation | Condition | Purpose |
|--------|------|-----------|-----------|---------|
| `shop_owners_read_own_payments` | authenticated | SELECT | User's shop owns the booking | Owners see their payments |
| `service_role_manage_payments` | service_role | ALL | Always true | Backend creates/updates payments |

#### Access Logic:

```sql
-- A shop owner can read ONLY payments linked to their shop's bookings
SELECT * FROM payments 
WHERE EXISTS (
  SELECT 1 FROM bookings b
  JOIN shops s ON s.id = b.shop_id
  WHERE b.id = payments.booking_id
  AND s.owner_id = auth.uid()  -- Current user owns the shop
  AND s.deleted_at IS NULL
)
```

#### Real-World Example:

- **Alice** owns Shop A
- **Bob** owns Shop B
- **Booking 123** is in Shop A
- **Payment P1** is linked to Booking 123

When Alice queries `SELECT * FROM payments`, she sees **P1** ✓  
When Bob queries `SELECT * FROM payments`, he sees **nothing** ✓ (RLS blocks P1)

#### Implementation Notes:

- Service role (backend via API routes) **bypasses RLS entirely**
- This allows payment creation during checkout without issues
- Payments without a booking_id would be inaccessible to all except service_role

---

### 2. SHOP_CLOSURES Table (Operational)

**Status**: RLS **ENABLED**

**Use Case**: Marks date ranges when a shop is temporarily closed

#### Policies:

| Policy | Role | Operation | Condition | Purpose |
|--------|------|-----------|-----------|---------|
| `public_read_shop_closures` | public, authenticated, anon | SELECT | deleted_at IS NULL | Anyone can check if shop is closed |
| `service_role_insert_shop_closures` | service_role | INSERT | Always true | Backend creates closures |
| `service_role_update_shop_closures` | service_role | UPDATE | Always true | Backend updates closures |
| `service_role_delete_shop_closures` | service_role | DELETE | Always true | Backend deletes closures |

#### Access Logic:

```sql
-- Anyone can read active (non-deleted) shop closures
SELECT * FROM shop_closures 
WHERE deleted_at IS NULL
```

#### Real-World Example:

- **Public user** booking on website queries shop closures to exclude closed dates ✓
- **Shop owner** (authenticated) also sees the same closures ✓
- **Admin** creating a closure via backend uses service_role, can write ✓

#### Why Public Read?

Closing dates must be visible to **anyone** using the public booking page, not just authenticated users.  
Authenticated shop owners can see their own closures through the admin dashboard (via service role API calls).

#### Write Restriction:

Only the **service role** (backend, after admin authentication) can create/update/delete closures.  
This prevents accidental or malicious closure creation by app users.

---

### 3. BARBER_LEAVES Table (Operational)

**Status**: RLS **ENABLED**

**Use Case**: Marks dates when a barber is unavailable (emergency, sickness, etc.)

#### Policies:

| Policy | Role | Operation | Condition | Purpose |
|--------|------|-----------|-----------|---------|
| `public_read_barber_leaves` | public, authenticated, anon | SELECT | Always true | Anyone can check barber availability |
| `service_role_insert_barber_leaves` | service_role | INSERT | Always true | Backend creates leave records |
| `service_role_update_barber_leaves` | service_role | UPDATE | Always true | Backend updates leave records |
| `service_role_delete_barber_leaves` | service_role | DELETE | Always true | Backend deletes leave records |

#### Access Logic:

```sql
-- Anyone can read all barber leave records
SELECT * FROM barber_leaves
```

#### Real-World Example:

- **Public user** booking slots avoids barbers on leave ✓
- **Shop owner** sees leave calendar in dashboard (via admin API) ✓
- **Backend** creates leave when admin submits form ✓

#### Why No Deletion Through Delete?

Leaves are soft-deleted via `deleted_at` column logic (if implemented).  
Service role has DELETE permission for cleanup only.

---

### 4. Other Tables with RLS Enabled

These tables already have comprehensive RLS:

| Table | RLS Status | Key Policy |
|-------|-----------|-----------|
| shops | ✓ ENABLED | Owners read/write own shop; admins read all |
| barbers | ✓ ENABLED | Owners manage barbers in their shops |
| services | ✓ ENABLED | Owners manage services in their shops |
| bookings | ✓ ENABLED | Owners read own bookings; customers create bookings |
| subscriptions | ✓ ENABLED | Owners read own; service_role manages all |
| working_hours | ✓ ENABLED | Owners manage hours for their shops |
| booking_services | ✓ ENABLED | Owners read via bookings; service_role manages |
| admin_users | ✓ ENABLED | Admins read self; service_role manages |

---

## View Security with security_invoker

### Problem: Views Don't Inherit RLS by Default

When you create a view without `security_invoker = true`:

```sql
CREATE VIEW active_bookings AS 
SELECT * FROM bookings WHERE deleted_at IS NULL;
```

**Issue**: The view has its own RLS rules, not the underlying table's rules.

### Solution: Use security_invoker = true

```sql
CREATE VIEW active_bookings WITH (security_invoker = true) AS 
SELECT * FROM bookings WHERE deleted_at IS NULL;
```

**Effect**: The view executes **with the caller's permissions**, not the view owner's.

### How It Works:

#### Without security_invoker:

```
User (shop_owner)
    ↓
Query: SELECT * FROM active_bookings
    ↓
View Definition: SELECT * FROM bookings WHERE deleted_at IS NULL
    ↓
Execution as: view_owner (likely superuser/postgres)
    ↓
Result: ALL bookings (RLS bypassed!) ❌ SECURITY HOLE
```

#### With security_invoker = true:

```
User (shop_owner, auth.uid() = 'alice-123')
    ↓
Query: SELECT * FROM active_bookings
    ↓
View Definition: SELECT * FROM bookings WHERE deleted_at IS NULL
    ↓
Execution as: alice-123 (caller)
    ↓
RLS Policy Applied: WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = 'alice-123')
    ↓
Result: Only alice's bookings ✓ SECURE
```

### Views in Clipper:

All active* views use `security_invoker = true`:

```sql
CREATE VIEW active_shops WITH (security_invoker = true) AS 
    SELECT * FROM shops WHERE deleted_at IS NULL;

CREATE VIEW active_barbers WITH (security_invoker = true) AS 
    SELECT * FROM barbers WHERE deleted_at IS NULL;

CREATE VIEW active_services WITH (security_invoker = true) AS 
    SELECT * FROM services WHERE deleted_at IS NULL;

CREATE VIEW active_bookings WITH (security_invoker = true) AS 
    SELECT * FROM bookings WHERE deleted_at IS NULL;
```

### Performance Note:

Using `security_invoker = true` adds minimal overhead and is the **correct** practice for multi-tenant applications.

---

## Service Role & Backend Access

### What is Service Role?

The service role is a **special Supabase role** that bypasses all RLS policies.

**Used for**:
- Backend API routes (Node.js server code)
- Scheduled functions
- Webhook handlers (Razorpay)
- Internal operations

**Never for**:
- Client-side queries
- Public endpoints (must validate auth first)

### Service Role Access in Clipper:

In your `lib/supabase.ts`, you likely have:

```typescript
// For backend operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Secret key, backend only
);
```

This key:
- **Can** insert payments without owner verification
- **Can** create shop_closures without auth checks
- **Can** manage admin_users

Example usage in API route:

```typescript
// pages/api/payments/webhook.ts
const { data: payment } = await supabaseAdmin
  .from('payments')
  .insert({ razorpay_order_id, amount, booking_id })
  .single();
  // No RLS check needed—service_role bypasses policies
```

### RLS Policies for Service Role:

All write policies include:

```sql
CREATE POLICY service_role_manage_payments ON public.payments
FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

This allows service_role to do anything on the table.

---

## Access Control Matrix

### Complete Permission Matrix

| User Type | shops | barbers | services | bookings | payments | subscriptions | shop_closures | barber_leaves |
|-----------|-------|---------|----------|----------|----------|---------------|---------------|---------------|
| **Shop Owner** | Read own; Write own | Manage own | Manage own | Read own; Write own | Read own | Read own | Read (public) | Read (public) |
| **Admin User** | Read all | — | — | Read all | — | — | Read (public) | Read (public) |
| **Authenticated** (other) | None | None | None | None | None | None | Read (public) | Read (public) |
| **Anonymous (Public)** | None | None | None | Insert only | None | None | Read (public) | Read (public) |
| **Service Role** | All | All | All | All | All | All | All | All |

### Rationale:

- **Shop owners**: Full control of their own data; can't see others'
- **Admins**: Read-only oversight; can't modify shop data directly
- **Authenticated users**: Limited read access for operational purposes
- **Anonymous**: Create bookings (walk-ins) and check availability
- **Service role**: Full access for backend operations

---

## Testing & Verification

### 1. Verify RLS is Enabled

```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves', 'shops', 'bookings')
  AND schemaname = 'public'
ORDER BY tablename;
```

**Expected output**:

```
 tablename     | rowsecurity 
---------------+-------------
 barber_leaves | t
 bookings      | t
 payments      | t
 shop_closures | t
 shops         | t
```

All should show `rowsecurity = t` (true).

### 2. List All Policies

```sql
SELECT tablename, policyname, qual, WITH CHECK
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Verify policies exist for each table.

### 3. Verify Views Use security_invoker

```sql
SELECT schemaname, viewname, security_invoker
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'active_%'
ORDER BY viewname;
```

**Expected**: All `active_*` views should show `security_invoker = t`.

### 4. Test Shop Owner Access

```sql
-- As a test user, set a specific UUID
SET REQUEST.JWT.CLAIMS = '{"sub":"shop-owner-uuid"}';

-- This should return only their shop
SELECT * FROM shops;

-- This should return nothing (different owner)
SELECT * FROM bookings WHERE shop_id = 'other-shop-id';
```

### 5. Test Service Role

```sql
-- Service role can read all
SELECT COUNT(*) FROM payments;
-- Should return total count, not filtered

-- Service role can write without checks
INSERT INTO payments (booking_id, razorpay_order_id, amount)
VALUES ('booking-id', 'order-123', 10000);
-- Should succeed
```

### 6. Test Payments Policy

```sql
-- As authenticated user (alice)
SELECT * FROM payments 
WHERE EXISTS (
  SELECT 1 FROM bookings b
  JOIN shops s ON s.id = b.shop_id
  WHERE b.id = payments.booking_id
  AND s.owner_id = 'alice-uuid'
);
-- Returns only payments from alice's shops

-- As authenticated user (bob)
SELECT * FROM payments;
-- Returns nothing (bob owns different shops)
```

### 7. Test Public Access

```sql
-- As anonymous user
SELECT * FROM shop_closures;
-- Should return active closures

-- As anonymous user
SELECT * FROM barber_leaves;
-- Should return all leaves

-- As anonymous user
INSERT INTO bookings (...) VALUES (...);
-- Should succeed (public can create bookings)
```

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Cause**: RLS policy condition failed.

**Solution**:
1. Check user is authenticated (has valid auth.uid())
2. Verify user has the required relationship (e.g., owns the shop)
3. Confirm policy condition is correct

### Error: "permission denied for schema public"

**Cause**: User lacks basic schema access.

**Solution**:
1. Verify user is authenticated
2. Check Supabase Auth configuration
3. Ensure policies exist (not just RLS enabled)

### View returns empty even though data exists

**Cause**: `security_invoker = true` is respecting RLS, or view doesn't exist.

**Solution**:
1. Verify view was created with `security_invoker = true`
2. Check underlying table RLS policies
3. Test with service_role to confirm data exists

### Backend API can't insert payments

**Cause**: Not using service_role key.

**Solution**:
1. Use `SUPABASE_SERVICE_ROLE_KEY`, not `NEXT_PUBLIC_SUPABASE_URL`
2. Verify key is in backend environment variables only
3. Never expose service_role key to client

---

## Security Best Practices

### ✅ DO:

- Always use `auth.uid()` to identify the current user
- Test policies with actual user credentials
- Keep service_role key secret (backend only)
- Use views with `security_invoker = true`
- Document RLS policies for each table
- Review RLS during code review
- Test both positive (should pass) and negative (should fail) cases

### ❌ DON'T:

- Rely solely on frontend validation
- Expose service_role key to clients
- Create policies that are too permissive (`USING (true)`)
- Use raw `auth.users.email` in policies (unsafe)
- Disable RLS "for now" without a deadline
- Trust client-submitted user IDs without verification

---

## Migration History

- **0001**: Initial setup—enabled RLS on shops, barbers, services, bookings, subscriptions, working_hours
- **0005**: Added admin_users with RLS
- **0013**: ✨ **CRITICAL** — Enabled RLS on payments, shop_closures, barber_leaves; fixed view security with `security_invoker = true`

---

## Questions?

Refer to:
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- This application's database schema: [types/database.ts](../types/database.ts)
