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
        <section
            aria-label="Week view"
            style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600 }}>Week View</div>
                <div style={{ fontSize: '12px', color: '#555' }}>
                    {payload?.weekStart} to {payload?.weekEnd}
                </div>
            </div>

            {error && <div style={{ color: '#b00020', fontSize: '14px' }}>{error}</div>}
            {loading && <div style={{ fontSize: '14px' }}>Loading week view...</div>}

            {!loading && payload && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: '8px',
                    }}
                >
                    {weekDates.map((date, index) => {
                        const dayLabel = getDayOfWeekLabel(date)
                        const dateLabel = getDateLabel(date)
                        const bookings = bookingsByDate[date]

                        return (
                            <div
                                key={date}
                                style={{
                                    border: '1px solid #e5e5e5',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    backgroundColor: '#fafafa',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    minHeight: '200px',
                                }}
                            >
                                <div style={{ fontWeight: 600, fontSize: '14px', textAlign: 'center' }}>
                                    {dayLabel}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                                    {dateLabel}
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        flex: 1,
                                    }}
                                >
                                    {bookings.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: '#999', padding: '8px', textAlign: 'center' }}>
                                            No bookings
                                        </div>
                                    ) : (
                                        bookings.map((booking) => {
                                            const displayStatus = toDisplayStatus(booking.status)
                                            const style = bookingStyle(displayStatus)
                                            const customerLabel = booking.customer_name || (booking.is_walk_in ? 'Walk-in' : 'Customer')
                                            const actionsDisabled =
                                                isActionPending ||
                                                isReadOnly ||
                                                displayStatus === 'completed' ||
                                                displayStatus === 'canceled'

                                            return (
                                                <div
                                                    key={booking.id}
                                                    style={{
                                                        padding: '10px',
                                                        border: `1px solid ${style.border}`,
                                                        borderRadius: '6px',
                                                        backgroundColor: style.bg,
                                                        color: style.text,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '6px',
                                                        fontSize: '12px',
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 600 }}>{booking.service_name}</div>
                                                    <div>{customerLabel}</div>
                                                    <div style={{ fontSize: '11px' }}>
                                                        {formatTimeLabel(booking.start_time)} - {formatTimeLabel(booking.end_time)}
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: 500 }}>{style.label}</div>

                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: '4px',
                                                            marginTop: '4px',
                                                            flexWrap: 'wrap',
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={actionsDisabled}
                                                            onClick={() => handleBookingAction(booking.id, 'completed')}
                                                            style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #22c55e',
                                                                backgroundColor: '#ecfdf3',
                                                                color: '#166534',
                                                                cursor: 'pointer',
                                                                fontSize: '11px',
                                                                flex: 1,
                                                                minWidth: '60px',
                                                            }}
                                                        >
                                                            Done
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionsDisabled}
                                                            onClick={() => handleBookingAction(booking.id, 'no_show')}
                                                            style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #facc15',
                                                                backgroundColor: '#fefce8',
                                                                color: '#854d0e',
                                                                cursor: 'pointer',
                                                                fontSize: '11px',
                                                                flex: 1,
                                                                minWidth: '60px',
                                                            }}
                                                        >
                                                            No Show
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionsDisabled}
                                                            onClick={() => handleBookingAction(booking.id, 'canceled')}
                                                            style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #f87171',
                                                                backgroundColor: '#fef2f2',
                                                                color: '#7f1d1d',
                                                                cursor: 'pointer',
                                                                fontSize: '11px',
                                                                flex: 1,
                                                                minWidth: '60px',
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
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

            {(actionMessage || actionError) && (
                <div
                    style={{
                        fontSize: '13px',
                        color: actionError ? '#991b1b' : '#065f46',
                        backgroundColor: actionError ? '#fee2e2' : '#d1fae5',
                        border: '1px solid',
                        borderColor: actionError ? '#fca5a5' : '#34d399',
                        borderRadius: '6px',
                        padding: '8px 10px',
                    }}
                >
                    {actionError || actionMessage}
                </div>
            )}
        </section>
    )
}
