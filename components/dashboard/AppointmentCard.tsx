'use client'

import { useTransition } from 'react'
import {
    seatCustomerAction,
    markBookingCompletedAction,
    markBookingNoShowAction,
    cancelBookingAction,
} from '@/app/barber/calendar/actions'

type AppointmentStatus = 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'

type Props = {
    bookingId: string
    serviceName: string
    customerName: string
    customerPhone?: string
    appointmentTime: string
    duration: number
    barberName?: string
    status: AppointmentStatus
    isWalkIn?: boolean
}

const STATUS_CONFIG = {
    confirmed: {
        label: 'Waiting',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        badgeColor: 'bg-blue-100 text-blue-800',
    },
    seated: {
        label: 'In Chair',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-400 border-2',
        badgeColor: 'bg-green-100 text-green-800',
    },
    completed: {
        label: 'Done',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-300',
        badgeColor: 'bg-gray-100 text-gray-800',
    },
    no_show: {
        label: 'No-show',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-300',
        badgeColor: 'bg-orange-100 text-orange-800',
    },
    canceled: {
        label: 'Cancelled',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        badgeColor: 'bg-red-100 text-red-800',
    },
}

export default function AppointmentCard({
    bookingId,
    serviceName,
    customerName,
    customerPhone,
    appointmentTime,
    duration,
    barberName,
    status,
    isWalkIn = false,
}: Props) {
    const [isPending, startTransition] = useTransition()
    const config = STATUS_CONFIG[status]

    const handleSeatCustomer = () => {
        startTransition(async () => {
            try {
                await seatCustomerAction({ bookingId })
            } catch (error) {
                console.error('Failed to seat customer:', error)
            }
        })
    }

    const handleMarkCompleted = () => {
        startTransition(async () => {
            try {
                await markBookingCompletedAction({ bookingId })
            } catch (error) {
                console.error('Failed to complete booking:', error)
            }
        })
    }

    const handleMarkNoShow = () => {
        startTransition(async () => {
            try {
                await markBookingNoShowAction({ bookingId })
            } catch (error) {
                console.error('Failed to mark as no-show:', error)
            }
        })
    }

    const handleCancel = () => {
        startTransition(async () => {
            try {
                await cancelBookingAction({ bookingId })
            } catch (error) {
                console.error('Failed to cancel booking:', error)
            }
        })
    }

    return (
        <div
            className={`rounded-lg border p-3 sm:p-4 transition-all ${config.bgColor} ${config.borderColor}`}
        >
            {/* Header with status badge and icons */}
            <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                        {customerName}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{appointmentTime}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${config.badgeColor}`}>
                    {config.label}
                </span>
            </div>

            {/* Service details */}
            <div className="space-y-1 mb-3 text-xs sm:text-sm">
                <p className="text-gray-700">
                    <span className="font-medium">Service:</span> {serviceName}
                </p>
                <p className="text-gray-600">
                    <span className="font-medium">Duration:</span> {duration} min
                </p>
                {customerPhone && (
                    <p className="text-gray-600">
                        <span className="font-medium">Phone:</span> {customerPhone}
                    </p>
                )}
                {isWalkIn && (
                    <p className="text-purple-600 font-medium">
                        ✓ Walk-in
                    </p>
                )}
            </div>

            {/* Status Action Bar - Mobile optimized */}
            <div className="border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
                {status === 'confirmed' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                        <button
                            onClick={handleSeatCustomer}
                            disabled={isPending}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            ✂️ Seat
                        </button>
                        <button
                            onClick={handleMarkNoShow}
                            disabled={isPending}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-orange-500 text-white font-medium rounded-md hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            ❌ No Show
                        </button>
                    </div>
                )}

                {status === 'seated' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                        <button
                            onClick={handleMarkCompleted}
                            disabled={isPending}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            ✅ Complete
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={isPending}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-gray-400 text-white font-medium rounded-md hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {status === 'completed' && (
                    <div className="text-center py-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                            Service completed
                        </p>
                    </div>
                )}

                {(status === 'canceled' || status === 'no_show') && (
                    <div className="text-center py-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                            {status === 'canceled' ? 'Booking cancelled' : 'Marked as no-show'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
