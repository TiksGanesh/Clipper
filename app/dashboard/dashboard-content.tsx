'use client'

export default function DashboardContent() {
    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                    href="/dashboard/services"
                    className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Manage Services</h4>
                        <p className="text-sm text-gray-600">Edit services and pricing</p>
                    </div>
                    <div className="text-gray-400">→</div>
                </a>
            </div>
        </div>
    )
}
