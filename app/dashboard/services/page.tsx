export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import ManageServicesClient from '@/components/dashboard/ManageServicesClient'
import SetupPendingMessage from '@/components/dashboard/SetupPendingMessage'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import SubscriptionBlockedPage from '@/components/dashboard/SubscriptionBlockedPage'

export default async function DashboardServicesPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    const shopId = shop?.id
    if (!shopId) {
        return <SetupPendingMessage userEmail={user.email ?? ''} step="shop" />
    }

    // CRITICAL SECURITY: Check subscription status
    const accessCheck = await checkSubscriptionAccess(shopId)
    if (!accessCheck.allowed) {
        return <SubscriptionBlockedPage reason={accessCheck.reason} />
    }

    const { data: services, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, is_active')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }) as { 
            data: Array<{ 
                id: string; 
                name: string; 
                duration_minutes: number;
                price: number;
                is_active: boolean 
            }> | null; 
            error: any 
        }

    if (error) {
        console.error('Services fetch failed:', error.message)
    }

    console.log('Shop ID:', shopId)
    console.log('Services fetched:', services?.length ?? 0, 'services')
    console.log('Raw services data:', JSON.stringify(services))

    const mapped = (services ?? []).map((svc) => ({
        id: svc.id,
        name: svc.name,
        duration: svc.duration_minutes,
        price: svc.price || 0,
        advanceAmount: 0, // TODO: will be populated once DB migration is applied
        requiresAdvance: false, // TODO: will be populated once DB migration is applied
        isActive: svc.is_active,
    }))

    return <ManageServicesClient services={mapped} userEmail={user.email ?? ''} errorMessage={error?.message} />
}
