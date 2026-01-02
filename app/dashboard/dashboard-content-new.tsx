'use client'

import { useState } from 'react'
import Link from 'next/link'
import BarberLeaveConfirmation from '@/components/dashboard/BarberLeaveConfirmation'
import { setBarberLeaveAction } from '@/app/dashboard/barber-leave/actions'

type Barber = {
    id: string
    name: string
    isOnLeave?: boolean
}

type Props = {
    barbers: Barber[]
}

export default function DashboardContent({ barbers = [] }: Props) {
    const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [barberLeaveStatus, setBarberLeaveStatus] = useState<Record<string, boolean>>(
        barbers.reduce((acc, b) => ({ ...acc, [b.id]: b.isOnLeave || false }), {})
    )

    const handleAddLeave = (barber: Barber) => {
        setSelectedBarber(barber)
        setIsConfirmationOpen(true)
    }

    const handleMarkAvailable = async (barber: Barber) => {
        setIsLoading(true)
        const result = await setBarberLeaveAction(barber.id, false)
        if (result.success) {
            setBarberLeaveStatus((prev) => ({ ...prev, [barber.id]: false }))
        }
        setIsLoading(false)
    }

    const handleConfirmLeave = async () => {
        if (!selectedBarber) return
        setIsLoading(true)
        const result = await setBarberLeaveAction(selectedBarber.id, true)
        if (result.success) {
            setBarberLeaveStatus((prev) => ({ ...prev, [selectedBarber.id]: true }))
            setIsConfirmationOpen(false)
        }
        setIsLoading(false)
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {barbers.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Mark Barber Unavailable</label>
                            {barbers.map((barber) => (
                                <button
                                    key={barber.id}
                                    type="button"
                                    onClick={() =>
                                        barberLeaveStatus[barber.id]
                                            ? handleMarkAvailable(barber)
                                            : handleAddLeave(barber)
                                    }
                                    disabled={isLoading}
                                    className={`w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition disabled:opacity-50 ${
                                        barberLeaveStatus[barber.id]
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                    }`}
                                >
                                    {barberLeaveStatus[barber.id] ? `✓ ${barber.name} - Available` : `+ ${barber.name} - Add Leave`}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Manage</label>
                        <a
                            href="/dashboard/walk-in"
                            className="flex items-center justify-center w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-medium text-sm"
                        >
                            + Walk-In Booking
                        </a>
                        <Link
                            href="/dashboard/services"
                            className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg transition font-medium text-sm"
                        >
                            <span>Manage Services</span>
                            <span className="text-gray-400">→</span>
                        </Link>
                    </div>
                </div>
            </div>

            {selectedBarber && (
                <BarberLeaveConfirmation
                    barberName={selectedBarber.name}
                    isOpen={isConfirmationOpen}
                    onConfirm={handleConfirmLeave}
                    onCancel={() => {
                        setIsConfirmationOpen(false)
                        setSelectedBarber(null)
                    }}
                    isLoading={isLoading}
                />
            )}
        </>
    )
}
