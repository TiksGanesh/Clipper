'use client'

import { useEffect, useMemo, useState } from 'react'

type Shop = {
    id: string
    name: string
    address: string | null
    phone: string | null
}

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
    shop: Shop
    barbers: Barber[]
    services: Service[]
}

export default function BookingForm({ shop, barbers, services }: Props) {
    const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
    const [serviceIds, setServiceIds] = useState<string[]>(services[0]?.id ? [services[0].id] : [])
    const [date, setDate] = useState('')
    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedSlot, setSelectedSlot] = useState<string>('')
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [success, setSuccess] = useState<string>('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Get browser timezone offset in minutes (negative for ahead of UTC)
    const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])

    const totalDuration = useMemo(() =>
        services.filter((s) => serviceIds.includes(s.id)).reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
        [services, serviceIds]
    )
    const maxDateStr = useMemo(() => {
        const today = new Date()
        const plus1 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        return plus1.toISOString().slice(0, 10)
    }, [])

    useEffect(() => {
        setSelectedSlot('')
        if (!barberId || serviceIds.length === 0 || !date) {
            setSlots([])
            return
        }

        const controller = new AbortController()
        const fetchSlots = async () => {
            setSlotsLoading(true)
            setError('')
            try {
                const params = new URLSearchParams({
                    barber_id: barberId,
                    date,
                    service_ids: serviceIds.join(','),
                    timezone_offset: String(timezoneOffset),
                })
                const res = await fetch(`/api/slots?${params.toString()}`, { signal: controller.signal })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'Failed to load slots')
                }
                const body = await res.json()
                setSlots(body.slots ?? [])
            } catch (err: any) {
                if (err.name === 'AbortError') return
                setSlots([])
                setError(err.message)
            } finally {
                setSlotsLoading(false)
            }
        }

        fetchSlots()
        return () => controller.abort()
    }, [barberId, serviceIds, date, timezoneOffset])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!barberId || serviceIds.length === 0 || !selectedSlot || !customerName || !customerPhone || !date) {
            setError('Please complete all fields')
            return
        }
        setSubmitting(true)
        setError('')
        setSuccess('')
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barber_id: barberId,
                    service_ids: serviceIds,
                    slot_start: selectedSlot,
                    customer_name: customerName.trim(),
                    customer_phone: customerPhone.trim(),
                    date,
                    timezone_offset: timezoneOffset,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(body.error || 'Booking failed')
            }
            setSuccess('Booking confirmed!')
            setSlots([])
            setSelectedSlot('')
            setCustomerName('')
            setCustomerPhone('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const formatSlot = (iso: string) => {
        const d = new Date(iso)
        // Display in local timezone with indication it's UTC-based
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
        return timeStr
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Barber</span>
                    <select
                        className="w-full border rounded px-3 py-2"
                        value={barberId}
                        onChange={(e) => setBarberId(e.target.value)}
                    >
                        {barbers.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Services</span>
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
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Date</span>
                    <input
                        type="date"
                        className="w-full border rounded px-3 py-2"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        max={maxDateStr}
                    />
                </label>
                <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Available Slots</span>
                    <div className="flex flex-wrap gap-2">
                        {slotsLoading && <span className="text-sm text-gray-500">Loading...</span>}
                        {!slotsLoading && slots.length === 0 && date && <span className="text-sm text-gray-500">No slots</span>}
                        {!slotsLoading && slots.map((slot) => (
                            <button
                                key={slot.start}
                                type="button"
                                className={`px-3 py-2 rounded border text-sm ${
                                    selectedSlot === slot.start ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                                }`}
                                onClick={() => setSelectedSlot(slot.start)}
                            >
                                {formatSlot(slot.start)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Your Name</span>
                    <input
                        type="text"
                        className="w-full border rounded px-3 py-2"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Alex Doe"
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Phone</span>
                    <input
                        type="tel"
                        className="w-full border rounded px-3 py-2"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">Estimated time: {totalDuration} mins</div>
                <button
                    type="submit"
                    disabled={submitting || !selectedSlot || serviceIds.length === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
                >
                    {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
            </div>
        </form>
    )
}
