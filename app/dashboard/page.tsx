import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import DayView from '@/components/calendar/DayView'
import DashboardContent from './dashboard-content'
import { getBarberLeaveStatuses } from '@/lib/barber-leave'
import { getShopSetupStatus } from '@/lib/shop-setup-status'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import SubscriptionBlockedPage from '@/components/dashboard/SubscriptionBlockedPage'
import { getUtcDayRange } from '@/lib/slots'

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

const normalizeCount = (value: number | null | undefined) => value ?? 0

const getNextSetupPath = (counts: { barbers: number; hours: number; services: number }) => {
    if (counts.barbers < 1) return '/setup/barbers'
    if (counts.hours < 1) return '/setup/hours'
    if (counts.services < 1) return '/setup/services'
    return null
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
    const activeShopId = shopId as string

    // CRITICAL SECURITY: Check subscription status before allowing dashboard access
    const accessCheck = await checkSubscriptionAccess(activeShopId)
    if (!accessCheck.allowed) {
        return <SubscriptionBlockedPage reason={accessCheck.reason} />
    }

    const [{ count: barberCount }, { count: servicesCount }, { count: hoursCount }] = await Promise.all([
        supabase.from('barbers').select('id', { count: 'exact', head: true }).eq('shop_id', activeShopId).is('deleted_at', null),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('shop_id', activeShopId).is('deleted_at', null),
        supabase.from('working_hours').select('id', { count: 'exact', head: true }).eq('shop_id', activeShopId),
    ])

    const nextSetupPath = getNextSetupPath({
        barbers: normalizeCount(barberCount),
        hours: normalizeCount(hoursCount),
        services: normalizeCount(servicesCount),
    })

    if (nextSetupPath) {
        redirect(nextSetupPath)
    }

    const [{ data: barbers }, { data: services }, leaveStatuses] = await Promise.all([
        supabase
            .from('barbers')
            .select('id, name')
            .eq('shop_id', activeShopId)
            .is('deleted_at', null)
            .order('name'),
        supabase
            .from('services')
            .select('id, name, duration_minutes, price')
            .eq('shop_id', activeShopId)
            .is('deleted_at', null)
            .order('name'),
        getBarberLeaveStatuses(activeShopId),
    ])

    // Get detailed setup status for dashboard hints
    const setupStatus = await getShopSetupStatus(activeShopId)

    // Fetch barber leave statuses for today
    const barbersWithLeaveStatus = (barbers as Barber[]).map((b) => ({
        ...b,
        isOnLeave: leaveStatuses[b.id] || false,
    }))

    // Sign out function will be handled via a server action or API route
    const today = new Date().toISOString().split('T')[0]
    const { start: todayStartUtc, end: todayEndUtc } = getUtcDayRange(today)
    // Calculate today's revenue from completed bookings
    const { data: revenueBookings } = await supabase
        .from('bookings')
        .select('id, start_time, status, services!inner ( price )')
        .eq('shop_id', activeShopId)
        .is('deleted_at', null)
        .is('services.deleted_at', null)
        .gte('start_time', todayStartUtc.toISOString())
        .lt('start_time', todayEndUtc.toISOString())
        .eq('status', 'completed')

    const dailyRevenue = (revenueBookings as any[] | null | undefined)?.reduce((sum, b: any) => {
        const price = Number(b?.services?.price ?? 0)
        return sum + (Number.isFinite(price) ? price : 0)
    }, 0) ?? 0
    const firstBarberId = (barbers as Barber[])?.[0]?.id ?? ''
    const todayString = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-3 md:py-6">
                    {/* Mobile Header (Focus Mode) */}
                    <div className="md:hidden flex justify-between items-center">
                        <div>
                            <span className="text-xl font-black text-gray-900">{todayString}</span>
                        </div>
                        <form action="/api/auth/signout" method="POST">
                            <button
                                type="submit"
                                aria-label="Sign Out"
                                className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition"
                            >
                                {/* Simple User Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-gray-700">
                                    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 3.134-7 7h2c0-2.757 2.243-5 5-5s5 2.243 5 5h2c0-3.866-3.134-7-7-7z" />
                                </svg>
                            </button>
                        </form>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden md:flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                            <p className="text-base text-gray-600 mt-1 truncate">Welcome, <span className="font-medium">{user.email}</span></p>
                        </div>
                        <form action="/api/auth/signout" method="POST">
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                            >
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-0 md:px-4 lg:px-6 py-4 md:py-6 pb-24">
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
                    <div className="lg:col-span-1 mt-8 lg:mt-0">
                        <DashboardContent 
                            barbers={barbersWithLeaveStatus} 
                            setupStatus={setupStatus}
                            barberCount={(barbers as Barber[])?.length ?? 0}
                            serviceCount={(services as Service[])?.length ?? 0}
                            todayRevenue={dailyRevenue}
                        />
                    </div>
                </div>
            </main>
        </div>
    )
}
