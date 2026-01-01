import { requireAdminContext } from '@/lib/auth'
import { createAdminShopAction } from './actions'

export default async function AdminCreateShopPage({
    searchParams,
}: {
    searchParams: { error?: string }
}) {
    await requireAdminContext()

    return (
        <main className="max-w-xl mx-auto py-10 px-4">
            <h1 className="text-2xl font-bold mb-2">Create Shop</h1>
            <p className="text-sm text-gray-600 mb-6">
                Create a shop, generate a new barber owner account, and set their password. Share the credentials with the barber to let them log in.
            </p>

            {searchParams.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                    {searchParams.error}
                </div>
            )}

            <form action={createAdminShopAction} className="space-y-5">
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold">Shop Details</h2>
                    <div>
                        <label className="block text-sm font-medium">Shop Name</label>
                        <input name="name" required className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Shop Phone</label>
                        <input name="phone" required className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Address (optional)</label>
                        <input name="address" className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-sm font-semibold">Owner Account</h2>
                    <div>
                        <label className="block text-sm font-medium">Owner Email</label>
                        <input name="owner_email" type="email" required className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Owner Password</label>
                        <input name="owner_password" type="password" required minLength={8} className="mt-1 w-full border px-3 py-2 rounded" />
                        <p className="text-xs text-gray-500 mt-1">Min 8 characters. Share this with the barber so they can log in.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-sm font-semibold">Primary Barber</h2>
                    <div>
                        <label className="block text-sm font-medium">Barber Name</label>
                        <input name="barber_name" required className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Barber Phone (optional)</label>
                        <input name="barber_phone" className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                    Create Shop & Invite Barber
                </button>
            </form>
        </main>
    )
}
