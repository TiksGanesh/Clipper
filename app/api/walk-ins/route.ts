import { NextResponse, NextRequest } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

export async function POST(req: NextRequest) {
    try {
        // Require authentication for walk-in creation (admin/shop owner only)
        const user = await requireAuth()
        const supabase = createServiceSupabaseClient()

        let body: {
            barber_id?: string
            service_ids?: string[]
            customer_name?: string
            customer_phone?: string
            start_time?: string
            end_time?: string
            timezone_offset?: number
        }

        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const { barber_id, service_ids, customer_name, customer_phone, start_time, end_time, timezone_offset } = body

        if (!barber_id || !service_ids || service_ids.length === 0) {
            return NextResponse.json({ error: 'Missing required fields: barber_id, service_ids' }, { status: 400 })
        }

        if (!start_time || !end_time) {
            return NextResponse.json({ error: 'Missing required fields: start_time, end_time' }, { status: 400 })
        }

        // Resolve services and total duration
        const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('id, shop_id, duration_minutes, is_active, deleted_at')
            .in('id', service_ids)

        if (servicesError) {
            return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
        }

        if (!services || services.length !== service_ids.length) {
            return NextResponse.json({ error: 'Some services not found' }, { status: 400 })
        }

        if (services.some((s: any) => s.deleted_at || s.is_active === false)) {
            return NextResponse.json({ error: 'Some services are inactive' }, { status: 400 })
        }

        // All services must be from the same shop
        const shopId = (services[0] as any).shop_id
        if (services.some((s: any) => s.shop_id !== shopId)) {
            return NextResponse.json({ error: 'Services must belong to the same shop' }, { status: 400 })
        }

        // Verify user owns this shop
        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('id, owner_id')
            .eq('id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (shopError) {
            return NextResponse.json({ error: 'Failed to verify shop' }, { status: 500 })
        }

        if (!shop || (shop as any).owner_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized: you do not own this shop' }, { status: 403 })
        }

        // CRITICAL SECURITY: Check subscription access
        const accessCheck = await checkSubscriptionAccess(shopId)
        if (!accessCheck.allowed) {
            return NextResponse.json({ error: 'Shop subscription is not active' }, { status: 403 })
        }

        const totalDuration = (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

        // Validate barber belongs to shop and is active
        const { data: barber, error: barberError } = await supabase
            .from('barbers')
            .select('id, shop_id, is_active, deleted_at')
            .eq('id', barber_id)
            .maybeSingle()

        if (barberError) {
            return NextResponse.json({ error: 'Failed to fetch barber' }, { status: 500 })
        }

        if (!barber || (barber as any).deleted_at || (barber as any).is_active === false || (barber as any).shop_id !== shopId) {
            return NextResponse.json({ error: 'Barber not available' }, { status: 400 })
        }

        // Default customer_name to "Walk-In" if not provided
        const finalCustomerName = customer_name?.trim() || 'Walk-In'
        const finalCustomerPhone = customer_phone?.trim() || null

        // Insert booking via RPC with is_walk_in=true using provided slot
        const serviceIdsToLink = (services as any[]).map((s) => s.id)
        // @ts-expect-error - Supabase RPC typing is not inferred here
        const { data: bookingId, error: rpcError } = await supabase.rpc('book_booking', {
            p_shop_id: shopId,
            p_barber_id: barber_id,
            p_service_ids: serviceIdsToLink,
            p_customer_name: finalCustomerName,
            p_customer_phone: finalCustomerPhone,
            p_start_time: start_time,
            p_end_time: end_time,
            p_is_walk_in: true,
        })

        if (rpcError) {
            // Map exclusion violation to 409 Conflict
            const code = (rpcError as any).code
            if (code === '23P01') {
                return NextResponse.json(
                    { error: 'Selected slot overlaps with another booking' },
                    { status: 409 }
                )
            }
            return NextResponse.json({ error: rpcError.message }, { status: 400 })
        }

        if (!bookingId) {
            return NextResponse.json({ error: 'Walk-in booking not created' }, { status: 500 })
        }

        return NextResponse.json({
            booking_id: bookingId,
            customer_name: finalCustomerName,
            customer_phone: finalCustomerPhone,
            slot_start: start_time,
            slot_end: end_time,
            barber_id,
            service_ids: serviceIdsToLink,
        })
    } catch (error: any) {
        console.error('Walk-in creation error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
