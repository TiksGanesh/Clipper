# RLS Security Architecture - Visual Guide

## Security Model Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLIPPER APPLICATION LAYERS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  Public Booking  │  │  Shop Owner      │  │  Admin Panel     │ │
│  │  Page (anon)     │  │  Dashboard       │  │  (internal)      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │                     │                     │             │
│           └─────────────────────┼─────────────────────┘             │
│                                 │                                   │
│                          API Routes / Server Actions               │
│                                 │                                   │
│     ┌───────────────────────────┼───────────────────────────────┐  │
│     │                           │                               │  │
│     ▼                           ▼                               ▼  │
│  [Anon Access]           [Authenticated]                [Service Role]
│  (Public Booking)       (Shop Owners/Users)         (Backend Operations)
│     │                           │                               │  │
└─────┼───────────────────────────┼───────────────────────────────┼──┘
      │                           │                               │
      │                     ROW LEVEL SECURITY (RLS)              │
      │                           │                               │
      │ READ: closures/leaves     │ READ: own payments            │ ALL ACCESS
      │ CREATE: bookings          │ READ: own bookings            │ (Bypasses RLS)
      │                           │ READ: own subscription        │
      │                           │                               │
┌─────┼───────────────────────────┼───────────────────────────────┼──┐
│     ▼                           ▼                               ▼  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │           SUPABASE POSTGRESQL DATABASE                      │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  Tables with RLS:                                           │  │
│  │  ✓ payments (owner-only read)                              │  │
│  │  ✓ shop_closures (public read, service-role write)         │  │
│  │  ✓ barber_leaves (public read, service-role write)         │  │
│  │  ✓ shops, barbers, services, bookings, etc.                │  │
│  │                                                             │  │
│  │  Views with security_invoker = true:                        │  │
│  │  ✓ active_shops, active_barbers                             │  │
│  │  ✓ active_services, active_bookings                         │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Access Control Matrix

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    WHO CAN ACCESS WHAT?                                        │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  USER TYPE          PAYMENTS        CLOSURES/LEAVES    BOOKINGS   SHOPS      │
│  ─────────────────  ─────────────   ──────────────────  ────────   ────────  │
│                                                                                │
│  Anonymous          ✗ None          ✓ Read (public)     ✓ Create   ✗ None   │
│  (Public Booking)                      (for availability)                      │
│                                                                                │
│  Shop Owner         ✓ Own only      ✓ Read (public)     ✓ Own      ✓ Own    │
│  (Alice)            (Alice's)          (for ops)        (Alice's)  (Alice's) │
│                                                                                │
│  Shop Owner         ✗ None          ✓ Read (public)     ✗ None     ✗ None   │
│  (Bob)              (Can't see                           (Bob's     (Bob's   │
│                     Alice's)                            show up    show up  │
│                                                         to Bob,    to Bob,  │
│                                                         but he      but he   │
│                                                         sees        can      │
│                                                         only own)   access)  │
│                                                                                │
│  Admin              ✗ None          ✓ Read (public)     ✓ Read     ✓ Read   │
│  (Internal)         (Read-only      (for availability)  all        all      │
│                     via API)                                                   │
│                                                                                │
│  Service Role       ✓ All           ✓ All              ✓ All      ✓ All    │
│  (Backend)          (CREATE)        (CREATE/UPDATE)    (All)      (All)    │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Example: Alice Books an Appointment

```
STEP 1: ANONYMOUS USER (Public Booking Page)
┌─────────────────────────────────┐
│ Customer on public booking site │
│ Query: GET shop closures        │
│ Query: GET barber leaves        │
│ Query: GET available slots      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ RLS Policies Evaluate:          │
│ ✓ public_read_shop_closures     │
│ ✓ public_read_barber_leaves     │
│ ✓ bookings: customers_insert    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ ✅ ALLOWED: Data returned       │
│ ✅ CREATE booking: Success      │
└─────────────────────────────────┘

STEP 2: PAYMENT (Razorpay Webhook - Service Role)
┌─────────────────────────────────┐
│ Backend receives webhook        │
│ Using SUPABASE_SERVICE_ROLE_KEY │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ RLS Policies Evaluate:          │
│ ✓ service_role_manage_payments  │
│ (Returns TRUE - bypass all)     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ ✅ ALLOWED: Payment created     │
│ ✅ Inserted into payments table │
└─────────────────────────────────┘

STEP 3: ALICE LOGS IN (Shop Owner - Alice)
┌─────────────────────────────────┐
│ Alice views her dashboard       │
│ Query: GET my bookings          │
│ Query: GET my payments          │
│ auth.uid() = 'alice-uuid'       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ RLS Policies Evaluate:          │
│ ✓ shop_owners_read_own_bookings │
│ ✓ shop_owners_read_own_payments │
│   (owner_id = 'alice-uuid')     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ ✅ ALLOWED: Alice's data only   │
│ ✅ Returns her booking & payment│
└─────────────────────────────────┘

STEP 4: BOB TRIES TO HACK (Shop Owner - Bob)
┌─────────────────────────────────┐
│ Bob tries to see Alice's data   │
│ Query: SELECT * FROM payments   │
│ auth.uid() = 'bob-uuid'         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ RLS Policies Evaluate:          │
│ ✗ shop_owners_read_own_payments │
│   (owner_id != 'bob-uuid')      │
│   Alice's payment owned by Alice│
│   not Bob!                      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ ❌ DENIED: No results returned  │
│ ❌ RLS blocks at database level │
│ ❌ Nothing Bob can do           │
└─────────────────────────────────┘
```

---

## RLS Policy Structure

```
TABLE: payments
├─ RLS Status: ✅ ENABLED
│
├─ Policy 1: shop_owners_read_own_payments
│  ├─ Role: authenticated
│  ├─ Operation: SELECT
│  └─ Condition: Payment's booking's shop's owner = current user
│
└─ Policy 2: service_role_manage_payments
   ├─ Role: service_role
   ├─ Operation: ALL (SELECT, INSERT, UPDATE, DELETE)
   └─ Condition: Always true (bypass RLS)

TABLE: shop_closures
├─ RLS Status: ✅ ENABLED
│
├─ Policy 1: public_read_shop_closures
│  ├─ Role: public, authenticated, anon
│  ├─ Operation: SELECT
│  └─ Condition: deleted_at IS NULL
│
└─ Policies 2-4: service_role_*_shop_closures
   ├─ Role: service_role
   ├─ Operations: INSERT, UPDATE, DELETE
   └─ Condition: Always true (backend only)

TABLE: barber_leaves
├─ RLS Status: ✅ ENABLED
│
├─ Policy 1: public_read_barber_leaves
│  ├─ Role: public, authenticated, anon
│  ├─ Operation: SELECT
│  └─ Condition: Always true
│
└─ Policies 2-4: service_role_*_barber_leaves
   ├─ Role: service_role
   ├─ Operations: INSERT, UPDATE, DELETE
   └─ Condition: Always true (backend only)

VIEWS: active_shops, active_barbers, active_services, active_bookings
├─ security_invoker: ✅ TRUE
└─ Effect: Respects underlying table RLS policies
```

---

## Security Layers (Defense in Depth)

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: Frontend Validation (User-Facing)                         │
│ └─ Show/hide UI elements based on user role                         │
│    └─ BYPASS: User can modify HTML/JavaScript                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: Server-Side Authorization (API Routes)                    │
│ └─ Verify user role before database operation                       │
│    └─ BYPASS: Attacker could modify requests if auth is weak       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Database-Level RLS (Row Level Security) ✨ NEW            │
│ └─ Filter results at database level, enforced by PostgreSQL         │
│    └─ BYPASS: Impossible (enforced before SQL returns results)     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
              ✅ DATA IS PROTECTED REGARDLESS
```

---

## Before vs After: View Security

```
BEFORE: Views Bypass RLS (VULNERABILITY)
═══════════════════════════════════════

┌──────────────────────────────────────────────────────┐
│ User Query: SELECT * FROM active_bookings            │
│ (auth.uid() = 'alice-uuid')                          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ View Definition (WITHOUT security_invoker):          │
│   SELECT * FROM bookings WHERE deleted_at IS NULL   │
│                                                      │
│ Executed AS: view_owner (postgres superuser)         │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ RLS on underlying bookings table NOT applied!        │
│ View owner bypasses RLS                              │
│                                                      │
│ Result: ALL bookings returned ❌                     │
│ Expected: Only Alice's bookings                      │
└──────────────────────────────────────────────────────┘


AFTER: Views Respect RLS (SECURE)
═════════════════════════════════

┌──────────────────────────────────────────────────────┐
│ User Query: SELECT * FROM active_bookings            │
│ (auth.uid() = 'alice-uuid')                          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ View Definition (WITH security_invoker = true):      │
│   SELECT * FROM bookings WHERE deleted_at IS NULL   │
│                                                      │
│ Executed AS: alice-uuid (the caller)                 │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ RLS on underlying bookings table IS applied!         │
│ Uses caller's permissions (alice-uuid)               │
│                                                      │
│ Result: Only Alice's bookings returned ✅            │
│ Expected: Only Alice's bookings                      │
└──────────────────────────────────────────────────────┘
```

---

## Migration Impact Timeline

```
┌────────────┬──────────────────────────────────────────┐
│   Phase    │              What Happens                 │
├────────────┼──────────────────────────────────────────┤
│ BEFORE     │ ❌ RLS disabled on 3 critical tables      │
│ (Current)  │ ⚠️  Views bypass RLS (security hole)     │
│            │                                          │
│   ↓        │  [Execute Migration]                     │
│            │                                          │
│ DURING     │ ✅ RLS enabled                           │
│ (Seconds)  │ ✅ Policies created                      │
│            │ ✅ Views recreated with security_invoker│
│            │                                          │
│   ↓        │  [Verify & Test]                         │
│            │                                          │
│ AFTER      │ ✅ Data properly secured                 │
│ (Running)  │ ✅ Shop owners see only their data       │
│            │ ✅ Payments protected                    │
│            │ ✅ Public booking flow unaffected        │
│            │ ✅ Backend (service_role) unaffected    │
└────────────┴──────────────────────────────────────────┘
```

---

## Verification Checklist

```
After deploying migration, verify:

┌─ RLS Enabled?
│  └─ Query: SELECT tablename, rowsecurity FROM pg_tables 
│     WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
│     └─ Expected: All show rowsecurity = t
│
├─ Policies Created?
│  └─ Query: SELECT COUNT(*) FROM pg_policies 
│     WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
│     └─ Expected: 10 policies
│
├─ Views Secure?
│  └─ Query: SELECT security_invoker FROM pg_views 
│     WHERE viewname LIKE 'active_%'
│     └─ Expected: All show security_invoker = t
│
└─ Testing?
   ├─ Shop owner sees own bookings? ✓
   ├─ Shop owner doesn't see other bookings? ✓
   ├─ Backend can create payments? ✓
   ├─ Public can book? ✓
   └─ Dashboard still works? ✓
```

---

## Questions Answered

### Q: Can my app code stay the same?
**A**: Yes! RLS is transparent. Your queries work exactly as before—RLS just filters results.

### Q: Can shop owners bypass RLS?
**A**: No. RLS is enforced at the PostgreSQL level, before any code runs. It's unhackable from the app.

### Q: Does this affect performance?
**A**: Minimal. RLS adds a small WHERE clause (~microseconds). Indexes handle it fine.

### Q: What if I need to change a policy?
**A**: Drop and recreate it. Detailed instructions in `docs/RLS_SQL_QUICK_REFERENCE.md`

### Q: Is service_role still unrestricted?
**A**: Yes. Service role (backend) bypasses all RLS. It's used for backend API operations only.

