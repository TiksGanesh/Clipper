'use client'

import { useState } from 'react'
import Link from 'next/link'
import { withProgress } from '@/lib/safe-action'
import { saveShopClosureAction, saveShopNameAction, saveWorkingHoursAction, saveBarberDetailsAction, saveShopContactAction, addBarberAction, saveLunchBreakAction, saveBrandingAction } from '@/app/dashboard/edit-shop/actions'

type Shop = {
    id: string
    name: string
    phone: string | null
    address: string | null
    slug: string
    brand_color: string
    logo_url: string | null
    tagline: string | null
    splash_image_url: string | null
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
    lunchStart?: string
    lunchEnd?: string
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const BRAND_COLOR_PRESETS = [
    '#4F46E5', // Indigo
    '#DC2626', // Red
    '#16A34A', // Green
    '#2563EB', // Blue
    '#7C3AED', // Purple
]

export default function EditShopInformation({ shop, barbers, workingHours, userEmail, lunchStart = '', lunchEnd = '' }: Props) {
    const [shopName, setShopName] = useState(shop.name)
    const [shopPhone, setShopPhone] = useState(shop.phone || '')
    const [shopAddress, setShopAddress] = useState(shop.address || '')
    const [hours, setHours] = useState<WorkingHours>(workingHours)
    const [lunchStartTime, setLunchStartTime] = useState(lunchStart)
    const [lunchEndTime, setLunchEndTime] = useState(lunchEnd)
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
    const [confirmCloseDay, setConfirmCloseDay] = useState<string | null>(null)

    // Branding state
    const [brandColor, setBrandColor] = useState(shop.brand_color || '#4F46E5')
    const [useCustomColor, setUseCustomColor] = useState(false)
    const [customColor, setCustomColor] = useState(shop.brand_color || '#4F46E5')
    const [logoUrl, setLogoUrl] = useState(shop.logo_url || '')
    const [tagline, setTagline] = useState(shop.tagline || '')
    const [splashImageUrl, setSplashImageUrl] = useState(shop.splash_image_url || '')
    const [logoPreview, setLogoPreview] = useState<string | null>(shop.logo_url || null)

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
            const contactResult = await withProgress(saveShopContactAction(shopPhone, shopAddress))
            if (!contactResult.success) {
                setSaveError(contactResult.error || 'Failed to save shop contact')
                setIsSaving(false)
                return
            }

            // Save shop name
            const nameResult = await withProgress(saveShopNameAction(shopName))
            if (!nameResult.success) {
                setSaveError(nameResult.error || 'Failed to save shop name')
                setIsSaving(false)
                return
            }

            // Save lunch break
            const lunchResult = await withProgress(saveLunchBreakAction(lunchStartTime, lunchEndTime))
            if (!lunchResult.success) {
                setSaveError(lunchResult.error || 'Failed to save lunch break')
                setIsSaving(false)
                return
            }

            // Save working hours
            const hoursResult = await withProgress(saveWorkingHoursAction(hours))
            if (!hoursResult.success) {
                setSaveError(hoursResult.error || 'Failed to save working hours')
                setIsSaving(false)
                return
            }

            // Save barber details (only existing barbers)
            const barberResult = await withProgress(saveBarberDetailsAction(barberData))
            if (!barberResult.success) {
                setSaveError(barberResult.error || 'Failed to save barber details')
                setIsSaving(false)
                return
            }

            // Save shop closure
            const closureResult = await withProgress(saveShopClosureAction(closedFrom, closedTo, closureReason, isClosed))
            if (!closureResult.success) {
                setSaveError(closureResult.error || 'Failed to save shop closure')
                setIsSaving(false)
                return
            }

            // Save branding
            const brandingResult = await withProgress(
                saveBrandingAction(
                    useCustomColor ? customColor : brandColor,
                    logoUrl,
                    tagline,
                    splashImageUrl
                )
            )
            if (!brandingResult.success) {
                setSaveError(brandingResult.error || 'Failed to save branding')
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
            const result = await withProgress(addBarberAction(newBarberName, newBarberPhone || null))

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
        <div className="space-y-6 pb-20">
            {/* Intro Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">Update Your Shop Information</h2>
                <p className="text-sm text-blue-800">Edit your shop details, working hours, staff, and availability.</p>
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

                {/* Daily Hours */}
                <div className="space-y-4">
                    {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="space-y-3 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-gray-800">{day}</h3>
                                {!hours[day]?.isOpen && (
                                    <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                                        Closed
                                    </span>
                                )}
                            </div>

                            {hours[day]?.isOpen ? (
                                <>
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
                                    <button
                                        type="button"
                                        onClick={() => setConfirmCloseDay(day)}
                                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                        aria-label={`Mark ${day} as closed`}
                                    >
                                        Mark as Closed
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHours((prev) => ({
                                            ...prev,
                                            [day]: { ...prev[day], isOpen: true },
                                        }))
                                    }}
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                    Open Shop
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Lunch Break */}
                <div className="pt-4 border-t border-gray-200 space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">Shop Lunch Break</h3>
                    <p className="text-xs text-gray-600">Specify a daily lunch break when no appointments can be booked for any barber.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-medium text-gray-700 mb-1 block">Lunch Start (optional)</span>
                            <input
                                type="time"
                                value={lunchStartTime}
                                onChange={(e) => setLunchStartTime(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-700 mb-1 block">Lunch End (optional)</span>
                            <input
                                type="time"
                                value={lunchEndTime}
                                onChange={(e) => setLunchEndTime(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </label>
                    </div>
                </div>
            </section>

            {/* Confirm Mark as Closed - Modal */}
            {confirmCloseDay && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmCloseDay(null)} />
                    <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-xl shadow-lg p-4 sm:p-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Mark as Closed</h3>
                        <p className="mt-2 text-sm text-gray-600">Are you sure you want to mark <span className="font-medium">{confirmCloseDay}</span> as closed?</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                                onClick={() => setConfirmCloseDay(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                onClick={() => {
                                    if (!confirmCloseDay) return
                                    setHours((prev) => ({
                                        ...prev,
                                        [confirmCloseDay]: { ...prev[confirmCloseDay], isOpen: false },
                                    }))
                                    setConfirmCloseDay(null)
                                }}
                            >
                                Yes, Close it
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* BRANDING SECTION */}
            <section className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Branding</h3>

                {/* Shop URL (Read-only) */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shop URL</label>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                        <span className="text-gray-500 text-sm">/shop/</span>
                        <span className="text-gray-900 font-medium">{shop.slug}</span>
                        <span className="text-xs text-gray-500 ml-auto">(Cannot be changed)</span>
                    </div>
                </div>

                {/* Brand Color */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brand Color</label>
                    <div className="flex gap-2 mb-3">
                        {BRAND_COLOR_PRESETS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    setBrandColor(color)
                                    setUseCustomColor(false)
                                }}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${brandColor === color && !useCustomColor
                                        ? 'border-gray-800 scale-110'
                                        : 'border-gray-300 hover:scale-105'
                                    }`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={useCustomColor ? customColor : brandColor}
                            onChange={(e) => {
                                setCustomColor(e.target.value)
                                setBrandColor(e.target.value)
                                setUseCustomColor(true)
                            }}
                            className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <span className="text-sm text-gray-600">
                            {useCustomColor ? customColor : brandColor}
                        </span>
                    </div>
                </div>

                {/* Logo URL */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL (optional)</label>
                    <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => {
                            setLogoUrl(e.target.value)
                            setLogoPreview(e.target.value || null)
                        }}
                        placeholder="https://example.com/logo.png"
                        className="w-full border px-3 py-2 rounded text-sm"
                    />
                    {logoPreview && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Preview:</span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={logoPreview}
                                alt="Logo preview"
                                className="w-12 h-12 object-contain rounded border border-gray-200"
                                onError={() => setLogoPreview(null)}
                            />
                        </div>
                    )}
                </div>

                {/* Tagline */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tagline (optional)
                        <span className="text-xs text-gray-500 ml-1">
                            {tagline.length}/150
                        </span>
                    </label>
                    <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value.slice(0, 150))}
                        placeholder="e.g., Premium haircuts since 2020"
                        maxLength={150}
                        className="w-full border px-3 py-2 rounded text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Appears on splash screen and landing page
                    </p>
                </div>

                {/* Splash Image URL */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Splash Image URL (optional)</label>
                    <input
                        type="url"
                        value={splashImageUrl}
                        onChange={(e) => setSplashImageUrl(e.target.value)}
                        placeholder="https://example.com/splash.jpg"
                        className="w-full border px-3 py-2 rounded text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Background image for the splash screen
                    </p>
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
        </div>
    )
}
