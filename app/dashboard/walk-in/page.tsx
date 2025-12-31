import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WalkInForm from '@/components/booking/WalkInForm'

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

export default async function WalkInPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

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

    const [{ data: barbers }, { data: services }] = await Promise.all([
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

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-0 sm:h-16 gap-2 sm:gap-4">
                        <Link href="/dashboard" className="text-base sm:text-xl font-bold text-gray-900 hover:text-gray-700">
                            ← Back
                        </Link>
                        <div className="flex items-center gap-2 sm:gap-4 text-sm">
                            <span className="text-gray-600 truncate max-w-[150px] sm:max-w-none">{user.email}</span>
                            <form action="/api/auth/signout" method="POST">
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                                >
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto py-4 md:py-6 px-4">
                <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
                    <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">Add Walk-In</h1>
                    <p className="text-sm md:text-base text-gray-600 mb-6">Create a new walk-in appointment.</p>

                    <WalkInForm
                        shopId={shopId}
                        barbers={(barbers as Barber[]) ?? []}
                        services={(services as Service[]) ?? []}
                    />
                </div>
            </main>
        </div>
    )
}
