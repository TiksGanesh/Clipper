import Link from 'next/link'

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-8 sm:p-6">
            <div className="w-full max-w-md">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-6 sm:mb-8 text-center leading-tight">
                    Welcome to Clipper
                </h1>
                
                <div className="flex flex-col gap-3 sm:gap-4 w-full">
                    {/* Customer Booking Button */}
                    <Link
                        href="/book/64e66dea-4fd8-4da6-a21a-d9466ea455fe"
                        className="w-full py-3 sm:py-4 bg-indigo-600 text-white text-center rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        Book an Appointment
                    </Link>
                    
                    {/* Barber Login Button */}
                    <Link
                        href="/login"
                        className="w-full py-3 sm:py-4 bg-white border-2 border-indigo-100 text-indigo-600 text-center rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:bg-indigo-50 transition-all active:scale-95"
                    >
                        Barber Login
                    </Link>
                </div>
            </div>
        </main>
    )
}
