'use client'

import Link from 'next/link'

type Props = {
    step?: 'shop' | 'barbers' | 'services' | 'hours'
    userEmail: string
}

export default function SetupPendingMessage({ step, userEmail }: Props) {
    const getStepMessage = () => {
        switch (step) {
            case 'barbers':
                return 'Your shop barbers are being set up'
            case 'services':
                return 'Your services are being configured'
            case 'hours':
                return 'Your working hours are being set'
            case 'shop':
            default:
                return 'Your shop account is being set up'
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
                            <p className="text-sm md:text-base text-gray-600 mt-1 truncate">Welcome, <span className="font-medium">{userEmail}</span></p>
                        </div>
                        <form action="/api/auth/signout" method="POST">
                            <button
                                type="submit"
                                className="px-3 py-1.5 md:px-4 md:py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                            >
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
                <div className="bg-white rounded-lg shadow p-8 text-center max-w-md mx-auto">
                    <div className="mb-4">
                        <div className="inline-block p-4 bg-blue-100 rounded-full">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup in Progress</h2>
                    <p className="text-gray-600 mb-4">{getStepMessage()}</p>
                    <p className="text-sm text-gray-500 mb-6">
                        Your account is being configured by our team. Please check back shortly or contact support if you have any questions.
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                    >
                        Reload Dashboard
                    </Link>
                </div>
            </main>
        </div>
    )
}
