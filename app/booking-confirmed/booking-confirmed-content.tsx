'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function BookingConfirmedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [redirectCountdown, setRedirectCountdown] = useState(5)

  // Read all parameters from URL using useSearchParams hook
  const shop = searchParams.get('shop') || 'Shop'
  const shopId = searchParams.get('shop_id') || ''
  const shopSlug = searchParams.get('shop_slug') || ''
  const barber = searchParams.get('barber') || 'Barber'
  const services = searchParams.get('services') || 'Service'
  const duration = searchParams.get('duration') || '0'
  const dateStr = searchParams.get('date') || ''
  const timeStr = searchParams.get('time') || ''
  const customer = searchParams.get('customer') || ''
  const paymentId = searchParams.get('payment_id') || ''
  const bookingId = searchParams.get('booking_id') || ''
  const status = searchParams.get('status') === 'failed' ? 'failed' : 'success'
  const error = searchParams.get('error') || ''
  const isWalkIn = searchParams.get('is_walk_in') === 'true'

  // Auto-redirect for walk-ins after 5 seconds
  useEffect(() => {
    if (!isWalkIn) return

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isWalkIn, router])

  // Format date
  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Date not available'

  // Format time
  const formattedTime = timeStr ? new Date(timeStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) : 'Time not available'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm md:max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        {/* Success Indicator */}
        <div className="flex flex-col items-center mb-6">
          <div className={`w-16 h-16 ${status === 'success' ? (isWalkIn ? 'bg-blue-50' : 'bg-emerald-50') : 'bg-red-50'} rounded-full flex items-center justify-center mb-4`}>
            {status === 'success' ? (
              <svg 
                className={`w-8 h-8 ${isWalkIn ? 'text-blue-500' : 'text-emerald-500'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 text-center">
            {status === 'success'
              ? (isWalkIn ? 'Walk-In Slot Booked' : 'Booking Confirmed')
              : 'Payment Failed'}
          </h1>
          {status === 'success' && customer && (
            <p className="text-lg text-gray-700 mt-2 font-medium">
              for {customer}
            </p>
          )}
          {status === 'success' && isWalkIn && (
            <p className="text-sm text-gray-600 mt-2">Redirecting to dashboard in {redirectCountdown}s...</p>
          )}
          {status === 'failed' && error && (
            <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
          )}
        </div>

        {/* Booking Summary */}
        <div className="space-y-4 mb-6">
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Shop</p>
                <p className="text-base font-medium text-gray-900">
                  {shop}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Barber</p>
                <p className="text-base font-medium text-gray-900">
                  {barber}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Service</p>
                <p className="text-base font-medium text-gray-900">
                  {services} • {duration} minutes
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Date</p>
                <p className="text-base font-medium text-gray-900">
                  {formattedDate}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Time</p>
                <p className="text-base font-medium text-gray-900">
                  {formattedTime}
                </p>
              </div>
            </div>
          </div>

          {/* Booking ID */}
          {status === 'success' && bookingId && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600 mb-2">Booking ID</p>
              <p className="text-sm font-mono bg-gray-50 p-3 rounded border border-gray-200 text-gray-800 break-all">
                {bookingId}
              </p>
            </div>
          )}

          {/* Payment Status */}
          <div className="border-t border-gray-200 pt-4">
            {status === 'success' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-1">
                <p className="text-base text-emerald-800 font-medium">Payment received</p>
                {paymentId && <p className="text-sm text-emerald-700">Payment ID: {paymentId}</p>}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1">
                <p className="text-base text-red-800 font-medium">Payment failed</p>
                {paymentId && <p className="text-sm text-red-700">Payment ID: {paymentId}</p>}
                {error && <p className="text-sm text-red-700">{error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Important Instruction */}
        <div className="mb-6">
          {isWalkIn && status === 'success' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">
                Walk-in slot created successfully. Slot is now blocked in the calendar.
              </p>
            </div>
          ) : (
            <p className="text-sm text-center text-gray-600">
              {status === 'success' ? 'Please arrive on time for your appointment.' : 'Payment did not go through. You can retry below.'}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === 'success' && bookingId && (
            <button
              type="button"
              onClick={() => router.push(`/track/${bookingId}`)}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-medium py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
            >
              Track Booking Status
            </button>
          )}
          
          <button
            type="button"
            onClick={() => {
              if (status === 'failed') {
                if (shopId) {
                  router.push(`/book/${shopId}`)
                } else {
                  router.back()
                }
                return
              }

              if (isWalkIn) {
                router.push('/dashboard')
              } else {
                // If shop_slug is available, redirect back to shop experience
                if (shopSlug) {
                  router.push(`/shop/${shopSlug}`)
                } else if (shopId) {
                  router.push(`/book/${shopId}`)
                } else {
                  router.push('/')
                }
              }
            }}
            className={`w-full ${status === 'failed' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : (isWalkIn ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500')} text-white font-medium py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
          >
            {status === 'failed' ? 'Retry Payment' : (isWalkIn ? 'Go to Dashboard' : 'Done')}
          </button>
        </div>
      </div>
    </div>
  )
}
