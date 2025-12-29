import { notFound } from 'next/navigation'
import BookingForm from '@/components/booking/BookingForm'
import { createServiceSupabaseClient } from '@/lib/supabase'

export default async function PublicBookingPage({ params }: { params: { shopId: string } }) {
    const supabase = createServiceSupabaseClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id, name, address, phone, deleted_at')
        .eq('id', params.shopId)
        .maybeSingle()

    if (!shop || (shop as any).deleted_at) {
        notFound()
    }

    const shopData = shop as any
    const shopIdValue = shopData.id

    const [{ data: barbers }, { data: services }] = await Promise.all([
        supabase
            .from('barbers')
            .select('id, name')
            .eq('shop_id', shopIdValue)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('name', { ascending: true }),
        supabase
            .from('services')
            .select('id, name, duration_minutes, price')
            .eq('shop_id', shopIdValue)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('name', { ascending: true }),
    ])

    if (!barbers || barbers.length === 0 || !services || services.length === 0) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="mb-8 text-center">
                    <p className="text-sm uppercase tracking-wide text-gray-500">Book with</p>
                    <h1 className="text-3xl font-bold text-gray-900">{shopData.name}</h1>
                    {shopData.address && <p className="text-gray-600 mt-2">{shopData.address}</p>}
                    {shopData.phone && <p className="text-gray-500 text-sm">{shopData.phone}</p>}
                </div>
                <BookingForm shop={shop} barbers={barbers} services={services} />
            </div>
        </div>
    )
}
