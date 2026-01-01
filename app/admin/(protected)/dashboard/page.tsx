

import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getShopAdminDashboardCounts, getLatestSetupPendingShops } from '@/lib/admin-dashboard'

export default async function AdminDashboardPage() {
    const user = await requireAuth()
    let counts: { total: number; active: number; trial: number; suspended: number; expired: number; setup_pending: number } | null = null
    let setupPending = null
    let errorMsg = ''
    try {
        [counts, setupPending] = await Promise.all([
            getShopAdminDashboardCounts(),
            getLatestSetupPendingShops(10),
        ])
    } catch (e) {
        errorMsg = 'Failed to load dashboard data. Please try again later.'
    }

    return (
        <>
            <header style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '16px 0', marginBottom: '32px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: '#666', fontSize: '14px' }}>Welcome, {user.email}</span>
                        <form action="/api/admin/signout" method="POST" style={{ margin: 0 }}>
                            <button
                                type="submit"
                                style={{
                                    padding: '8px 16px',
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                }}
                            >
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </header>
            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
                {errorMsg ? (
                  <div style={{ margin: '32px 0', padding: 16, border: '1px solid #f00', borderRadius: 8, background: '#fff0f0' }}>
                    <strong>{errorMsg}</strong>
                  </div>
                ) : (
                  <>
                    <section>
                <h2>Quick Actions</h2>
                <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                    <a href="/admin/shops/create" style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, textDecoration: 'none' }}>Create New Shop</a>
                    <a href="/admin/shops" style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, textDecoration: 'none' }}>View All Shops</a>
                    <a href="/admin/shops?status=setup_pending" style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, textDecoration: 'none' }}>Setup Pending Shops</a>
                </div>
            </section>
            <section>
                <h2>Platform Snapshot</h2>
                <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                    <a href="/admin/shops" style={{ textDecoration: 'none' }}>
                        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 120, textAlign: 'center' }}>
                            <div>Total Shops</div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{counts?.total ?? 0}</div>
                        </div>
                    </a>
                    <a href="/admin/shops?status=active" style={{ textDecoration: 'none' }}>
                        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 120, textAlign: 'center' }}>
                            <div>Active Shops</div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{counts?.active ?? 0}</div>
                        </div>
                    </a>
                    <a href="/admin/shops?status=trial" style={{ textDecoration: 'none' }}>
                        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 120, textAlign: 'center' }}>
                            <div>Trial Shops</div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{counts?.trial ?? 0}</div>
                        </div>
                    </a>
                    <a href="/admin/shops?status=suspended" style={{ textDecoration: 'none' }}>
                        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 120, textAlign: 'center' }}>
                            <div>Suspended / Expired</div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{(counts?.suspended ?? 0) + (counts?.expired ?? 0)}</div>
                        </div>
                    </a>
                </div>
            </section>
            <section>
                <h2>Setup Pending Shops</h2>
                {setupPending?.length === 0 ? (
                    <p>No shops pending setup</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Shop Name</th>
                                <th>Owner Contact</th>
                                <th>Created Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(setupPending ?? []).map((shop) => (
                                <tr key={shop.shop_id}>
                                    <td>{shop.shop_name}</td>
                                    <td>{shop.owner_email || shop.owner_phone || '-'}</td>
                                    <td>{shop.created_at}</td>
                                    <td>
                                        <a href={`/admin/shops/${shop.shop_id}`} style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none' }}>Open</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
                  </>
                )}
            </main>
        </>
    )
}
