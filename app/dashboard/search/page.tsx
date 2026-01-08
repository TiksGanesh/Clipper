export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SetupPendingMessage from '@/components/dashboard/SetupPendingMessage'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import SubscriptionBlockedPage from '@/components/dashboard/SubscriptionBlockedPage'
import SearchBookingsClient from '@/components/dashboard/SearchBookingsClient'
import { PAGINATION_LIMITS } from '@/lib/pagination'

type Booking = {
    id: string
    customer_name: string
    customer_phone: string
    start_time: string
    end_time: string
    service_name: string
    barber_name: string
    status: 'confirmed' | 'completed' | 'canceled' | 'no_show'
    is_walk_in: boolean
}

export default async function SearchPage({ searchParams }: { searchParams?: Record<string, string> }) {
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

    const query = searchParams?.q || ''

    let bookings: Booking[] = []
    let error: string | null = null

    if (query.trim().length > 0) {
        try {
            // Search by customer name or phone
            const { data, error: searchError } = await supabase
                .from('bookings')
                .select(
                    `
                    id,
                    customer_name,
                    customer_phone,
                    start_time,
                    end_time,
                    status,
                    is_walk_in,
                    services:service_id (name),
                    barbers:barber_id (name)
                    `
                )
                .eq('shop_id', shopId)
                .is('deleted_at', null)
                .or(
                    `customer_name.ilike.%${query}%,customer_phone.like.%${query}%`
                )
                .order('start_time', { ascending: false })
                .limit(PAGINATION_LIMITS.BOOKINGS)

            if (searchError) {
                error = searchError.message
            } else {
                bookings = (data || []).map((b: any) => ({
                    id: b.id,
                    customer_name: b.customer_name,
                    customer_phone: b.customer_phone,
                    start_time: b.start_time,
                    end_time: b.end_time,
                    service_name: b.services?.name || 'Service',
                    barber_name: b.barbers?.name || 'Barber',
                    status: b.status,
                    is_walk_in: b.is_walk_in,
                }))
            }
        } catch (err) {
            error = 'Search failed. Please try again.'
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Compact Sticky Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="p-1 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Back to Dashboard">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="flex-1 text-lg font-bold text-gray-900">Search Bookings</h1>
                <div className="w-6" />
            </header>

            <main className="max-w-2xl mx-auto py-4 md:py-6 px-4">
                <SearchBookingsClient initialQuery={query} bookings={bookings} error={error} />
            </main>
        </div>
    )
}
