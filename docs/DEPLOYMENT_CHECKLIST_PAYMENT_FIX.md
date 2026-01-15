# Deployment Checklist: Multi-Tab Booking Bug Fix

## Pre-Deployment

- [ ] All tests pass locally
  ```bash
  npm run test
  npm run type-check
  ```

- [ ] No TypeScript errors
  ```bash
  npx tsc --noEmit
  ```

- [ ] Code review completed
  - Review: `app/api/bookings/route.ts` (payment lookup logic)
  - Review: `components/booking/BookingForm.tsx` (comment only)
  - Review: Documentation files

- [ ] All database migrations complete
  - `payments` table exists with:
    - `razorpay_order_id` (indexed)
    - `booking_id` (foreign key)
    - `status` column
  - `bookings` table has `expires_at` column

- [ ] Environment variables verified
  - `SUPABASE_URL` set
  - `SUPABASE_SERVICE_KEY` set
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` set

---

## Deployment Steps

### Step 1: Backup Current State
```bash
# Tag current version
git tag -a pre-payment-validation-fix -m "Pre-fix version"

# Verify backup
git describe --tags
```

### Step 2: Deploy Code
```bash
# Deploy to staging first
git push origin feature/appointment-workflow

# Run tests on staging
npm run test:staging

# If tests pass, deploy to production
git push production main
```

### Step 3: Verify Deployment
```bash
# Check logs for errors
# Should see new log format in payment confirmation

# Test single-tab flow
# 1. Open booking page
# 2. Select service, date, time
# 3. Complete payment
# 4. Verify: booking confirmed (status = 'confirmed')

# Test multi-tab flow
# 1. Open booking page in Tab A and Tab B
# 2. In Tab A: Select service X, date D, time T
# 3. In Tab B: Select service Y, date D, time T+30min
# 4. In Tab B: Complete payment
# 5. In Tab A: Complete payment
# 6. Verify: Both bookings confirmed independently
```

### Step 4: Monitor
- [ ] Monitor error logs for payment validation failures
- [ ] Check for "Payment record not found" errors
- [ ] Verify idempotent retries work (should see `idempotent: true`)
- [ ] Track booking confirmation latency (should be < 100ms)

---

## Rollback Plan

If critical issues arise:

### Option 1: Quick Rollback
```bash
# Revert to previous version
git revert <commit-hash>
git push production main

# Or rollback deployment
vercel rollback
```

### Option 2: Feature Flag (if implemented)
```typescript
if (process.env.PAYMENT_VALIDATION_ENABLED) {
    // New logic (payment lookup)
} else {
    // Old logic (frontend booking_id)
}
```

### Option 3: Gradual Rollout
```typescript
// Use percentage-based rollout
if (Math.random() < 0.5) {
    // 50% use new logic
    // 50% use old logic
}
```

---

## Verification Checklist

### After Deployment

- [ ] **Single-tab booking**
  - [ ] Can book a service
  - [ ] Payment succeeds
  - [ ] Booking confirms
  - [ ] Redirects to confirmation page
  - [ ] Dashboard shows booking as "CONFIRMED"

- [ ] **Multi-tab booking**
  - [ ] Two tabs can book independently
  - [ ] Both payments can succeed
  - [ ] Both bookings confirm
  - [ ] No "Booking hold not found" errors

- [ ] **Idempotency**
  - [ ] Payment succeeds, page refreshes
  - [ ] Confirmation API retried
  - [ ] Returns 200 (not 400)
  - [ ] No duplicate confirmations

- [ ] **Error handling**
  - [ ] Missing payment → Clear error
  - [ ] Expired hold → Clear error
  - [ ] Invalid booking → Clear error
  - [ ] Error messages are user-friendly

- [ ] **Logging**
  - [ ] Logs show payment lookup
  - [ ] Logs show booking validation
  - [ ] Logs show status changes
  - [ ] No sensitive data in logs

- [ ] **Dashboard**
  - [ ] Confirmed bookings show "WAITING"
  - [ ] Seated bookings show "IN CHAIR"
  - [ ] Completed bookings show "DONE"
  - [ ] No "PENDING" status (unless UI fix also deployed)

- [ ] **Walk-in bookings**
  - [ ] Still work (non-payment path)
  - [ ] Don't need razorpay_order_id

---

## Monitoring Commands

### Check Logs for Errors
```bash
# Supabase logs
supabase logs:retrieve --prod

