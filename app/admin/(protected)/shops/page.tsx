
import { requireAdminContext } from '@/lib/auth'
import { getAdminShopListWithPagination } from '@/lib/admin-shop-list'
import { Suspense } from 'react'

const ALLOWED_STATUS = ['setup_pending', 'trial', 'active', 'suspended', 'expired'] as const
type StatusParam = typeof ALLOWED_STATUS[number]

function parseQueryParams(searchParams: URLSearchParams) {
    let status: StatusParam | '' = ''
    let search: string = ''
    let page: number = 1

    const statusParam = searchParams.get('status')
    if (statusParam && ALLOWED_STATUS.includes(statusParam as StatusParam)) {
        status = statusParam as StatusParam
    }
    search = searchParams.get('search') || ''
    const pageParam = searchParams.get('page')
    if (pageParam && !isNaN(Number(pageParam))) {
        page = Math.max(1, Number(pageParam))
    }
    return { status, search, page }
}

export default async function AdminShopsPage({ searchParams }: { searchParams: Record<string, string | string[]> }) {
    try {
        await requireAdminContext()
    } catch (err: any) {
        if (err?.status === 401) {
            return new Response('Unauthorized', { status: 401 })
        }
        if (err?.status === 403) {
            return new Response('Forbidden', { status: 403 })
        }
        return new Response('Error', { status: 500 })
    }

    // Parse and validate query params
    const urlParams = new URLSearchParams(
        Object.entries(searchParams).flatMap(([k, v]) =>
            Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, v]]
        )
    )
    const { status, search, page } = parseQueryParams(urlParams)

    let data = null
    let errorMsg = ''
    try {
        data = await getAdminShopListWithPagination({ status: status || undefined, search: search || undefined, page })
    } catch (e) {
        errorMsg = 'Failed to load shops. Please try again later.'
    }

    return (
        <main>
            <h1>Shops</h1>
            <form method="get" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                <label>
                    Status:
                    <select name="status" defaultValue={status} style={{ marginLeft: 4 }}>
                        <option value="">All</option>
                        {ALLOWED_STATUS.map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Search:
                    <input
                        type="text"
                        name="search"
                        defaultValue={search}
                        placeholder="Shop name or owner contact"
                        style={{ marginLeft: 4 }}
                    />
                </label>
                <button type="submit">Apply</button>
            </form>
            {errorMsg ? (
                <div style={{ margin: '32px 0', padding: 16, border: '1px solid #f00', borderRadius: 8, background: '#fff0f0' }}>
                    <strong>{errorMsg}</strong>
                </div>
            ) : data && data.items.length === 0 ? (
                <p>No shops found matching your filters.</p>
            ) : data ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>Shop Name</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>Owner Contact</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>Status</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>Subscription End Date</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>Created Date</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((shop) => (
                            <tr key={shop.shop_id}>
                                <td style={{ padding: 4 }}>{shop.shop_name}</td>
                                <td style={{ padding: 4 }}>{shop.owner_email || shop.owner_phone || '-'}</td>
                                <td style={{ padding: 4 }}>{shop.status}</td>
                                <td style={{ padding: 4 }}>{shop.subscription_end || '-'}</td>
                                <td style={{ padding: 4 }}>{shop.created_at}</td>
                                <td style={{ padding: 4 }}>
                                    <a href={`/admin/shops/${shop.shop_id}`} style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none' }}>Open</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : null}
        </main>
    )
}
