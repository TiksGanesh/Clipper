

import { requireAdminContext } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminShopDetailById } from "@/lib/admin-shop-detail";
import { getShopSetupStatus } from "@/lib/shop-setup-status";
import { getShopRelatedData } from "@/lib/shop-related-data";
import ActionButton from "@/components/dashboard/ActionButton";
import { 
    extendTrialAction, 
    reactivateShopAction, 
    suspendShopAction, 
    emergencyDisableAction,
    updateBusinessTypeAction,
    updateShopSlugAction
} from './actions';

interface PageProps {
    params: { shopId?: string };
    searchParams?: { success?: string };
}

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server component for /admin/shops/[shopId]
export default async function Page({ params, searchParams }: PageProps) {
    // Validate shopId param
    const { shopId } = params;
    if (!shopId || typeof shopId !== "string" || shopId.length < 1) {
        notFound();
    }

    // Check admin authentication - handled by layout
    await requireAdminContext();

    // Fetch shop details (read-only)
    let shop: Awaited<ReturnType<typeof getAdminShopDetailById>>;
    let setupStatus: Awaited<ReturnType<typeof getShopSetupStatus>>;
    let related: Awaited<ReturnType<typeof getShopRelatedData>>;
    let errorMsg = '';
    
    try {
        shop = await getAdminShopDetailById(shopId);
        setupStatus = await getShopSetupStatus(shopId);
        related = await getShopRelatedData(shopId);
    } catch (err: any) {
        console.error('Failed to load shop details:', err);
        
        if (err?.status === 404) {
            notFound();
        }
        
        // For other errors, show user-friendly message
        errorMsg = 'Unable to load shop details. Please try again later.';
        
        // Provide fallback data to prevent crashes
        shop = { 
            shop_id: shopId, 
            shop_name: 'Unknown',
            slug: 'unknown', 
            owner_email: null, 
            owner_phone: '', 
            status: 'unknown' as any,
            business_type: 'barber',
            subscription_start: null,
            subscription_end: null,
            created_at: ''
        } as any;
        setupStatus = { isSetupComplete: false, barbersConfigured: false, servicesConfigured: false, hoursConfigured: false };
        related = { barbers: [], services: [], workingHours: [], recentBookings: [] };
    }

    // If error occurred, show error message
    if (errorMsg) {
        return (
            <main className="space-y-6">
                <h1 className="text-xl font-semibold">Shop Details</h1>
                <div className="bg-white border border-gray-200 rounded-md p-4">
                    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-red-800">{errorMsg}</p>
                                <p className="text-xs text-red-600 mt-1">
                                    If this issue persists, please contact support or return to the shops list.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Calculate setup completion details
    const barberCount = related.barbers?.length ?? 0;
    const serviceCount = related.services?.length ?? 0;
    const configuredDaysCount = related.workingHours?.filter(wh => !wh.is_closed).length ?? 0;
    const setupComplete = setupStatus.isSetupComplete;

    console.log('Shop detail page - related data:', {
        barbers: barberCount,
        services: serviceCount,
        servicesData: related.services,
        workingHours: configuredDaysCount,
        bookings: related.recentBookings?.length ?? 0
    });

    return (
        <main>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <h1 className="text-xl font-semibold">Shop Details</h1>
                <Link
                    href={`/admin/shops/${shopId}/terminology`}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                    Customize Terminology
                </Link>
            </div>

            {searchParams?.success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
                    {searchParams.success}
                </div>
            )}

            {/* Two-column layout: Main content (left) and Sidebar (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Content - Left Column (2/3 width on desktop) */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Shop Summary */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop Summary</h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Shop Name:</span>
                                <div className="text-gray-900 mt-1">{shop.shop_name}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Status:</span>
                                <div className="text-gray-900 mt-1">{shop.status}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Business Type:</span>
                                <div className="text-gray-900 mt-1 capitalize">{shop.business_type}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Owner Contact:</span>
                                <div className="text-gray-900 mt-1">{shop.owner_email || shop.owner_phone || "-"}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Created Date:</span>
                                <div className="text-gray-900 mt-1">{shop.created_at ? new Date(shop.created_at).toLocaleDateString() : "-"}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Subscription Start:</span>
                                <div className="text-gray-900 mt-1">{shop.subscription_start ? new Date(shop.subscription_start).toLocaleDateString() : "-"}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Subscription End:</span>
                                <div className="text-gray-900 mt-1">{shop.subscription_end ? new Date(shop.subscription_end).toLocaleDateString() : "-"}</div>
                            </div>
                        </div>
                    </section>

                    {/* Business Type Update */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Type</h2>
                        <form action={updateBusinessTypeAction} className="space-y-4">
                            <input type="hidden" name="shopId" value={shopId} />
                            <div className="space-y-2">
                                {['barber','salon','clinic'].map((type) => (
                                    <label key={type} className="flex items-center gap-3 text-sm text-gray-800">
                                        <input
                                            type="radio"
                                            name="businessType"
                                            value={type}
                                            defaultChecked={shop.business_type === type}
                                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="capitalize">{type}</span>
                                    </label>
                                ))}
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                            >
                                Update Business Type
                            </button>
                        </form>
                    </section>

                    {/* Shop Slug Update */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop URL Slug</h2>
                        <form action={updateShopSlugAction} className="space-y-4">
                            <input type="hidden" name="shopId" value={shopId} />
                            <div>
                                <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                                    Slug (max 25 characters, lowercase letters, numbers, and hyphens only)
                                </label>
                                <div className="text-xs text-gray-500 mb-2">
                                    Current URL: /shop/<strong>{shop.slug}</strong>
                                </div>
                                <input
                                    type="text"
                                    id="slug"
                                    name="slug"
                                    defaultValue={shop.slug}
                                    maxLength={25}
                                    pattern="[a-z0-9-]+"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="my-shop-name"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                            >
                                Update Slug
                            </button>
                        </form>
                    </section>

                    {/* Barbers List */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Barbers ({barberCount})</h2>
                        {barberCount === 0 ? (
                            <p className="text-sm text-gray-500">No barbers configured yet.</p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {(related.barbers ?? []).slice(0, 10).map((barber) => (
                                    <li key={barber.id} className="py-2 border-b border-gray-100 last:border-b-0">
                                        <div className="font-medium text-gray-900">{barber.name}</div>
                                        {barber.phone && <div className="text-gray-600">Phone: {barber.phone}</div>}
                                    </li>
                                ))}
                                {barberCount > 10 && (
                                    <li className="text-sm text-gray-500 italic">+ {barberCount - 10} more barbers</li>
                                )}
                            </ul>
                        )}
                    </section>

                    {/* Services List */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Services ({serviceCount})</h2>
                        {serviceCount === 0 ? (
                            <p className="text-sm text-gray-500">No services configured yet.</p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {(related.services ?? []).slice(0, 10).map((service) => (
                                    <li key={service.id} className="py-2 border-b border-gray-100 last:border-b-0">
                                        <div className="font-medium text-gray-900">{service.name}</div>
                                        <div className="text-gray-600">
                                            {service.duration_minutes} min | ₹{service.advance_amount} advance
                                        </div>
                                    </li>
                                ))}
                                {serviceCount > 10 && (
                                    <li className="text-sm text-gray-500 italic">+ {serviceCount - 10} more services</li>
                                )}
                            </ul>
                        )}
                    </section>

                    {/* Recent Bookings */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Bookings</h2>
                        {related.recentBookings.length === 0 ? (
                            <p className="text-sm text-gray-500">No recent bookings.</p>
                        ) : (
                            <ul className="space-y-3 text-sm">
                                {(related.recentBookings ?? []).slice(0, 10).map((bk) => (
                                    <li key={bk.id} className="py-2 border-b border-gray-100 last:border-b-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{bk.customer_name}</div>
                                                <div className="text-gray-600">{bk.customer_phone}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-gray-900">
                                                    {bk.start_time ? new Date(bk.start_time).toLocaleDateString() : ''}
                                                </div>
                                                <div className="text-gray-600 text-xs">
                                                    {bk.start_time ? new Date(bk.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600">
                                            Status: {bk.status} | {bk.is_walk_in ? 'Walk-in' : 'Online'}
                                        </div>
                                    </li>
                                ))}
                                {related.recentBookings.length > 10 && (
                                    <li className="text-sm text-gray-500 italic">+ {related.recentBookings.length - 10} more bookings</li>
                                )}
                            </ul>
                        )}
                    </section>
                </div>

                {/* Sidebar - Right Column (1/3 width on desktop) */}
                <aside className="space-y-6">
                    
                    {/* Setup Status */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Setup Status</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-700">Barbers configured:</span>
                                <span className="font-medium text-gray-900">{setupStatus.barbersConfigured ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-700">Services configured:</span>
                                <span className="font-medium text-gray-900">{setupStatus.servicesConfigured ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-700">Working hours configured:</span>
                                <span className="font-medium text-gray-900">{setupStatus.hoursConfigured ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="flex justify-between pt-3 border-t border-gray-200">
                                <span className="font-medium text-gray-900">Overall setup complete:</span>
                                <span className="font-semibold text-gray-900">{setupComplete ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    </section>
                    
                    {/* Working Hours */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Working Hours</h2>
                        {related.workingHours.length === 0 ? (
                            <p className="text-sm text-gray-500">No working hours configured yet.</p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {(related.workingHours ?? []).map((wh) => (
                                    <li key={wh.day_of_week} className="flex items-center justify-between">
                                        <span className="font-medium text-gray-900">
                                            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][wh.day_of_week]}
                                        </span>
                                        <span className="text-gray-600">
                                            {wh.is_closed ? (
                                                <span>Closed</span>
                                            ) : (
                                                `${wh.open_time?.slice(0,5) || '--:--'} - ${wh.close_time?.slice(0,5) || '--:--'}`
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Admin Actions */}
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
                        
                        {/* Standard Actions */}
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Subscription Management</h3>
                            <div className="flex flex-col gap-2">
                                <ActionButton 
                                    label="Extend Trial" 
                                    confirm="Extend trial period by 30 days for this shop?" 
                                    action={extendTrialAction.bind(null, shopId)}
                                />
                                <ActionButton 
                                    label="Reactivate Shop" 
                                    confirm="Reactivate this shop? Will grant 30 days access period." 
                                    action={reactivateShopAction.bind(null, shopId)}
                                />
                            </div>
                        </div>

                        {/* Destructive Actions */}
                        <div className="pt-4 border-t border-gray-200">
                            <h3 className="text-sm font-medium text-red-700 mb-3">Restrictive Actions</h3>
                            <div className="flex flex-col gap-2">
                                <ActionButton 
                                    label="Suspend Shop" 
                                    confirm="Suspend this shop? All bookings will be blocked." 
                                    action={suspendShopAction.bind(null, shopId)}
                                    variant="danger"
                                />
                                <ActionButton 
                                    label="Emergency Disable" 
                                    confirm="⚠️ EMERGENCY CANCEL - This will immediately block ALL access. Are you absolutely sure?" 
                                    action={emergencyDisableAction.bind(null, shopId)}
                                    variant="danger"
                                />
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
}
