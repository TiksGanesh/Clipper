'use client'

export default function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const shop = searchParams.shop || 'Shop'
  const barber = searchParams.barber || 'Barber'
  const services = searchParams.services || 'Service'
  const duration = searchParams.duration || '0'
  const dateStr = searchParams.date || ''
  const timeStr = searchParams.time || ''
  const customer = searchParams.customer || ''

  // Format date
  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Date not available'

  // Format time
  const formattedTime = timeStr ? new Date(timeStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) : 'Time not available'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm md:max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        {/* Success Indicator */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <svg 
              className="w-8 h-8 text-emerald-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Booking Confirmed
          </h1>
        </div>

        {/* Booking Summary */}
        <div className="space-y-4 mb-6">
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Shop</p>
                <p className="text-base font-medium text-gray-900">
                  {shop}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Barber</p>
                <p className="text-base font-medium text-gray-900">
                  {barber}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Service</p>
                <p className="text-base font-medium text-gray-900">
                  {services} • {duration} minutes
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Date</p>
                <p className="text-base font-medium text-gray-900">
                  {formattedDate}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Time</p>
                <p className="text-base font-medium text-gray-900">
                  {formattedTime}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-base text-gray-600">
                No advance payment required
              </p>
            </div>
          </div>
        </div>

        {/* Important Instruction */}
        <div className="mb-6">
          <p className="text-sm text-center text-gray-600">
            Please arrive on time for your appointment.
          </p>
        </div>

        {/* Primary Action */}
        <button
          type="button"
          onClick={() => window.close()}
          className="w-full bg-indigo-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
