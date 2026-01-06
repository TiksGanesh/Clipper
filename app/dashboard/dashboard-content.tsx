'use client'

import Link from 'next/link'
import { useState } from 'react'

type Barber = {
    id: string
    name: string
    isOnLeave?: boolean
}

type SetupStatus = {
    barbersConfigured: boolean
    servicesConfigured: boolean
    hoursConfigured: boolean
    isSetupComplete: boolean
}

type Props = {
    barbers: Barber[]
    setupStatus: SetupStatus
    barberCount: number
    serviceCount: number
    todayRevenue?: number
}

export default function DashboardContent({ barbers = [], setupStatus, barberCount = 0, serviceCount = 0, todayRevenue = 0 }: Props) {
    // Determine if there are setup improvements possible
    const canAddBarber = barberCount === 1 // Can add second barber
    const needsMoreServices = serviceCount < 3 // Suggest adding more services for variety
    const hasSetupSuggestions = canAddBarber || needsMoreServices
    const [showRevenue, setShowRevenue] = useState(false)

    return (
        <div className="space-y-4">
            {/* Setup Suggestions Banner - Only show if there are actionable improvements */}
            {hasSetupSuggestions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">Enhance Your Setup</h4>
                            <div className="space-y-2">
                                {canAddBarber && (
                                    <Link
                                        href="/dashboard/edit-shop"
                                        className="flex items-center justify-between w-full px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-900 rounded-lg transition text-sm font-medium"
                                    >
                                        <span>➕ Add Second Barber</span>
                                        <span className="text-blue-600">→</span>
                                    </Link>
                                )}
                                {needsMoreServices && (
                                    <Link
                                        href="/dashboard/services"
                                        className="flex items-center justify-between w-full px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-900 rounded-lg transition text-sm font-medium"
                                    >
                                        <span>✨ Add More Services</span>
                                        <span className="text-blue-600">→</span>
                                    </Link>
                                )}
                            </div>
                            <p className="text-xs text-blue-700 mt-2">
                                {canAddBarber && "Adding a second barber increases booking capacity. "}
                                {needsMoreServices && "More services attract diverse customers."}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                    <button
                        type="button"
                        onClick={() => setShowRevenue((v) => !v)}
                        className="px-2 py-1 bg-indigo-800 text-emerald-300 font-mono border border-indigo-700 rounded-full"
                        aria-label="Toggle revenue visibility"
                        title="Toggle revenue visibility"
                    >
                        {`Today: ₹${showRevenue ? Number(todayRevenue).toLocaleString('en-IN') : '****'}`}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Bookings</label>
                        <a
                            href="/dashboard/walk-in"
                            className="hidden md:flex items-center justify-center w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-medium text-sm"
                        >
                            + Walk-In Booking
                        </a>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Manage</label>
                        <Link
                            href="/dashboard/services"
                            className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg transition font-medium text-sm"
                        >
                            <span>Manage Services</span>
                            <span className="text-gray-400">→</span>
                        </Link>
                        <Link
                            href="/dashboard/manage-leave"
                            className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg transition font-medium text-sm"
                        >
                            <span>Manage Leave</span>
                            <span className="text-gray-400">→</span>
                        </Link>
                        <Link
                            href="/dashboard/edit-shop"
                            className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg transition font-medium text-sm"
                        >
                            <span>Shop Information</span>
                            <span className="text-gray-400">→</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
