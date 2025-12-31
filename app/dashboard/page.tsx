import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DayView from '@/components/calendar/DayView'

type Barber = {
    id: string
    name: string
}

type Service = {
    id: string
    name: string
    duration_minutes: number
    price: number
}

export default async function DashboardPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Enforce first-time setup completion before accessing dashboard
    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    const shopId = (shop as { id: string } | null)?.id
    if (!shopId) {
        redirect('/setup/shop')
    }

    const [{ count: barberCount }, { count: servicesCount }, { count: hoursCount }, { data: barbers }, { data: services }] = await Promise.all([
        supabase.from('barbers').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('working_hours').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
        supabase
            .from('barbers')
            .select('id, name')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('name'),
        supabase
            .from('services')
            .select('id, name, duration_minutes, price')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('name'),
    ])

    if (!barberCount || barberCount < 1) {
        redirect('/setup/barbers')
    }
    if (!hoursCount || hoursCount < 1) {
        redirect('/setup/hours')
    }
    if (!servicesCount || servicesCount < 1) {
        redirect('/setup/services')
    }

    // Sign out function will be handled via a server action or API route
    const today = new Date().toISOString().split('T')[0]
    const firstBarberId = (barbers as Barber[])?.[0]?.id ?? ''

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
                            <p className="text-sm md:text-base text-gray-600 mt-1 truncate">Welcome, <span className="font-medium">{user.email}</span></p>
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

            <main className="max-w-7xl mx-auto px-0 md:px-4 lg:px-6 py-4 md:py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                    {/* Calendar Section */}
                    <div className="lg:col-span-3 px-4 md:px-0">
                        <DayView
                            barbers={(barbers as Barber[]) ?? []}
                            initialDate={today}
                            initialBarberId={firstBarberId}
                            isReadOnly={false}
                        />
                    </div>

                    {/* Sidebar Navigation - Hidden on mobile, visible on desktop */}
                    <div className="hidden lg:block lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>

                            {/* Add Walk-In Button */}
                            <Link
                                href="/dashboard/walk-in"
                                className="flex items-center justify-center w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-medium text-sm"
                            >
                                + Walk-In Booking
                            </Link>

                            {/* Manage Services Link */}
                            <Link
                                href="/dashboard/services"
                                className="flex items-center justify-between w-full px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg transition font-medium text-sm"
                            >
                                <span>Manage Services</span>
                                <span className="text-gray-400">→</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
