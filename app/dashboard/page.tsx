import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import DayView from '@/components/calendar/DayView'
import DashboardContent from './dashboard-content'
import { getBarberLeaveStatuses } from '@/lib/barber-leave'
import SetupPendingMessage from '@/components/dashboard/SetupPendingMessage'

type Barber = {
    id: string
    name: string
    isOnLeave?: boolean
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
        return <SetupPendingMessage userEmail={user.email ?? ''} step="shop" />
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
        return <SetupPendingMessage userEmail={user.email ?? ''} step="barbers" />
    }
    if (!hoursCount || hoursCount < 1) {
        return <SetupPendingMessage userEmail={user.email ?? ''} step="hours" />
    }
    if (!servicesCount || servicesCount < 1) {
        return <SetupPendingMessage userEmail={user.email ?? ''} step="services" />
    }

    // Fetch barber leave statuses for today
    const leaveStatuses = await getBarberLeaveStatuses(shopId)
    const barbersWithLeaveStatus = (barbers as Barber[]).map((b) => ({
        ...b,
        isOnLeave: leaveStatuses[b.id] || false,
    }))

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
                {/* Mobile Quick Actions */}
                <div className="lg:hidden px-4 md:px-0 mb-4">
                    <DashboardContent barbers={barbersWithLeaveStatus} />
                </div>

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
                        <DashboardContent barbers={barbersWithLeaveStatus} />
                    </div>
                </div>
            </main>
        </div>
    )
}
