import { requireAuth } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function SetupShopPage() {
    const user = await requireAuth()

    async function createShopAction(formData: FormData) {
        'use server'
        const supabase = await createServerActionClient()

        const name = (formData.get('name') as string)?.trim()
        const phone = (formData.get('phone') as string)?.trim()
        const address = (formData.get('address') as string)?.trim() || null

        if (!name || !phone) {
            throw new Error('Name and phone are required')
        }

        // If shop already exists for this owner, redirect to next step
        const { data: existing } = await supabase
            .from('shops')
            .select('id')
            .eq('owner_id', user.id)
            .is('deleted_at', null)
            .maybeSingle()

        if (existing?.id) {
            redirect('/setup/barbers')
        }

        const { error } = await supabase.from('shops').insert({
            owner_id: user.id,
            name,
            phone,
            address,
        })

        if (error) {
            throw new Error(error.message)
        }

        redirect('/setup/barbers')
    }

    return (
        <div className="max-w-lg mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 1: Create Shop</h1>
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
