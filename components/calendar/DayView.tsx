'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    cancelBookingAction,
    markBookingCompletedAction,
    markBookingNoShowAction,
} from '@/app/barber/calendar/actions'
import WeekView from './WeekView'

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <header
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <label htmlFor="date-selector">Date</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handlePrevDay}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #ccc',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                borderRadius: '4px',
                            }}
                        >
                            ← Prev
                        </button>
                        <input
                            id="date-selector"
                            type="date"
                            disabled={isActionPending}
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            min={minDate}
                            max={maxDate}
                            style={{ width: 'auto' }}
                        />
                        <button
                            type="button"
                            onClick={handleNextDay}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #ccc',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                borderRadius: '4px',
                            }}
                        >
                            Next →
                        </button>
                        <button
                            type="button"
                            onClick={handleTodayClick}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #4f46e5',
                                backgroundColor: '#eef2ff',
                                color: '#4f46e5',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontWeight: 600,
                            }}
                        >
                            Today
                        </button>
                    </div>

                    <label htmlFor="barber-selector">Barber</label>
                    <select
                        id="barber-selector"
                        disabled={isActionPending}
                        value={selectedBarberId}
                        onChange={(event) => handleBarberChange(event.target.value)}
                    >
                        {barbers.map((barber) => (
                            <option key={barber.id} value={barber.id}>
                                {barber.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'inline-flex', gap: '8px' }}>
                    <button
                        type="button"
                        aria-pressed={viewMode === 'day'}
                        onClick={() => setViewMode('day')}
                        style={{
                            padding: '8px 12px',
                            border: '1px solid #ccc',
                            backgroundColor: viewMode === 'day' ? '#f1f1f1' : '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        Day
                    </button>
                    <button
                        type="button"
                        aria-pressed={viewMode === 'week'}
                        onClick={() => setViewMode('week')}
                        style={{
                            padding: '8px 12px',
                            border: '1px solid #ccc',
                            backgroundColor: viewMode === 'week' ? '#f1f1f1' : '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        Week
                    </button>
                </div>
            </header>

            {viewMode === 'week' && (
                <WeekView
                    selectedBarberId={selectedBarberId}
                    selectedDate={selectedDate}
                    isActionPending={isActionPending}
                    isReadOnly={isReadOnly}
                />
            )}

            {viewMode === 'day' && (
                <section
                    aria-label="Day view timeline"
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
                        <div style={{ fontWeight: 600 }}>Day View (15-minute grid)</div>
                        <div style={{ fontSize: '12px', color: '#555' }}>Times shown in your local time</div>
                    </div>

                    {error && <div style={{ color: '#b00020', fontSize: '14px' }}>{error}</div>}
                    {loading && <div style={{ fontSize: '14px' }}>Loading timeline...</div>}

                    {!loading && dayClosed && (
                        <div style={{ padding: '12px', backgroundColor: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: '6px' }}>
                            Closed or hours not set for this day.
                        </div>
                    )}

                    {!loading && !dayClosed && rows.length === 0 && (
                        <div style={{ padding: '12px', backgroundColor: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: '6px' }}>
                            No slots available.
                        </div>
                    )}

                    {!loading && !dayClosed && rows.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderTop: '1px solid #eee' }}>
                            {rows.map((row) => {
                                const isHourMark = new Date(row.start).getMinutes() === 0

                                if (row.kind === 'booking') {
                                    const style = bookingStyle(row.displayStatus)
                                    const customerLabel = row.booking.customer_name || (row.booking.is_walk_in ? 'Walk-in' : 'Customer')
                                    const actionsDisabled = isActionPending || isReadOnly || row.displayStatus === 'completed' || row.displayStatus === 'canceled'
                                    return (
                                        <div key={row.booking.id + row.start} style={{ display: 'contents' }}>
                                            <div
                                                style={{
                                                    padding: '6px 8px',
                                                    borderBottom: '1px solid #f3f3f3',
                                                    fontSize: '12px',
                                                    color: isHourMark ? '#333' : '#aaa',
                                                }}
                                            >
                                                {isHourMark ? formatTimeLabel(row.start) : ''}
                                            </div>
                                            <div
                                                style={{
                                                    padding: '10px 12px',
                                                    margin: '4px 8px 4px 0',
                                                    border: `1px solid ${style.border}`,
                                                    borderRadius: '8px',
                                                    backgroundColor: style.bg,
                                                    color: style.text,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '13px' }}>{row.booking.service_name}</div>
                                                <div style={{ fontSize: '12px' }}>{customerLabel}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                                    <span>{formatTimeLabel(row.start)} - {formatTimeLabel(row.end)}</span>
                                                    <span style={{ fontWeight: 600 }}>{style.label}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                                    <button
                                                        type="button"
                                                        disabled={actionsDisabled}
                                                        onClick={() => handleBookingAction(row.booking.id, 'completed')}
                                                        style={{
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #22c55e',
                                                            backgroundColor: '#ecfdf3',
                                                            color: '#166534',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Mark Completed
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={actionsDisabled}
                                                        onClick={() => handleBookingAction(row.booking.id, 'no_show')}
                                                        style={{
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #facc15',
                                                            backgroundColor: '#fefce8',
                                                            color: '#854d0e',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Mark No-show
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={actionsDisabled}
                                                        onClick={() => handleBookingAction(row.booking.id, 'canceled')}
                                                        style={{
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #f87171',
                                                            backgroundColor: '#fef2f2',
                                                            color: '#7f1d1d',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Cancel Booking
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                const selected = selectedSlot === row.start
                                return (
                                    <div key={row.start} style={{ display: 'contents' }}>
                                        <div
                                            style={{
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #f3f3f3',
                                                fontSize: '12px',
                                                color: isHourMark ? '#333' : '#aaa',
                                            }}
                                        >
                                            {isHourMark ? formatTimeLabel(row.start) : ''}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedSlot(row.start)
                                                setSlotMessage(`Add Booking modal placeholder for ${formatRange(row)}`)
                                            }}
                                            style={{
                                                textAlign: 'left',
                                                padding: '8px 10px',
                                                border: `1px solid ${selected ? '#60a5fa' : '#d8d8d8'}`,
                                                borderRadius: '6px',
                                                margin: '4px 8px 4px 0',
                                                backgroundColor: selected ? '#e0f2fe' : '#fff',
                                                color: '#222',
                                                cursor: 'pointer',
                                                minHeight: '32px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                            }}
                                        >
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                                {formatRange(row)}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#4a5568' }}>Available</span>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {selectedSlotLabel && (
                        <div style={{ fontSize: '14px', color: '#0f5132', backgroundColor: '#d1e7dd', border: '1px solid #badbcc', borderRadius: '6px', padding: '8px 10px' }}>
                            Selected slot: {selectedSlotLabel}
                        </div>
                    )}
                    {slotMessage && (
                        <div style={{ fontSize: '14px', color: '#1f2937', backgroundColor: '#e5e7eb', border: '1px dashed #9ca3af', borderRadius: '6px', padding: '8px 10px' }}>
                            {slotMessage}
                        </div>
                    )}
                    {(actionMessage || actionError) && (
                        <div style={{ fontSize: '13px', color: actionError ? '#991b1b' : '#065f46', backgroundColor: actionError ? '#fee2e2' : '#d1fae5', border: '1px solid', borderColor: actionError ? '#fca5a5' : '#34d399', borderRadius: '6px', padding: '8px 10px' }}>
                            {actionError || actionMessage}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}
