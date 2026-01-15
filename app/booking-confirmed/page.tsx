'use client'

import { Suspense } from 'react'
import BookingConfirmedContent from './booking-confirmed-content'

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm md:max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </div>
    }>
      <BookingConfirmedContent />
    </Suspense>
  )
}
