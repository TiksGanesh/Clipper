'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createServiceAction, updateServiceAction, deleteServiceAction } from '@/app/dashboard/services/actions'

type Service = {
    id: string
    name: string
    duration: number
    isActive: boolean
}

type Props = {
    services: Service[]
    userEmail: string
    errorMessage?: string
}

type ModalMode = 'add' | 'edit' | null

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360]

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

    const sortedServices = useMemo(() => items, [items])

    const openAdd = () => {
        setModalMode('add')
        setEditing(null)
        setName('')
        setDuration(30)
        setError('')
    }

    const openEdit = (svc: Service) => {
        setModalMode('edit')
        setEditing(svc)
        setName(svc.name)
        setDuration(svc.duration)
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
                formData.append('price', '0')
                await createServiceAction(formData)
                // Refresh the page to show the new service
                window.location.reload()
            }

            if (modalMode === 'edit' && editing) {
                const formData = new FormData()
                formData.append('id', editing.id)
                formData.append('name', name.trim())
                formData.append('duration', duration.toString())
                formData.append('price', '0')
                formData.append('is_active', editing.isActive ? 'on' : 'off')
                await updateServiceAction(formData)
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
            formData.append('price', '0')
            formData.append('is_active', (!service.isActive) ? 'on' : 'off')
            await updateServiceAction(formData)
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
            await deleteServiceAction(formData)
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
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-0 sm:h-16 gap-2 sm:gap-4">
                        <Link href="/dashboard" className="text-base sm:text-xl font-bold text-gray-900 hover:text-gray-700">
                            ← Back
                        </Link>
                        <div className="flex items-center gap-2 sm:gap-4 text-sm">
                            <span className="text-gray-600 truncate max-w-[150px] sm:max-w-none">{userEmail}</span>
                            <form action="/api/auth/signout" method="POST">
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                                >
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Services</h1>
                        <p className="text-sm md:text-base text-gray-600">Services shown to customers during booking.</p>
                    </div>
                    <button
                        type="button"
                        onClick={openAdd}
                        className="inline-flex justify-center items-center px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        Add Service
                    </button>
                </div>

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
                            className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5 flex flex-col gap-3"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold text-gray-900">{service.name}</h2>
                                        <span
                                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                                service.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {service.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700">Duration: {formatDuration(service.duration)}</p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleActive(service.id)}
                                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {service.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => openEdit(service)}
                                    className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(service)}
                                    className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    Delete
                                </button>
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
