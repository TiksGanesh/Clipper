'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Booking = {
    id: string
    customer_name: string
    customer_phone: string
    start_time: string
    end_time: string
    service_name: string
    barber_name: string
    status: 'confirmed' | 'completed' | 'canceled' | 'no_show'
    is_walk_in: boolean
}

type Props = {
    initialQuery: string
    bookings: Booking[]
    error?: string | null
}

function statusColor(status: string) {
    switch (status) {
        case 'confirmed':
            return 'bg-blue-100 text-blue-800'
        case 'completed':
            return 'bg-emerald-100 text-emerald-800'
        case 'no_show':
            return 'bg-yellow-100 text-yellow-800'
        case 'canceled':
            return 'bg-red-100 text-red-800'
        default:
            return 'bg-gray-100 text-gray-800'
    }
}

function formatDateTime(isoString: string) {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

function formatPhone(phone: string) {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
    }
    return phone
}

export default function SearchBookingsClient({ initialQuery, bookings, error }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [query, setQuery] = useState(initialQuery)

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim().length > 0) {
            const params = new URLSearchParams()
            params.set('q', query.trim())
            router.push(`/dashboard/search?${params.toString()}`)
        }
    }

    const handleClear = () => {
        setQuery('')
        router.push('/dashboard/search')
    }

    return (
        <div className="space-y-4">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-sm p-4 sticky top-20 z-5">
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search by Name or Mobile"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    <button
                        type="submit"
                        disabled={query.trim().length === 0}
                        className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Search
                    </button>
                </div>
                {query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-xs text-gray-600 hover:text-gray-900 mt-2"
                    >
                        Clear search
                    </button>
                )}
            </form>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    {error}
                </div>
            )}

            {/* Results */}
            {query.trim().length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600 text-sm">
                    Enter a name or mobile number to search for bookings.
                </div>
            ) : bookings.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600 text-sm">
                    No bookings found for &quot;{query}&quot;
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 px-1">
                        Found {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
                    </p>
                    {bookings.map((booking) => (
                        <div
                            key={booking.id}
                            className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                        >
                            <div className="p-4 space-y-3">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-semibold text-gray-900 truncate">
                                            {booking.customer_name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-0.5">
                                            {formatPhone(booking.customer_phone)}
                                        </p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor(booking.status)}`}>
                                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Service</span>
                                        <span className="text-gray-900 font-medium">{booking.service_name}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Barber</span>
                                        <span className="text-gray-900 font-medium">{booking.barber_name}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Date & Time</span>
                                        <span className="text-gray-900 font-medium text-right">
                                            {formatDateTime(booking.start_time)}
                                        </span>
                                    </div>
                                    {booking.is_walk_in && (
                                        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Walk-in
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
