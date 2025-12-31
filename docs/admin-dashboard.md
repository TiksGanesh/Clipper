# GitHub Copilot Instructions — Admin Panel (V1)

You are implementing the ADMIN PANEL for a barber appointment SaaS.

This file defines the FIXED V1 OUTLINE for admin.
Do NOT add features outside this scope.

Admin panel logic must be implemented FIRST WITH SIMPLE UI.
Enhanced UI will be added later using Tailwind and separate design instructions.

If something is not explicitly allowed here, assume it is NOT allowed.

---

## 1. ADMIN ROLE & PURPOSE

Admin is a platform operator, not a barber.

Admin responsibilities:
- Control shop access
- Support onboarding
- Handle emergencies
- Fix broken states

Admin must NOT:
- Manage daily bookings
- Edit services or schedules
- View analytics or revenue

---

## 2. FIXED ADMIN ROUTES (LOCKED)

Only these routes are allowed in V1:

/admin/login  
/admin/dashboard  
/admin/shops  
/admin/shops/create  
/admin/shops/[shopId] 
/admin/setup-user 

Do NOT add new admin routes.

---

## 3. AUTH & ACCESS RULES

- Admin is a separate role from barber
- Separate auth guard / middleware
- Admin routes must NOT be accessible to barber users
- No role switching or impersonation in V1

---

## 4. ADMIN DATA ACCESS RULES

Admin CAN:
- Read all shops
- Read barbers, services, hours (read-only)
- Read recent bookings (read-only)
- Modify shop access state
- Modify subscription dates
- Create shops

Admin CANNOT:
- Edit bookings
- Edit services
- Edit barber schedules
- Edit customer data
- Trigger notifications

---

## 5. SHOP LIFECYCLE STATES (IMPORTANT)

Each shop must have ONE clear state:

- setup_pending
- trial
- active
- suspended
- expired

Admin is allowed to:
- Transition shop between states
- Extend trial or subscription manually
- Suspend or reactivate shops

Do NOT add automation logic.

---

## 6. ADMIN ACTIONS — ALLOWED

Admin may perform ONLY these mutations:

- Create shop
- Update shop status
- Set subscription start/end date
- Extend trial
- Suspend / reactivate shop
- Disable booking in emergencies
- Reset barber emergency-leave flags

No other mutations are allowed.

---

## 7. SHOP CREATION FLOW (ADMIN)

Admin-created shops must follow this flow:

1. Admin creates shop with:
   - Shop name
   - Owner email / phone
2. Shop state = setup_pending
3. Barber logs in
4. Barber is redirected to setup flow

Admin may optionally complete setup on behalf of barber,
but this is NOT required in V1.

---

## 8. BASE LOGIC FIRST

When implementing admin features:
- Start with data models
- Implement API routes or server actions
- Add validation and access control
- Return JSON responses only
- Create Simple UI form

Enhanced UI with Tailwind will be implemented later using separate instructions.

---

## 9. ERROR HANDLING

- Errors must be human-readable
- No raw DB or stack traces
- Fail safely (no partial updates)

---

## 10. WHAT NOT TO BUILD (STRICT)

Do NOT build:
- Analytics dashboards
- Revenue reports
- Admin roles hierarchy
- Bulk operations
- Notifications
- Audit logs (V2+)

---

## 11. COPILOT RESPONSE BEHAVIOR

- Generate code incrementally
- Explain assumptions briefly
- Ask questions ONLY if a requirement is missing or conflicting
- Never invent new admin features
- Respect this document as final authority
