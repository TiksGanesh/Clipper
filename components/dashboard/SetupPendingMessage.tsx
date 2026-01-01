'use client'

import Link from 'next/link'

type Props = {
    step?: 'shop' | 'barbers' | 'services' | 'hours'
    userEmail: string
}

const steps = [
    { id: 'shop', title: 'Create shop profile', detail: 'Add your shop name, phone, and address.', href: '/setup/shop' },
    { id: 'barbers', title: 'Add barbers', detail: 'Add up to two barbers with contact details.', href: '/setup/barbers' },
    { id: 'hours', title: 'Set working hours', detail: 'Define open and close times for each day.', href: '/setup/hours' },
    { id: 'services', title: 'Add services', detail: 'Create fixed-duration services with pricing.', href: '/setup/services' },
] as const

export default function SetupPendingMessage({ step, userEmail }: Props) {
    const activeStepIndex = Math.max(
        steps.findIndex((s) => s.id === step),
        0,
    )
    const activeStep = steps[activeStepIndex]

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
                <div className="bg-white rounded-lg shadow p-8 max-w-2xl mx-auto">
                    <div className="mb-6 text-center">
                        <div className="inline-block p-3 bg-blue-100 rounded-full mb-3">
                            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Finish your setup to use the dashboard</h2>
                        <p className="text-gray-600 mt-2">Complete the steps below. Most owners finish in under 10 minutes.</p>
                    </div>

                    <div className="space-y-4">
                        {steps.map((item, idx) => {
                            const isActive = item.id === activeStep.id
                            return (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500">Step {idx + 1}</p>
                                            <p className="text-base font-semibold text-gray-900">{item.title}</p>
                                            <p className="text-sm text-gray-600 mt-1">{item.detail}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                                                {isActive ? 'Next up' : 'Pending'}
                                            </span>
                                            <Link
                                                href={item.href}
                                                className="text-sm font-medium text-blue-700 hover:text-blue-900"
                                            >
                                                Open
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <Link
                            href={activeStep.href}
                            className="inline-block text-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                        >
                            Go to {activeStep.title}
                        </Link>
                        <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                            Refresh after completing a step
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}
