
import { requireAdminContext } from '@/lib/auth'
import { getAdminShopListWithPagination } from '@/lib/admin-shop-list'
import { Suspense } from 'react'

const ALLOWED_STATUS = ['setup_pending', 'trial', 'active', 'suspended', 'expired'] as const
type StatusParam = typeof ALLOWED_STATUS[number]

function formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
        'setup_pending': 'Pending',
        'trial': 'Trial',
        'active': 'Active',
        'suspended': 'Suspended',
        'expired': 'Expired'
    }
    return statusMap[status] || status
}

function getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
        'setup_pending': 'text-yellow-700 bg-yellow-50',
        'trial': 'text-blue-700 bg-blue-50',
        'active': 'text-green-700 bg-green-50',
        'suspended': 'text-orange-700 bg-orange-50',
        'expired': 'text-red-700 bg-red-50'
    }
    return colorMap[status] || 'text-gray-700 bg-gray-50'
}

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
    // Auth check is handled by layout, but we still await it
    await requireAdminContext()

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
    } catch (e: any) {
        // Provide user-friendly error messages without exposing internals
        console.error('Failed to load shops:', e)
        errorMsg = 'Unable to load shops at this time. Please refresh the page or try again later.'
    }

    return (
        <main className="space-y-6">
            <h1 className="text-xl font-semibold">Shops</h1>

            {/* Filters Card */}
            <div className="bg-white rounded-lg shadow p-6">
                <form method="get" className="flex flex-col md:flex-row gap-4 md:items-end">
                    <div className="flex flex-col gap-1 flex-1">
                        <label htmlFor="status" className="text-sm font-medium text-gray-700">
                            Status
                        </label>
                        <select 
                            id="status"
                            name="status" 
                            defaultValue={status}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All</option>
                            {ALLOWED_STATUS.map((s) => (
                                <option key={s} value={s}>
                                    {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <label htmlFor="search" className="text-sm font-medium text-gray-700">
                            Search
                        </label>
                        <input
                            id="search"
                            type="text"
                            name="search"
                            defaultValue={search}
                            placeholder="Shop name or owner contact"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button 
                        type="submit"
                        className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Apply
                    </button>
                </form>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-lg shadow">
                {errorMsg ? (
                    <div className="p-6">
                        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-red-800">{errorMsg}</p>
                                    <p className="text-xs text-red-600 mt-1">
                                        If this issue persists, please contact support.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : data && data.items.length === 0 ? (
                    <div className="p-6">
                        <p className="text-gray-600">No shops found matching your filters.</p>
                    </div>
                ) : data ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Shop Name</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Owner Contact</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Subscription End</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Created</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.items.map((shop) => (
                                    <tr key={shop.shop_id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-sm text-gray-900">{shop.shop_name}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{shop.owner_email || shop.owner_phone || '-'}</td>
                                        <td className="py-3 px-4 text-sm">
                                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(shop.status)}`}>
                                                {formatStatus(shop.status)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{shop.subscription_end || '-'}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{shop.created_at}</td>
                                        <td className="py-3 px-4 text-sm">
                                            <a 
                                                href={`/admin/shops/${shop.shop_id}`}
                                                className="inline-block px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700 no-underline transition-colors"
                                            >
                                                Open
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}

                {/* Pagination Controls */}
                {data && data.total_count > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Page {data.current_page}
                        </div>
                        <div className="flex gap-2">
                            <a
                                href={`?${new URLSearchParams({ status, search, page: String(page - 1) }).toString()}`}
                                className={`px-4 py-2 text-sm border rounded ${
                                    page <= 1
                                        ? 'border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                                aria-disabled={page <= 1}
                            >
                                Previous
                            </a>
                            <a
                                href={`?${new URLSearchParams({ status, search, page: String(page + 1) }).toString()}`}
                                className={`px-4 py-2 text-sm border rounded ${
                                    !data.has_next_page
                                        ? 'border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                                aria-disabled={!data.has_next_page}
                            >
                                Next
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
