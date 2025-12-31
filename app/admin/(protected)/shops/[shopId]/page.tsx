

import { requireAdminContext } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getAdminShopDetailById } from "@/lib/admin-shop-detail";

import dynamic from "next/dynamic";
import { getShopSetupStatus } from "@/lib/shop-setup-status";
import { getShopRelatedData } from "@/lib/shop-related-data";

interface PageProps {
    params: { shopId?: string };
}

// Server component for /admin/shops/[shopId]
// No UI yet, just access control and param validation
export default async function Page({ params }: PageProps) {
    // Validate shopId param (must be a non-empty string, numeric or uuid)
    const { shopId } = params;
    if (!shopId || typeof shopId !== "string" || shopId.length < 1) {
        notFound(); // 404 for invalid param
    }

            let errorMsg: string | null = null;
            if (!shopId || typeof shopId !== "string" || shopId.length < 8) {
                errorMsg = "Invalid shop ID.";
            }
    try {
        await requireAdminContext();
    } catch (err: any) {
        if (err?.status === 401) {
            // Not authenticated
            return new Response("Unauthorized", { status: 401 });
        }
        if (err?.status === 403) {
            // Authenticated but not admin
            return new Response("Forbidden", { status: 403 });
        }
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
        // Debug: log related data to server console
        // eslint-disable-next-line no-console
        console.log("[DEBUG] Shop related data:", JSON.stringify(related, null, 2));
    } catch (err: any) {
        if (err?.status === 404) {
            notFound();
        }
        throw err;
    }

    // Minimal Shop Details layout
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                            {errorMsg}
                        </div>
                    )}
    // Dynamically import ActionButton as a client component
    const ActionButton = dynamic(() => import("@/components/dashboard/ActionButton"), { ssr: false });

    return (
        <main className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-4">Shop Details</h1>
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Shop Summary</h2>
                <div className="grid grid-cols-1 gap-2 text-sm">
                    <div>
                        <span className="font-medium">Name:</span> {shop.shop_name}
                    </div>
                    <div>
                        <span className="font-medium">Status:</span> {shop.status}
                    </div>
                    <div>
                        <span className="font-medium">Owner Contact:</span> {shop.owner_email || shop.owner_phone || "-"}
                    </div>
                    <div>
                        <span className="font-medium">Created:</span> {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : "-"}
                    </div>
                    <div>
                        <span className="font-medium">Subscription:</span> {shop.subscription_start ? new Date(shop.subscription_start).toLocaleDateString() : "-"} &ndash; {shop.subscription_end ? new Date(shop.subscription_end).toLocaleDateString() : "-"}
                    </div>
                </div>
            </section>
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Setup Status</h2>
                <ul className="list-none pl-0 text-sm">
                    <li>
                        <span className="font-medium">Barbers configured:</span> {setupStatus.barbersConfigured ? "Yes" : "No"}
                    </li>
                    <li>
                        <span className="font-medium">Services configured:</span> {setupStatus.servicesConfigured ? "Yes" : "No"}
                    </li>
                    <li>
                        <span className="font-medium">Working hours configured:</span> {setupStatus.hoursConfigured ? "Yes" : "No"}
                    </li>
                </ul>
            </section>
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Admin Actions</h2>
                <div className="flex flex-col gap-3">
                    <ActionButton label="Extend Trial" confirm="Are you sure you want to extend the trial for this shop?" />
                    <ActionButton label="Set Subscription Dates" confirm="Set new subscription start and end dates for this shop?" />
                    <ActionButton label="Suspend Shop" confirm="Suspend this shop? Bookings will be blocked until reactivated." />
                    <ActionButton label="Reactivate Shop" confirm="Reactivate this shop and allow bookings?" />
                    <ActionButton label="Disable Booking (Emergency)" confirm="Disable all bookings for this shop immediately?" />
                </div>
            </section>
            {/* Barbers List */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Barbers</h2>
                <ul className="list-disc pl-5 text-sm">
                    {(related?.barbers?.length ?? 0) === 0 && <li>No barbers configured.</li>}
                    {(related?.barbers ?? []).map(barber => (
                        <li key={barber.id}>
                            {barber.name} {barber.phone ? `(${barber.phone})` : ""}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Services List */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Services</h2>
                <ul className="list-disc pl-5 text-sm">
                    {(related?.services?.length ?? 0) === 0 && <li>No services configured.</li>}
                    {(related?.services ?? []).map(service => (
                        <li key={service.id}>
                            {service.name} &ndash; {service.duration_minutes} min, Advance: ₹{service.advance_amount}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Working Hours Summary */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Working Hours</h2>
                <ul className="list-disc pl-5 text-sm">
                    {(related?.workingHours?.length ?? 0) === 0 && <li>No working hours configured.</li>}
                    {(related?.workingHours ?? []).map((wh, i) => (
                        <li key={i}>
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wh.day_of_week]}: {wh.is_closed ? 'Closed' : `${wh.open_time?.slice(0,5) || '--:--'} - ${wh.close_time?.slice(0,5) || '--:--'}`}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Recent Bookings List */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Recent Bookings</h2>
                <ul className="list-disc pl-5 text-sm">
                    {(related?.recentBookings?.length ?? 0) === 0 && <li>No recent bookings.</li>}
                    {(related?.recentBookings ?? []).map(bk => (
                        <li key={bk.id}>
                            {bk.customer_name} ({bk.customer_phone}) &ndash; {bk.status}, {bk.is_walk_in ? 'Walk-in' : 'Online'}<br />
                            {bk.start_time ? new Date(bk.start_time).toLocaleString() : ''}
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
}


