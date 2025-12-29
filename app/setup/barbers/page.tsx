import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveBarbersAction } from '@/app/setup/actions'
import type { Database } from '@/types/database'

export default async function SetupBarbersPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    type ShopId = Pick<Database['public']['Tables']['shops']['Row'], 'id'>

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<ShopId>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    return (
        <div className="max-w-lg mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 2: Add Barbers (max 2)</h1>
            <form action={saveBarbersAction} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Barber 1 Name</label>
                        <input name="barber1" required className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Barber 1 Phone (optional)</label>
                        <input name="phone1" className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Barber 2 Name (optional)</label>
                        <input name="barber2" className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Barber 2 Phone (optional)</label>
                        <input name="phone2" className="mt-1 w-full border px-3 py-2 rounded" />
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                    Save and Continue
                </button>
            </form>
        </div>
    )
}
