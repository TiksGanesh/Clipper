import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import ManageBarberLeave from '@/components/dashboard/ManageBarberLeave'
import SetupPendingMessage from '@/components/dashboard/SetupPendingMessage'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import SubscriptionBlockedPage from '@/components/dashboard/SubscriptionBlockedPage'

export default async function ManageLeavePage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Get shop
    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as { data: { id: string } | null; error: any }

    if (!shop) {
        return <SetupPendingMessage userEmail={user.email ?? ''} step="shop" />
    }

    // CRITICAL SECURITY: Check subscription status
    const accessCheck = await checkSubscriptionAccess(shop.id)
    if (!accessCheck.allowed) {
        return <SubscriptionBlockedPage reason={accessCheck.reason} />
    }

    // Fetch barbers
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('shop_id', shop.id)
        .is('deleted_at', null)
        .order('name', { ascending: true })

    // Fetch leaves
    const { data: leavesData } = await supabase
        .from('barber_leaves')
        .select(`
            id,
            barber_id,
            leave_date,
            barbers!inner(name)
        `)
        .in(
            'barber_id',
            (barbers ?? []).map((b: any) => b.id)
        )
        .order('leave_date', { ascending: false })

    const leaves = (leavesData ?? []).map((leave: any) => ({
        id: leave.id,
        barberId: leave.barber_id,
        barberName: leave.barbers?.name || '',
        leaveDate: leave.leave_date,
    }))

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="p-1 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Back to Dashboard">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="flex-1 text-lg font-bold text-gray-900">Manage Leave</h1>
                <div className="w-6" aria-hidden="true" />
            </header>

            <main className="max-w-lg mx-auto p-4 space-y-6">
                <ManageBarberLeave barbers={barbers ?? []} leaves={leaves} userEmail={user.email ?? ''} />
            </main>
        </div>
    )
}
