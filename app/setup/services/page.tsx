import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveServicesAction } from '@/app/setup/actions'

export default async function SetupServicesPage() {
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

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    const { data: services } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('shop_id', shop.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

    const servicesList = (services ?? []) as any[]

    return (
        <div className="max-w-2xl mx-auto py-6 px-4 sm:py-10 sm:px-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-6">Step 4: Add Services</h1>
            <form action={saveServicesAction} className="space-y-6">
                <div id="service-list" className="space-y-6">
                    {(servicesList.length ? servicesList : [null]).map((service, idx) => (
                        <div key={service?.id ?? `new-${idx}`} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
                            <input type="hidden" name="service_id" defaultValue={service?.id ?? ''} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
                                    <input
                                        name="service_name"
                                        defaultValue={service?.name ?? ''}
                                        required
                                        maxLength={100}
                                        minLength={2}
                                        className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        placeholder="e.g., Haircut"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">Duration (minutes)</label>
                                    <input
                                        name="service_duration"
                                        type="number"
                                        min={1}
                                        max={480}
                                        step={1}
                                        defaultValue={service?.duration_minutes ?? ''}
                                        required
                                        className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        placeholder="30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">Price</label>
                                    <input
                                        name="service_price"
                                        type="number"
                                        min={0}
                                        max={100000}
                                        step="0.01"
                                        defaultValue={service?.price ?? ''}
                                        required
                                        className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm">
                    Save and Finish
                </button>
            </form>
            <script dangerouslySetInnerHTML={{
                __html: `
                (function(){
                    const list = document.getElementById('service-list');
                    const addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.textContent = '+ Add another service';
                    addBtn.className = 'mt-4 w-full border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 font-medium text-sm';
                    addBtn.onclick = function(){
                        const row = document.createElement('div');
                        row.className = 'bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6';
                        row.innerHTML = '<input type="hidden" name="service_id" value="" /><div class="grid grid-cols-1 sm:grid-cols-3 gap-4"><div><label class="block text-sm font-medium text-gray-900 mb-1">Name</label><input name="service_name" required class="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="e.g., Haircut" /></div><div><label class="block text-sm font-medium text-gray-900 mb-1">Duration (minutes)</label><input name="service_duration" type="number" min="1" required class="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="30" /></div><div><label class="block text-sm font-medium text-gray-900 mb-1">Price</label><input name="service_price" type="number" min="0" step="0.01" required class="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="0.00" /></div></div>';
                        list.appendChild(row);
                    };
                    list.parentElement.appendChild(addBtn);
                })();
            ` }} />
        </div>
    )
}
