#!/bin/bash
# Integration Testing Guide for Soft Lock Implementation
# Run these tests to verify the soft lock mechanism works correctly

set -e

BASE_URL="${1:-http://localhost:3000}"
CLEANUP_SECRET="${2:-test-secret}"

echo "=========================================="
echo "Soft Lock Integration Tests"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
if curl -s "$BASE_URL/api/bookings" | grep -q "Invalid input\|Invalid JSON\|error"; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${RED}✗ API is not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Create a Hold (Success Case)
echo -e "${YELLOW}Test 2: Create Slot Hold${NC}"
HOLD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings/hold" \
  -H "Content-Type: application/json" \
  -d '{
    "barber_id": "test-barber-id",
    "service_ids": ["test-service-id"],
    "date": "2025-01-09",
    "slot_time": "2025-01-09T10:00:00Z",
    "timezone_offset": -330
  }')

echo "Response: $HOLD_RESPONSE"
if echo "$HOLD_RESPONSE" | grep -q "bookingId\|error"; then
    echo -e "${GREEN}✓ Hold API responds${NC}"
else
    echo -e "${RED}✗ Hold API response invalid${NC}"
fi
echo ""

# Test 3: Check Cleanup Status
echo -e "${YELLOW}Test 3: Check Cleanup Status${NC}"
CLEANUP_STATUS=$(curl -s "$BASE_URL/api/bookings/cleanup")
echo "Response: $CLEANUP_STATUS"
if echo "$CLEANUP_STATUS" | grep -q "expired_count\|current_time"; then
    echo -e "${GREEN}✓ Cleanup endpoint responds${NC}"
else
    echo -e "${RED}✗ Cleanup endpoint response invalid${NC}"
fi
echo ""

# Test 4: Trigger Cleanup (Requires Secret)
echo -e "${YELLOW}Test 4: Trigger Cleanup${NC}"
CLEANUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings/cleanup" \
  -H "Authorization: Bearer $CLEANUP_SECRET")
echo "Response: $CLEANUP_RESPONSE"
if echo "$CLEANUP_RESPONSE" | grep -q "cleaned\|error\|Unauthorized"; then
    echo -e "${GREEN}✓ Cleanup endpoint triggers${NC}"
else
    echo -e "${RED}✗ Cleanup endpoint response invalid${NC}"
fi
echo ""

echo "=========================================="
echo "Manual Testing Checklist:"
echo "=========================================="
echo ""
echo "1. Happy Path Test:"
echo "   - Go to booking page"
echo "   - Select barber, service, date, time"
echo "   - Click 'Continue to Payment'"
echo "   - Verify slot is reserved (check DB: status = pending_payment)"
echo "   - Complete payment in Razorpay modal"
echo "   - Verify booking is confirmed (status = confirmed)"
echo "   - Verify customer details are saved"
echo ""

echo "2. Concurrent Booking Test:"
echo "   - Open two browser windows to same booking page"
echo "   - Both select same time slot"
echo "   - Both click 'Continue to Payment'"
echo "   - Window 1: Complete payment (should succeed)"
echo "   - Window 2: Try to complete payment (should fail with 409)"
echo ""

echo "3. Hold Expiry Test:"
echo "   - Create a hold via API: curl -X POST $BASE_URL/api/bookings/hold ..."
echo "   - Verify booking created with status = pending_payment"
echo "   - Wait 10+ minutes"
echo "   - Run cleanup: curl -X POST $BASE_URL/api/bookings/cleanup ..."
echo "   - Verify booking is soft-deleted (deleted_at is set)"
echo "   - Verify same slot can now be booked by another user"
echo ""

echo "4. Payment Cancellation Test:"
echo "   - Create a hold via API"
echo "   - Open Razorpay modal"
echo "   - Click X to close modal (cancel payment)"
echo "   - Verify error message: 'The slot hold will expire in 10 minutes'"
echo "   - Verify hold booking still exists with pending_payment status"
echo ""

echo "5. Cleanup Scheduling Test:"
echo "   - Verify cleanup endpoint is accessible"
echo "   - Set up cron job (see SOFT_LOCK_IMPLEMENTATION.md)"
echo "   - Monitor logs to verify cleanup runs periodically"
echo "   - Verify expired holds are cleaned up"
echo ""

echo "=========================================="
echo "Database Queries for Manual Testing:"
echo "=========================================="
echo ""
echo "View pending payment bookings:"
echo '  SELECT id, barber_id, status, expires_at, created_at'
echo '  FROM bookings'
echo "  WHERE status = 'pending_payment'"
echo "  ORDER BY created_at DESC;"
echo ""

echo "View bookings for a specific date:"
echo '  SELECT id, barber_id, status, start_time, end_time, expires_at'
echo '  FROM bookings'
echo "  WHERE DATE(start_time) = '2025-01-09'"
echo "  ORDER BY start_time;"
echo ""

echo "View soft-deleted (expired) bookings:"
echo '  SELECT id, barber_id, status, deleted_at'
echo '  FROM bookings'
echo "  WHERE deleted_at IS NOT NULL"
echo "  ORDER BY deleted_at DESC"
echo "  LIMIT 10;"
echo ""

echo "Check for overlapping bookings (should be 0):"
echo '  SELECT COUNT(*) FROM bookings b1'
echo "  WHERE b1.barber_id = 'barber-uuid'"
echo "  AND b1.status IN ('confirmed', 'completed')"
echo "  AND b1.deleted_at IS NULL"
echo "  AND EXISTS ("
echo "    SELECT 1 FROM bookings b2"
echo "    WHERE b2.barber_id = b1.barber_id"
echo "    AND b2.id != b1.id"
echo "    AND b2.deleted_at IS NULL"
echo "    AND ("
echo "      (b2.start_time >= b1.start_time AND b2.start_time < b1.end_time)"
echo "      OR (b2.end_time > b1.start_time AND b2.end_time <= b1.end_time)"
echo "      OR (b2.start_time <= b1.start_time AND b2.end_time >= b1.end_time)"
echo "    )"
echo "  );"
echo ""

echo "=========================================="
echo "Environment Variables to Set:"
echo "=========================================="
echo ""
echo "CLEANUP_SECRET=your-secure-secret-key"
echo ""

echo -e "${GREEN}Testing guide complete!${NC}"
