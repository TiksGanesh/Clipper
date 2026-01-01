import Link from 'next/link'

export default function NotFound() {
    return (
        <main className="space-y-6">
            <h1 className="text-xl font-semibold">Shop Not Found</h1>
            <div className="bg-white border border-gray-200 rounded-md p-6">
                <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h2 className="text-lg font-medium text-gray-900 mb-2">Shop Not Found</h2>
                    <p className="text-gray-600 mb-6">
                        The shop you are looking for does not exist or has been deleted.
                    </p>
                    <Link 
                        href="/admin/shops"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Return to Shops List
                    </Link>
                </div>
            </div>
        </main>
    )
}
