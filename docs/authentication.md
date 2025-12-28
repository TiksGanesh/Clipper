# Authentication Setup Guide

This guide explains the email-based authentication implementation using Supabase.

## Files Created

### Pages
- `app/login/page.tsx` - Login page with email/password form
- `app/signup/page.tsx` - Signup page with shop name, email, and password
- `app/dashboard/page.tsx` - Protected dashboard (example)

### API Routes
- `app/api/auth/signout/route.ts` - Sign out endpoint
- `app/auth/callback/route.ts` - Email confirmation callback handler

### Utilities
- `lib/auth.ts` - Server-side auth helpers (`requireAuth`, `getUser`, etc.)
- `middleware.ts` - Route protection and session refresh

### Configuration
- `.env.example` - Environment variable template
- Updated `types/env.d.ts` - TypeScript environment variable definitions

## Supabase Configuration

### 1. Email Settings
In your Supabase dashboard, go to **Authentication → Email Auth**:

- **Enable email confirmations**: Toggle based on your preference
  - ON: Users must confirm email before login (more secure)
  - OFF: Users can login immediately after signup (faster onboarding)

### 2. Redirect URLs
In **Authentication → URL Configuration**, add:

```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

### 3. Email Templates (Optional)
Customize email templates in **Authentication → Email Templates**:
- Confirmation email
- Password reset email
- Magic link email (if needed)

## Authentication Flow

### Signup Flow
1. User fills signup form with shop name, email, and password
2. Supabase creates user account
3. If email confirmation is enabled:
   - User receives confirmation email
   - Clicks link → redirected to `/auth/callback` → redirected to `/dashboard`
4. If email confirmation is disabled:
   - User is automatically signed in
   - Redirected to `/dashboard`

### Login Flow
1. User enters email and password
2. Supabase validates credentials
3. Session is created and stored in cookies
4. User is redirected to `/dashboard`

### Session Management
- Sessions are automatically refreshed by middleware
- Sessions persist across browser sessions (cookie-based)
- Sessions expire based on Supabase settings (default: 7 days)

## Protected Routes

### Middleware Configuration
The middleware protects these routes:

```typescript
/dashboard/*  → Requires authentication
/admin/*      → Requires admin role (future)
```

Public routes:
```typescript
/login        → Redirects to /dashboard if authenticated
/signup       → Redirects to /dashboard if authenticated
/book/*       → Public (no auth required)
/             → Public
```

### Using Auth in Server Components

```typescript
import { requireAuth, getUser } from '@/lib/auth'

// Require authentication (redirects to /login if not authenticated)
export default async function ProtectedPage() {
    const user = await requireAuth()
    // user is guaranteed to exist
}

// Optional authentication
export default async function OptionalAuthPage() {
    const user = await getUser()
    if (user) {
        // User is logged in
    } else {
        // User is not logged in
    }
}
```

### Using Auth in Client Components

```typescript
'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function ClientComponent() {
    const [user, setUser] = useState(null)
    
    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user)
        })
    }, [])
}
```

## Security Best Practices

### ✅ Implemented
- Email/password authentication only (no social login)
- Cookie-based session management (httpOnly, secure)
- Middleware refreshes sessions automatically
- Server-side auth checks for protected routes
- Password minimum length validation (8 characters)
- CSRF protection via Supabase's built-in mechanisms
- Row Level Security ready (RLS policies to be added at database level)

### ⚠️ Important Notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
- Always validate user input on the server-side
- Implement rate limiting for auth endpoints (future)
- Enable email confirmation for production
- Use HTTPS in production

## Testing Authentication

### Local Development
1. Ensure `.env.local` has valid Supabase credentials
2. Start dev server: `npm run dev`
3. Navigate to `http://localhost:3000/signup`
4. Create an account
5. Check email for confirmation (if enabled)
6. Login at `http://localhost:3000/login`
7. Verify redirect to `/dashboard`

### Manual Test Cases
- [ ] Signup with valid email/password
- [ ] Signup with duplicate email (should show error)
- [ ] Signup with weak password (< 8 chars, should show error)
- [ ] Login with correct credentials
- [ ] Login with wrong credentials (should show error)
- [ ] Access `/dashboard` without login (should redirect to `/login`)
- [ ] Access `/login` when already logged in (should redirect to `/dashboard`)
- [ ] Sign out and verify redirect to `/login`
- [ ] Refresh page while logged in (session should persist)

## Troubleshooting

### "Invalid credentials" error on signup
- Check Supabase project is active
- Verify environment variables are correct
- Check Supabase logs in dashboard

### Email confirmation not received
- Check spam folder
- Verify email provider is not blocking Supabase emails
- Check Supabase email logs in dashboard
- Ensure redirect URLs are configured correctly

### Redirect loop or infinite redirects
- Clear browser cookies
- Check middleware configuration
- Verify Supabase URL and keys are correct

### Session not persisting
- Check browser allows cookies
- Verify middleware is running (check console logs)
- Check Supabase session expiry settings

## Next Steps

1. **Database Schema**: Create shops, barbers, services, bookings tables
2. **Row Level Security**: Implement RLS policies for multi-tenant isolation
3. **Shop Setup**: Create onboarding flow for new shops
4. **Subscription Management**: Integrate Razorpay for subscription billing
5. **Email Customization**: Customize Supabase email templates with branding
6. **Password Reset**: Add forgot password flow (uses Supabase built-in)
7. **Account Settings**: Add profile/shop settings page
8. **Logout Everywhere**: Add "logout from all devices" functionality
