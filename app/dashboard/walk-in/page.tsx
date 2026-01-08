import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WalkInForm from '@/components/booking/WalkInForm'
import SetupPendingMessage from '@/components/dashboard/SetupPendingMessage'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import SubscriptionBlockedPage from '@/components/dashboard/SubscriptionBlockedPage'
import { PAGINATION_LIMITS } from '@/lib/pagination'

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

export default async function WalkInPage({ searchParams }: { searchParams?: Record<string, string> }) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id, phone, name')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    const shopId = (shop as { id: string } | null)?.id
    if (!shopId) {
        return <SetupPendingMessage userEmail={user.email ?? ''} step="shop" />
    }

    // CRITICAL SECURITY: Check subscription status
    const accessCheck = await checkSubscriptionAccess(shopId)
    if (!accessCheck.allowed) {
        return <SubscriptionBlockedPage reason={accessCheck.reason} />
    }

    const shopPhone = (shop as { phone?: string } | null)?.phone
    const shopName = (shop as { name?: string } | null)?.name

    const [{ data: barbers }, { data: services }] = await Promise.all([
        supabase
            .from('barbers')
            .select('id, name')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('name')
            .limit(PAGINATION_LIMITS.BARBERS),
        supabase
            .from('services')
            .select('id, name, duration_minutes, price')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('name')
            .limit(PAGINATION_LIMITS.SERVICES),
    ])

    const initialBarberId = searchParams?.barber_id
    const initialStartTime = searchParams?.start_time
    const initialDate = searchParams?.date

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            {/* Compact Sticky Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="p-1 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Back to Dashboard">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="flex-1 text-lg font-bold text-gray-900">Add Walk-in</h1>
                <div className="w-6" />
            </header>

            <main className="max-w-4xl mx-auto py-4 md:py-6 px-4">
                <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
                    <WalkInForm
                        shopId={shopId}
                        barbers={(barbers as Barber[]) ?? []}
                        services={(services as Service[]) ?? []}
                        shopPhone={shopPhone}
                        shopName={shopName}
                        initialBarberId={initialBarberId}
                        initialStartTime={initialStartTime}
                        initialDate={initialDate}
                    />
                </div>
            </main>
        </div>
    )
}
