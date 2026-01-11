'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
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
    
    // --- Refs for Auto-Scrolling ---
    const serviceSectionRef = useRef<HTMLElement>(null)
    const timeSectionRef = useRef<HTMLElement>(null)
    const detailsSectionRef = useRef<HTMLElement>(null)
    const paymentSectionRef = useRef<HTMLElement>(null)

    // --- State ---
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
    const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
    const [serviceIds, setServiceIds] = useState<string[]>([])
    const [date, setDate] = useState('')
    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedSlot, setSelectedSlot] = useState<string>('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [activeTab, setActiveTab] = useState<'morning' | 'afternoon' | 'evening'>('morning')
    const [dateOptions, setDateOptions] = useState<Array<{ value: string; label: string; fullLabel: string }>>([])
    const [holdBookingId, setHoldBookingId] = useState<string | null>(null)

    // Date options: Today and Tomorrow (client-side only to avoid hydration mismatch)
    useEffect(() => {
        const today = new Date()
        const tomorrow = new Date(Date.now() + 86400000)
        const todayValue = formatDateLocal(today)
        const tomorrowValue = formatDateLocal(tomorrow)
        
        setDateOptions([
            {
                value: todayValue,
                label: 'Today',
                fullLabel: `Today, ${today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            },
            {
                value: tomorrowValue,
                label: 'Tomorrow',
                fullLabel: `Tomorrow, ${tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            }
        ])
    }, [])

    // UI State
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    // --- Derived State ---
    const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])
    const selectedServices = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds])
    const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0), [selectedServices])
    const totalPrice = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.price || 0), 0), [selectedServices])
    const selectedServiceName = useMemo(() => selectedServices.map((s) => s.name).join(' + '), [selectedServices])

    // --- Helpers ---
    const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const formatDateLocal = (value: Date) => {
        const year = value.getFullYear()
        const month = String(value.getMonth() + 1).padStart(2, '0')
        const day = String(value.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const formatPhone = (value: string) => {
        // Remove non-digits
        const cleaned = value.replace(/\D/g, '')
        // Format as 12345 67890
        const match = cleaned.match(/^(\d{0,5})(\d{0,5})$/)
        if (match) {
            return !match[2] ? match[1] : `${match[1]} ${match[2]}`
        }
        return cleaned
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value)
        if (formatted.replace(/\s/g, '').length <= 10) {
            setCustomerPhone(formatted)
        }
    }

    // --- Existing Slot Logic (Preserved) ---
    useEffect(() => {
        setSelectedSlot('')
        if (!barberId || serviceIds.length === 0 || !date) {
            setSlots([])
            return
        }

        const controller = new AbortController()
        const fetchSlots = async () => {
            setSlotsLoading(true)
            setErrorMessage('')
            try {
                const params = new URLSearchParams({
                    barber_id: barberId,
                    date,
                    service_ids: serviceIds.join(','),
                    timezone_offset: String(timezoneOffset),
                    _t: String(new Date().getTime()), // Timestamp buster
                })
                const res = await fetch(`/api/slots?${params.toString()}`, {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                })
                const body = await res.json().catch(() => ({} as any))
                if (!res.ok) {
                    const apiError = body?.error || 'Unable to load slots. Please try again.'
                    throw new Error(apiError)
                }
                setSlots(body.slots ?? [])
            } catch (err: any) {
                if (err.name === 'AbortError') return
                setErrorMessage(err?.message || 'Unable to load slots. Please try again.')
                setSlots([])
            } finally {
                setSlotsLoading(false)
            }
        }

        fetchSlots()
        return () => controller.abort()
    }, [barberId, serviceIds, date, timezoneOffset])

    // --- Payment Logic ---
    const handlePaymentAndBooking = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage('')

        // Clean phone for submission
        const cleanPhone = customerPhone.replace(/\s/g, '')

        if (!barberId) return setErrorMessage('Please select a barber')
        if (serviceIds.length === 0) return setErrorMessage('Please select a service')
        if (!date || !selectedSlot) return setErrorMessage('Please select a time slot')
        if (!customerName.trim() || cleanPhone.length < 10) return setErrorMessage('Please enter valid details')

        setSubmitting(true)

        try {
            console.log('[booking-form] starting soft lock + payment flow', {
                barberId,
                serviceIds,
                date,
                selectedSlot,
                timezoneOffset,
                customerName: customerName.trim(),
                customerPhone: cleanPhone,
                totalPrice,
            })

            // Step 1: Create a soft lock (pending_payment booking)
            console.log('[booking-form] requesting hold on slot...')
            const holdRes = await fetch('/api/bookings/hold', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barber_id: barberId,
                    service_ids: serviceIds,
                    date: date,
                    slot_time: selectedSlot,
                    timezone_offset: timezoneOffset,
                }),
            })

            if (!holdRes.ok) {
                const holdError = await holdRes.json()
                console.error('[booking-form] hold request failed', {
                    status: holdRes.status,
                    error: holdError
                })
                setSubmitting(false)
                
                if (holdRes.status === 409) {
                    return setErrorMessage('This slot is no longer available. Please select another time.')
                }
                return setErrorMessage(holdError.error || 'Failed to reserve slot')
            }

            const holdData = await holdRes.json()
            const bookingId = holdData.bookingId
            
            console.log('[booking-form] slot hold successful', { bookingId })
            setHoldBookingId(bookingId)

            // Step 2: Proceed with payment (if advance payment required)
            const orderRes = await fetch("/api/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    amount: totalPrice, 
                    userId: cleanPhone,
                    serviceIds: serviceIds
                }),
            })

            if (!orderRes.ok) {
                const errorData = await orderRes.json()
                console.error('[booking-form] payment order creation failed', errorData)
                setSubmitting(false)
                throw new Error(errorData.error || "Failed to initiate payment")
            }
            const order = await orderRes.json()

            const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
            if (!razorpayKeyId) {
                setSubmitting(false)
                return setErrorMessage('Payment configuration missing.')
            }

            const options = {
                key: razorpayKeyId,
                amount: order.amount,
                currency: "INR",
                name: shop.name,
                description: selectedServiceName,
                order_id: order.id,
                handler: async function (response: any) {
                    // Immediately show processing overlay
                    setPaymentStatus('processing')
                    setSubmitting(false)
                    console.log('[booking-form] payment success, confirming hold', {
                        paymentId: response?.razorpay_payment_id,
                        orderId: response?.razorpay_order_id,
                        slot: selectedSlot,
                        date,
                        bookingId,
                    })
                    await confirmBookingFromHold(
                        response.razorpay_payment_id, 
                        response.razorpay_order_id, 
                        cleanPhone,
                        bookingId
                    )
                },
                prefill: {
                    name: customerName,
                    contact: cleanPhone,
                },
                theme: { color: "#4F46E5" },
                method: { upi: true, card: true, netbanking: true, wallet: true },
                modal: {
                    ondismiss: () => {
                        // User dismissed/cancelled payment modal
                        setSubmitting(false)
                        setPaymentStatus('failed')
                        setErrorMessage('You cancelled the payment. The slot hold will expire in 10 minutes.')
                        // Force cleanup
                        const rzpContainer = document.querySelector('.razorpay-container')
                        if (rzpContainer) rzpContainer.remove()
                        document.body.style.overflow = 'auto'
                    }
                }
            }

            const rzp = new (window as any).Razorpay(options)
            
            rzp.on("payment.failed", function (response: any) {
                const message = response?.error?.description || 'Payment failed'
                setSubmitting(false)
                setPaymentStatus('failed')
                setErrorMessage(message + '. The slot hold will expire in 10 minutes.')
                
                // Force remove DOM elements
                const rzpContainer = document.querySelector('.razorpay-container')
                if (rzpContainer) rzpContainer.remove()
                document.body.style.overflow = 'auto'
            })

            rzp.open()

        } catch (err: any) {
            console.error("Payment Init Error:", err)
            setErrorMessage(err.message || "Something went wrong")
            setSubmitting(false)
            // Clear the hold on error
            setHoldBookingId(null)
        }
    }

    const confirmBookingFromHold = async (paymentId: string, orderId: string, finalPhone: string, bookingId: string) => {
        try {
            // Confirm the pending booking with customer details
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: bookingId,
                    barber_id: barberId,
                    service_ids: serviceIds,
                    slot_start: selectedSlot,
                    customer_name: customerName.trim(),
                    customer_phone: finalPhone,
                    date,
                    timezone_offset: timezoneOffset,
                    razorpay_payment_id: paymentId,
                    razorpay_order_id: orderId,
                    amount: totalPrice * 100 
                }),
            })
            
            if (!res.ok) {
                const errorBody = await res.json().catch(() => ({} as any))
                console.error('[booking-form] booking confirmation failed', { status: res.status, body: errorBody })
                throw new Error('Booking confirmation failed')
            }

            const resData = await res.json()
            const confirmedBookingId = resData.booking_id || bookingId

            const selectedBarber = barbers.find(b => b.id === barberId)
            const bookingParams = new URLSearchParams({
                status: 'success',
                shop: shop.name,
                barber: selectedBarber?.name || '',
                services: selectedServiceName,
                date: date,
                time: selectedSlot,
                customer: customerName.trim(),
                phone: finalPhone,
                payment_id: paymentId,
                booking_id: confirmedBookingId
            })
            router.push(`/booking-confirmed?${bookingParams.toString()}`)

        } catch (err: any) {
            // CRITICAL ERROR: Payment succeeded but booking confirmation failed
            console.error('Critical booking error after payment:', err)
            setPaymentStatus('success') // Change to 'success' to show critical error state
            setErrorMessage(err.message || 'Booking confirmation failed. Please contact support.')
        }
    }

    const createBooking = async (paymentId: string, orderId: string, finalPhone: string) => {
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barber_id: barberId,
                    service_ids: serviceIds,
                    slot_start: selectedSlot,
                    customer_name: customerName.trim(),
                    customer_phone: finalPhone,
                    date,
                    timezone_offset: timezoneOffset,
                    razorpay_payment_id: paymentId,
                    razorpay_order_id: orderId,
                    amount: totalPrice * 100 
                }),
            })
            
            if (!res.ok) {
                const errorBody = await res.json().catch(() => ({} as any))
                console.error('[booking-form] booking failed after payment', { status: res.status, body: errorBody })
                throw new Error('Booking failed after payment')
            }

            const resData = await res.json()
            const bookingId = resData.booking_id

            const selectedBarber = barbers.find(b => b.id === barberId)
            const bookingParams = new URLSearchParams({
                status: 'success',
                shop: shop.name,
                barber: selectedBarber?.name || '',
                services: selectedServiceName,
                date: date,
                time: selectedSlot,
                customer: customerName.trim(),
                phone: finalPhone,
                payment_id: paymentId,
                booking_id: bookingId
            })
            router.push(`/booking-confirmed?${bookingParams.toString()}`)

        } catch (err: any) {
            // CRITICAL ERROR: Payment succeeded but booking failed
            console.error('Critical booking error after payment:', err)
            setPaymentStatus('success') // Change to 'success' to show critical error state
            setErrorMessage(err.message || 'Booking confirmation failed')
        }
    }

    const formatSlot = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    // Group slots by time period (Morning, Afternoon, Evening)
    const getTimePeriod = (isoString: string): 'morning' | 'afternoon' | 'evening' => {
        const date = new Date(isoString)
        const hours = date.getHours()
        
        if (hours < 12) return 'morning'
        if (hours >= 12 && hours < 17) return 'afternoon'
        return 'evening'
    }

    const groupedSlots = useMemo(() => {
        const isToday = date === formatDateLocal(new Date())
        const now = new Date()
        const currentHour = isToday ? now.getHours() : -1
        const currentMinute = isToday ? now.getMinutes() : 0

        // Filter out past slots if selecting today
        const filteredSlots = isToday
            ? slots.filter((slot) => {
                const slotTime = new Date(slot.start)
                return slotTime > now
              })
            : slots

        const grouped = {
            morning: filteredSlots.filter((s) => getTimePeriod(s.start) === 'morning'),
            afternoon: filteredSlots.filter((s) => getTimePeriod(s.start) === 'afternoon'),
            evening: filteredSlots.filter((s) => getTimePeriod(s.start) === 'evening'),
        }

        return grouped
    }, [slots, date])

    // Determine default active tab - first category with available slots
    useEffect(() => {
        if (!date) return
        
        let defaultTab: 'morning' | 'afternoon' | 'evening' = 'morning'
        
        if (groupedSlots.morning.length > 0) {
            defaultTab = 'morning'
        } else if (groupedSlots.afternoon.length > 0) {
            defaultTab = 'afternoon'
        } else if (groupedSlots.evening.length > 0) {
            defaultTab = 'evening'
        }
        
        setActiveTab(defaultTab)
    }, [date, groupedSlots])

    // Control body scroll when overlay is active
    useEffect(() => {
        if (paymentStatus !== 'idle') {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'auto'
        }
        return () => {
            document.body.style.overflow = 'auto'
        }
    }, [paymentStatus])

    // Auto-dismiss errorMessage after 4 seconds
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(''), 4000)
            return () => clearTimeout(timer)
        }
    }, [errorMessage])

    const hasAnySlots = groupedSlots.morning.length > 0 || groupedSlots.afternoon.length > 0 || groupedSlots.evening.length > 0

    // --- Render ---

    return (
        <>
            {/* Full-Screen Payment Overlay */}
            {paymentStatus !== 'idle' && (
                <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
                    {/* State 1: Payment Success - Processing Booking */}
                    {paymentStatus === 'processing' && (
                        <div className="text-center space-y-6 max-w-md animate-in fade-in duration-300">
                            {/* Animated Success Icon */}
                            <div className="relative mx-auto w-20 h-20">
                                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                                <div className="relative flex items-center justify-center w-20 h-20 bg-green-500 rounded-full">
                                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
                                <p className="text-gray-600">Please wait, securing your appointment slot...</p>
                                <p className="text-sm text-amber-600 font-medium mt-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
                                    ⚠️ Do not close or refresh this page
                                </p>
                            </div>

                            {/* Processing Spinner */}
                            <div className="flex items-center justify-center gap-2 mt-6">
                                <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-sm text-gray-600">Processing your booking...</span>
                            </div>
                        </div>
                    )}

                    {/* State 2: Payment Failed (Recoverable) */}
                    {paymentStatus === 'failed' && (
                        <div className="text-center space-y-6 max-w-md animate-in fade-in duration-300">
                            {/* Error Icon */}
                            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-gray-900">Payment Failed</h2>
                                <p className="text-gray-600">{errorMessage || 'Your payment could not be processed.'}</p>
                            </div>

                            <button
                                onClick={() => {
                                    setPaymentStatus('idle')
                                    setErrorMessage('')
                                    document.body.style.overflow = 'auto'
                                }}
                                className="w-full max-w-xs mx-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* State 3: Critical Error (Money Cut, Booking Failed) */}
                    {paymentStatus === 'success' && errorMessage && (
                        <div className="text-center space-y-6 max-w-md animate-in fade-in duration-300">
                            {/* Warning Icon */}
                            <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            
                            <div className="space-y-3">
                                <h2 className="text-2xl font-bold text-gray-900">Booking Error</h2>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-amber-900 font-medium mb-2">Your payment was captured successfully</p>
                                    <p className="text-sm text-amber-700">However, we could not secure your appointment slot. A refund will be initiated automatically within 5-7 business days.</p>
                                </div>
                                <p className="text-sm text-gray-600">{errorMessage}</p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        const phone = customerPhone.replace(/\s/g, '')
                                        window.location.href = `tel:${shop.phone || '+919876543210'}`
                                    }}
                                    className="w-full max-w-xs mx-auto bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    Contact Support
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                                >
                                    Go to Home
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <form onSubmit={handlePaymentAndBooking} className="pb-48 max-w-2xl mx-auto">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-8">
                
                {/* Step 1: Barber Selection */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">1</span>
                        Select Barber
                    </h2>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {barbers.slice(0, 2).map((b) => {
                            const selected = barberId === b.id
                            return (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => { 
                                        setBarberId(b.id)
                                        setStep(2)
                                        setTimeout(() => scrollToSection(serviceSectionRef), 100)
                                    }}
                                    className={`flex-shrink-0 px-5 py-3 rounded-xl border font-medium transition-all ${
                                        selected
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {b.name}
                                </button>
                            )
                        })}
                    </div>
                </section>

                <hr className="border-gray-100" />

                {/* Step 2: Service Selection (Cards) */}
                <section ref={serviceSectionRef} className={`transition-opacity duration-500 ${step < 2 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step >= 2 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>2</span>
                            Select Services
                        </h2>
                        {serviceIds.length > 0 && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">{serviceIds.length} selected</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {services.map((s) => {
                            const selected = serviceIds.includes(s.id)
                            return (
                                <div
                                    key={s.id}
                                    onClick={() => {
                                        setServiceIds((prev) => {
                                            const next = prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                            if (next.length > 0 && step < 3) {
                                                setStep(3)
                                                setTimeout(() => scrollToSection(timeSectionRef), 100)
                                            }
                                            return next
                                        })
                                    }}
                                    className={`relative flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                                        selected 
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <p className={`font-medium ${selected ? 'text-indigo-900' : 'text-gray-900'}`}>{s.name}</p>
                                        <p className="text-sm text-gray-500 mt-0.5">{s.duration_minutes} mins • ₹{s.price}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                        selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
                                    }`}>
                                        {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                <hr className="border-gray-100" />

                {/* Step 3: Date & Time */}
                <section ref={timeSectionRef} className={`transition-opacity duration-500 ${step < 3 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step >= 3 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>3</span>
                        Date & Time
                    </h2>
                    
                    <div className="space-y-4">
                        {/* Date Selection Toggle */}
                        <div className="flex gap-3">
                            {dateOptions.map((option) => {
                                const isSelected = date === option.value
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setDate(option.value)}
                                        className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {option.fullLabel}
                                    </button>
                                )
                            })}
                        </div>

                        {date && (
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                {slotsLoading ? (
                                    <div className="text-center py-4 text-gray-500 text-sm">Checking availability...</div>
                                ) : !hasAnySlots ? (
                                    <div className="text-center py-4 text-gray-500 text-sm">No slots available for this date.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Tab Navigation */}
                                        <div className="flex gap-2 border-b border-gray-200">
                                            {[
                                                { key: 'morning' as const, label: 'Morning', hours: '9 AM - 12 PM' },
                                                { key: 'afternoon' as const, label: 'Afternoon', hours: '12 PM - 5 PM' },
                                                { key: 'evening' as const, label: 'Evening', hours: '5 PM onwards' }
                                            ].map(({ key, label, hours }) => {
                                                const isDisabled = groupedSlots[key].length === 0
                                                const isActive = activeTab === key
                                                
                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => !isDisabled && setActiveTab(key)}
                                                        disabled={isDisabled}
                                                        className={`px-4 py-2.5 font-medium text-sm transition-all relative ${
                                                            isDisabled
                                                                ? 'text-gray-400 cursor-not-allowed opacity-50'
                                                                : isActive
                                                                ? 'text-indigo-600'
                                                                : 'text-gray-600 hover:text-gray-900'
                                                        }`}
                                                    >
                                                        {label}
                                                        {isActive && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Tab Content - Render only active tab's slots */}
                                        <div className="pt-2">
                                            {activeTab === 'morning' && groupedSlots.morning.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-3">Morning (9 AM - 12 PM)</p>
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                        {groupedSlots.morning.map((slot) => {
                                                            const sel = selectedSlot === slot.start
                                                            return (
                                                                <button
                                                                    key={slot.start}
                                                                    type="button"
                                                                    onClick={() => { 
                                                                        setSelectedSlot(slot.start)
                                                                        setStep(4)
                                                                        setTimeout(() => scrollToSection(detailsSectionRef), 100)
                                                                    }}
                                                                    className={`px-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                                        sel
                                                                            ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                                                                            : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {formatSlot(slot.start)}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'afternoon' && groupedSlots.afternoon.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-3">Afternoon (12 PM - 5 PM)</p>
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                        {groupedSlots.afternoon.map((slot) => {
                                                            const sel = selectedSlot === slot.start
                                                            return (
                                                                <button
                                                                    key={slot.start}
                                                                    type="button"
                                                                    onClick={() => { 
                                                                        setSelectedSlot(slot.start)
                                                                        setStep(4)
                                                                        setTimeout(() => scrollToSection(detailsSectionRef), 100)
                                                                    }}
                                                                    className={`px-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                                        sel
                                                                            ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                                                                            : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {formatSlot(slot.start)}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'evening' && groupedSlots.evening.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-3">Evening (5 PM onwards)</p>
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                        {groupedSlots.evening.map((slot) => {
                                                            const sel = selectedSlot === slot.start
                                                            return (
                                                                <button
                                                                    key={slot.start}
                                                                    type="button"
                                                                    onClick={() => { 
                                                                        setSelectedSlot(slot.start)
                                                                        setStep(4)
                                                                        setTimeout(() => scrollToSection(detailsSectionRef), 100)
                                                                    }}
                                                                    className={`px-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                                        sel
                                                                            ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                                                                            : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {formatSlot(slot.start)}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                <hr className="border-gray-100" />

                {/* Step 4: Details (Enhanced Inputs) */}
                <section ref={detailsSectionRef} className={`transition-opacity duration-500 ${step < 4 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step >= 4 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>4</span>
                        Your Details
                    </h2>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                            <input
                                type="text"
                                maxLength={100}
                                required
                                minLength={1}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter your name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium pointer-events-none border-r border-gray-300 pr-3">+91</span>
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9 ]{10,11}"
                                    required
                                    title="Enter a valid 10-digit phone number"
                                    className="w-full pl-16 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium tracking-wide"
                                    value={customerPhone}
                                    onChange={handlePhoneChange}
                                    placeholder="98765 00000"
                                    maxLength={11}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Step 5: Trust Signals (New) */}
                <section ref={paymentSectionRef} className={`transition-opacity duration-500 ${step < 4 ? 'opacity-50' : 'opacity-100'}`}>
                     <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 mt-2">
                        <div className="flex items-center gap-2 text-indigo-900 font-medium mb-1">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Secure Payment via Razorpay
                        </div>
                        <p className="text-xs text-indigo-700/80 pl-7">
                            Your payment is encrypted and safe. We support UPI, Cards, and Netbanking.
                        </p>
                     </div>
                </section>

            </div>

            {/* Top Error Snackbar */}
            {errorMessage && (
                <div className="fixed top-4 left-4 right-4 z-40 bg-red-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-5 duration-300">
                    <span className="font-medium text-sm">{errorMessage}</span>
                    <button onClick={() => setErrorMessage('')} className="text-white/80 hover:text-white ml-4 flex-shrink-0">✕</button>
                </div>
            )}

            {/* Smart Sticky Footer - Hidden during payment processing */}
            {paymentStatus === 'idle' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 px-4 py-4 md:py-5">
                <div className="max-w-2xl mx-auto space-y-3">
                    {/* Payment Breakup */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Service Total</span>
                            <span className="text-gray-900 font-medium">₹{totalPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Platform Fee</span>
                            <span className="text-gray-900 font-medium">₹0</span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 flex justify-between">
                            <span className="text-base font-semibold text-gray-900">Total Payable</span>
                            <span className="text-base font-bold text-gray-900">₹{totalPrice}</span>
                        </div>
                    </div>

                    {/* Pay Button */}
                    <button
                        onClick={handlePaymentAndBooking}
                        disabled={submitting || !selectedSlot || customerPhone.replace(/\s/g, '').length < 10}
                        className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                Pay & Confirm <span className="text-indigo-200 ml-1">→</span>
                            </>
                        )}
                    </button>

                    {/* Terms & Conditions Disclaimer */}
                    <p className="text-xs text-center text-gray-500">
                        By tapping Pay & Confirm, you agree to our <a href="/terms" className="text-indigo-600 hover:underline">Terms and Conditions</a>.
                    </p>
                </div>
            </div>
            )}
        </form>
        </>
    )
}