# Edge function logs (if deployed there)
vercel logs --prod --format pretty

# Filter for booking API errors
supabase logs:retrieve --prod | grep "booking-api" | grep "error"
```

### Monitor Payment Processing
```bash
# Check payment records in Supabase
supabase query "SELECT COUNT(*) FROM payments WHERE status = 'paid'"

# Check for failed confirmations
supabase query "
  SELECT COUNT(*) 
  FROM bookings 
  WHERE status = 'pending_payment' 
  AND expires_at < NOW()
"

# Verify no orphaned payments
supabase query "
  SELECT * FROM payments 
  WHERE booking_id NOT IN (SELECT id FROM bookings)
"
```

---

## Performance Baseline

Establish baseline metrics before and after:

### Before Deployment
```
- Average confirmation latency: ___ ms
- Error rate: ___ %
- Multi-tab success rate: ___ %
- Idempotent retry success: ___ %
```

### After Deployment
```
- Average confirmation latency: ___ ms (target: < 100ms)
- Error rate: ___ % (target: < 0.1%)
- Multi-tab success rate: ___ % (target: 99%+)
- Idempotent retry success: ___ % (target: 100%)
```

---

## Post-Deployment Tasks

### Immediate (Within 1 hour)
- [ ] Verify no critical errors in logs
- [ ] Test basic booking flow works
- [ ] Confirm payment processing succeeds

### Short-term (Within 24 hours)
- [ ] Monitor error rates
- [ ] Check multi-tab scenarios
- [ ] Verify idempotency works
- [ ] Run full test suite

### Medium-term (Within 1 week)
- [ ] Analyze logs for patterns
- [ ] Check user feedback
- [ ] Review performance metrics
- [ ] Update dashboard to handle `pending_payment` status

### Long-term (Within 1 month)
- [ ] Verify webhook integration works
- [ ] Add integration tests for multi-tab
- [ ] Document lessons learned
- [ ] Consider payment validation as template for other APIs

---

## Known Issues & Workarounds

### Issue 1: Dashboard Shows "PENDING" Status
**Status**: Identified
**Workaround**: Only appears if booking holds timeout (10 min)
**Fix**: Update `AppointmentCard.tsx` (separate PR)
**Timeline**: Next sprint

### Issue 2: Payment Webhook May Duplicate Confirmations
**Status**: Identified  
**Workaround**: Update webhook to use same validation logic
**Fix**: Refactor webhook handler
**Timeline**: Next sprint

### Issue 3: Walk-in Bookings Don't Use Payment Path
**Status**: Expected
**Workaround**: None needed (walk-ins skip payment)
**Impact**: None (confirmed in code review)

---

## Approval Sign-Off

- [ ] Technical review: _____________
- [ ] Security review: _____________
- [ ] Product review: _____________
- [ ] Release lead approval: _____________

---

## Final Notes

This fix is **low-risk** because:
1. ✅ Backward compatible (old path still works)
2. ✅ No database schema changes
3. ✅ No new dependencies
4. ✅ No environment variable changes
5. ✅ Can be rolled back in < 5 minutes

**Confidence Level**: HIGH ✅

This fix is **critical** because:
1. ❌ Prevents payment → booking confirmation failures
2. ❌ Fixes multi-tab booking collisions
3. ❌ Makes bookings idempotent (retry-safe)
4. ❌ Improves error messages significantly

**Business Impact**: CRITICAL ⚠️

---

## Deployment Commands

```bash
# Stage the fix
git add app/api/bookings/route.ts components/booking/BookingForm.tsx

# Commit with clear message
git commit -m "fix: use payment order_id as source of truth for booking confirmation

- Fixes multi-tab booking collision bug
- Adds payment-to-booking validation
- Implements idempotency for payment confirmations
- Improves error messages and logging
- Backward compatible with walk-in bookings"

# Push to feature branch
git push origin feature/appointment-workflow

# Create pull request
# Add this checklist link to PR description

# After approval, merge
git merge --squash feature/appointment-workflow
git push origin main

# Deploy
vercel deploy --prod
```

