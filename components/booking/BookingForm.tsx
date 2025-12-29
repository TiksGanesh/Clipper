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
    advance_amount?: number
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
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
    const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
    const [serviceIds, setServiceIds] = useState<string[]>([])
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

    const selectedServices = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds])
    const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0), [selectedServices])
    const selectedServiceName = useMemo(() => selectedServices.map((s) => s.name).join(' + '), [selectedServices])

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
        
        // Detailed validation with clear error messages
        if (!barberId) {
            setError('Please select a barber')
            return
        }
        if (serviceIds.length === 0) {
            setError('Please select at least one service')
            return
        }
        if (!date) {
            setError('Please select a date')
            return
        }
        if (!selectedSlot) {
            setError('Please select a time slot')
            return
        }
        if (!customerName.trim()) {
            setError('Please enter your name')
            return
        }
        if (!customerPhone.trim()) {
            setError('Please enter your phone number')
            return
        }

        setSubmitting(true)
        setError('')
        setSuccess('')

        try {
            console.log('Booking submission - no advance payment; creating booking')
            await createBookingWithoutPayment()
        } catch (err: any) {
            console.error('Booking error:', err)
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }


    const createBookingWithoutPayment = async () => {
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
    }

    const formatSlot = (iso: string) => {
        const d = new Date(iso)
        // Display in local timezone with indication it's UTC-based
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
        return timeStr
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
            {/* Step Header */}
            <ol className="flex items-center gap-2 text-sm text-gray-600" aria-label="Steps">
                <li className={step >= 1 ? 'text-indigo-600 font-medium' : ''}>1. Barber</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 2 ? 'text-indigo-600 font-medium' : ''}>2. Service</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 3 ? 'text-indigo-600 font-medium' : ''}>3. Time</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 4 ? 'text-indigo-600 font-medium' : ''}>4. Details</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 5 ? 'text-indigo-600 font-medium' : ''}>5. Payment</li>
            </ol>

            {/* Step 1: Select Barber */}
            <section aria-labelledby="step-barber">
                <h2 id="step-barber" className="text-lg font-medium text-gray-900 mb-3">Select Barber</h2>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {barbers.slice(0, 2).map((b) => {
                        const selected = barberId === b.id
                        return (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                    setBarberId(b.id)
                                    setStep(2)
                                }}
                                aria-pressed={selected}
                                className={`whitespace-nowrap px-4 py-2 rounded-full border text-sm transition-colors ${
                                    selected
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                {b.name}
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Step 2: Select Service(s) */}
            <section aria-labelledby="step-service">
                <h2 id="step-service" className="text-lg font-medium text-gray-900 mb-3">Select Service</h2>
                <div className="grid grid-cols-1 gap-3">
                    {services.map((s) => {
                        const selected = serviceIds.includes(s.id)
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    setServiceIds((prev) => {
                                        const exists = prev.includes(s.id)
                                        const next = exists ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                        if (next.length > 0 && step < 3) setStep(3)
                                        return next
                                    })
                                }}
                                aria-pressed={selected}
                                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                                    selected
                                        ? 'border-indigo-600 ring-2 ring-indigo-500'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{s.name}</p>
                                        <p className="text-sm text-gray-600">{s.duration_minutes} min{s.duration_minutes !== 1 ? 's' : ''}</p>
                                    </div>
                                    {typeof s.price === 'number' && (
                                        <p className="text-sm font-medium text-gray-900">₹{s.price}</p>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Step 3: Select Date & Time */}
            <section aria-labelledby="step-time">
                <h2 id="step-time" className="text-lg font-medium text-gray-900 mb-3">Select Date & Time</h2>
                <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1">Date</span>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            max={maxDateStr}
                        />
                    </label>

                    <div>
                        <span className="block text-sm font-medium text-gray-700 mb-2">Available time slots</span>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                            {slotsLoading && <span className="text-sm text-gray-500">Loading…</span>}
                            {!slotsLoading && date && slots.length === 0 && (
                                <span className="text-sm text-gray-500">No slots</span>
                            )}
                            {!slotsLoading && slots.map((slot) => {
                                const sel = selectedSlot === slot.start
                                return (
                                    <button
                                        key={slot.start}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSlot(slot.start)
                                            setStep(4)
                                        }}
                                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                                            sel
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
                                        }`}
                                    >
                                        {formatSlot(slot.start)}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Step 4: Customer Details */}
            <section aria-labelledby="step-details">
                <h2 id="step-details" className="text-lg font-medium text-gray-900 mb-3">Your Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1">Name</span>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Your name"
                        />
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1">Phone number</span>
                        <input
                            type="tel"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Your phone"
                        />
                    </label>
                </div>
            </section>

            {/* Step 5: Payment */}
            <section aria-labelledby="step-payment">
                <h2 id="step-payment" className="text-lg font-medium text-gray-900 mb-3">Payment</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Selected service</span>
                        <span className="text-sm font-medium text-gray-900">{selectedServiceName || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Estimated time</span>
                        <span className="text-sm font-medium text-gray-900">{totalDuration} mins</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <span className="text-sm text-gray-700">Advance payment required</span>
                        <span className="text-sm font-medium text-indigo-700">₹0</span>
                    </div>
                    <p className="text-xs text-gray-600">This amount will be adjusted in your final bill.</p>
                </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            {/* Mobile sticky CTA */}
            <div className="md:static fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
                <div className="max-w-2xl mx-auto p-4">
                    <button
                        type="submit"
                        disabled={submitting || !barberId || serviceIds.length === 0 || !selectedSlot || !customerName || !customerPhone}
                        className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Booking…' : 'Confirm Booking'}
                    </button>
                </div>
            </div>
        </form>
    )
}
