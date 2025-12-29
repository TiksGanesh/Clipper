# Clipper

Barber appointment scheduling SaaS application.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase (Auth, Database, RLS)
- Razorpay (Payments & Subscriptions)

## Booking Overlap Protection

- DB Constraint: Prevents double booking at the database level using a GiST exclusion constraint on a generated `tstzrange` (`time_range`). Only `confirmed` and `completed` bookings (not soft-deleted) block time.
- Range Semantics: Half-open `[start, end)` ranges allow back-to-back bookings without false conflicts.
- Concurrency Safety: Inserts/updates that would overlap for the same barber acquire index-level locks; one transaction succeeds, the other fails with SQLSTATE `23P01` (`exclusion_violation`). This removes race conditions present in trigger-based checks.
- API Behavior: The bookings API calls a transactional RPC (`book_booking`) which inserts the booking and linked services atomically. If the DB reports `23P01`, the API returns HTTP `409 Conflict` with a clear message.
- Legacy Removal: The earlier trigger-based overlap check is removed to avoid time-of-check/time-of-use races.

## Authentication

Email-based authentication is implemented using Supabase Auth.

### Setup

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key from the API settings
3. Add them to your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Routes

- `/login` - User login page
- `/signup` - New user registration
- `/dashboard` - Protected route (requires authentication)

### Protected Routes

The middleware automatically protects:
- `/dashboard/*` - Requires authentication
- `/admin/*` - Requires admin role (future)

Public routes:
- `/book/*` - Customer booking pages (no auth required)

### Email Confirmation
## First-Time Setup

After signup, complete the setup wizard:

- Step 1: `/setup/shop` — Create your shop
- Step 2: `/setup/barbers` — Add up to 2 barbers
- Step 3: `/setup/hours` — Set working hours (per day)
- Step 4: `/setup/services` — Add fixed-duration services

The dashboard enforces completion of setup and will redirect you to the next required step if anything is missing.

### Database

- `working_hours` table stores per-day hours (`open_time`, `close_time`, `is_closed`)
- Max 2 barbers per shop is enforced by a DB trigger
- Row Level Security (RLS) ensures users access only their shop data

Apply migration in [supabase/migrations/0001_initial_setup.sql](supabase/migrations/0001_initial_setup.sql) via Supabase SQL editor or CLI.

#### Migration Notes
- Extensions: The schema enables `btree_gist` for the exclusion constraint.
- Constraint: Adds `bookings_no_overlap` with predicate `WHERE deleted_at IS NULL AND status IN ('confirmed','completed')`.
- Generated Column: Adds `time_range` as `tstzrange(start_time, end_time, '[)')` (stored), used by the constraint.
- Existing Data: If your database already has bookings, validate for overlaps before enabling the constraint, or stage it as `NOT VALID` and clean conflicting rows. Once clean, run `VALIDATE CONSTRAINT`.

#### Conflict Handling in API
- On conflict (`23P01`), the API responds with `409` and message “Selected slot overlaps with another booking.”
- Other Postgres constraint errors (`23xxx`) map to `400` unless clearly server-side (`500`).

By default, Supabase requires email confirmation. You can disable this in your Supabase project settings under:
**Authentication → Email Auth → Enable email confirmations**
