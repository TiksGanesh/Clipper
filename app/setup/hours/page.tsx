import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveHoursAction } from '@/app/setup/actions'

const days = [
    { key: 0, label: 'Sunday' },
    { key: 1, label: 'Monday' },
    { key: 2, label: 'Tuesday' },
    { key: 3, label: 'Wednesday' },
    { key: 4, label: 'Thursday' },
    { key: 5, label: 'Friday' },
    { key: 6, label: 'Saturday' },
]

export default async function SetupHoursPage() {
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

    return (
        <div className="max-w-2xl mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 3: Set Working Hours</h1>
            <form action={saveHoursAction} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    {days.map((d) => (
                        <div key={d.key} className="border rounded p-4">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{d.label}</span>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" name={`closed_${d.key}`} /> Closed
                                </label>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs">Open</label>
                                    <input type="time" name={`open_${d.key}`} className="mt-1 w-full border px-3 py-2 rounded" />
                                </div>
                                <div>
                                    <label className="block text-xs">Close</label>
                                    <input type="time" name={`close_${d.key}`} className="mt-1 w-full border px-3 py-2 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                    Save and Continue
                </button>
            </form>
        </div>
    )
}
