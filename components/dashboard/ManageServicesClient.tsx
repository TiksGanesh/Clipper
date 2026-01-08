'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { withProgress } from '@/lib/safe-action'
import { createServiceAction, updateServiceAction, deleteServiceAction } from '@/app/dashboard/services/actions'

type Service = {
    id: string
    name: string
    duration: number
    price: number
    advanceAmount: number
    requiresAdvance: boolean
    isActive: boolean
}

type Props = {
    services: Service[]
    userEmail: string
    errorMessage?: string
}

type ModalMode = 'add' | 'edit' | null

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360]

function formatPrice(priceInRupees: number): string {
    if (priceInRupees === 0) return 'Free'
    return `₹${priceInRupees.toFixed(0)}`
}

function formatDuration(minutes: number): string {
    if (minutes <= 60) {
        return `${minutes} minutes`
    }
    const hours = minutes / 60
    return `${hours} hours`
}

export default function ManageServicesClient({ services, userEmail, errorMessage }: Props) {
    const [items, setItems] = useState<Service[]>(services)
    const [modalMode, setModalMode] = useState<ModalMode>(null)
    const [editing, setEditing] = useState<Service | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Service | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string>('')

    const [name, setName] = useState('')
    const [duration, setDuration] = useState<number>(30)
    const [price, setPrice] = useState<number>(0)
    const [advanceAmount, setAdvanceAmount] = useState<number>(0)
    const [requiresAdvance, setRequiresAdvance] = useState<boolean>(false)

    const sortedServices = useMemo(() => items, [items])

    const openAdd = () => {
        setModalMode('add')
        setEditing(null)
        setName('')
        setDuration(30)
        setPrice(0)
        setAdvanceAmount(0)
        setRequiresAdvance(false)
        setError('')
    }

    const openEdit = (svc: Service) => {
        setModalMode('edit')
        setEditing(svc)
        setName(svc.name)
        setDuration(svc.duration)
        setPrice(svc.price)
        setAdvanceAmount(svc.advanceAmount)
        setRequiresAdvance(svc.requiresAdvance)
        setError('')
    }

    const closeModal = () => {
        setModalMode(null)
        setEditing(null)
        setError('')
    }

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Service name is required')
            return
        }
        if (!duration) {
            setError('Duration is required')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            if (modalMode === 'add') {
                const formData = new FormData()
                formData.append('name', name.trim())
                formData.append('duration', duration.toString())
                formData.append('price', price.toString())
                formData.append('advance_amount', advanceAmount.toString())
                formData.append('requires_advance', requiresAdvance ? 'on' : 'off')
                await withProgress(createServiceAction(formData))
                // Refresh the page to show the new service
                window.location.reload()
            }

            if (modalMode === 'edit' && editing) {
                const formData = new FormData()
                formData.append('id', editing.id)
                formData.append('name', name.trim())
                formData.append('duration', duration.toString())
                formData.append('price', price.toString())
                formData.append('advance_amount', advanceAmount.toString())
                formData.append('requires_advance', requiresAdvance ? 'on' : 'off')
                formData.append('is_active', editing.isActive ? 'on' : 'off')
                await withProgress(updateServiceAction(formData))
                // Refresh the page to show updated service
                window.location.reload()
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleActive = async (id: string) => {
        const service = items.find((s) => s.id === id)
        if (!service) return

        setIsLoading(true)
        setError('')

        try {
            const formData = new FormData()
            formData.append('id', id)
            formData.append('name', service.name)
            formData.append('duration', service.duration.toString())
            formData.append('price', service.price.toString())
            formData.append('advance_amount', service.advanceAmount.toString())
            formData.append('requires_advance', service.requiresAdvance ? 'on' : 'off')
            formData.append('is_active', (!service.isActive) ? 'on' : 'off')
            await withProgress(updateServiceAction(formData))
            // Refresh the page to show updated status
            window.location.reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update service')
        } finally {
            setIsLoading(false)
        }
    }

    const confirmDeleteService = async () => {
        if (!confirmDelete) return

        setIsLoading(true)
        setError('')

        try {
            const formData = new FormData()
            formData.append('id', confirmDelete.id)
            await withProgress(deleteServiceAction(formData))
            // Refresh the page to show the deletion
            window.location.reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete service')
        } finally {
            setIsLoading(false)
            setConfirmDelete(null)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Compact Sticky Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="p-1 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Back to Dashboard">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="flex-1 text-lg font-bold text-gray-900">Services</h1>
                <button
                    type="button"
                    onClick={openAdd}
                    className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors" 
                    aria-label="Add Service"
                >
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </header>

            <main className="max-w-5xl mx-auto p-4 space-y-4">

                <section className="space-y-4">
                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
                            Could not load services. Showing cached data. ({errorMessage})
                        </div>
                    )}

                    {sortedServices.length === 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-6 text-sm text-gray-600">
                            No services yet. Add your first service to show it in booking.
                        </div>
                    )}

                    {sortedServices.map((service) => (
                        <article
                            key={service.id}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3"
                        >
                            {/* Content Section */}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h2 className="text-lg font-bold text-gray-900">{service.name}</h2>
                                    <span className="text-lg font-bold text-indigo-600">{formatPrice(service.price)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
                                    <span>⏱</span>
                                    <span>{formatDuration(service.duration)}</span>
                                </div>
                                {service.requiresAdvance && (
                                    <p className="text-xs text-amber-700 mt-2">
                                        Advance: {formatPrice(service.advanceAmount)} required
                                    </p>
                                )}
                            </div>

                            {/* Action Footer */}
                            <div className="bg-gray-50 p-3 flex items-center justify-between border-t border-gray-100">
                                {/* Status Badge / Toggle Button */}
                                <button
                                    type="button"
                                    onClick={() => toggleActive(service.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                                        service.isActive
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                    }`}
                                    disabled={isLoading}
                                >
                                    {service.isActive ? '●' : '○'} {service.isActive ? 'Active' : 'Disabled'}
                                </button>

                                {/* Edit & Delete Buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(service)}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 shadow-sm active:bg-gray-50 transition-all"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(service)}
                                        className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-semibold text-red-600 shadow-sm active:bg-red-50 transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            </main>

            {/* Add / Edit Bottom Sheet / Modal */}
            {modalMode && (
                <div className="fixed inset-0 z-40">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeModal} />
                    <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center px-4 md:px-0">
                        <div className="bg-white rounded-t-xl md:rounded-xl border border-gray-200 shadow-md w-full md:max-w-lg md:mx-auto p-4 md:p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {modalMode === 'add' ? 'Add Service' : 'Edit Service'}
                                    </h3>
                                    <p className="text-sm text-gray-600">Fields marked with * are required.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={isLoading}
                                    className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium text-gray-800">Service Name *</span>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter service name"
                                        disabled={isLoading}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                </label>

                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium text-gray-800">Duration *</span>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                        disabled={isLoading}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        {DURATION_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {formatDuration(opt)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium text-gray-800">Price (₹)</span>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                                        placeholder="0"
                                        min="0"
                                        disabled={isLoading}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-xs text-gray-500">Service cost shown to customers</p>
                                </label>

                                <div className="border-t pt-4 space-y-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={requiresAdvance}
                                            onChange={(e) => {
                                                setRequiresAdvance(e.target.checked)
                                                if (!e.target.checked) {
                                                    setAdvanceAmount(0)
                                                }
                                            }}
                                            disabled={isLoading}
                                            className="w-4 h-4 border border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className="text-sm font-medium text-gray-800">Require advance payment</span>
                                    </label>

                                    {requiresAdvance && (
                                        <label className="space-y-1 block">
                                            <span className="text-sm font-medium text-gray-800">Advance Amount (₹)</span>
                                            <input
                                                type="number"
                                                value={advanceAmount}
                                                onChange={(e) => setAdvanceAmount(Math.max(0, Number(e.target.value)))}
                                                placeholder="0"
                                                min="0"
                                                max={price}
                                                disabled={isLoading}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                            />
                                            <p className="text-xs text-gray-500">Amount customer must pay upfront</p>
                                        </label>
                                    )}
                                    <p className="text-xs text-amber-600 mt-2">
                                        Note: Advance payment will be stored once the database is updated.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="w-full inline-flex justify-center items-center px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Saving...' : modalMode === 'add' ? 'Add Service' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={isLoading}
                                    className="w-full text-sm font-semibold text-gray-700 hover:text-gray-900 focus:outline-none disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {confirmDelete && (
                <div className="fixed inset-0 z-40">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => !isLoading && setConfirmDelete(null)} />
                    <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center px-4 md:px-0">
                        <div className="bg-white rounded-t-xl md:rounded-xl border border-gray-200 shadow-md w-full md:max-w-md md:mx-auto p-4 md:p-6 space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-gray-900">Delete this service?</h3>
                                <p className="text-sm text-gray-600">This will hide it from customer booking immediately.</p>
                            </div>
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={confirmDeleteService}
                                    disabled={isLoading}
                                    className="w-full inline-flex justify-center items-center px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-400 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Deleting...' : 'Delete'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    disabled={isLoading}
                                    className="w-full text-sm font-semibold text-gray-700 hover:text-gray-900 focus:outline-none disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
