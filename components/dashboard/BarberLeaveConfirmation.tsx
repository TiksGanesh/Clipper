'use client'

type Props = {
    barberName: string
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
    isLoading?: boolean
}

export default function BarberLeaveConfirmation({ barberName, isOpen, onConfirm, onCancel, isLoading = false }: Props) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onCancel} />
            <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center px-4 md:px-0">
                <div className="bg-white rounded-t-xl md:rounded-xl border border-gray-200 shadow-lg w-full md:max-w-sm md:mx-auto p-4 md:p-6 space-y-4">
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-gray-900">Mark Barber Unavailable Today?</h2>
                        <p className="text-sm text-gray-600">
                            No new bookings or walk-ins will be allowed for <strong>{barberName}</strong> today. Existing bookings will remain.
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        This applies only for today and will automatically reset tomorrow.
                    </div>

                    <div className="space-y-2 pt-2">
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="w-full inline-flex justify-center items-center px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            {isLoading ? 'Confirming...' : 'Confirm'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isLoading}
                            className="w-full text-sm font-semibold text-gray-700 hover:text-gray-900 focus:outline-none disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
