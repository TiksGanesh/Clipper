'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    cancelBookingAction,
    markBookingCompletedAction,
    markBookingNoShowAction,
} from '@/app/barber/calendar/actions'
import WeekView from './WeekView'
import AppointmentDetailSheet from './AppointmentDetailSheet'

type BarberOption = {
    id: string
    name: string
}

type BookingStatus = 'confirmed' | 'completed' | 'canceled' | 'no_show'

type DayBooking = {
    id: string
    start_time: string
    end_time: string
    service_name: string
    customer_name: string
    customer_phone?: string
    status: BookingStatus
    is_walk_in: boolean
}

type WorkingHours = {
    open_time: string | null
    close_time: string | null
    is_closed: boolean | null
    day_of_week?: number | null
}

type DayPayload = {
    working_hours: WorkingHours | null
    bookings: DayBooking[]
}

type SlotState = {
    start: string
    end: string
    status: 'available' | 'booked'
    booking?: DayBooking
}

type ViewMode = 'day' | 'week'

const SLOT_MINUTES = 15

type BookingDisplayStatus = 'upcoming' | 'completed' | 'no_show' | 'canceled'

function timeToMinutes(time: string | null) {
    if (!time) return null
    const [h, m, s] = time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    const minutes = h * 60 + m + Math.floor((s || 0) / 60)
    return minutes
}

function addMinutes(base: Date, minutes: number) {
    const next = new Date(base)
    next.setMinutes(next.getMinutes() + minutes)
    return next
}

function overlaps(slotStart: Date, slotEnd: Date, booking: DayBooking) {
    const bookingStart = new Date(booking.start_time)
    const bookingEnd = new Date(booking.end_time)
    return slotStart < bookingEnd && slotEnd > bookingStart
}

function buildSlots(date: string, workingHours: WorkingHours | null, bookings: DayBooking[]): SlotState[] {
    if (!workingHours || workingHours.is_closed || !workingHours.open_time || !workingHours.close_time) {
        return []
    }

    const openMinutes = timeToMinutes(workingHours.open_time)
    const closeMinutes = timeToMinutes(workingHours.close_time)
    if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
        return []
    }

    const dayStart = new Date(`${date}T00:00:00`)
    const activeBookings = bookings.filter((b) => b.status !== 'canceled')

    const slots: SlotState[] = []
    for (let minute = openMinutes; minute < closeMinutes; minute += SLOT_MINUTES) {
        const slotStart = addMinutes(dayStart, minute)
        const slotEnd = addMinutes(dayStart, Math.min(minute + SLOT_MINUTES, closeMinutes))
        const blockingBooking = activeBookings.find((booking) => overlaps(slotStart, slotEnd, booking))
        slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            status: blockingBooking ? 'booked' : 'available',
            booking: blockingBooking,
        })
    }

    return slots
}

