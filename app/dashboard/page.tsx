import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import WalkInForm from '@/components/booking/WalkInForm'
import DashboardContent from './dashboard-content'

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
    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">Clipper Dashboard</h1>
                        </div>
                            <div className="flex items-center gap-4">
                                <a
                                    href="#walk-in-form"
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition"
                                >
                                    + Book Walk-In
                                </a>
                                <span className="text-sm text-gray-600">{user.email}</span>
                            <form action="/api/auth/signout" method="POST">
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                                >
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0 space-y-6">
                    {/* Welcome Section */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                        <p className="text-gray-600">{user.email}</p>
                    </div>

                    {/* Walk-In Quick Action */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-600 rounded-lg shadow-sm p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-green-900 mb-1">Add Walk-In</h3>
                                <p className="text-sm text-green-700">Quickly create a walk-in appointment. Slot auto-assigned to next available time.</p>
                            </div>
                        </div>
                    </div>

                    {/* Walk-In Form Section */}
                    <div id="walk-in-form" className="bg-white rounded-lg shadow-sm p-6 scroll-mt-20">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Walk-In Booking</h3>
                        <WalkInForm
                            shopId={shopId}
                            barbers={(barbers as Barber[]) ?? []}
                            services={(services as Service[]) ?? []}
                        />
                    </div>

                    {/* Dashboard Navigation */}
                    <DashboardContent />
                </div>
            </main>
        </div>
    )
}
