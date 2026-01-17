'use client'

type AppointmentStatus = 'confirmed' | 'seated' | 'completed' | 'no_show' | 'canceled' | 'pending_payment'

type Props = {
    isOpen: boolean
    onClose: () => void
    // Appointment details
    serviceName: string
    appointmentTime: string
    status: AppointmentStatus
    customerName: string
    customerPhone?: string
    barberName: string
    dateTime: string
    duration: number
    isWalkIn?: boolean
    staffLabel?: string
    customerLabel?: string
    // Actions
    onSeatCustomer?: () => void
    onMarkCompleted?: () => void
    onMarkNoShow?: () => void
    onCancel?: () => void
}

const STATUS_CONFIG = {
    confirmed: { label: 'Waiting', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    seated: { label: 'In Chair', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    completed: { label: 'Completed', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
    no_show: { label: 'No-show', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
    canceled: { label: 'Cancelled', bgColor: 'bg-red-100', textColor: 'text-red-800' },
    pending_payment: { label: 'Payment Pending', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
}

export default function AppointmentDetailSheet({
    isOpen,
    onClose,
    serviceName,
    appointmentTime,
    status,
    customerName,
    customerPhone,
    barberName,
    dateTime,
    duration,
    isWalkIn = false,
    staffLabel = 'Barber',
    customerLabel = 'Customer',
    onSeatCustomer,
    onMarkCompleted,
    onMarkNoShow,
    onCancel,
}: Props) {
    if (!isOpen) return null

    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG['confirmed']

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Bottom Sheet / Modal */}
            <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50">
                <div className="bg-white rounded-t-xl md:rounded-xl border border-gray-200 shadow-md w-full md:max-w-lg md:mx-4 max-h-[90vh] overflow-y-auto">
                    {/* Header Section */}
                    <div className="p-4 md:p-6 border-b border-gray-200">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1">
                                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                                    {serviceName}
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {appointmentTime}
                                </p>
                            </div>
                            <span
                                className={`${statusConfig.bgColor} ${statusConfig.textColor} px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap`}
                            >
                                {statusConfig.label}
                            </span>
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="p-4 md:p-6 space-y-4 border-b border-gray-200">
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">{customerLabel} Name</p>
                                <p className="text-base font-medium text-gray-900 mt-1">
                                    {customerName}
                                    {isWalkIn && (
                                        <span className="ml-2 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                            Walk-in
                                        </span>
                                    )}
                                </p>
                            </div>

                            {customerPhone && (
                                <div>
                                    <p className="text-sm text-gray-600">Phone Number</p>
                                    <p className="text-base font-medium text-gray-900 mt-1">
                                        {customerPhone}
                                    </p>
                                </div>
                            )}

                            <div>
                                <p className="text-sm text-gray-600">{staffLabel}</p>
                                <p className="text-base font-medium text-gray-900 mt-1">
                                    {barberName}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">Date & Time</p>
                                <p className="text-base font-medium text-gray-900 mt-1">
                                    {dateTime}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600">Duration</p>
                                <p className="text-base font-medium text-gray-900 mt-1">
                                    {duration} minutes
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions Section */}
                    <div className="p-4 md:p-6">
                        {status === 'confirmed' && (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSeatCustomer?.()
                                        onClose()
                                    }}
                                    className="w-full bg-green-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                                >
                                    ✂️ Seat Customer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onMarkNoShow?.()
                                        onClose()
                                    }}
                                    className="w-full bg-white text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                                >
                                    ❌ No-show
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCancel?.()
                                        onClose()
                                    }}
                                    className="w-full text-red-600 font-medium py-2 px-4 hover:text-red-700 focus:outline-none focus:underline transition-colors"
                                >
                                    Cancel Appointment
                                </button>
                            </div>
                        )}

                        {status === 'seated' && (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onMarkCompleted?.()
                                        onClose()
                                    }}
                                    className="w-full bg-emerald-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
                                >
                                    ✅ Complete
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCancel?.()
                                        onClose()
                                    }}
                                    className="w-full text-gray-600 font-medium py-2 px-4 hover:text-gray-700 focus:outline-none focus:underline transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {status === 'completed' && (
                            <div className="text-center py-2">
                                <p className="text-base text-gray-700">
                                    This appointment is completed.
                                </p>
                            </div>
                        )}

                        {status === 'no_show' && (
                            <div className="text-center py-2">
                                <p className="text-base text-gray-700">
                                    Marked as no-show.
                                </p>
                            </div>
                        )}

                        {status === 'canceled' && (
                            <div className="text-center py-2">
                                <p className="text-base text-gray-700">
                                    This appointment was cancelled.
                                </p>
                            </div>
                        )}

                        {/* Close Button (Always Available) */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full mt-3 text-gray-600 font-medium py-2 px-4 hover:text-gray-700 focus:outline-none focus:underline transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
