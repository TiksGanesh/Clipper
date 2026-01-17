'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    seatCustomerAction,
    cancelBookingAction,
    markBookingCompletedAction,
    markBookingNoShowAction,
    createBreakAction,
} from '@/app/barber/calendar/actions'
import { useShopTerminology, type BusinessType } from '@/src/hooks/useShopTerminology'
import WeekView from './WeekView'
import AppointmentDetailSheet from './AppointmentDetailSheet'

type BarberOption = {
    id: string
    name: string
}

type BookingStatus = 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show' | 'pending_payment'

type DayBooking = {
    id: string
    start_time: string
    end_time: string
    service_name: string
    customer_name: string
    customer_phone?: string
    status: BookingStatus
    is_walk_in: boolean
    is_block?: boolean
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
    lunch_start?: string | null
    lunch_end?: string | null
}

type SlotState = {
    start: string
    end: string
    status: 'available' | 'booked'
    booking?: DayBooking
}

type ViewMode = 'day' | 'week'

const SLOT_MINUTES = 15

type BookingDisplayStatus = 'pending_payment' | 'upcoming' | 'seated' | 'completed' | 'no_show' | 'canceled'

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

function buildSlots(date: string, workingHours: WorkingHours | null, bookings: DayBooking[], lunchStart?: string | null, lunchEnd?: string | null): SlotState[] {
    if (!workingHours || workingHours.is_closed || !workingHours.open_time || !workingHours.close_time) {
        return []
    }

    const openMinutes = timeToMinutes(workingHours.open_time)
    const closeMinutes = timeToMinutes(workingHours.close_time)
    const lunchStartMinutes = timeToMinutes(lunchStart || null)
    const lunchEndMinutes = timeToMinutes(lunchEnd || null)
    
    if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
        return []
    }

    const dayStart = new Date(`${date}T00:00:00`)
    const activeBookings = bookings.filter((b) => b.status !== 'canceled')

    const slots: SlotState[] = []
    for (let minute = openMinutes; minute < closeMinutes; minute += SLOT_MINUTES) {
        const slotStart = addMinutes(dayStart, minute)
        const slotEnd = addMinutes(dayStart, Math.min(minute + SLOT_MINUTES, closeMinutes))
        
        // Check if slot overlaps with lunch break
        const isLunchTime = lunchStartMinutes !== null && lunchEndMinutes !== null && 
                            minute < lunchEndMinutes && (minute + SLOT_MINUTES) > lunchStartMinutes
        
        if (isLunchTime) {
            slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                status: 'booked',
                booking: undefined,
            })
            continue
        }
        
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
        case 'pending_payment':
            return 'pending_payment'
        case 'seated':
            return 'seated'
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

