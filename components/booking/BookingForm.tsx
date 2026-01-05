'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

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
    const router = useRouter()
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
    
    // Form State
    const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
    const [serviceIds, setServiceIds] = useState<string[]>([])
    const [date, setDate] = useState('')
    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedSlot, setSelectedSlot] = useState<string>('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')

    // UI State
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

    // Derived State
    const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])
    const selectedServices = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds])
    const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0), [selectedServices])
    const totalPrice = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.price || 0), 0), [selectedServices])
    const selectedServiceName = useMemo(() => selectedServices.map((s) => s.name).join(' + '), [selectedServices])

    const maxDateStr = useMemo(() => {
        const today = new Date()
        const plus1 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        return plus1.toISOString().slice(0, 10)
    }, [])

    // Fetch Slots
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
                if (!res.ok) throw new Error('Failed to load slots')
                const body = await res.json()
                setSlots(body.slots ?? [])
            } catch (err: any) {
                if (err.name === 'AbortError') return
                setSlots([])
            } finally {
                setSlotsLoading(false)
            }
        }

        fetchSlots()
        return () => controller.abort()
    }, [barberId, serviceIds, date, timezoneOffset])

    // --- PAYMENT & SUBMISSION LOGIC ---

    const handlePaymentAndBooking = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // 1. Validation
        if (!barberId) return setError('Please select a barber')
        if (serviceIds.length === 0) return setError('Please select a service')
        if (!date || !selectedSlot) return setError('Please select a time slot')
        if (!customerName.trim() || !customerPhone.trim()) return setError('Please enter your details')

        setSubmitting(true)

        try {
            // 2. Create Order on Backend
            const orderRes = await fetch("/api/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    amount: totalPrice, 
                    userId: customerPhone // Optional metadata
                }),
            })

            if (!orderRes.ok) throw new Error("Failed to initiate payment")
            const order = await orderRes.json()

            const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
            if (!razorpayKeyId) {
                setSubmitting(false)
                return setError('Payments are not configured right now. Please contact the shop.')
            }

            // 3. Open Razorpay Modal
            const options = {
                key: razorpayKeyId,
                amount: order.amount,
                currency: "INR",
                name: shop.name,
                description: selectedServiceName,
                order_id: order.id,
                handler: async function (response: any) {
                    // 4. Payment Success -> Create Booking
                    await createBooking(response.razorpay_payment_id, response.razorpay_order_id)
                },
                prefill: {
                    name: customerName,
                    contact: customerPhone,
                },
                theme: {
                    color: "#4F46E5",
                },
                // Force UPI intent flow on mobile
                method: {
                    upi: true,
                    card: true,
                    netbanking: true,
                    wallet: true,
                },
                modal: {
                    ondismiss: () => {
                        setSubmitting(false)
                        setError('Payment was cancelled')
                    }
                }
            }

            const rzp = new (window as any).Razorpay(options)
            
            rzp.on("payment.failed", function (response: any) {
                const message = response?.error?.description || 'Payment failed'
                setSubmitting(false)
                try { rzp.close() } catch (_) {}

                const failedParams = new URLSearchParams({
                    status: 'failed',
                    error: message,
                    shop: shop.name,
                    shop_id: shop.id,
                    barber: barbers.find(b => b.id === barberId)?.name || '',
                    services: selectedServiceName,
                    duration: String(totalDuration),
                    date,
                    time: selectedSlot,
                    customer: customerName.trim(),
                    phone: customerPhone.trim(),
                })

                router.push(`/booking-confirmed?${failedParams.toString()}`)
            })

            rzp.open()

        } catch (err: any) {
            console.error("Payment Init Error:", err)
            setError(err.message || "Something went wrong")
            setSubmitting(false)
        }
    }

    const createBooking = async (paymentId: string, orderId: string) => {
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
                    // Payment Details (matching DB schema)
                    razorpay_payment_id: paymentId,
                    razorpay_order_id: orderId,
                    amount: totalPrice * 100 // Convert to paise
                }),
            })
            
            if (!res.ok) throw new Error('Booking failed after payment')

            // Success Redirect
            const selectedBarber = barbers.find(b => b.id === barberId)
            const bookingParams = new URLSearchParams({
                status: 'success',
                shop: shop.name,
                shop_id: shop.id,
                barber: selectedBarber?.name || '',
                services: selectedServiceName,
                duration: String(totalDuration),
                date: date,
                time: selectedSlot,
                customer: customerName.trim(),
                phone: customerPhone.trim(),
                payment_id: paymentId
            })
            router.push(`/booking-confirmed?${bookingParams.toString()}`)

        } catch (err: any) {
            const selectedBarber = barbers.find(b => b.id === barberId)
            const failureParams = new URLSearchParams({
                status: 'failed',
                error: 'Payment captured but booking creation failed. Please contact support.',
                shop: shop.name,
                shop_id: shop.id,
                barber: selectedBarber?.name || '',
                services: selectedServiceName,
                duration: String(totalDuration),
                date: date,
                time: selectedSlot,
                customer: customerName.trim(),
                phone: customerPhone.trim(),
                payment_id: paymentId
            })
            router.push(`/booking-confirmed?${failureParams.toString()}`)
            setSubmitting(false)
        }
    }

    const formatSlot = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    return (
        <form onSubmit={handlePaymentAndBooking} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-6 max-w-full">
            
            {/* Load Razorpay Script */}
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

            {/* ... EXISTING STEP HEADER (No changes) ... */}
            <ol className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-600 overflow-x-auto no-scrollbar" aria-label="Steps">
                <li className={step >= 1 ? 'text-indigo-600 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>1. Barber</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 2 ? 'text-indigo-600 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>2. Service</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 3 ? 'text-indigo-600 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>3. Time</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 4 ? 'text-indigo-600 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>4. Details</li>
                <span className="text-gray-300">/</span>
                <li className={step >= 5 ? 'text-indigo-600 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>5. Payment</li>
            </ol>

            {/* ... STEP 1, 2, 3, 4 (No logic changes, just paste your existing sections here) ... */}
            
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
                                onClick={() => { setBarberId(b.id); setStep(2) }}
                                className={`whitespace-nowrap px-4 py-2 rounded-full border text-sm transition-colors ${
                                    selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                {b.name}
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Step 2: Select Service */}
            <section aria-labelledby="step-service">
                <div className="flex items-center justify-between mb-3">
                    <h2 id="step-service" className="text-lg font-medium text-gray-900">Select Service(s)</h2>
                    {serviceIds.length > 0 && <span className="text-sm text-indigo-600 font-medium">{serviceIds.length} selected</span>}
                </div>
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    <div className="divide-y divide-gray-200">
                        {services.map((s) => {
                            const selected = serviceIds.includes(s.id)
                            return (
                                <label key={s.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected ? 'bg-indigo-50' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => {
                                            setServiceIds((prev) => {
                                                const exists = prev.includes(s.id)
                                                const next = exists ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                                if (next.length > 0 && step < 3) setStep(3)
                                                return next
                                            })
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                                        <p className="text-xs text-gray-600">{s.duration_minutes} mins • ₹{s.price}</p>
                                    </div>
                                </label>
                            )
                        })}
                    </div>
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
                            {!slotsLoading && date && slots.length === 0 && <span className="text-sm text-gray-500">No slots</span>}
                            {!slotsLoading && slots.map((slot) => {
                                const sel = selectedSlot === slot.start
                                return (
                                    <button
                                        key={slot.start}
                                        type="button"
                                        onClick={() => { setSelectedSlot(slot.start); setStep(4) }}
                                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${sel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'}`}
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
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" />
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1">Phone number</span>
                        <input type="tel" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Your phone" />
                    </label>
                </div>
            </section>

            {/* Step 5: Payment Summary (UPDATED) */}
            <section aria-labelledby="step-payment">
                <h2 id="step-payment" className="text-lg font-medium text-gray-900 mb-3">Payment Summary</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Service</span>
                        <span className="text-sm font-medium text-gray-900">{selectedServiceName || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Total Duration</span>
                        <span className="text-sm font-medium text-gray-900">{totalDuration} mins</span>
                    </div>
                    
                    {/* TOTAL PRICE DISPLAY */}
                    <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <span className="text-base font-semibold text-gray-800">Total Payable</span>
                        <span className="text-lg font-bold text-indigo-700">₹{totalPrice}</span>
                    </div>
                    <p className="text-xs text-center text-gray-500 mt-2">
                        Secure payment via Razorpay (UPI, Cards, Netbanking)
                    </p>
                </div>
            </section>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            {/* CTA Button */}
            <div className="md:static fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:p-0 md:border-0 z-50">
                <div className="max-w-2xl mx-auto">
                    <button
                        type="submit"
                        disabled={submitting || !barberId || serviceIds.length === 0 || !selectedSlot || !customerName || !customerPhone}
                        className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg md:shadow-none"
                    >
                        {submitting ? 'Processing Payment...' : `Pay ₹${totalPrice} & Confirm`}
                    </button>
                </div>
            </div>
        </form>
    )
}