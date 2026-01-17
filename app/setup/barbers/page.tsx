import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveBarbersAction } from '@/app/setup/actions'
import type { Database } from '@/types/database'
import { useShopTerminology, type BusinessType } from '@/src/hooks/useShopTerminology'

export default async function SetupBarbersPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: adminMembership } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (adminMembership) {
        redirect('/admin/dashboard')
    }

    type ShopId = Pick<Database['public']['Tables']['shops']['Row'], 'id'>

    const { data: shop } = await supabase
        .from('shops')
        .select('id, business_type, terminology_overrides')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    // Get terminology for this shop
    const terms = useShopTerminology(
        (shop as any).business_type || 'barber',
        (shop as any).terminology_overrides
    )

    return (
        <div className="max-w-lg mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 2: Add {terms.staff_label}s (max 2)</h1>
            <form action={saveBarbersAction} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium">{terms.staff_label} 1 Name</label>
                        <input 
                            name="barber1" 
                            required 
                            maxLength={100}
                            minLength={2}
                            pattern="[A-Za-z\s.,'\-]+"
                            title={`${terms.staff_label} name should be 2-100 characters (letters and spaces only)`}
                            className="mt-1 w-full border px-3 py-2 rounded" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">{terms.staff_label} 1 Phone (optional)</label>
                        <input 
                            name="phone1" 
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]{10,15}"
                            maxLength={15}
                            title="Enter a valid phone number (10-15 digits)"
                            className="mt-1 w-full border px-3 py-2 rounded" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">{terms.staff_label} 2 Name (optional)</label>
                        <input 
                            name="barber2" 
                            maxLength={100}
                            minLength={2}
                            pattern="[A-Za-z\s.,'\-]+"
                            title={`${terms.staff_label} name should be 2-100 characters (letters and spaces only)`}
                            className="mt-1 w-full border px-3 py-2 rounded" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">{terms.staff_label} 2 Phone (optional)</label>
                        <input 
                            name="phone2" 
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]{10,15}"
                            maxLength={15}
                            title="Enter a valid phone number (10-15 digits)"
                            className="mt-1 w-full border px-3 py-2 rounded" 
                        />
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                    Save and Continue
                </button>
            </form>
        </div>
    )
}
