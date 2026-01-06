import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import EditShopInformation from '@/components/dashboard/EditShopInformation'
import SetupPendingMessage from '@/components/dashboard/SetupPendingMessage'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import SubscriptionBlockedPage from '@/components/dashboard/SubscriptionBlockedPage'

export default async function EditShopPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Fetch shop
    const { data: shop } = await supabase
        .from('shops')
        .select('id, name, phone, address')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as { data: { id: string; name: string; phone: string | null; address: string | null } | null; error: any }

    if (!shop) {
        return <SetupPendingMessage userEmail={user.email ?? ''} step="shop" />
    }

    // CRITICAL SECURITY: Check subscription status
    const accessCheck = await checkSubscriptionAccess(shop.id)
    if (!accessCheck.allowed) {
        return <SubscriptionBlockedPage reason={accessCheck.reason} />
    }

    // Fetch barbers (only active ones)
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, phone')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }) as { data: Array<{ id: string; name: string; phone: string | null }> | null; error: any }

    // Fetch working hours
    const { data: workingHoursData } = await supabase
        .from('working_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('shop_id', shop.id) as { data: Array<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean }> | null; error: any }

    // Map working hours to days
    const workingHours: Record<string, any> = {}
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    DAYS.forEach((day, idx) => {
        const dayData = (workingHoursData ?? []).find((h) => h.day_of_week === idx)
        workingHours[day] = {
            isOpen: !dayData?.is_closed,
            openTime: dayData?.open_time || '09:00',
            closeTime: dayData?.close_time || '18:00',
        }
    })

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="p-1 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Back to Dashboard">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="flex-1 text-lg font-bold text-gray-900">Shop Info</h1>
                <div className="w-6" aria-hidden="true" />
            </header>

            <main className="max-w-lg mx-auto p-4 space-y-6 pb-20">
                <EditShopInformation
                    shop={shop}
                    barbers={barbers ?? []}
                    workingHours={workingHours}
                    userEmail={user.email ?? ''}
                />
            </main>
        </div>
    )
}
