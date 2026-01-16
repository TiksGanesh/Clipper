'use client'

import { useState } from 'react'
import { createShopAction } from '@/app/setup/actions'

const BRAND_COLOR_PRESETS = [
    '#4F46E5', // Indigo
    '#DC2626', // Red
    '#16A34A', // Green
    '#2563EB', // Blue
    '#7C3AED', // Purple
]

function SetupShopForm({
    error,
}: {
    error?: string
}) {
    const [shopName, setShopName] = useState('')
    const [slug, setSlug] = useState('')
    const [brandColor, setBrandColor] = useState(BRAND_COLOR_PRESETS[0])
    const [useCustomColor, setUseCustomColor] = useState(false)
    const [customColor, setCustomColor] = useState('#4F46E5')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Auto-generate slug from shop name
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        setShopName(name)

        // Auto-generate slug if user hasn't manually edited it
        if (!slug || slug === shopName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) {
            const newSlug = name
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
            setSlug(newSlug)
        }
    }

    // Validate and sanitize slug
    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        const sanitized = value
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
        setSlug(sanitized)
    }

    const handleColorSelect = (color: string) => {
        setBrandColor(color)
        setUseCustomColor(false)
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)

        const formData = new FormData(e.currentTarget)
        // Add branding fields to form
        formData.set('slug', slug)
        formData.set('brand_color', useCustomColor ? customColor : brandColor)

        await createShopAction(formData)
    }

    return (
        <div className="max-w-lg mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 1: Create Shop</h1>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Shop Name */}
                <div>
                    <label className="block text-sm font-medium">Shop Name</label>
                    <input
                        name="name"
                        value={shopName}
                        onChange={handleNameChange}
                        required
                        maxLength={100}
                        minLength={2}
                        pattern="[A-Za-z0-9\s&'\-]+"
                        title="Shop name should be 2-100 characters (letters, numbers, spaces, &, ', -)"
                        className="mt-1 w-full border px-3 py-2 rounded"
                    />
                </div>

                {/* Shop URL Slug */}
                <div>
                    <label className="block text-sm font-medium">Shop URL (Slug)</label>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-gray-500">/shop/</span>
                        <input
                            name="slug"
                            value={slug}
                            onChange={handleSlugChange}
                            required
                            minLength={2}
                            maxLength={50}
                            pattern="[a-z0-9-]+"
                            title="Use only lowercase letters, numbers, and hyphens"
                            placeholder="my-shop"
                            className="flex-1 border px-3 py-2 rounded"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Auto-generated from shop name. Edit manually if needed.</p>
                </div>

                {/* Phone */}
                <div>
                    <label className="block text-sm font-medium">Phone</label>
                    <input
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        required
                        pattern="[0-9]{10,15}"
                        maxLength={15}
                        title="Enter a valid phone number (10-15 digits)"
                        className="mt-1 w-full border px-3 py-2 rounded"
                    />
                </div>

                {/* Address */}
                <div>
                    <label className="block text-sm font-medium">Address (optional)</label>
                    <input
                        name="address"
                        maxLength={500}
                        className="mt-1 w-full border px-3 py-2 rounded"
                    />
                </div>

                {/* Brand Color */}
                <div>
                    <label className="block text-sm font-medium mb-3">Brand Color</label>

                    {/* Preset Colors */}
                    <div className="flex gap-3 mb-3">
                        {BRAND_COLOR_PRESETS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => handleColorSelect(color)}
                                className={`w-10 h-10 rounded-full border-2 transition-transform ${brandColor === color && !useCustomColor
                                        ? 'border-gray-800 scale-110'
                                        : 'border-gray-300 hover:scale-105'
                                    }`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>

                    {/* Custom Color Picker */}
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

                {/* Tagline */}
                <div>
                    <label className="block text-sm font-medium">Tagline (optional)</label>
                    <input
                        name="tagline"
                        type="text"
                        maxLength={150}
                        placeholder="e.g., Premium haircuts since 2020"
                        className="mt-1 w-full border px-3 py-2 rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">Appears on the splash screen and landing page.</p>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Creating Shop...' : 'Save and Continue'}
                </button>
            </form>
        </div>
    )
}

export default function SetupShopPage({
    searchParams,
}: {
    searchParams: { error?: string }
}) {
    return <SetupShopForm error={searchParams.error} />
}
