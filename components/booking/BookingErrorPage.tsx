export default function BookingErrorPage({ 
  message, 
  shopName, 
  shopPhone 
}: { 
  message: string
  shopName?: string
  shopPhone?: string 
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Unable to Book Appointment</h1>
        
        {shopName && (
          <p className="text-lg font-medium text-gray-700 mb-4">{shopName}</p>
        )}
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="text-sm text-gray-500">
          Please try again later or contact the shop directly.
        </div>
      </div>
    </div>
  )
}
