

import { requireAdminContext } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getAdminShopDetailById } from "@/lib/admin-shop-detail";
import { getShopSetupStatus } from "@/lib/shop-setup-status";
import { getShopRelatedData } from "@/lib/shop-related-data";
import ActionButton from "@/components/dashboard/ActionButton";

interface PageProps {
    params: { shopId?: string };
}

// Server component for /admin/shops/[shopId]
export default async function Page({ params }: PageProps) {
    // Validate shopId param
    const { shopId } = params;
    if (!shopId || typeof shopId !== "string" || shopId.length < 1) {
        notFound();
    }

    // Check admin authentication
    try {
        await requireAdminContext();
    } catch (err: any) {
        // For server components, we should redirect rather than return error JSX
        // But since requireAdminContext should handle redirects, just throw
        throw err;
    }

    // Fetch shop details (read-only)
    let shop: Awaited<ReturnType<typeof getAdminShopDetailById>>;
    let setupStatus: Awaited<ReturnType<typeof getShopSetupStatus>>;
    let related: Awaited<ReturnType<typeof getShopRelatedData>>;
    try {
        shop = await getAdminShopDetailById(shopId);
        setupStatus = await getShopSetupStatus(shopId);
        related = await getShopRelatedData(shopId);
    } catch (err: any) {
        if (err?.status === 404) {
            notFound();
        }
        throw err;
    }

    // Calculate setup completion details
    const barberCount = related.barbers?.length ?? 0;
    const serviceCount = related.services?.length ?? 0;
    const configuredDaysCount = related.workingHours?.filter(wh => !wh.is_closed).length ?? 0;
    const setupComplete = setupStatus.isSetupComplete;

    return (
        <main className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Shop Details</h1>
                <p className="text-sm text-gray-600 mt-1">Admin view for {shop.shop_name}</p>
            </div>

            {/* Setup Status Checklist - Prominent Section */}
            <section className="mb-8 bg-white border-2 border-gray-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Setup Status</h2>
                    {setupComplete ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                            ✓ Complete
                        </span>
                    ) : (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                            ⚠ Incomplete
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    {/* Barbers Checklist Item */}
                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 mt-0.5">
                            {setupStatus.barbersConfigured ? (
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900">Barbers</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                {barberCount === 0 && "No barbers configured. At least 1 barber required."}
                                {barberCount === 1 && `${barberCount} barber configured. Can add 1 more (max 2).`}
                                {barberCount === 2 && `${barberCount} barbers configured (maximum reached).`}
                            </p>
                            {barberCount > 0 && (
                                <div className="mt-2 text-sm text-gray-700">
                                    {(related.barbers ?? []).map((b, idx) => (
                                        <div key={b.id} className="flex items-center gap-2">
                                            <span className="text-gray-500">{idx + 1}.</span>
                                            <span className="font-medium">{b.name}</span>
                                            {b.phone && <span className="text-gray-500">({b.phone})</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Services Checklist Item */}
                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 mt-0.5">
                            {setupStatus.servicesConfigured ? (
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900">Services</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                {serviceCount === 0 && "No services configured. At least 1 service required."}
                                {serviceCount > 0 && `${serviceCount} service${serviceCount > 1 ? 's' : ''} configured.`}
                            </p>
                            {serviceCount > 0 && (
                                <div className="mt-2 text-sm text-gray-700">
                                    {(related.services ?? []).slice(0, 3).map((s, idx) => (
                                        <div key={s.id} className="flex items-center gap-2">
                                            <span className="text-gray-500">{idx + 1}.</span>
                                            <span className="font-medium">{s.name}</span>
                                            <span className="text-gray-500">({s.duration_minutes} min, ₹{s.advance_amount})</span>
                                        </div>
                                    ))}
                                    {serviceCount > 3 && (
                                        <div className="text-gray-500 ml-5">+ {serviceCount - 3} more...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Working Hours Checklist Item */}
                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 mt-0.5">
                            {setupStatus.hoursConfigured ? (
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900">Working Hours</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                {!setupStatus.hoursConfigured && "Working hours not configured."}
                                {setupStatus.hoursConfigured && `${configuredDaysCount} day${configuredDaysCount !== 1 ? 's' : ''} open per week.`}
                            </p>
                            {setupStatus.hoursConfigured && (
                                <div className="mt-2 text-sm text-gray-700">
                                    {(related.workingHours ?? []).filter(wh => !wh.is_closed).slice(0, 3).map((wh) => (
                                        <div key={wh.day_of_week} className="flex items-center gap-2">
                                            <span className="font-medium w-12">
                                                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][wh.day_of_week]}:
                                            </span>
                                            <span className="text-gray-600">
                                                {wh.open_time?.slice(0,5)} - {wh.close_time?.slice(0,5)}
                                            </span>
                                        </div>
                                    ))}
                                    {configuredDaysCount > 3 && (
                                        <div className="text-gray-500 ml-14">+ {configuredDaysCount - 3} more days...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Next Steps - Only shown when setup is incomplete */}
            {!setupComplete && (
                <section className="mb-8 bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm p-6">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-yellow-900 mb-2">Next Steps</h2>
                            <div className="text-sm text-yellow-800 space-y-2">
                                <p className="font-medium">The shop owner needs to complete setup before accepting bookings:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    {!setupStatus.barbersConfigured && <li>Add at least 1 barber (max 2)</li>}
                                    {!setupStatus.servicesConfigured && <li>Configure at least 1 service with pricing and duration</li>}
                                    {!setupStatus.hoursConfigured && <li>Set working hours for each day of the week</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Owner Setup Link Hint */}
            <section className="mb-8 bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-6">
                <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-blue-900 mb-2">Guide Owner to Complete Setup</h2>
                        <div className="text-sm text-blue-800 space-y-3">
                            <p>
                                To help the shop owner complete setup, share these instructions:
                            </p>
                            <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-2">
                                <p className="font-medium text-blue-900">Owner Instructions:</p>
                                <ol className="list-decimal pl-5 space-y-1">
                                    <li>Visit the login page at your domain</li>
                                    <li>Sign in with email: <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">{shop.owner_email || 'owner email not available'}</span></li>
                                    <li>Complete the setup wizard (barbers → services → hours)</li>
                                    <li>Start accepting bookings!</li>
                                </ol>
                            </div>
                            <p className="text-xs text-blue-700">
                                Note: Admin cannot modify barbers, services, or hours directly. The owner must complete these steps.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium text-gray-700">Name:</span>
                        <span className="ml-2 text-gray-900">{shop.shop_name}</span>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Status:</span>
                        <span className="ml-2 text-gray-900">{shop.status}</span>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Owner Email:</span>
                        <span className="ml-2 text-gray-900">{shop.owner_email || "-"}</span>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Owner Phone:</span>
                        <span className="ml-2 text-gray-900">{shop.owner_phone || "-"}</span>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Created:</span>
                        <span className="ml-2 text-gray-900">{shop.created_at ? new Date(shop.created_at).toLocaleDateString() : "-"}</span>
                    </div>
                    <div className="md:col-span-2">
                        <span className="font-medium text-gray-700">Subscription:</span>
                        <span className="ml-2 text-gray-900">
                            {shop.subscription_start ? new Date(shop.subscription_start).toLocaleDateString() : "-"} → {shop.subscription_end ? new Date(shop.subscription_end).toLocaleDateString() : "-"}
                        </span>
                    </div>
                </div>
            </section>
<section className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
                <p className="text-sm text-gray-600 mb-4">Manage shop access and subscription status.</p>
                <div className="flex flex-col gap-3">
                    <ActionButton label="Extend Trial" confirm="Are you sure you want to extend the trial for this shop?" />
                    <ActionButton label="Set Subscription Dates" confirm="Set new subscription start and end dates for this shop?" />
                    <ActionButton label="Suspend Shop" confirm="Suspend this shop? Bookings will be blocked until reactivated." />
                    <ActionButton label="Reactivate Shop" confirm="Reactivate this shop and allow bookings?" />
                    <ActionButton label="Disable Booking (Emergency)" confirm="Disable all bookings for this shop immediately?" />
                </div>
            </section>

            {/* Detailed Lists - Collapsed by default look */}
            <section className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Complete Details</h2>
                
                {/* All Barbers */}
                <div className="mb-6">
                    <h3 className="text-base font-medium text-gray-800 mb-3">All Barbers ({barberCount})</h3>
                    {barberCount === 0 ? (
                        <p className="text-sm text-gray-500 italic">No barbers configured.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {(related.barbers ?? []).map((barber) => (
                                <li key={barber.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-b-0">
                                    <span className="text-gray-500">•</span>
                                    <div>
                                        <div className="font-medium text-gray-900">{barber.name}</div>
                                        {barber.phone && <div className="text-gray-600">Phone: {barber.phone}</div>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* All Services */}
                <div className="mb-6">
                    <h3 className="text-base font-medium text-gray-800 mb-3">All Services ({serviceCount})</h3>
                    {serviceCount === 0 ? (
                        <p className="text-sm text-gray-500 italic">No services configured.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {(related.services ?? []).map((service) => (
                                <li key={service.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-b-0">
                                    <span className="text-gray-500">•</span>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">{service.name}</div>
                                        <div className="text-gray-600">
                                            Duration: {service.duration_minutes} minutes | Advance: ₹{service.advance_amount}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Working Hours Summary */}
                <div className="mb-6">
                    <h3 className="text-base font-medium text-gray-800 mb-3">Working Hours</h3>
                    {related.workingHours.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No working hours configured.</p>
                    ) : (
                        <ul className="space-y-1 text-sm">
                            {(related.workingHours ?? []).map((wh) => (
                                <li key={wh.day_of_week} className="flex items-center gap-3 py-1.5">
                                    <span className="font-medium text-gray-700 w-20">
                                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][wh.day_of_week]}:
                                    </span>
                                    <span className="text-gray-600">
                                        {wh.is_closed ? (
                                            <span className="text-red-600">Closed</span>
                                        ) : (
                                            `${wh.open_time?.slice(0,5) || '--:--'} - ${wh.close_time?.slice(0,5) || '--:--'}`
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Recent Bookings */}
                <div>
                    <h3 className="text-base font-medium text-gray-800 mb-3">Recent Bookings (Last 14 Days)</h3>
                    {related.recentBookings.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No recent bookings.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {(related.recentBookings ?? []).map((bk) => (
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
                                    <div className="mt-1 flex items-center gap-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full ${
                                            bk.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                            bk.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {bk.status}
                                        </span>
                                        <span className="text-gray-500">
                                            {bk.is_walk_in ? '🚶 Walk-in' : '💻 Online'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </main>
    );
}


