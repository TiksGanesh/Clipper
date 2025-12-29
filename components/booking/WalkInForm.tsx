'use client'

import { useEffect, useMemo, useState } from 'react'

type Barber = {
    id: string
    name: string
}

type Service = {
    id: string
    name: string
    duration_minutes: number
    price: number
}

type Slot = {
    start: string
    end: string
}

type Props = {
    shopId: string
    barbers: Barber[]
    services: Service[]
    onSuccess?: (bookingId: string) => void
}

export default function WalkInForm({ shopId, barbers, services, onSuccess }: Props) {
    const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
    const [serviceIds, setServiceIds] = useState<string[]>(services[0]?.id ? [services[0].id] : [])
    const [autoSlot, setAutoSlot] = useState<Slot | null>(null)
    const [alternativeSlots, setAlternativeSlots] = useState<Slot[]>([])
    const [showAlternatives, setShowAlternatives] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [success, setSuccess] = useState<string>('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Get browser timezone offset in minutes (negative for ahead of UTC)
    const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])

    const totalDuration = useMemo(
        () =>
            services
                .filter((s) => serviceIds.includes(s.id))
                .reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
        [services, serviceIds]
    )

    // Auto-fetch slots when barber/services change
    useEffect(() => {
        if (!barberId || serviceIds.length === 0) {
            setAutoSlot(null)
            setAlternativeSlots([])
            setSelectedSlot(null)
            setShowAlternatives(false)
            return
        }

        const controller = new AbortController()
        const fetchSlots = async () => {
            setSlotsLoading(true)
            setError('')
            try {
                // Use today's date for walk-in
                const today = new Date().toISOString().slice(0, 10)
                const params = new URLSearchParams({
                    barber_id: barberId,
                    date: today,
                    service_ids: serviceIds.join(','),
                    timezone_offset: String(timezoneOffset),
                })
                const res = await fetch(`/api/slots?${params.toString()}`, { signal: controller.signal })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to load slots')
                }
                const body = await res.json()
                const slots = body.slots ?? []

                if (slots.length === 0) {
                    setError('No available slots for this barber today')
                    setAutoSlot(null)
                    setAlternativeSlots([])
                    setSelectedSlot(null)
                    return
                }

                // Auto-select first slot, show next 2 as alternatives
                setAutoSlot(slots[0])
                setSelectedSlot(slots[0])
                setAlternativeSlots(slots.slice(1, 3))
            } catch (err: any) {
                if (err.name === 'AbortError') return
                setAutoSlot(null)
                setAlternativeSlots([])
                setSelectedSlot(null)
                setError(err.message)
            } finally {
                setSlotsLoading(false)
            }
        }

        fetchSlots()
        return () => controller.abort()
    }, [barberId, serviceIds, timezoneOffset])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!barberId || serviceIds.length === 0 || !selectedSlot) {
            setError('Please select a barber and services. Slot is auto-assigned.')
            return
        }
        setSubmitting(true)
        setError('')
        setSuccess('')
        try {
            const res = await fetch('/api/walk-ins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barber_id: barberId,
                    service_ids: serviceIds,
                    customer_name: customerName.trim() || undefined,
                    customer_phone: customerPhone.trim() || undefined,
                    timezone_offset: timezoneOffset,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(body.error || 'Walk-in creation failed')
            }
            setSuccess(`Walk-in created! Booking ID: ${body.booking_id}`)
            // Reset form
            setBarberId(barbers[0]?.id ?? '')
            setServiceIds(services[0]?.id ? [services[0].id] : [])
            setCustomerName('')
            setCustomerPhone('')
            setAutoSlot(null)
            setSelectedSlot(null)
            setShowAlternatives(false)
            if (onSuccess) {
                onSuccess(body.booking_id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const formatSlot = (iso: string) => {
        const d = new Date(iso)
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
        return timeStr
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Barber *</span>
                    <select
                        className="w-full border rounded px-3 py-2"
                        value={barberId}
                        onChange={(e) => setBarberId(e.target.value)}
                    >
                        <option value="">Select a barber</option>
                        {barbers.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Services *</span>
                    <select
                        className="w-full border rounded px-3 py-2"
                        multiple
                        value={serviceIds}
                        onChange={(e) => {
                            const opts = Array.from(e.currentTarget.selectedOptions).map((o) => o.value)
                            setServiceIds(opts)
                        }}
                    >
                        {services.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.duration_minutes} mins)
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500">Hold Ctrl/Cmd to select multiple</p>
                </label>
            </div>

            {/* Auto-assigned slot display */}
            <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Assigned Slot</span>
                {slotsLoading && <p className="text-sm text-blue-600">Loading available slots...</p>}
                {!slotsLoading && autoSlot && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm font-semibold text-blue-900">
                            {formatSlot(autoSlot.start)} - {formatSlot(autoSlot.end)}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">Next available slot (auto-assigned)</p>
                    </div>
                )}
                {!slotsLoading && !autoSlot && error && <p className="text-sm text-red-600">{error}</p>}

                {/* Alternative slots toggle */}
                {!slotsLoading && alternativeSlots.length > 0 && (
                    <div className="mt-3">
                        <button
                            type="button"
                            className="text-sm text-blue-600 hover:underline"
                            onClick={() => setShowAlternatives(!showAlternatives)}
                        >
                            {showAlternatives ? 'Hide alternatives' : 'Pick different time'}
                        </button>
                        {showAlternatives && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {alternativeSlots.map((slot) => (
                                    <button
                                        key={slot.start}
                                        type="button"
                                        className={`px-3 py-2 rounded border text-sm ${
                                            selectedSlot?.start === slot.start
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-800 hover:bg-gray-50'
                                        }`}
                                        onClick={() => setSelectedSlot(slot)}
                                    >
                                        {formatSlot(slot.start)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Optional customer info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Customer Name (optional)</span>
                    <input
                        type="text"
                        className="w-full border rounded px-3 py-2"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Defaults to 'Walk In'"
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                    <input
                        type="tel"
                        className="w-full border rounded px-3 py-2"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Customer phone"
                    />
                </label>
            </div>

            {error && !autoSlot && <p className="text-sm text-red-600 font-medium">{error}</p>}
            {success && <p className="text-sm text-green-600 font-medium">{success}</p>}

            <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">Estimated duration: {totalDuration} mins</div>
                <button
                    type="submit"
                    disabled={submitting || !selectedSlot || serviceIds.length === 0}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60 hover:bg-green-700"
                >
                    {submitting ? 'Creating Walk-In...' : 'Create Walk-In'}
                </button>
            </div>
        </form>
    )
}
