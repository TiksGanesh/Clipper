import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createServiceAction, deleteServiceAction, updateServiceAction } from './actions'

export default async function DashboardServicesPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    const shopId = shop?.id
    if (!shopId) {
        redirect('/setup/shop')
    }

    const { data: services, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, is_active, created_at')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

    if (error) {
        throw new Error(error.message)
    }

    const servicesList = (services ?? []) as any[]

    return (
        <div className="max-w-4xl mx-auto py-4 md:py-10 px-4 space-y-6 md:space-y-8 overflow-x-hidden">
            <header className="space-y-2">
                <h1 className="text-xl md:text-2xl font-bold">Services</h1>
                <p className="text-sm md:text-base text-gray-600">Manage your shop services.</p>
            </header>

            <section className="bg-white shadow-sm rounded-lg p-4 md:p-6 space-y-4">
                <h2 className="text-base md:text-lg font-semibold">Add service</h2>
                <form action={createServiceAction} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <label className="space-y-1">
                        <span className="text-sm text-gray-700">Name</span>
                        <input name="name" required className="w-full border rounded px-3 py-2 text-sm" placeholder="Haircut" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-sm text-gray-700">Duration (minutes)</span>
                        <input name="duration" type="number" min={1} required className="w-full border rounded px-3 py-2" placeholder="30" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-sm text-gray-700">Price</span>
                        <input name="price" type="number" min={0} step="0.01" required className="w-full border rounded px-3 py-2" placeholder="15" />
                    </label>
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
                </form>
            </section>

            <section className="bg-white shadow-sm rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold">Existing services</h2>
                {servicesList && servicesList.length > 0 ? (
                    <div className="space-y-3">
                        {servicesList.map((service) => (
                            <div key={service.id} className="border rounded p-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                    <form action={updateServiceAction} className="contents">
                                        <input type="hidden" name="id" value={service.id} />
                                        <label className="space-y-1">
                                            <span className="text-sm text-gray-700">Name</span>
                                            <input
                                                name="name"
                                                defaultValue={service.name}
                                                required
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm text-gray-700">Duration (minutes)</span>
                                            <input
                                                name="duration"
                                                type="number"
                                                min={1}
                                                defaultValue={service.duration_minutes}
                                                required
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm text-gray-700">Price</span>
                                            <input
                                                name="price"
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                defaultValue={service.price}
                                                required
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                name="is_active"
                                                type="checkbox"
                                                defaultChecked={service.is_active}
                                                className="h-4 w-4"
                                            />
                                            Active
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                className="bg-blue-600 text-white px-3 py-2 rounded w-full"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </form>
                                    <form action={deleteServiceAction} className="flex justify-end">
                                        <input type="hidden" name="id" value={service.id} />
                                        <button
                                            type="submit"
                                            className="bg-red-600 text-white px-3 py-2 rounded"
                                        >
                                            Delete
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-600">No services yet. Add your first service above.</p>
                )}
            </section>
        </div>
    )
}
