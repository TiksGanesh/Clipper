'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    cancelBookingAction,
    markBookingCompletedAction,
    markBookingNoShowAction,
} from '@/app/barber/calendar/actions'

type DayBooking = {
    id: string
    start_time: string
    end_time: string
    service_name: string
    customer_name: string
    status: 'confirmed' | 'completed' | 'canceled' | 'no_show'
    is_walk_in: boolean
}

type BookingDisplayStatus = 'upcoming' | 'completed' | 'no_show' | 'canceled'

type WeekPayload = {
    bookings: DayBooking[]
    weekStart: string
    weekEnd: string
}

function formatTimeLabel(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

function toDisplayStatus(status: string): BookingDisplayStatus {
    switch (status) {
        case 'completed':
            return 'completed'
        case 'no_show':
            return 'no_show'
        case 'canceled':
            return 'canceled'
        default:
            return 'upcoming'
    }
}

function bookingStyle(status: BookingDisplayStatus) {
    const map: Record<BookingDisplayStatus, { bg: string; border: string; text: string; label: string }> = {
        upcoming: { bg: '#e0f2fe', border: '#60a5fa', text: '#0f172a', label: 'Upcoming' },
        completed: { bg: '#dcfce7', border: '#22c55e', text: '#14532d', label: 'Completed' },
        no_show: { bg: '#fef9c3', border: '#facc15', text: '#854d0e', label: 'No Show' },
        canceled: { bg: '#fee2e2', border: '#f87171', text: '#7f1d1d', label: 'Cancelled' },
    }
    return map[status]
}

function getDayOfWeekLabel(iso: string) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const d = new Date(iso + 'T00:00:00')
    return days[d.getDay()]
}

