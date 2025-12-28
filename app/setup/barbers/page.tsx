import { requireAuth } from '@/lib/auth'
import { createServerActionClient, createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function SetupBarbersPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    async function saveBarbersAction(formData: FormData) {
        'use server'
        const supabase = await createServerActionClient()

        const names = [
            (formData.get('barber1') as string)?.trim(),
            (formData.get('barber2') as string)?.trim(),
        ].filter(Boolean) as string[]

        const phones = [
            (formData.get('phone1') as string)?.trim(),
            (formData.get('phone2') as string)?.trim(),
        ]

        if (names.length === 0) {
            throw new Error('Add at least one barber')
        }

        if (names.length > 2) {
            throw new Error('Maximum 2 barbers allowed')
        }

        const rows = names.map((name, idx) => ({
            shop_id: shop!.id,
            name,
            phone: phones[idx] || null,
            is_active: true,
        }))

        const { error } = await supabase.from('barbers').insert(rows)
        if (error) {
            throw new Error(error.message)
        }

        redirect('/setup/hours')
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
