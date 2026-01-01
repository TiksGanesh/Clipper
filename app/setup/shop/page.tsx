import { requireAdmin } from '@/lib/auth'
import { createShopAction } from '@/app/setup/actions'

export default async function SetupShopPage({
    searchParams,
}: {
    searchParams: { error?: string }
}) {
    await requireAdmin()

    return (
        <div className="max-w-lg mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 1: Create Shop</h1>
            
            {searchParams.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                    {searchParams.error}
                </div>
            )}
            
            <form action={createShopAction} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Shop Name</label>
                    <input name="name" required className="mt-1 w-full border px-3 py-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Phone</label>
                    <input name="phone" required className="mt-1 w-full border px-3 py-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Address (optional)</label>
                    <input name="address" className="mt-1 w-full border px-3 py-2 rounded" />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                    Save and Continue
                </button>
            </form>
        </div>
    )
}
