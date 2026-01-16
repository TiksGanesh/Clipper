'use client'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import ShopGuidelines from '@/components/booking/ShopGuidelines'

type TrackingResponse = {
    booking: {
        id: string
        original_start: string
        service_name: string
        barber_name: string
        customer_name: string
        status: string
        duration_minutes: number
    }
    live_status: {
        is_delayed: boolean
        delay_minutes: number
        expected_start: string
        queue_position: number
        people_ahead: number
        current_activity: string
        timestamp: string
    }
}

// Helper Components for Status Cards
const ServiceCompletedCard = () => (
    <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-2xl p-6 text-center"
    >
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-2xl font-bold mb-2">Service Completed</h2>
        <p className="text-gray-50">Thank you for visiting!</p>
    </motion.div>
)

const BookingCancelledCard = () => (
    <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl p-6 text-center"
    >
        <div className="text-5xl mb-3">❌</div>
        <h2 className="text-2xl font-bold mb-2">Booking Cancelled</h2>
        <p className="text-red-50">This booking has been cancelled</p>
    </motion.div>
)

const ExpiredCard = () => (
    <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-6 text-center"
    >
        <div className="text-5xl mb-3">⏰</div>
        <h2 className="text-2xl font-bold mb-2">Slot Expired</h2>
        <p className="text-orange-50">This booking slot has expired</p>
    </motion.div>
)

const ServiceInProgressCard = () => (
    <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl p-6 text-center"
    >
        <div className="text-5xl mb-3">✂️</div>
        <h2 className="text-2xl font-bold mb-2">Service in Progress</h2>
        <p className="text-blue-50">Your service is underway</p>
    </motion.div>
)

const YouAreNextCard = () => (
    <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl p-6 text-center"
    >
        <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            className="text-5xl mb-3"
        >
            🎉
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">You are Next!</h2>
        <p className="text-green-50">Please head to the shop now</p>
    </motion.div>
)

const StandardQueueCard = ({ queue_position, people_ahead, current_activity }: { queue_position: number; people_ahead: number; current_activity: string }) => (
    <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
            <span className="text-gray-600">Your Position</span>
            <span className="text-3xl font-bold text-indigo-600">
                #{queue_position}
            </span>
        </div>

        {people_ahead > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-gray-600">People Ahead</span>
                <span className="text-2xl font-semibold text-gray-900">
                    {people_ahead}
                </span>
            </div>
        )}

        <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Current Activity</p>
            <p className="text-base font-medium text-gray-900">
                {current_activity}
            </p>
        </div>
    </div>
)

// Helper function to render the appropriate status card based on strict priority
function renderStatusCard(
    status: string,
    queue_position: number,
    people_ahead: number,
    current_activity: string
) {
    // Priority order: completed > cancelled > expired > seated > queue_position === 1 > default
    if (status === 'completed') {
        return <ServiceCompletedCard />
    }
    if (status === 'canceled' || status === 'cancelled') {
        return <BookingCancelledCard />
    }
    if (status === 'expired') {
        return <ExpiredCard />
    }
    if (status === 'seated') {
        return <ServiceInProgressCard />
    }
    if (queue_position === 1) {
        return <YouAreNextCard />
    }
    // Default: show standard queue card
    return <StandardQueueCard queue_position={queue_position} people_ahead={people_ahead} current_activity={current_activity} />
}

// Helper function to copy text to clipboard
async function copyToClipboard(text: string, onCopy: () => void) {
    try {
        await navigator.clipboard.writeText(text)
        onCopy()
    } catch (err) {
        console.error('Failed to copy:', err)
    }
}

const fetcher = (url: string) => {
    // Add timestamp to bust all caches
    const cacheBuster = `_t=${Date.now()}`
    const separator = url.includes('?') ? '&' : '?'
    return fetch(`${url}${separator}${cacheBuster}`, {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    }).then((res) => res.json())
}

