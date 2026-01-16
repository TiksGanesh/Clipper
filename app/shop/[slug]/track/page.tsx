'use client'

import { useState, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { findBookingByPhone } from './findBookingByPhone'

export default function TrackBookingLookupPage() {
    const params = useParams()
    const router = useRouter()

    const slug = (params?.slug as string) || ''
    const [phone, setPhone] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const validatePhone = (value: string) => {
        const cleaned = value.replace(/\D/g, '')
        const indianPhoneRegex = /^[6-9]\d{9}$/
        if (!indianPhoneRegex.test(cleaned)) {
            setError('Please enter a valid 10-digit mobile number')
            return { valid: false, cleaned }
        }
        setError(null)
        return { valid: true, cleaned }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const { valid, cleaned } = validatePhone(phone)
        if (!valid || !slug) return

        startTransition(async () => {
            const result = await findBookingByPhone({ shopSlug: slug, phoneNumber: cleaned })

            if (result.success && result.bookingId) {
                router.push(`/track/${result.bookingId}`)
                return
            }

            setError(!result.success ? result.message ?? 'No active booking found for today.' : null)
        })
    }

    const buttonDisabled = isPending || !slug

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
            <div className="w-full max-w-md mx-4">
                <div className="w-full bg-white border border-gray-100 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black text-gray-900">Track Your Booking</h1>
                        <p className="text-sm text-gray-500">Enter the mobile number used while booking.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">
                                Mobile Number
                            </label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={phone}
                                onChange={(e) => {
                                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
                                    setPhone(digitsOnly)
                                }}
                                placeholder="10-digit mobile number"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <button
                            type="submit"
                            disabled={buttonDisabled}
                            className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            {isPending ? 'Finding...' : 'Find Booking'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
