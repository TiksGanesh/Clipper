# RLS Security Policies - Complete Specification

## Summary

This document lists every RLS policy created and their exact logic.

---

## PAYMENTS TABLE: Owner-Only Access

### Policy 1: shop_owners_read_own_payments

**Type**: SELECT (Read)  
**Role**: authenticated  
**Purpose**: Allow shop owners to see payments from their own shop's bookings

**Exact Logic**:
```sql
CREATE POLICY shop_owners_read_own_payments ON public.payments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM bookings b
        JOIN shops s ON s.id = b.shop_id
        WHERE b.id = payments.booking_id
        AND s.owner_id = auth.uid()
        AND s.deleted_at IS NULL
    )
);
```

**What This Does**:
1. User wants to SELECT from payments table
2. For each payment row, check: Is there a booking linked to this payment?
3. Does that booking belong to a shop?
4. Does that shop's owner match the current user (auth.uid())?
5. Is the shop NOT deleted?
6. If YES to all → allow the row  
   If NO to any → block the row

**Example**:
- Alice owns Shop A
- Booking 123 is in Shop A
- Payment P1 is linked to Booking 123
- Alice queries payments → sees P1 ✓
- Bob owns Shop B (different)
- Bob queries payments → sees nothing ✓ (RLS blocks P1)

---

### Policy 2: service_role_manage_payments

**Type**: ALL (SELECT, INSERT, UPDATE, DELETE)  
**Role**: service_role  
**Purpose**: Allow backend to manage all payments