function formatTimeLabel(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatRange(range: { start: string; end: string }) {
    return `${formatTimeLabel(range.start)} - ${formatTimeLabel(range.end)}`
}

function toDisplayStatus(status: BookingStatus): BookingDisplayStatus {
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

type Props = {
    barbers: BarberOption[]
    initialDate: string
    initialBarberId?: string | null
    isReadOnly?: boolean
}

export default function DayView({ barbers, initialDate, initialBarberId, isReadOnly }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [selectedBarberId, setSelectedBarberId] = useState(() => {
        const candidate = initialBarberId && barbers.some((b) => b.id === initialBarberId)
            ? initialBarberId
            : barbers[0]?.id ?? ''
        return candidate
    })
    const [selectedDate, setSelectedDate] = useState(initialDate)
    const [viewMode, setViewMode] = useState<ViewMode>('day')
    const [payload, setPayload] = useState<DayPayload | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [selectedSlot, setSelectedSlot] = useState<string>('')
    const [selectedBooking, setSelectedBooking] = useState<DayBooking | null>(null)
    const [slotMessage, setSlotMessage] = useState<string>('')
    const [actionMessage, setActionMessage] = useState<string>('')
    const [actionError, setActionError] = useState<string>('')
    const [isActionPending, startActionTransition] = useTransition()

    useEffect(() => {
        const param = searchParams.get('barber')
        if (!param) return
        if (param === selectedBarberId) return
        if (barbers.some((b) => b.id === param)) {
            setSelectedBarberId(param)
        }
    }, [searchParams, barbers, selectedBarberId])

    const handleBarberChange = (id: string) => {
        setSelectedBarberId(id)
        const params = new URLSearchParams(searchParams.toString())
        params.set('barber', id)
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
    }

    useEffect(() => {
        if (viewMode !== 'day' || !selectedBarberId || !selectedDate) {
            return
        }

        const controller = new AbortController()
        const fetchDay = async () => {
            setLoading(true)
            setError('')
            setSelectedSlot('')
            try {
                const params = new URLSearchParams({ barber_id: selectedBarberId, date: selectedDate })
                const res = await fetch(`/api/calendar/day?${params.toString()}`, { signal: controller.signal })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to load day view')
                }
                const body = await res.json()
                setPayload(body as DayPayload)
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

        fetchDay()
        return () => controller.abort()
    }, [selectedBarberId, selectedDate, viewMode])

    const slots = useMemo(
        () => buildSlots(selectedDate, payload?.working_hours ?? null, payload?.bookings ?? []),
        [selectedDate, payload]
    )

    const rows = useMemo(() => {
        const result: Array<
            | { kind: 'booking'; start: string; end: string; booking: DayBooking; displayStatus: BookingDisplayStatus }
            | { kind: 'available'; start: string; end: string }
        > = []

        let i = 0
        while (i < slots.length) {
            const slot = slots[i]
            if (slot.status === 'booked' && slot.booking) {
                let j = i + 1
                while (j < slots.length && slots[j].booking?.id === slot.booking?.id) {
                    j += 1
                }
                const end = slots[j - 1].end
                result.push({
                    kind: 'booking',
                    start: slot.start,
                    end,
                    booking: slot.booking,
                    displayStatus: toDisplayStatus(slot.booking.status),
                })
                i = j
            } else {
                result.push({ kind: 'available', start: slot.start, end: slot.end })
                i += 1
            }
        }

        return result
    }, [slots])

    const selectedSlotLabel = useMemo(() => {
        const slot = slots.find((s) => s.start === selectedSlot)
        return slot ? formatRange(slot) : ''
    }, [selectedSlot, slots])

    const handleBookingAction = (bookingId: string, status: BookingDisplayStatus) => {
        setActionMessage('')
        setActionError('')
        setSelectedBooking(null)

        const action = status === 'completed'
            ? markBookingCompletedAction
            : status === 'no_show'
                ? markBookingNoShowAction
                : cancelBookingAction

        startActionTransition(async () => {
            try {
                await action({ bookingId })
                setActionMessage('Booking updated')
                setSelectedSlot('')
                const params = new URLSearchParams({ barber_id: selectedBarberId, date: selectedDate })
                const res = await fetch(`/api/calendar/day?${params.toString()}`)
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to refresh')
                }
                const body = await res.json()
                setPayload(body as DayPayload)
            } catch (err: any) {
                setActionError(err.message || 'Failed to update booking')
            }
        })
    }

    const dayClosed = payload && (!payload.working_hours || payload.working_hours.is_closed || !payload.working_hours.open_time || !payload.working_hours.close_time)

    const handleTodayClick = () => {
        const today = new Date().toISOString().split('T')[0]
        setSelectedDate(today)
    }

    const handlePrevDay = () => {
        const current = new Date(selectedDate + 'T00:00:00')
        const prev = new Date(current)
        prev.setDate(prev.getDate() - 1)
        const dateStr = prev.toISOString().split('T')[0]
        setSelectedDate(dateStr)
    }

    const handleNextDay = () => {
        const current = new Date(selectedDate + 'T00:00:00')
        const next = new Date(current)
        next.setDate(next.getDate() + 1)
        const dateStr = next.toISOString().split('T')[0]
        setSelectedDate(dateStr)
    }

    const minDate = (() => {
        const min = new Date()
        min.setDate(min.getDate() - 7)
        return min.toISOString().split('T')[0]
    })()

    const maxDate = (() => {
        const max = new Date()
        max.setDate(max.getDate() + 30)
        return max.toISOString().split('T')[0]
    })()

    return (
        <div className="space-y-4">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Barber Selector */}
                    <select
                        value={selectedBarberId}
                        onChange={(e) => handleBarberChange(e.target.value)}
                        disabled={isActionPending}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    >
                        {barbers.map((barber) => (
                            <option key={barber.id} value={barber.id}>
                                {barber.name}
                            </option>
                        ))}
                    </select>

                    {/* Today Button */}
                    <button
                        type="button"
                        onClick={handleTodayClick}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 w-full">
                <button
                    type="button"
                    onClick={() => setViewMode('day')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                        viewMode === 'day'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    Today
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode('week')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                        viewMode === 'week'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    Week
                </button>
            </div>

            {/* Date Navigation (Day View Only) */}
            {viewMode === 'day' && (
                <div className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg p-3">
                    <button
                        type="button"
                        onClick={handlePrevDay}
                        disabled={isActionPending}
                        className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        disabled={isActionPending}
                        min={minDate}
                        max={maxDate}
                        className="flex-1 text-center px-3 py-1 border-0 focus:outline-none text-sm font-medium text-gray-900"
                    />
                    
                    <button
                        type="button"
                        onClick={handleNextDay}
                        disabled={isActionPending}
                        className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Week View */}
            {viewMode === 'week' && (
                <WeekView
                    selectedBarberId={selectedBarberId}
                    selectedDate={selectedDate}
                    isActionPending={isActionPending}
                    isReadOnly={isReadOnly}
                />
            )}

            {/* Day View */}
            {viewMode === 'day' && (
                <div className="space-y-2 pb-20 md:pb-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-800">
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-600 text-sm">
                            Loading...
                        </div>
                    )}

                    {!loading && dayClosed && (
                        <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-center text-gray-700 text-sm">
                            Shop closed today
                        </div>
                    )}

                    {!loading && !dayClosed && rows.length === 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-600 text-sm">
                            No appointments
                        </div>
                    )}

                    {!loading && !dayClosed && rows.length > 0 && (
                        <div className="space-y-2">
                            {rows.map((row) => {
                                if (row.kind === 'booking') {
                                    const customerLabel = row.booking.customer_name || (row.booking.is_walk_in ? 'Walk-in' : 'Customer')
                                    const actionsDisabled = isActionPending || isReadOnly || row.displayStatus === 'completed' || row.displayStatus === 'canceled'
                                    const isExpanded = selectedSlot === row.booking.id
                                    
                                    return (
                                        <div
                                            key={row.booking.id + row.start}
                                            className="bg-white border border-gray-200 rounded-xl shadow-sm"
                                        >
                                            {/* Main Card Content - Always Visible */}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBooking(row.booking)}
                                                className="w-full text-left p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline gap-2">
                                                            <p className="text-base font-semibold text-gray-900">
                                                                {formatTimeLabel(row.start)}
                                                            </p>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                                row.displayStatus === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                                                                row.displayStatus === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                                                row.displayStatus === 'no_show' ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {row.displayStatus === 'upcoming' ? 'Upcoming' :
                                                                 row.displayStatus === 'completed' ? 'Done' :
                                                                 row.displayStatus === 'no_show' ? 'No Show' :
                                                                 'Cancelled'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium text-gray-900 mt-1 truncate break-words">
                                                            {row.booking.service_name}
                                                        </p>
                                                        <p className="text-xs text-gray-600 mt-0.5">
                                                            {customerLabel}
                                                        </p>
                                                    </div>
                                                    <svg 
                                                        className="w-5 h-5 text-gray-400"
                                                        fill="none" 
                                                        stroke="currentColor" 
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        </div>
                                    )
                                }

                                // Skip most available slots to reduce clutter - show only every 4th slot
                                const slotMinute = new Date(row.start).getMinutes()
                                if (slotMinute % 60 !== 0) return null

                                const selected = selectedSlot === row.start
                                return (
                                    <button
                                        key={row.start}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSlot(row.start)
                                            setSlotMessage(`Add walk-in for ${formatRange(row)}`)
                                        }}
                                        className={`w-full text-left px-3 py-1.5 rounded-lg border transition-colors ${
                                            selected
                                                ? 'border-indigo-300 bg-indigo-50'
                                                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className="text-xs text-gray-500">
                                            {formatTimeLabel(row.start)}
                                        </span>
                                    </button>
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
                </div>
            )}

            {/* Sticky Add Walk-in Button (Mobile) */}
            {viewMode === 'day' && !loading && !dayClosed && (
                <div className="fixed bottom-4 left-4 right-4 md:hidden">
                    <button
                        type="button"
                        className="w-full py-3 px-4 text-base font-medium text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    >
                        + Add Walk-in
                    </button>
                </div>
            )}

            {/* Appointment Detail Bottom Sheet */}
            {selectedBooking && (
                <AppointmentDetailSheet
                    isOpen={!!selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    serviceName={selectedBooking.service_name}
                    appointmentTime={formatTimeLabel(selectedBooking.start_time)}
                    status={selectedBooking.status}
                    customerName={selectedBooking.customer_name || 'Walk-in'}
                    customerPhone={selectedBooking.customer_phone}
                    barberName={barbers.find(b => b.id === selectedBarberId)?.name || 'Barber'}
                    dateTime={new Date(selectedBooking.start_time).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    })}
                    duration={Math.round((new Date(selectedBooking.end_time).getTime() - new Date(selectedBooking.start_time).getTime()) / 60000)}
                    isWalkIn={selectedBooking.is_walk_in}
                    onMarkCompleted={() => handleBookingAction(selectedBooking.id, 'completed')}
                    onMarkNoShow={() => handleBookingAction(selectedBooking.id, 'no_show')}
                    onCancel={() => handleBookingAction(selectedBooking.id, 'canceled')}
                />
            )}
        </div>
    )
}
