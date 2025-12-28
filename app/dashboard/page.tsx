import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

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

    const [{ count: barberCount }, { count: servicesCount }, { count: hoursCount }] = await Promise.all([
        supabase.from('barbers').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('working_hours').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
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
                        <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-4">{user.email}</span>
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
                <div className="px-4 py-6 sm:px-0">
                    <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Welcome to your dashboard
                        </h2>
                        <p className="text-gray-600">
                            You're now authenticated! This is a protected route.
                        </p>
                        <div className="mt-6 bg-blue-50 p-4 rounded-md">
                            <h3 className="text-sm font-medium text-blue-800 mb-2">
                                User Information
                            </h3>
                            <dl className="space-y-1">
                                <div>
                                    <dt className="text-xs text-blue-600">Email:</dt>
                                    <dd className="text-sm text-blue-900">{user.email}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-blue-600">User ID:</dt>
                                    <dd className="text-sm text-blue-900 font-mono text-xs">{user.id}</dd>
                                </div>
                                {user.user_metadata?.shop_name && (
                                    <div>
                                        <dt className="text-xs text-blue-600">Shop Name:</dt>
                                        <dd className="text-sm text-blue-900">{user.user_metadata.shop_name}</dd>
                                    </div>
                                )}
                            </dl>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