export default function TrackBookingPage() {
    const params = useParams()
    const bookingId = params.id as string

    // Poll every 10 seconds, force fresh data with aggressive cache busting
    const { data, error, isLoading, mutate } = useSWR<TrackingResponse>(
        bookingId ? `/api/track?booking_id=${bookingId}` : null,
        fetcher,
        {
            refreshInterval: 30000, // 30 seconds for quicker updates
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            revalidateIfStale: true,
            revalidateOnMount: true,
            dedupingInterval: 0, // Disable deduping to ensure fresh requests
            focusThrottleInterval: 0,
            keepPreviousData: false, // Don't show stale data
        }
    )

    const [showContent, setShowContent] = useState(false)
    const [copiedId, setCopiedId] = useState(false)

    useEffect(() => {
        if (data) {
            setShowContent(true)
        }
    }, [data])

    // Check for API error responses (e.g., booking not found)
    const hasErrorResponse = data && 'error' in data
    const errorMessage = hasErrorResponse && 'error' in data && typeof data.error === 'string'
        ? data.error
        : "We couldn't find this booking. Please check your booking ID."

    if (error || hasErrorResponse) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
                >
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h1>
                    <p className="text-gray-600">
                        {errorMessage}
                    </p>
                </motion.div>
            </div>
        )
    }

    if (isLoading || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
                >
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading your booking...</p>
                </motion.div>
            </div>
        )
    }

    if (!data.booking || !data.live_status) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
                >
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Booking Data</h1>
                    <p className="text-gray-600">
                        We received incomplete data for this booking. Please try again.
                    </p>
                </motion.div>
            </div>
        )
    }

    const { booking, live_status } = data

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Live Status Indicator */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : -20 }}
                    className="flex items-center justify-center gap-2 text-sm text-gray-600"
                >
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="font-medium">Live Status</span>
                    <button
                        onClick={() => mutate()}
                        className="ml-3 text-indigo-600 hover:text-indigo-800 underline"
                    >Refresh</button>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
                        <h1 className="text-3xl font-bold mb-2">{booking.service_name}</h1>
                        <p className="text-indigo-100">with {booking.barber_name}</p>
                    </div>

                    {/* Main Content */}
                    <div className="p-6 sm:p-8 space-y-8">
                        {/* Status Card - Strict Priority Rendering */}
                        {renderStatusCard(booking.status, live_status.queue_position, live_status.people_ahead, live_status.current_activity)}

                        {/* Expected Start Time */}
                        {booking.status !== 'completed' && booking.status !== 'canceled' && booking.status !== 'cancelled' && booking.status !== 'expired' && (
                            <div className="text-center space-y-2">
                                <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold">
                                    Expected Start Time
                                </p>
                                <motion.div
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    className="text-5xl sm:text-6xl font-bold text-gray-900"
                                >
                                    {live_status.expected_start}
                                </motion.div>

                                {live_status.is_delayed && (
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <span className="text-gray-500 line-through">
                                            {booking.original_start}
                                        </span>
                                        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium">
                                            +{live_status.delay_minutes} min delay
                                        </span>
                                    </div>
                                )}

                                {!live_status.is_delayed && (
                                    <div className="text-sm text-green-600 font-medium">
                                        ⏰ On time
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Booking Details */}
                        <div className="bg-indigo-50 rounded-2xl p-6 space-y-3">
                            <h3 className="font-semibold text-gray-900 mb-4">Booking Details</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-600 mb-1">Customer</p>
                                    <p className="font-medium text-gray-900">{booking.customer_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 mb-1">Duration</p>
                                    <p className="font-medium text-gray-900">{booking.duration_minutes} min</p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-indigo-100">
                                <p className="text-xs text-gray-600 mb-2">Booking ID</p>
                                <button
                                    onClick={() => copyToClipboard(booking.id, () => {
                                        setCopiedId(true)
                                        setTimeout(() => setCopiedId(false), 2000)
                                    })}
                                    className="relative group font-mono text-xs text-gray-700 break-all hover:text-indigo-600 transition-colors"
                                    title="Click to copy full ID"
                                >
                                    ...{booking.id.slice(-8)}
                                    {copiedId && (
                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                                            Copied!
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Auto-refresh notice */}
                        <div className="text-center text-sm text-gray-500">
                            <p>Status updates automatically every 30 seconds</p>
                            <p className="text-xs mt-1">
                                Last updated: {new Date(live_status.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showContent ? 1 : 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-center text-sm text-gray-600"
                >
                    <p>Track your booking in real-time</p>
                </motion.div>

                <div className="mt-8">
                    <ShopGuidelines />
                </div>
            </div>
        </div>
    )
}
