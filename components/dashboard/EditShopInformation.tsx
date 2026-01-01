'use client'

import { useState } from 'react'
import Link from 'next/link'
import { saveShopClosureAction, saveShopNameAction, saveWorkingHoursAction, saveBarberDetailsAction, saveShopContactAction, addBarberAction } from '@/app/dashboard/edit-shop/actions'

type Shop = {
    id: string
    name: string
    phone: string
    address: string | null
}

type Barber = {
    id: string
    name: string
    phone: string | null
}

type WorkingHours = {
    [day: string]: {
        isOpen: boolean
        openTime: string
        closeTime: string
    }
}

type Props = {
    shop: Shop
    barbers: Barber[]
    workingHours: WorkingHours
    userEmail: string
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function EditShopInformation({ shop, barbers, workingHours, userEmail }: Props) {
    const [shopName, setShopName] = useState(shop.name)
    const [shopPhone, setShopPhone] = useState(shop.phone)
    const [shopAddress, setShopAddress] = useState(shop.address || '')
    const [hours, setHours] = useState<WorkingHours>(workingHours)
    const [barberData, setBarberData] = useState<Barber[]>(barbers)
    const [isSaving, setIsSaving] = useState(false)
    const [isClosed, setIsClosed] = useState(false)
    const [closedFrom, setClosedFrom] = useState('')
    const [closedTo, setClosedTo] = useState('')
    const [closureReason, setClosureReason] = useState('')
    const [saveError, setSaveError] = useState('')
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [isAddingBarber, setIsAddingBarber] = useState(false)
    const [newBarberName, setNewBarberName] = useState('')
    const [newBarberPhone, setNewBarberPhone] = useState('')
    const [addBarberError, setAddBarberError] = useState('')

    const handleBarberNameChange = (id: string, name: string) => {
        setBarberData((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)))
    }

    const handleBarberPhoneChange = (id: string, phone: string) => {
        setBarberData((prev) => prev.map((b) => (b.id === id ? { ...b, phone } : b)))
    }

    const handleTimeChange = (day: string, field: 'openTime' | 'closeTime', value: string) => {
        setHours((prev) => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value,
            },
        }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        setSaveError('')
        setSaveSuccess(false)

        try {
            // Save shop contact (phone and address)
            const contactResult = await saveShopContactAction(shopPhone, shopAddress)
            if (!contactResult.success) {
                setSaveError(contactResult.error || 'Failed to save shop contact')
                setIsSaving(false)
                return
            }

            // Save shop name
            const nameResult = await saveShopNameAction(shopName)
            if (!nameResult.success) {
                setSaveError(nameResult.error || 'Failed to save shop name')
                setIsSaving(false)
                return
            }

            // Save working hours
            const hoursResult = await saveWorkingHoursAction(hours)
            if (!hoursResult.success) {
                setSaveError(hoursResult.error || 'Failed to save working hours')
                setIsSaving(false)
                return
            }

            // Save barber details (only existing barbers)
            const barberResult = await saveBarberDetailsAction(barberData)
            if (!barberResult.success) {
                setSaveError(barberResult.error || 'Failed to save barber details')
                setIsSaving(false)
                return
            }

            // Save shop closure
            const closureResult = await saveShopClosureAction(closedFrom, closedTo, closureReason, isClosed)
            if (!closureResult.success) {
                setSaveError(closureResult.error || 'Failed to save shop closure')
                setIsSaving(false)
                return
            }

            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'An error occurred while saving')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddBarber = async () => {
        setAddBarberError('')

        if (!newBarberName.trim()) {
            setAddBarberError('Barber name is required')
            return
        }

        setIsAddingBarber(true)

        try {
            const result = await addBarberAction(newBarberName, newBarberPhone || null)

            if (!result.success) {
                setAddBarberError(result.error || 'Failed to add barber')
                setIsAddingBarber(false)
                return
            }

            // Reset form and reload page
            setNewBarberName('')
            setNewBarberPhone('')
            setSaveSuccess(true)
            setTimeout(() => {
                window.location.reload()
            }, 500)
        } catch (error) {
            setAddBarberError(error instanceof Error ? error.message : 'An error occurred while adding barber')
            setIsAddingBarber(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        <Link href="/dashboard" className="text-base md:text-lg font-semibold text-gray-900 hover:text-gray-700">
                            ← Dashboard
                        </Link>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 hidden sm:inline">{userEmail}</span>
                            <form action="/api/auth/signout" method="POST">
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                                >
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
                {/* Page Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">Shop Information</h1>
                    <p className="text-gray-600">Update your shop details and working hours.</p>
                </div>

                {saveError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
                        {saveError}
                    </div>
                )}

                {saveSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3">
                        Changes saved successfully.
                    </div>
                )}

                {/* Section 1: Shop Details */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Shop Details</h2>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-800 mb-2 block">Shop Name *</span>
                        <input
                            type="text"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="Enter your shop name"
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-800 mb-2 block">Phone *</span>
                        <input
                            type="tel"
                            value={shopPhone}
                            onChange={(e) => setShopPhone(e.target.value)}
                            placeholder="Enter shop phone number (7-15 digits)"
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-800 mb-2 block">Address (optional)</span>
                        <textarea
                            value={shopAddress}
                            onChange={(e) => setShopAddress(e.target.value)}
                            placeholder="Enter your shop address"
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </label>
                </section>

                {/* Section 2: Shop Timings */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Shop Timings</h2>
                        <p className="text-sm text-gray-600 mt-1">These timings apply to all barbers unless overridden.</p>
                    </div>

                    <div className="space-y-4">
                        {DAYS_OF_WEEK.map((day) => (
                            <div key={day} className="space-y-3 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                                <h3 className="text-sm font-medium text-gray-800">{day}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-medium text-gray-700 mb-1 block">Open Time</span>
                                        <input
                                            type="time"
                                            value={hours[day]?.openTime || '09:00'}
                                            onChange={(e) => handleTimeChange(day, 'openTime', e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-medium text-gray-700 mb-1 block">Close Time</span>
                                        <input
                                            type="time"
                                            value={hours[day]?.closeTime || '18:00'}
                                            onChange={(e) => handleTimeChange(day, 'closeTime', e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Section: Shop Availability */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-gray-900">Shop Availability</h2>
                        <p className="text-sm text-gray-600">Pause bookings for a short period when needed.</p>
                    </div>

                    <label className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={isClosed}
                            onChange={(e) => setIsClosed(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-900">Temporarily close shop</span>
                            <p className="text-sm text-gray-600">Stop new bookings during a specific date range.</p>
                        </div>
                    </label>

                    {isClosed && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium text-gray-800">Closed From *</span>
                                    <input
                                        type="date"
                                        value={closedFrom}
                                        onChange={(e) => setClosedFrom(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium text-gray-800">Closed To *</span>
                                    <input
                                        type="date"
                                        value={closedTo}
                                        onChange={(e) => setClosedTo(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </label>
                            </div>

                            <label className="space-y-1 block">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-800">Reason (optional)</span>
                                    <span className="text-xs text-gray-500">For your reference only.</span>
                                </div>
                                <textarea
                                    value={closureReason}
                                    onChange={(e) => setClosureReason(e.target.value)}
                                    rows={3}
                                    placeholder="Festival, travel, renovation, etc."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </label>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                                When enabled, customers will not be able to book appointments during the selected dates. Existing bookings remain visible and read-only; walk-ins and new bookings are disabled for those days.
                            </div>
                        </div>
                    )}
                </section>

                {/* Section 3: Barbers */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Barbers</h2>
                        <p className="text-sm text-gray-600 mt-1">Update barber details shown to customers. Maximum 2 barbers allowed.</p>
                    </div>

                    <div className="space-y-4">
                        {barberData.map((barber, idx) => (
                            <div key={barber.id} className="space-y-3 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                                <h3 className="text-sm font-medium text-gray-800">Barber {idx + 1}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-medium text-gray-700 mb-1 block">Name</span>
                                        <input
                                            type="text"
                                            value={barber.name}
                                            onChange={(e) => handleBarberNameChange(barber.id, e.target.value)}
                                            placeholder="Enter barber name"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-medium text-gray-700 mb-1 block">Phone (optional)</span>
                                        <input
                                            type="tel"
                                            value={barber.phone || ''}
                                            onChange={(e) => handleBarberPhoneChange(barber.id, e.target.value)}
                                            placeholder="Enter phone number"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </label>
                                </div>
                            </div>
                        ))}

                        {/* Add Barber Section */}
                        {barberData.length < 2 && (
                            <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-800">Add Second Barber</h3>
                                    <span className="text-xs text-gray-500">{barberData.length} of 2 barbers</span>
                                </div>

                                {addBarberError && (
                                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
                                        {addBarberError}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-medium text-gray-700 mb-1 block">Name *</span>
                                        <input
                                            type="text"
                                            value={newBarberName}
                                            onChange={(e) => setNewBarberName(e.target.value)}
                                            placeholder="Enter barber name"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-medium text-gray-700 mb-1 block">Phone (optional)</span>
                                        <input
                                            type="tel"
                                            value={newBarberPhone}
                                            onChange={(e) => setNewBarberPhone(e.target.value)}
                                            placeholder="Enter phone number"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </label>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddBarber}
                                    disabled={isAddingBarber}
                                    className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                >
                                    {isAddingBarber ? 'Adding...' : '+ Add Barber'}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Save Actions */}
                <div className="space-y-2 pt-4">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full inline-flex justify-center items-center px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <Link href="/dashboard" className="block text-center text-sm font-semibold text-gray-700 hover:text-gray-900">
                        Cancel
                    </Link>
                </div>
            </main>
        </div>
    )
}
