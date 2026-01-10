<div align="center">

# 💈 Clipper

### Intelligent Barber Shop Scheduling Platform

*A mobile-first, AI-architected SaaS for barber appointment booking with real-time payments and concurrency handling.*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=flat&logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Documentation](#-documentation)

</div>

---

## ✨ Key Features

- **📱 Mobile-First Dashboard**: Optimized "Busy Barber" interface with intuitive Date Ribbon navigation and bottom action bar for one-handed operation
  
- **🧠 Smart Slot Generation**: Timezone-aware (IST/UTC) scheduling logic that respects shop hours, lunch breaks, barber leave, and dynamic "Today/Tomorrow" booking windows

- **🔒 Robust Concurrency Control**: Patent-ready "Soft Lock" mechanism prevents double-bookings during payment flows using database-level exclusion constraints and time-range validation

- **💳 Seamless Payment Integration**: Real-time Razorpay checkout with instant status updates (Success/Failure/Pending) and automatic booking confirmation

- **🛠️ Admin Tools**: Comprehensive shop management including multi-barber scheduling, break blocking, walk-in registrations, and daily revenue reports

- **🚀 Zero-Downtime Booking**: Half-open time ranges `[start, end)` enable back-to-back appointments without false conflicts

- **🔐 Enterprise Security**: Row-Level Security (RLS) policies ensure complete data isolation between shops with role-based access control

- **⚡ Real-Time Updates**: Instant calendar synchronization across devices with optimistic UI updates and server-side validation

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router, React Server Components, Server Actions)
- **TypeScript** (Strict mode with comprehensive type definitions)
- **Tailwind CSS** (Mobile-first responsive design)
- **Framer Motion** (Smooth animations and transitions)
- **Lucide Icons** (Consistent iconography)

### Backend
- **Supabase**
  - PostgreSQL (with btree_gist extension for exclusion constraints)
  - Row Level Security (RLS) policies
  - Real-time subscriptions
  - Authentication & Authorization
- **Server Actions** (Type-safe server mutations)
- **Zod** (Runtime validation and type inference)

### Payments
- **Razorpay** (Payment gateway with webhook verification)

### Infrastructure
- **Vercel** (Edge deployment and serverless functions)
- **GitHub Codespaces** (Cloud development environment)
- **Docker** (Dev container configuration)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Supabase CLI** (optional, for local development)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TiksGanesh/Clipper.git
   cd Clipper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add the following required keys to `.env.local`:
   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   
   # Razorpay
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
   
   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run database migrations**
   
   Apply migrations via Supabase Dashboard SQL Editor or CLI:
   ```bash
   supabase db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### First-Time Setup

After signing up, complete the guided 4-step setup wizard:

1. **Shop Details** - Enter shop name, contact, and address
2. **Barbers** - Add up to 2 barbers (names and contact info)
3. **Working Hours** - Set daily open/close times and lunch breaks
4. **Services** - Define services with fixed durations and pricing

The dashboard automatically redirects until setup is complete.

---

## 📚 Documentation

Comprehensive documentation is available in the [`/docs`](docs/) folder:

### 📖 Setup & Configuration
- [Authentication Guide](docs/setup/authentication.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Dashboard Setup Navigation](docs/setup/DASHBOARD_SETUP_NAVIGATION.md)

### 🏗️ Architecture & Database
- [Soft Lock Architecture](docs/architecture/SOFT_LOCK_ARCHITECTURE.md) - Concurrency control mechanism
- [Soft Lock Implementation](docs/architecture/SOFT_LOCK_IMPLEMENTATION.md)
- [Soft Lock Quick Reference](docs/architecture/SOFT_LOCK_QUICK_REFERENCE.md)
- [Trial & Subscription System](docs/architecture/TRIAL_SUBSCRIPTION_IMPLEMENTATION.md)
- [Design System Guidelines](docs/architecture/design-system.md)
- [Layout Guidelines](docs/architecture/layout-guidelines.md)
- [Database Schema Reference](types/database.ts)

### ✨ Feature Deep Dives
- [Booking Page Implementation](docs/features/booking-page.md)
- [Barber Leave Management](docs/features/BARBER_LEAVE_IMPLEMENTATION.md)
- [Walk-In Booking Feature](docs/features/WALKIN_FEATURE.md)
- [Calendar Views (Day/Week)](docs/features/CALENDAR_REVIEW.md)
- [Add Second Barber Flow](docs/features/ADD_SECOND_BARBER_FEATURE.md)
- [Edit Shop Feature](docs/features/EDIT_SHOP_FIX_SUMMARY.md)
- [Services Management](docs/features/SERVICES_FIX_SUMMARY.md)

### 🔌 API Reference
- [Slots API Documentation](docs/api/SLOTS_API_UPDATE.md)
- [Admin Dashboard API](docs/api/admin-dashboard.md)
- [Admin Dashboard Cleanup](docs/api/admin-dashboard-cleanup-instructions.md)
- [Admin Shop Detail Enhancement](docs/api/ADMIN_SHOP_DETAIL_ENHANCEMENT.md)

### 🧪 Testing & Maintenance
- [Soft Lock Testing Script](docs/architecture/SOFT_LOCK_TESTING.sh)
- [Soft Lock Change Summary](docs/architecture/SOFT_LOCK_CHANGE_SUMMARY.md)

---

## 🎯 Project Philosophy

**Built in < 25 days using an Agentic AI Workflow**

This project demonstrates the power of combining:
- **Human Architecture** - Strategic decisions, database schema design, and product scoping
- **AI Implementation** - Rapid feature development via prompt engineering with GitHub Copilot
- **Production-First Mindset** - Real-world constraints handled from day one (concurrency, payments, security)

Key principles followed:
- ✅ Ship MVPs fast, iterate based on real usage
- ✅ Database-level constraints > application-level validation
- ✅ Mobile-first design (80% of barbers use mobile devices)
- ✅ Clear code > clever code
- ❌ No premature optimization
- ❌ No feature creep outside V1 scope

---

## 🔒 Security Features

- **Row-Level Security (RLS)**: Multi-tenant data isolation at PostgreSQL level
- **Webhook Signature Verification**: Razorpay payment webhooks validated cryptographically
- **Server-Side Validation**: All mutations validated with Zod schemas before DB operations
- **Exclusion Constraints**: Race-condition-free double-booking prevention via database locks
- **Environment Variables**: Sensitive keys never exposed to client-side code

---

## 🤝 Contributing

This is currently a solo-developed MVP. Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) by Vercel
- Database powered by [Supabase](https://supabase.com/)
- Payments by [Razorpay](https://razorpay.com/)
- Designed with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)

---

<div align="center">

**[⬆ back to top](#-clipper)**

Made with ❤️ by [TiksGanesh](https://github.com/TiksGanesh)

</div>
