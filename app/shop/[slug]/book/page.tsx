import Link from 'next/link'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import BookingForm from '@/components/booking/BookingForm'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { getShopClosure, formatClosurePeriod } from '@/lib/shop-closure'
import BookingErrorPage from '@/components/booking/BookingErrorPage'
import { getShopTerminology, type BusinessType } from '@/src/hooks/useShopTerminology'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicShopBookingPage({ params }: { params: { slug: string } }) {
    const supabase = createServiceSupabaseClient()

    // Fetch shop by slug with branding fields
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name, address, phone, slug, brand_color, logo_url, tagline, splash_image_url, business_type, terminology_overrides, deleted_at')
        .eq('slug', params.slug)
        .is('deleted_at', null)
        .maybeSingle()

    if (!shop) {
        notFound()
    }

    const shopData = shop as any
    const shopIdValue = shopData.id

    // Get terminology for this shop
    const terms = getShopTerminology(
        shopData.business_type || 'barber',
        shopData.terminology_overrides
    )

    // Separately fetch subscription with explicit filter
    const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at, current_period_end, deleted_at')
        .eq('shop_id', shopIdValue) as { data: Array<{ status: string; trial_ends_at: string | null; current_period_end: string | null; deleted_at: string | null }> | null; error: any }

    const subscription = subscriptions?.find(s => !s.deleted_at)

    if (!subscription) {
        return (
            <BookingErrorPage
                message="This shop is not currently accepting online bookings. Please contact the shop directly."
                shopName={shopData.name}
                shopPhone={shopData.phone}
            />
        )
    }

    // Check for blocked subscription statuses
    const blockedStatuses = ['canceled', 'expired', 'past_due']
    if (blockedStatuses.includes(subscription.status)) {
        const messages: Record<string, string> = {
            canceled: 'This shop is temporarily unavailable. Please try again later or contact the shop directly.',
            expired: 'This shop is temporarily unavailable. Please contact the shop directly.',
            past_due: 'This shop is temporarily unavailable. Please try again later or contact the shop directly.'
        }
        return (
            <BookingErrorPage
                message={messages[subscription.status] || 'This shop is currently unavailable.'}
                shopName={shopData.name}
                shopPhone={shopData.phone}
            />
        )
    }

    // Check trial expiry
    if (subscription.status === 'trial') {
        const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null
        if (trialEnd && trialEnd < new Date()) {
            return (
                <BookingErrorPage
                    message="This shop's trial period has ended. Please contact the shop directly."
                    shopName={shopData.name}
                    shopPhone={shopData.phone}
                />
            )
        }
    }

    // Check active subscription expiry
    if (subscription.status === 'active') {
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null
        if (periodEnd && periodEnd < new Date()) {
            return (
                <BookingErrorPage
                    message="This shop is temporarily unavailable. Please try again later or contact the shop directly."
                    shopName={shopData.name}
                    shopPhone={shopData.phone}
                />
            )
        }
    }

    // Check for shop closure
    const shopClosure = await getShopClosure(shopIdValue)

    const [{ data: barbers, error: barbersError }, { data: services, error: servicesError }] = await Promise.all([
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

    // Show closure message if shop is closed
    if (shopClosure) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900">{shopData.name}</h1>
                        {shopData.address && <p className="text-gray-600 mt-2">{shopData.address}</p>}
                        {shopData.phone && <p className="text-gray-500 text-sm">{shopData.phone}</p>}
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                        <h2 className="text-xl font-semibold text-amber-900 mb-2">Shop is Closed</h2>
                        <p className="text-amber-800 text-lg font-medium">
                            {formatClosurePeriod(shopClosure.closedFrom, shopClosure.closedTo)}
                        </p>
                        <p className="text-amber-700 mt-3">We will be back soon. Please try booking after this period or contact us directly.</p>
                        {shopData.phone && (
                            <p className="text-amber-800 mt-4">
                                📞 <strong>{shopData.phone}</strong>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Show a helpful message if no barbers or services are available
    if (!barbers || barbers.length === 0 || !services || services.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900">{shopData.name}</h1>
                        {shopData.address && <p className="text-gray-600 mt-2">{shopData.address}</p>}
                        {shopData.phone && <p className="text-gray-500 text-sm">{shopData.phone}</p>}
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <h2 className="text-xl font-semibold text-yellow-900 mb-2">Currently Unavailable</h2>
                        <p className="text-yellow-800">
                            {!barbers || barbers.length === 0
                                ? `No ${terms.staff_label.toLowerCase()}s are currently available for booking.`
                                : 'No services are currently available for booking.'}
                        </p>
                        <p className="text-yellow-700 mt-2">Please contact the shop directly or try again later.</p>
                        {shopData.phone && (
                            <p className="text-yellow-800 mt-4">
                                📞 <strong>{shopData.phone}</strong>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Prepare shop data for BookingForm (only send required fields)
    const shopForForm = {
        id: shopData.id,
        name: shopData.name,
        address: shopData.address,
        phone: shopData.phone,
        slug: shopData.slug,
    }

    return (
        <div
            className="min-h-screen overflow-x-hidden"
            style={{ backgroundColor: shopData.brand_color ? `${shopData.brand_color}15` : '#f9fafb' }}
        >
            <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
                <header className="mb-6 text-center">
                    {shopData.logo_url && (
                        <div className="mb-4 flex justify-center">
                            <Image
                                src={shopData.logo_url}
                                alt={shopData.name}
                                width={64}
                                height={64}
                                className="h-16 object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                }}
                            />
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-gray-900">{shopData.name}</h1>
                    {shopData.tagline && (
                        <p className="text-gray-600 mt-2 italic">{shopData.tagline}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-3">Book your appointment in seconds</p>
                </header>
                <BookingForm shop={shopForForm} barbers={barbers} services={services} />
                <p className="mt-6 text-center text-sm text-gray-600">
                    By booking, you agree to our{' '}
                    <Link href="/terms" className="font-semibold text-blue-600 hover:text-blue-700">
                        Terms of Service
                    </Link>
                    .
                </p>
            </div>
        </div>
    )
}
