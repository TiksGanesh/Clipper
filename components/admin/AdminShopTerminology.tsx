'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getShopTerminology, BusinessType, getDefaultTerminology } from '@/src/hooks/useShopTerminology'

interface Shop {
    id: string
    name: string
    business_type: BusinessType
    terminology_overrides?: Record<string, string> | null
}

interface AdminShopTerminologyProps {
    shopId: string
}

interface TerminologyField {
    key: keyof ReturnType<typeof getShopTerminology>
    label: string
    description: string
}

const TERMINOLOGY_FIELDS: TerminologyField[] = [
    {
        key: 'staff_label',
        label: 'Staff Member Label',
        description: 'What you call your staff (e.g., Barber, Stylist, Doctor)'
    },
    {
        key: 'service_label',
        label: 'Service Label',
        description: 'What you call your services (e.g., Haircut, Treatment, Consultation)'
    },
    {
        key: 'customer_label',
        label: 'Customer Label',
        description: 'What you call your customers (e.g., Customer, Client, Patient)'
    },
    {
        key: 'booking_action',
        label: 'Booking Button Text',
        description: 'Text shown on booking buttons (e.g., Book Seat, Book Appointment, Book Visit)'
    },
    {
        key: 'queue_msg',
        label: 'Queue Status Message',
        description: 'Message shown in queue (e.g., People ahead in chair, Clients ahead, Patients in waiting)'
    }
]

export function AdminShopTerminology({ shopId }: AdminShopTerminologyProps) {
    const router = useRouter()
    const [shop, setShop] = useState<Shop | null>(null)
    const [overrides, setOverrides] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Load shop data
    const fetchShopTerminology = useCallback(async () => {

        try {
            const response = await fetch(`/api/admin/shops/${shopId}/terminology`)
            if (!response.ok) {
                throw new Error('Failed to fetch shop terminology')
            }
            const data = await response.json()
            setShop(data.shop)
            setOverrides(data.shop.terminology_overrides || {})
        } catch (error) {
            console.error('Error fetching terminology:', error)
            setMessage({ type: 'error', text: 'Failed to load shop terminology' })
        } finally {
            setIsLoading(false)
        }
    }, [shopId])

    useEffect(() => {
        fetchShopTerminology()
    }, [fetchShopTerminology])

    const handleFieldChange = (field: string, value: string) => {
        setOverrides(prev => {
            const updated = { ...prev }
            // Preserve user-entered spacing; only drop the key when input is effectively empty
            if (value.trim().length > 0) {
                updated[field] = value
            } else {
                delete updated[field]
            }
            return updated
        })
    }

    const handleReset = () => {
        setOverrides({})
        setMessage({ type: 'success', text: 'Reset to defaults (not saved yet)' })
    }

    const handleSave = async () => {
        if (!shop) return

        setIsSaving(true)
        setMessage(null)

        try {
            const response = await fetch(`/api/admin/shops/${shopId}/terminology`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    terminology_overrides: Object.keys(overrides).length > 0 ? overrides : null
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update terminology')
            }

            const { shop: updatedShop } = await response.json()
            setShop(updatedShop)
            setMessage({ type: 'success', text: 'Terminology updated successfully!' })

            // Auto-clear success message after 3 seconds
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Save error:', error)
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Failed to save changes. Please try again.'
            })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    if (!shop) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Shop not found</p>
            </div>
        )
    }

    const defaultTerms = getDefaultTerminology(shop.business_type)
    const previewTerms = getShopTerminology(shop.business_type, overrides)

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.back()}
                    className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1"
                >
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Customize Terminology</h1>
                <p className="text-gray-600 mt-1">
                    Shop: <span className="font-medium">{shop.name}</span> ({shop.business_type})
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                    <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Customize how this shop&apos;s terminology appears to customers.
                        Leave fields empty to use the default terminology for {shop.business_type}s.
                    </p>
                </div>

                {/* Terminology Fields */}
                <div className="space-y-6 mb-8">
                    {TERMINOLOGY_FIELDS.map((field) => (
                        <div key={field.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {field.label}
                            </label>
                            <input
                                type="text"
                                value={overrides[field.key] || ''}
                                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                placeholder={defaultTerms[field.key]}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {field.description} • Default: <strong>{defaultTerms[field.key]}</strong>
                            </p>
                        </div>
                    ))}
                </div>

                {/* Preview Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Live Preview</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-600">Staff:</span>
                            <span className="ml-2 font-medium text-gray-900">{previewTerms.staff_label}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Service:</span>
                            <span className="ml-2 font-medium text-gray-900">{previewTerms.service_label}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Customer:</span>
                            <span className="ml-2 font-medium text-gray-900">{previewTerms.customer_label}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Button:</span>
                            <span className="ml-2 font-medium text-gray-900">{previewTerms.booking_action}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-gray-600">Queue Message:</span>
                            <span className="ml-2 font-medium text-gray-900">{previewTerms.queue_msg}</span>
                        </div>
                    </div>
                </div>

                {/* Message Display */}
                {message && (
                    <div className={`mb-4 p-3 rounded-md ${message.type === 'success'
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={isSaving}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                        Reset to Defaults
                    </button>
                </div>
            </div>
        </div>
    )
}
