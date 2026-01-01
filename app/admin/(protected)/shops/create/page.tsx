import { requireAdminContext } from '@/lib/auth'
import { createAdminShopAction } from './actions'
import Link from 'next/link'

export default async function AdminCreateShopPage({
    searchParams,
}: {
    searchParams: { error?: string }
}) {
    await requireAdminContext()

    return (
        <main>
            <h1 className="text-xl font-semibold mb-6">Create Shop</h1>
            
            <div className="max-w-xl">
                <div className="bg-white border border-gray-200 rounded-md p-4">
                {searchParams.error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                        {searchParams.error}
                    </div>
                )}

                <form action={createAdminShopAction} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">
                            Shop Name <span className="text-red-600">*</span>
                        </label>
                        <input 
                            name="name" 
                            required 
                            className="mt-1 w-full border border-gray-300 px-3 py-2 rounded" 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">
                            Owner Email <span className="text-red-600">*</span>
                        </label>
                        <input 
                            name="owner_email" 
                            type="email" 
                            required 
                            className="mt-1 w-full border border-gray-300 px-3 py-2 rounded" 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">
                            Owner Password <span className="text-red-600">*</span>
                        </label>
                        <input 
                            name="owner_password" 
                            type="password" 
                            required 
                            minLength={8}
                            className="mt-1 w-full border border-gray-300 px-3 py-2 rounded" 
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Min 8 characters. Share this with the owner so they can login.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">
                            Owner Phone
                        </label>
                        <input 
                            name="owner_phone" 
                            type="tel" 
                            className="mt-1 w-full border border-gray-300 px-3 py-2 rounded" 
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Owner will complete setup after login.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                            Create Shop
                        </button>
                        <Link 
                            href="/admin/shops" 
                            className="flex-1 text-center border border-gray-300 py-2 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
        </main>
    )
}
