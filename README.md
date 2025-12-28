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

By default, Supabase requires email confirmation. You can disable this in your Supabase project settings under:
**Authentication → Email Auth → Enable email confirmations**