function getDateLabel(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${month}/${date}`
}

type Props = {
    selectedBarberId: string
    selectedDate: string
    isActionPending: boolean
    isReadOnly?: boolean
}

export default function WeekView({ selectedBarberId, selectedDate, isActionPending, isReadOnly }: Props) {
    const [payload, setPayload] = useState<WeekPayload | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [actionMessage, setActionMessage] = useState<string>('')
    const [actionError, setActionError] = useState<string>('')
    const [, startActionTransition] = useTransition()

    useEffect(() => {
        if (!selectedBarberId || !selectedDate) {
            return
        }

        const controller = new AbortController()
        const fetchWeek = async () => {
            setLoading(true)
            setError('')
            try {
                const params = new URLSearchParams({ barber_id: selectedBarberId, date: selectedDate })
                const res = await fetch(`/api/calendar/week?${params.toString()}`, { signal: controller.signal })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to load week view')
                }
                const body = await res.json()
                setPayload(body as WeekPayload)
                setActionMessage('')
                setActionError('')
            } catch (err: any) {
                if (err.name === 'AbortError') return
                setPayload(null)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchWeek()
        return () => controller.abort()
    }, [selectedBarberId, selectedDate])

    const handleBookingAction = (bookingId: string, status: BookingDisplayStatus) => {
        setActionMessage('')
        setActionError('')

        const action =
            status === 'completed'
                ? markBookingCompletedAction
                : status === 'no_show'
                  ? markBookingNoShowAction
                  : cancelBookingAction

        startActionTransition(async () => {
            try {
                await action({ bookingId })
                setActionMessage('Booking updated')
                const params = new URLSearchParams({ barber_id: selectedBarberId, date: selectedDate })
                const res = await fetch(`/api/calendar/week?${params.toString()}`)
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to refresh')
                }
                const body = await res.json()
                setPayload(body as WeekPayload)
            } catch (err: any) {
                setActionError(err.message || 'Failed to update booking')
            }
        })
    }

    // Generate 7 dates for Mon-Sun of the week
    const dateObj = new Date(selectedDate + 'T00:00:00')
    const dayOfWeek = dateObj.getDay()
    const monday = new Date(dateObj)
    monday.setDate(dateObj.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d.toISOString().split('T')[0]
    })

    // Group bookings by date
    const bookingsByDate: Record<string, DayBooking[]> = {}
    weekDates.forEach((date) => {
        bookingsByDate[date] = []
    })

    // Helper to get local date key YYYY-MM-DD for a timestamp
    const localDateKey = (iso: string) => {
        const d = new Date(iso)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    if (payload?.bookings) {
        payload.bookings.forEach((booking) => {
            const bookingDate = localDateKey(booking.start_time)
            if (bookingsByDate[bookingDate]) {
                bookingsByDate[bookingDate].push(booking)
            }
        })
    }

    // Sort bookings within each day by start time
    Object.keys(bookingsByDate).forEach((date) => {
        bookingsByDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    return (
        <section className="space-y-3 pb-20 md:pb-4">
            <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900">Week View</h3>
                {payload && (
                    <p className="text-xs text-gray-600">
                        {payload.weekStart} - {payload.weekEnd}
                    </p>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-800">
                    {error}
                </div>
            )}
            
            {loading && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-600 text-sm">
                    Loading week...
                </div>
            )}

            {!loading && payload && (
                <div className="space-y-3">
                    {weekDates.map((date) => {
                        const dayLabel = getDayOfWeekLabel(date)
                        const dateLabel = getDateLabel(date)
                        const bookings = bookingsByDate[date]
                        const hasBookings = bookings.length > 0

                        return (
                            <div
                                key={date}
                                className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                            >
                                {/* Day Header */}
                                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{dayLabel}</p>
                                            <p className="text-xs text-gray-600">{dateLabel}</p>
                                        </div>
                                        {hasBookings && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                {bookings.length}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bookings List */}
                                <div className="p-3 space-y-2">
                                    {!hasBookings ? (
                                        <p className="text-xs text-gray-500 text-center py-2">No bookings</p>
                                    ) : (
                                        bookings.map((booking) => {
                                            const displayStatus = toDisplayStatus(booking.status)
                                            const customerLabel = booking.customer_name || (booking.is_walk_in ? 'Walk-in' : 'Customer')
                                            const actionsDisabled =
                                                isActionPending ||
                                                isReadOnly ||
                                                displayStatus === 'completed' ||
                                                displayStatus === 'canceled'

                                            return (
                                                <div
                                                    key={booking.id}
                                                    className="border border-gray-200 rounded-lg p-3 space-y-2"
                                                >
                                                    {/* Booking Info */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-gray-600">
                                                                {formatTimeLabel(booking.start_time)} - {formatTimeLabel(booking.end_time)}
                                                            </p>
                                                            <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                                                                {booking.service_name}
                                                            </p>
                                                            <p className="text-xs text-gray-600 mt-0.5">
                                                                {customerLabel}
                                                            </p>
                                                        </div>
                                                        
                                                        {/* Status Badge */}
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                                            displayStatus === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                                                            displayStatus === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                                            displayStatus === 'no_show' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {displayStatus === 'upcoming' ? 'Upcoming' :
                                                             displayStatus === 'completed' ? 'Done' :
                                                             displayStatus === 'no_show' ? 'No Show' :
                                                             'Cancelled'}
                                                        </span>
                                                    </div>

                                                    {/* Actions */}
                                                    {!actionsDisabled && (
                                                        <div className="flex gap-1.5 pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBookingAction(booking.id, 'completed')}
                                                                className="flex-1 py-1.5 px-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
                                                            >
                                                                Done
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBookingAction(booking.id, 'no_show')}
                                                                className="flex-1 py-1.5 px-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 active:bg-red-200 transition-colors"
                                                            >
                                                                No Show
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBookingAction(booking.id, 'canceled')}
                                                                className="flex-1 py-1.5 px-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 active:bg-gray-200 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Messages */}
            {actionMessage && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-sm text-emerald-800">
                    {actionMessage}
                </div>
            )}
            {actionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-800">
                    {actionError}
                </div>
            )}
        </section>
    )
}
