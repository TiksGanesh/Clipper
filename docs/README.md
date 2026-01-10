# 📚 Clipper Documentation Index

Welcome to the Clipper documentation! This directory contains comprehensive guides covering setup, architecture, features, and API references.

## 📂 Documentation Structure

### 📖 [Setup & Configuration](setup/)
Getting started with Clipper - installation, authentication, and deployment guides.

- [Authentication Guide](setup/authentication.md) - Email-based auth with Supabase
- [Dashboard Setup Navigation](setup/DASHBOARD_SETUP_NAVIGATION.md) - First-time setup wizard

**Also see:** [Deployment Guide](../DEPLOYMENT_GUIDE.md) at project root

---

### 🏗️ [Architecture & Database](architecture/)
System design, concurrency control, and design guidelines.

**Core Concepts:**
- [Soft Lock Architecture](architecture/SOFT_LOCK_ARCHITECTURE.md) - Concurrency control mechanism
- [Soft Lock Implementation](architecture/SOFT_LOCK_IMPLEMENTATION.md) - Technical deep dive
- [Soft Lock Quick Reference](architecture/SOFT_LOCK_QUICK_REFERENCE.md) - At-a-glance guide
- [Soft Lock Testing](architecture/SOFT_LOCK_TESTING.sh) - Integration test suite

**Subscriptions & Billing:**
- [Trial & Subscription System](architecture/TRIAL_SUBSCRIPTION_IMPLEMENTATION.md) - Razorpay integration

**Design Guidelines:**
- [Design System](architecture/design-system.md) - UI/UX standards
- [Layout Guidelines](architecture/layout-guidelines.md) - Mobile-first principles

**Change Logs:**
- [Soft Lock Change Summary](architecture/SOFT_LOCK_CHANGE_SUMMARY.md)

**Also see:** [Database Schema](../types/database.ts) for TypeScript type definitions

---

### ✨ [Feature Documentation](features/)
Detailed guides for specific product features.

**Booking & Scheduling:**
- [Booking Page Implementation](features/booking-page.md) - Customer-facing booking flow
- [Walk-In Feature](features/WALKIN_FEATURE.md) - Register walk-in customers
- [Calendar Views](features/CALENDAR_REVIEW.md) - Day/Week view implementation

**Shop Management:**
- [Add Second Barber](features/ADD_SECOND_BARBER_FEATURE.md) - Multi-barber setup
- [Barber Leave Management](features/BARBER_LEAVE_IMPLEMENTATION.md) - Block barber availability
- [Edit Shop Feature](features/EDIT_SHOP_FIX_SUMMARY.md) - Shop details management
- [Services Management](features/SERVICES_FIX_SUMMARY.md) - Service CRUD operations

---

### 🔌 [API Reference](api/)
API endpoint documentation and technical specifications.

**Core APIs:**
- [Slots API](api/SLOTS_API_UPDATE.md) - Available time slot generation
- [Admin Dashboard API](api/admin-dashboard.md) - Admin panel endpoints

**Admin Features:**
- [Admin Dashboard Cleanup](api/admin-dashboard-cleanup-instructions.md)
- [Admin Shop Detail Enhancement](api/ADMIN_SHOP_DETAIL_ENHANCEMENT.md)

---

## 🚀 Quick Navigation

**New to Clipper?** Start here:
1. [Authentication Guide](setup/authentication.md)
2. [Dashboard Setup](setup/DASHBOARD_SETUP_NAVIGATION.md)
3. [Deployment Guide](../DEPLOYMENT_GUIDE.md)

**Understanding the System?**
1. [Soft Lock Architecture](architecture/SOFT_LOCK_ARCHITECTURE.md)
2. [Database Schema](../types/database.ts)
3. [Design System](architecture/design-system.md)

**Building Features?**
1. [Booking Flow](features/booking-page.md)
2. [Slots API](api/SLOTS_API_UPDATE.md)
3. [Calendar Views](features/CALENDAR_REVIEW.md)

---

## 🤝 Contributing to Documentation

When adding new documentation:
- Place setup/deployment guides in `setup/`
- Place architecture/design docs in `architecture/`
- Place feature-specific docs in `features/`
- Place API specifications in `api/`

Use clear titles, code examples, and maintain the existing formatting style.

---

**[← Back to Main README](../README.md)**
