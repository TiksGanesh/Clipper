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
    const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
    const [autoSlot, setAutoSlot] = useState<Slot | null>(null)
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])

    const selectedService = services.find(s => s.id === serviceId)

    // Auto-fetch next available slot
    useEffect(() => {
        if (!barberId || !serviceId) {
            setAutoSlot(null)
            return
        }

        const controller = new AbortController()
        const fetchSlot = async () => {
            setSlotsLoading(true)
            setError('')
            try {
                const today = new Date().toISOString().slice(0, 10)
                const params = new URLSearchParams({
                    barber_id: barberId,
                    date: today,
                    service_ids: serviceId,
                    timezone_offset: String(timezoneOffset),
                })
                const res = await fetch(`/api/slots?${params.toString()}`, { signal: controller.signal })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || 'No slots available')
                }
                const body = await res.json()
                const slots = body.slots ?? []

                if (slots.length === 0) {
                    setError('No slots available')
                    setAutoSlot(null)
                    return
                }

                setAutoSlot(slots[0])
            } catch (err: any) {
                if (err.name === 'AbortError') return
                setAutoSlot(null)
                setError(err.message)
            } finally {
                setSlotsLoading(false)
            }
        }

        fetchSlot()
        return () => controller.abort()
    }, [barberId, serviceId, timezoneOffset])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!barberId || !serviceId || !autoSlot) {
            setError('Missing required information')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            const res = await fetch('/api/walk-ins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barber_id: barberId,
                    service_ids: [serviceId],
                    customer_name: customerName.trim() || undefined,
                    customer_phone: customerPhone.trim() || undefined,
                    timezone_offset: timezoneOffset,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(body.error || 'Failed to create walk-in')
            }
            if (onSuccess) {
                onSuccess(body.booking_id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const formatTime = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-t-xl md:rounded-xl border border-gray-200 shadow-md p-4 md:p-6 space-y-4 max-w-full">
            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-gray-900">Add Walk-in</h2>
                <p className="text-xs text-gray-600">Quickly add a customer who walked in.</p>
            </div>

            {/* Barber Selection */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Barber</label>
                <div className="flex gap-2">
                    {barbers.slice(0, 2).map((barber) => (
                        <button
                            key={barber.id}
                            type="button"
                            onClick={() => setBarberId(barber.id)}
                            className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                                barberId === barber.id
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {barber.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Service Selection */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Service</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {services.map((service) => (
                        <button
                            key={service.id}
                            type="button"
                            onClick={() => setServiceId(service.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                serviceId === service.id
                                    ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                                    <p className="text-xs text-gray-600">{service.duration_minutes} mins</p>
                                </div>
                                {serviceId === service.id && (
                                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Time Display */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Time</label>
                {slotsLoading && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                        <p className="text-sm text-gray-600">Finding next slot...</p>
                    </div>
                )}
                {!slotsLoading && autoSlot && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-base font-semibold text-emerald-900">
                            {formatTime(autoSlot.start)}
                        </p>
                        <p className="text-xs text-emerald-700 mt-0.5">Next available slot</p>
                    </div>
                )}
                {!slotsLoading && !autoSlot && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800">No slots available</p>
                    </div>
                )}
            </div>

            {/* Optional Customer Info */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700">Customer Info (Optional)</p>
                <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-800">
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitting || !autoSlot || !barberId || !serviceId}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {submitting ? 'Adding...' : 'Add Walk-in'}
                </button>
            </div>
        </form>
    )
}
