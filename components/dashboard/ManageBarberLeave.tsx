'use client'

import { useState } from 'react'
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
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3">
                    {success}
                </div>
            )}

            {/* Quick Action: Mark Today */}
            <section className="bg-white border border-amber-200 rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Quick Action</h2>
                    <span className="text-xs text-amber-700">Today</span>
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
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Add Leave</h2>
                    <span className="text-xs text-gray-500">Future dates</span>
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
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Scheduled Leaves</h2>
                    <span className="text-xs text-gray-500">Review</span>
                </div>

                {sortedLeaves.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">No leaves scheduled.</div>
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
        </div>
    )
}
