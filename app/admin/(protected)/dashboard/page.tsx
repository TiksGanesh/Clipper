

import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getShopAdminDashboardCounts, getLatestSetupPendingShops } from '@/lib/admin-dashboard'
import Link from 'next/link'

export default async function AdminDashboardPage() {
    const user = await requireAuth()
    let counts: { total: number; active: number; trial: number; suspended: number; expired: number; setup_pending: number } | null = null
    let setupPending = null
    let errorMsg = ''
    
    // System alerts - can be fetched from database or calculated
    const systemAlerts: string[] = []
    // Example: if (counts?.expired > 0) systemAlerts.push(`${counts.expired} shops have expired subscriptions`)
    
    try {
        [counts, setupPending] = await Promise.all([
            getShopAdminDashboardCounts(),
            getLatestSetupPendingShops(10),
        ])
    } catch (e) {
        console.error('Dashboard data load error:', e)
        errorMsg = 'Failed to load dashboard data. Please try again later.'
    }

    // Check if platform has no shops at all
    const hasNoShops = counts?.total === 0

    return (
        <main className="max-w-7xl mx-auto px-4">
            <h1 className="text-xl font-semibold mb-4">Admin Dashboard</h1>
            
            {errorMsg ? (
                <div className="bg-red-50 border border-red-500 rounded-md p-4">
                    <p className="text-red-800 font-medium">Error Loading Dashboard</p>
                    <p className="text-red-700 text-sm mt-1">{errorMsg}</p>
                </div>
            ) : hasNoShops ? (
                <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
                    <h2 className="text-lg font-medium text-gray-900 mb-2">Welcome to Admin Dashboard</h2>
                    <p className="text-gray-600 mb-6">No shops have been created yet. Get started by creating your first shop.</p>
                    <Link 
                        href="/admin/shops/create"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Create First Shop
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {systemAlerts.length > 0 && (
                        <section className="bg-white border border-gray-200 rounded-md p-4">
                            <h2 className="text-lg font-medium mb-4">System Alerts</h2>
                            <ul className="space-y-2">
                                {systemAlerts.map((alert, index) => (
                                    <li key={index} className="text-sm text-gray-700">
                                        <span className="font-medium">•</span> {alert}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-medium mb-4">Platform Snapshot</h2>
                        {counts ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Link href="/admin/shops" className="block">
                                    <div className="border border-gray-200 rounded-md p-4 text-center hover:border-gray-300 transition-colors">
                                        <div className="text-sm text-gray-600 mb-1">Total Shops</div>
                                        <div className="text-3xl font-bold text-gray-900">{counts.total}</div>
                                    </div>
                                </Link>
                                <Link href="/admin/shops?status=active" className="block">
                                    <div className="border border-gray-200 rounded-md p-4 text-center hover:border-gray-300 transition-colors">
                                        <div className="text-sm text-gray-600 mb-1">Active</div>
                                        <div className="text-3xl font-bold text-gray-900">{counts.active}</div>
                                    </div>
                                </Link>
                                <Link href="/admin/shops?status=trial" className="block">
                                    <div className="border border-gray-200 rounded-md p-4 text-center hover:border-gray-300 transition-colors">
                                        <div className="text-sm text-gray-600 mb-1">Trial</div>
                                        <div className="text-3xl font-bold text-gray-900">{counts.trial}</div>
                                    </div>
                                </Link>
                                <Link href="/admin/shops?status=suspended" className="block">
                                    <div className="border border-gray-200 rounded-md p-4 text-center hover:border-gray-300 transition-colors">
                                        <div className="text-sm text-gray-600 mb-1">Suspended / Expired</div>
                                        <div className="text-3xl font-bold text-gray-900">{counts.suspended + counts.expired}</div>
                                    </div>
                                </Link>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">Unable to load shop statistics</p>
                        )}
                    </section>
                    
                    <section className="bg-white border border-gray-200 rounded-md p-4">
                        <h2 className="text-lg font-medium mb-4">Setup Pending Shops</h2>
                        {!setupPending ? (
                            <p className="text-gray-500 text-sm">Unable to load setup pending shops</p>
                        ) : setupPending.length === 0 ? (
                            <p className="text-gray-500 text-sm">No shops pending setup</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Shop Name</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Owner Contact</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Created Date</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {setupPending.map((shop) => (
                                            <tr key={shop.shop_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm">{shop.shop_name}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{shop.owner_email || shop.owner_phone || '-'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{shop.created_at}</td>
                                                <td className="py-3 px-4">
                                                    <Link 
                                                        href={`/admin/shops/${shop.shop_id}`}
                                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        Open
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </main>
    )
}
