'use client'

import { useState } from 'react'
import Link from 'next/link'
import { addBarberLeaveAction, removeBarberLeaveAction } from '@/app/dashboard/manage-leave/actions'

type Barber = {
    id: string
    name: string
}

type Leave = {
    id: string
    barberId: string
    barberName: string
    leaveDate: string
}

type Props = {
    barbers: Barber[]
    leaves: Leave[]
    userEmail: string
}

export default function ManageBarberLeave({ barbers, leaves, userEmail }: Props) {
    const [leaveList, setLeaveList] = useState<Leave[]>(leaves)
    const [selectedBarberId, setSelectedBarberId] = useState(barbers[0]?.id || '')
    const [leaveDate, setLeaveDate] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleMarkToday = async () => {
        if (!selectedBarberId) return
        setIsAdding(true)
        setError('')
        setSuccess('')

        const today = new Date().toISOString().split('T')[0]
        const selectedBarber = barbers.find((b) => b.id === selectedBarberId)

        const result = await addBarberLeaveAction(selectedBarberId, today)
        
        if (result.success) {
            setLeaveList((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    barberId: selectedBarberId,
                    barberName: selectedBarber?.name || '',
                    leaveDate: today,
                },
            ])
            setSuccess(`${selectedBarber?.name} marked unavailable for today`)
        } else {
            setError(result.error || 'Failed to add leave')
        }
        
        setIsAdding(false)
        setTimeout(() => {
            setSuccess('')
            setError('')
        }, 3000)
    }

    const handleAddLeave = async () => {
        if (!selectedBarberId || !leaveDate) {
            setError('Please select barber and date')
            return
        }

        setIsAdding(true)
        setError('')
        setSuccess('')

        const selectedBarber = barbers.find((b) => b.id === selectedBarberId)

        const result = await addBarberLeaveAction(selectedBarberId, leaveDate)
        
        if (result.success) {
            setLeaveList((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    barberId: selectedBarberId,
                    barberName: selectedBarber?.name || '',
                    leaveDate,
                },
            ])
            setSuccess('Leave added successfully')
            setLeaveDate('')
        } else {
            if (result.error?.includes('duplicate') || result.error?.includes('already exists')) {
                setError('Leave already exists for this date')
            } else {
                setError(result.error || 'Failed to add leave')
            }
        }
        
        setIsAdding(false)
        setTimeout(() => {
            setSuccess('')
            setError('')
        }, 3000)
    }

    const handleDeleteLeave = async (leaveId: string) => {
        const result = await removeBarberLeaveAction(leaveId)
        
        if (result.success) {
            setLeaveList((prev) => prev.filter((l) => l.id !== leaveId))
            setSuccess('Leave removed successfully')
        } else {
            setError(result.error || 'Failed to remove leave')
        }
        
        setTimeout(() => {
            setSuccess('')
            setError('')
        }, 3000)
    }

    const sortedLeaves = [...leaveList].sort((a, b) => new Date(b.leaveDate).getTime() - new Date(a.leaveDate).getTime())

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
            <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
                {/* Page Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">Manage Barber Leave</h1>
                    <p className="text-gray-600">Mark barbers unavailable for specific dates to prevent bookings.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">{error}</div>
                )}

                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3">
                        {success}
                    </div>
                )}

                {/* Quick Action: Mark Today */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Quick Action</h2>
                        <p className="text-sm text-gray-600 mt-1">Mark a barber unavailable for today.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={selectedBarberId}
                            onChange={(e) => setSelectedBarberId(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            {barbers.map((barber) => (
                                <option key={barber.id} value={barber.id}>
                                    {barber.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleMarkToday}
                            disabled={isAdding}
                            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {isAdding ? 'Processing...' : 'Mark Unavailable Today'}
                        </button>
                    </div>
                </section>

                {/* Add Leave Form */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Add Leave</h2>
                        <p className="text-sm text-gray-600 mt-1">Schedule leave for a specific date.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select
                            value={selectedBarberId}
                            onChange={(e) => setSelectedBarberId(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            {barbers.map((barber) => (
                                <option key={barber.id} value={barber.id}>
                                    {barber.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={leaveDate}
                            onChange={(e) => setLeaveDate(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={handleAddLeave}
                            disabled={isAdding}
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {isAdding ? 'Adding...' : 'Add Leave'}
                        </button>
                    </div>
                </section>

                {/* Leave List */}
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Scheduled Leaves</h2>
                        <p className="text-sm text-gray-600 mt-1">All upcoming and past leaves.</p>
                    </div>

                    {sortedLeaves.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">No leaves scheduled.</div>
                    ) : (
                        <div className="space-y-2">
                            {sortedLeaves.map((leave) => (
                                <div
                                    key={leave.id}
                                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">{leave.barberName}</p>
                                        <p className="text-sm text-gray-600">
                                            {new Date(leave.leaveDate).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteLeave(leave.id)}
                                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}