**Exact Logic**:
```sql
CREATE POLICY service_role_manage_payments ON public.payments
FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

**What This Does**:
1. If user has service_role → always return true
2. Allow any operation on any payment

**Why**:
- Backend (Razorpay webhook) needs to create payments
- Backend needs to update payment status
- service_role is backend-only (never exposed to clients)

**Security Note**:
- service_role key is kept in backend env variables only
- Client never has access to service_role key
- RLS bypassing is intended and safe

---

## SHOP_CLOSURES TABLE: Public Read, Service-Role Write

### Policy 1: public_read_shop_closures

**Type**: SELECT (Read)  
**Role**: public, authenticated, anon  
**Purpose**: Allow anyone to see active shop closures

**Exact Logic**:
```sql
CREATE POLICY public_read_shop_closures ON public.shop_closures
FOR SELECT TO public, authenticated, anon
USING (deleted_at IS NULL);
```

**What This Does**:
1. User wants to SELECT from shop_closures table
2. For each closure row, check: Is it NOT deleted?
3. If deleted_at IS NULL → allow the row
4. Otherwise → block the row

**Why Public Read**:
- Public booking page needs to check if shop is closed
- Customers are anonymous (no account required)
- Closure dates are not sensitive information

**Example**:
- Shop A is closed Jan 15-20
- Anyone (public or authenticated) can query: SELECT * FROM shop_closures
- Gets back: Shop A's closure dates
- Uses these dates to exclude from booking flow

---

### Policy 2: service_role_insert_shop_closures

**Type**: INSERT  
**Role**: service_role  
**Purpose**: Allow backend to create shop closures

**Exact Logic**:
```sql
CREATE POLICY service_role_insert_shop_closures ON public.shop_closures
FOR INSERT TO service_role
WITH CHECK (true);
```

**What This Does**:
1. If user has service_role → allow INSERT
2. For each row being inserted, always return true (no restrictions)

**Why Service-Role Only**:
- Prevents accidental/malicious closure creation
- Admin must authenticate via API
- Backend validates admin status before allowing insert

**Example Workflow**:
1. Admin logs into dashboard
2. Admin API verifies admin status
3. Admin submits: "Close shop Jan 15-20"
4. Backend API calls supabaseAdmin (service_role)
5. INSERT succeeds → closure created
6. Public booking page now excludes those dates

---

### Policy 3: service_role_update_shop_closures

**Type**: UPDATE  
**Role**: service_role  
**Purpose**: Allow backend to modify shop closures

**Exact Logic**:
```sql
CREATE POLICY service_role_update_shop_closures ON public.shop_closures
FOR UPDATE TO service_role
USING (true) WITH CHECK (true);
```

**What This Does**:
1. If user has service_role → allow UPDATE
2. Always return true (no restrictions on what can be updated)

---

### Policy 4: service_role_delete_shop_closures

**Type**: DELETE  
**Role**: service_role  
**Purpose**: Allow backend to remove shop closures

**Exact Logic**:
```sql
CREATE POLICY service_role_delete_shop_closures ON public.shop_closures
FOR DELETE TO service_role
USING (true);
```

**What This Does**:
1. If user has service_role → allow DELETE
2. Always return true (can delete any closure)

---

## BARBER_LEAVES TABLE: Public Read, Service-Role Write

### Policy 1: public_read_barber_leaves

**Type**: SELECT (Read)  
**Role**: public, authenticated, anon  
**Purpose**: Allow anyone to see barber leaves

**Exact Logic**:
```sql
CREATE POLICY public_read_barber_leaves ON public.barber_leaves
FOR SELECT TO public, authenticated, anon
USING (true);
```

**What This Does**:
1. User wants to SELECT from barber_leaves table
2. Always allow (USING (true) = no restrictions)

**Why Public Read**:
- Public booking page needs to check barber availability
- If barber is on leave, exclude them from available slots
- Leave dates are not sensitive

**Example**:
- Barber Rajesh has leave on Jan 14
- Public booking page queries available barbers
- Gets back that Rajesh is unavailable Jan 14
- Doesn't show him as an option

---

### Policy 2: service_role_insert_barber_leaves

**Type**: INSERT  
**Role**: service_role  
**Purpose**: Allow backend to create barber leaves

**Exact Logic**:
```sql
CREATE POLICY service_role_insert_barber_leaves ON public.barber_leaves
FOR INSERT TO service_role
WITH CHECK (true);
```

---

### Policy 3: service_role_update_barber_leaves

**Type**: UPDATE  
**Role**: service_role  
**Purpose**: Allow backend to modify barber leaves

**Exact Logic**:
```sql
CREATE POLICY service_role_update_barber_leaves ON public.barber_leaves
FOR UPDATE TO service_role
USING (true) WITH CHECK (true);
```

---

### Policy 4: service_role_delete_barber_leaves

**Type**: DELETE  
**Role**: service_role  
**Purpose**: Allow backend to remove barber leaves

**Exact Logic**:
```sql
CREATE POLICY service_role_delete_barber_leaves ON public.barber_leaves
FOR DELETE TO service_role
USING (true);
```

---

## VIEW SECURITY: security_invoker = true

### Views Recreated

All four views were recreated with `security_invoker = true`:

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

**What security_invoker = true Does**:
- Forces the view to execute WITH the caller's permissions
- Not the view owner's permissions
- This makes views respect underlying table RLS

**Before** (Without security_invoker):
- View owner = postgres (superuser)
- View executes as superuser
- RLS bypassed → all data returned ❌

**After** (With security_invoker = true):
- View owner = postgres
- View executes as caller (e.g., alice-uuid)
- RLS applied → only caller's data returned ✓

---

## Policy Comparison Table

| Policy | Table | Type | Role | Access |
|--------|-------|------|------|--------|
| `shop_owners_read_own_payments` | payments | SELECT | authenticated | Owner's payments only |
| `service_role_manage_payments` | payments | ALL | service_role | All payments (backend) |
| `public_read_shop_closures` | shop_closures | SELECT | public/anon | All active closures |
| `service_role_insert_shop_closures` | shop_closures | INSERT | service_role | Create closures |
| `service_role_update_shop_closures` | shop_closures | UPDATE | service_role | Modify closures |
| `service_role_delete_shop_closures` | shop_closures | DELETE | service_role | Delete closures |
| `public_read_barber_leaves` | barber_leaves | SELECT | public/anon | All leaves |
| `service_role_insert_barber_leaves` | barber_leaves | INSERT | service_role | Create leaves |
| `service_role_update_barber_leaves` | barber_leaves | UPDATE | service_role | Modify leaves |
| `service_role_delete_barber_leaves` | barber_leaves | DELETE | service_role | Delete leaves |

---

## How Policies Work Together

### Example: Alice Booking an Appointment

```
┌─────────────────────────────────────────────────────┐
│ STEP 1: PUBLIC BOOKING PAGE (Alice is anonymous)   │
│                                                     │
│ Query: SELECT * FROM shop_closures                  │
│ Policy Applied: public_read_shop_closures           │
│ Condition: deleted_at IS NULL                       │
│ Result: ✓ Sees closures (for date selection)       │
│                                                     │
│ Query: SELECT * FROM barber_leaves                  │
│ Policy Applied: public_read_barber_leaves           │
│ Condition: true (always)                            │
│ Result: ✓ Sees leaves (for barber selection)       │
│                                                     │
│ Action: INSERT booking                              │
│ Policy Applied: customers_insert_bookings           │
│ (from other migrations)                             │
│ Result: ✓ Booking created (walk-in allowed)        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ STEP 2: PAYMENT WEBHOOK (Backend / Service Role)   │
│                                                     │
│ Backend receives Razorpay webhook                   │
│ Using: SUPABASE_SERVICE_ROLE_KEY                    │
│ Query: INSERT payment                               │
│ Policy Applied: service_role_manage_payments        │
│ Condition: true (always)                            │
│ Result: ✓ Payment created (no RLS check)          │
│                                                     │
│ Query: UPDATE payment status to 'paid'              │
│ Policy Applied: service_role_manage_payments        │
│ Condition: true (always)                            │
│ Result: ✓ Payment updated                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ STEP 3: ALICE LOGS IN (Shop Owner)                 │
│                                                     │
│ Query: SELECT * FROM payments                       │
│ Policy Applied: shop_owners_read_own_payments       │
│ Condition: booking exists, shop is owned by Alice   │
│ Result: ✓ Sees her payments                        │
│                                                     │
│ Query: SELECT * FROM active_bookings (view)         │
│ View Uses: security_invoker = true                  │
│ Caller: alice-uuid                                  │
│ Underlying Policy: owner_read_bookings              │
│ Result: ✓ Sees her bookings (via view)             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ STEP 4: BOB (OTHER SHOP OWNER) TRIES TO CHEAT      │
│                                                     │
│ Query: SELECT * FROM payments                       │
│ Policy Applied: shop_owners_read_own_payments       │
│ Condition: booking exists AND Alice owns shop       │
│ Bob's shop owns ≠ Alice's payment's shop            │
│ Result: ✗ No results (RLS blocks all rows)         │
│                                                     │
│ Query: SELECT * FROM active_bookings (view)         │
│ View Uses: security_invoker = true                  │
│ Caller: bob-uuid                                    │
│ Underlying Policy: owner_read_bookings              │
│ Result: ✗ Only sees his bookings (not Alice's)    │
└─────────────────────────────────────────────────────┘
```

---

## SQL Commands for Testing

### Test: Can Shop Owner See Own Payments?

```sql
-- Set as Alice
SET REQUEST.JWT.CLAIMS = '{"sub":"alice-uuid"}';

-- Should return Alice's payments
SELECT * FROM payments;

-- Reset
RESET REQUEST.JWT.CLAIMS;
```

### Test: Can Shop Owner See Other's Payments?

```sql
-- Set as Bob
SET REQUEST.JWT.CLAIMS = '{"sub":"bob-uuid"}';

-- Should return EMPTY (Alice's payments blocked)
SELECT * FROM payments;

-- Reset
RESET REQUEST.JWT.CLAIMS;
```

### Test: Can Backend Create Payments?

```sql
-- Use service_role (backend)
-- This automatically bypasses RLS

INSERT INTO payments (
    booking_id, razorpay_order_id, amount, status
) VALUES (
    'booking-123', 'order-456', 10000, 'created'
);

-- Should succeed
```

### Test: Can Public See Closures?

```sql
-- No auth set (anonymous)

SELECT * FROM shop_closures;

-- Should return active closures
```

---

## Reference: All Tables with RLS in Clipper

| Table | RLS | Policies | Purpose |
|-------|-----|----------|---------|
| payments | ✓ | 2 | **NEW** - Secure payment data |
| shop_closures | ✓ | 4 | **NEW** - Control closure modifications |
| barber_leaves | ✓ | 4 | **NEW** - Control leave modifications |
| shops | ✓ | 4+ | Owner access + admin override |
| barbers | ✓ | 3+ | Owner management + admin override |
| services | ✓ | 3+ | Owner management + admin override |
| bookings | ✓ | 3+ | Owner + customer access |
| subscriptions | ✓ | 2+ | Owner + service role management |
| working_hours | ✓ | 3+ | Owner management |
| booking_services | ✓ | 2+ | Owner + service role management |
| admin_users | ✓ | 2+ | Admin self-check + management |

---

## Implementation Notes

1. **All policies use IF NOT EXISTS checks** - Safe to re-run without duplicates
2. **Service role always returns true** - This is intentional and required for backend
3. **Views use security_invoker** - Critical for RLS to work through views
4. **No breaking changes** - Existing functionality preserved

---

## When to Update Policies

Update policies when:
- ✓ User roles change (e.g., add super-admin)
- ✓ Business logic changes (e.g., different access model)
- ✓ Data structure changes (e.g., new owner_id field)

Update by:
1. DROP POLICY old_name ON table_name;
2. CREATE POLICY new_name ON table_name ...

See `docs/RLS_SQL_QUICK_REFERENCE.md` for commands.

