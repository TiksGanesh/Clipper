# GitHub Copilot Instructions

You are assisting in building a production-ready SaaS MVP for a barber appointment scheduling application.

## Strict rules:
- Follow the defined V1 scope only
- No extra features
- No premature optimization
- Use clean, readable code
- Explain file structure when asked
- Ask clarifying questions ONLY if critical

Tech stack:
- Next.js (App Router, TypeScript)
- Supabase (Postgres, Auth, RLS)
- Razorpay (subscriptions + webhooks)


## Product Scope (STRICT)
This is a V1 MVP. Do NOT add features outside this scope.

### Included
- Barber appointment booking
- Max 2 barbers per shop
- Fixed-duration services
- Dynamic time slot generation
- Walk-in bookings
- Monthly subscription billing
- Trial + access control
- Admin panel (internal use)

### Explicitly Excluded
- Customer login/accounts
- Loyalty points or rewards
- Coupons or promotions
- POS or inventory
- SMS or WhatsApp
- Analytics dashboards
- Mobile apps
- AI or recommendation logic
- Multi-location shops
- Multiple pricing plans

If a feature is not listed as INCLUDED, assume it is OUT OF SCOPE.

---

## Tech Stack (DO NOT CHANGE)
- Next.js (App Router)
- TypeScript
- Supabase (PostgreSQL, Auth, RLS)
- Razorpay (subscriptions + webhooks)
- Server-side logic using API routes or server actions

Do not suggest alternative frameworks or databases.

---

## Coding Principles
- Prefer clarity over cleverness
- Keep files small and focused
- No premature optimization
- No over-abstraction
- Use explicit types
- Handle errors gracefully
- Assume multi-tenant SaaS context

---

## Database Rules
- Enforce constraints at database level
- Prevent double booking at DB level
- Max 2 barbers per shop must be enforced in backend
- Do not rely only on frontend validation

---

## Booking Rules
- One booking = one barber
- One barber = one booking at a time
- Fixed service durations only
- No overlapping slots
- Walk-ins block calendar like normal bookings

---

## Payments & Billing Rules
- All payments handled via Razorpay
- Never expose Razorpay secrets to frontend
- Always verify webhook signatures
- Subscription state controls app access
- Trial expiry must lock booking actions

---

## Security
- Use Supabase Row Level Security
- Users can only access their own shop data
- Customers can only CREATE bookings, not read them
- Admin role has explicit elevated access

---

## UI / UX Rules
- Barber setup must be completable in under 10 minutes
- Customer booking must be completable in under 60 seconds
- Avoid unnecessary UI complexity
- One primary action per screen

---

## Response Behavior
- Ask questions ONLY if a requirement is unclear or blocking
- Otherwise, make reasonable assumptions and proceed
- Explain decisions briefly when introducing non-trivial logic
- Do not generate unused code

---

## Code Generation Rules
- Generate code incrementally
- Do not scaffold features not requested
- Respect existing file structure
- Follow existing naming conventions
- Write modular, reusable components and functions
- Include necessary imports and exports
- Write type-safe code with appropriate interfaces/types
- Include comments for complex logic
- Write unit tests for critical functions
- Ensure code is ready for production deployment