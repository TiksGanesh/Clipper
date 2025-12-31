'use client'

import Link from 'next/link'

type Barber = {
    id: string
    name: string
    isOnLeave?: boolean
}

type Props = {
    barbers: Barber[]
}

export default function DashboardContent({ barbers = [] }: Props) {
    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Bookings</label>
                    <a
                        href="/dashboard/walk-in"
                        className="flex items-center justify-center w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-medium text-sm"
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
    )
}