function bookingStyle(status: BookingDisplayStatus, isBlock?: boolean) {
    const map: Record<BookingDisplayStatus, { bg: string; border: string; text: string; label: string }> = {
        pending_payment: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: 'Payment Pending' },
        upcoming: { bg: '#e0f2fe', border: '#60a5fa', text: '#0f172a', label: 'Upcoming' },
        seated: { bg: '#dcfce7', border: '#22c55e', text: '#14532d', label: 'In Chair' },
        completed: { bg: '#f3f4f6', border: '#d1d5db', text: '#374151', label: 'Completed' },
        no_show: { bg: '#fef9c3', border: '#facc15', text: '#854d0e', label: 'No Show' },
        canceled: { bg: '#fee2e2', border: '#f87171', text: '#7f1d1d', label: 'Cancelled' },
    }
    if (isBlock) {
        return { bg: '#e5e7eb', border: '#9ca3af', text: '#6b7280', label: 'Break' }
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
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isBarberPickerOpen, setIsBarberPickerOpen] = useState(false)
    const [createType, setCreateType] = useState<'client' | 'break'>('client')
    const [businessType, setBusinessType] = useState<BusinessType>('barber')
    const [terminologyOverrides, setTerminologyOverrides] = useState(null)
    const terms = useShopTerminology(businessType, terminologyOverrides)

    // Fetch shop business type and terminology on mount
    useEffect(() => {
        const fetchShopInfo = async () => {
            try {
                const res = await fetch('/api/shop/info')
                if (res.ok) {
                    const data = await res.json()
                    setBusinessType((data.business_type as BusinessType) || 'barber')
                    setTerminologyOverrides(data.terminology_overrides || null)
                }
            } catch (err) {
                console.error('Failed to fetch shop info:', err)
            }
        }
        fetchShopInfo()
    }, [])

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
        () => buildSlots(selectedDate, payload?.working_hours ?? null, payload?.bookings ?? [], payload?.lunch_start, payload?.lunch_end),
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

        // Sort bookings: pending_payment first (CRITICAL - must be visible), seated next, then confirmed by time, then completed, no_show, canceled
        const bookings = result.filter((r) => r.kind === 'booking')
        const available = result.filter((r) => r.kind === 'available')

        const statusOrder = { pending_payment: 0, seated: 1, upcoming: 2, no_show: 3, completed: 4, canceled: 5 }
        const sortedBookings = bookings.sort((a, b) => {
            const statusCmp = (statusOrder[a.displayStatus] ?? 6) - (statusOrder[b.displayStatus] ?? 6)
            if (statusCmp !== 0) return statusCmp
            // Within same status, sort by start time
            return new Date(a.start).getTime() - new Date(b.start).getTime()
        })

        return [...sortedBookings, ...available]
    }, [slots])

    const selectedSlotLabel = useMemo(() => {
        const slot = slots.find((s) => s.start === selectedSlot)
        return slot ? formatRange(slot) : ''
    }, [selectedSlot, slots])

    const handleBookingAction = (bookingId: string, status: BookingDisplayStatus | 'seated') => {
        setActionMessage('')
        setActionError('')
        setSelectedBooking(null)

        const actionMap = {
            seated: () => seatCustomerAction({ bookingId }),
            completed: () => markBookingCompletedAction({ bookingId }),
            no_show: () => markBookingNoShowAction({ bookingId }),
            canceled: () => cancelBookingAction({ bookingId }),
            upcoming: () => Promise.reject(new Error('Invalid action')),
            pending_payment: () => Promise.reject(new Error('Use Re-check or Clear Hold in the booking card')),
        }

        const action = actionMap[status]
        if (!action) {
            throw new Error('Unsupported status action')
        }

        startActionTransition(async () => {
            try {
                await action()
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

    const handleCreateClick = () => {
        if (!selectedSlot) {
            setActionError('Select a time slot first')
            return
        }
        setIsCreateOpen(true)
        setCreateType('client')
    }

    const handleCreateBreak = () => {
        setActionMessage('')
        setActionError('')
        startActionTransition(async () => {
            try {
                await createBreakAction({ barberId: selectedBarberId, startTimeIso: selectedSlot })
                setIsCreateOpen(false)
                setSelectedSlot('')
                const params = new URLSearchParams({ barber_id: selectedBarberId, date: selectedDate })
                const res = await fetch(`/api/calendar/day?${params.toString()}`)
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to refresh')
                }
                const body = await res.json()
                setPayload(body as DayPayload)
                setActionMessage('Break added')
            } catch (err: any) {
                setActionError(err.message || 'Failed to add break')
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
                    {/* Barber Selector Trigger */}
                    <div className="w-full sm:w-auto mb-6 sm:mb-0">
                        <button
                            type="button"
                            onClick={() => !isActionPending && setIsBarberPickerOpen(true)}
                            disabled={isActionPending}
                            className={`w-full bg-white border-2 border-indigo-100 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all ${isActionPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                            aria-haspopup="dialog"
                            aria-expanded={isBarberPickerOpen}
                            aria-label="Select barber"
                        >
                            <span className="text-lg font-bold text-gray-900 truncate">
                                {barbers.find(b => b.id === selectedBarberId)?.name || 'Select Barber'}
                            </span>
                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

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
                                    const customerLabel = row.booking.is_block ? 'Personal Break' : (row.booking.customer_name || (row.booking.is_walk_in ? 'Walk-in' : 'Customer'))
                                    const actionsDisabled = isActionPending || isReadOnly || row.displayStatus === 'completed' || row.displayStatus === 'canceled' || row.booking.is_block
                                    const style = bookingStyle(row.displayStatus, row.booking.is_block)
                                    
                                    return (
                                        <div
                                            key={row.booking.id + row.start}
                                            className="border rounded-xl shadow-sm"
                                            style={{ background: row.booking.is_block ? 'repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 10px, #f3f4f6 10px, #f3f4f6 20px)' : style.bg, borderColor: style.border }}
                                        >
                                            {/* Main Card Content - Always Visible */}
                                            <button
                                                type="button"
                                                onClick={() => !row.booking.is_block && setSelectedBooking(row.booking)}
                                                className="w-full text-left p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline gap-2">
                                                            <p className="text-base font-semibold text-gray-900">
                                                                {formatTimeLabel(row.start)}
                                                            </p>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.booking.is_block ? 'bg-gray-200 text-gray-700' : row.displayStatus === 'upcoming' ? 'bg-blue-100 text-blue-800' : row.displayStatus === 'seated' ? 'bg-green-100 text-green-800' : row.displayStatus === 'completed' ? 'bg-gray-100 text-gray-800' : row.displayStatus === 'no_show' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                {row.booking.is_block ? 'Break' : row.displayStatus === 'upcoming' ? 'Upcoming' : row.displayStatus === 'seated' ? 'In Chair' : row.displayStatus === 'completed' ? 'Done' : row.displayStatus === 'no_show' ? 'No Show' : 'Cancelled'}
                                                            </span>
                                                        </div>
                                                        {!row.booking.is_block && (
                                                            <p className="text-sm font-medium text-gray-900 mt-1 truncate break-words">
                                                                {row.booking.service_name}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-gray-600 mt-0.5">
                                                            {customerLabel}
                                                        </p>
                                                    </div>
                                                    {!row.booking.is_block && (
                                                    <svg 
                                                        className="w-5 h-5 text-gray-400"
                                                        fill="none" 
                                                        stroke="currentColor" 
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                    )}
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
                <div className="fixed bottom-4 left-4 right-4 md:hidden flex gap-2">
                    <button
                        type="button"
                        className="flex-1 py-3 px-4 text-base font-medium text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                        onClick={handleCreateClick}
                    >
                        + Add Walk-in
                    </button>
                    <a
                        href="/dashboard/search"
                        className="p-3 text-indigo-600 bg-white rounded-lg shadow-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                        aria-label="Search bookings"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </a>
                </div>
            )}

            {/* New Entry Creation Sheet */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30">
                    <div className="w-full md:max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold">New Entry</h2>
                            <button className="p-2" onClick={() => setIsCreateOpen(false)} aria-label="Close">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <div className="flex mb-4 rounded-lg overflow-hidden border">
                            <button className={`flex-1 py-2 text-sm ${createType==='client'?'bg-indigo-600 text-white':'bg-white'}`} onClick={() => setCreateType('client')}>Client</button>
                            <button className={`flex-1 py-2 text-sm ${createType==='break'?'bg-indigo-600 text-white':'bg-white'}`} onClick={() => setCreateType('break')}>Personal/Break</button>
                        </div>

                        {createType === 'client' ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-600">Redirect to Walk-in form for details.</p>
                                <a href={`/dashboard/walk-in?barber_id=${encodeURIComponent(selectedBarberId)}&start_time=${encodeURIComponent(selectedSlot)}&date=${encodeURIComponent(selectedDate)}`} className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md">Go to Walk-in</a>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">Blocking 30 minutes for break.</p>
                                <p className="text-xs text-gray-500">Selected: {selectedSlotLabel}</p>
                                {/* Break counter */}
                                <p className="text-xs text-gray-600">Breaks used today: {(payload?.bookings.filter(b=> (b as any).is_block).length ?? 0)}/2</p>
                                <button
                                    type="button"
                                    onClick={handleCreateBreak}
                                    disabled={isActionPending}
                                    className="w-full py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800"
                                >
                                    Add Break
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Barber Picker Sheet */}
            {isBarberPickerOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsBarberPickerOpen(false)}
                >
                    <div
                        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-xl p-2"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Select barber"
                    >
                        {barbers.map((barber, idx) => {
                            const isSelected = barber.id === selectedBarberId
                            return (
                                <button
                                    key={barber.id}
                                    type="button"
                                    className={`w-full p-5 text-left text-lg font-semibold border-b border-gray-50 last:border-0 ${isSelected ? 'bg-indigo-50' : 'bg-white'} active:bg-indigo-50 flex items-center justify-between`}
                                    onClick={() => {
                                        handleBarberChange(barber.id)
                                        setIsBarberPickerOpen(false)
                                    }}
                                >
                                    <span className="truncate text-gray-900">{barber.name}</span>
                                    {isSelected && (
                                        <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            )
                        })}
                    </div>
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
                    staffLabel={terms.staff_label}
                    customerLabel={terms.customer_label}
                    onSeatCustomer={() => handleBookingAction(selectedBooking.id, 'seated')}
                    onMarkCompleted={() => handleBookingAction(selectedBooking.id, 'completed')}
                    onMarkNoShow={() => handleBookingAction(selectedBooking.id, 'no_show')}
                    onCancel={() => handleBookingAction(selectedBooking.id, 'canceled')}
                />
            )}
        </div>
    )
}
