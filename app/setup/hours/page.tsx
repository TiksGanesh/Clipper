import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveHoursAction } from '@/app/setup/actions'
import type { Database } from '@/types/database'

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
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<ShopId>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Step 3: Set Working Hours</h1>
                <p className="text-sm text-gray-600 mt-2">
                    All times are stored in UTC. If you operate in another timezone, subtract your offset. Example: IST (UTC+5:30) opening at 1:30 PM → enter 08:00 UTC.
                </p>
            </div>

            <form action={saveHoursAction} className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
                    <div className="grid grid-cols-1 gap-4">
                        {days.map((d) => (
                            <div key={d.key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{d.label}</p>
                                        <p className="text-xs text-gray-600">Set open and close times or mark as closed.</p>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input type="checkbox" name={`closed_${d.key}`} className="h-4 w-4" />
                                        Closed
                                    </label>
                                </div>
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Open (UTC)</label>
                                        <input
                                            type="time"
                                            name={`open_${d.key}`}
                                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Close (UTC)</label>
                                        <input
                                            type="time"
                                            name={`close_${d.key}`}
                                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                    Save and Continue
                </button>
            </form>
        </div>
    )
}
