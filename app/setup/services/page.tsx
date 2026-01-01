import { requireAdmin } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveServicesAction } from '@/app/setup/actions'

export default async function SetupServicesPage() {
    const user = await requireAdmin()
    const supabase = await createServerSupabaseClient()

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
        <div className="max-w-2xl mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 4: Add Services</h1>
            <form action={saveServicesAction} className="space-y-4">
                <div id="service-list" className="space-y-4">
                    {(servicesList.length ? servicesList : [null]).map((service, idx) => (
                        <div key={service?.id ?? `new-${idx}`} className="grid grid-cols-3 gap-3">
                            <input type="hidden" name="service_id" defaultValue={service?.id ?? ''} />
                            <div>
                                <label className="block text-sm">Name</label>
                                <input
                                    name="service_name"
                                    defaultValue={service?.name ?? ''}
                                    required
                                    className="mt-1 w-full border px-3 py-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm">Duration (minutes)</label>
                                <input
                                    name="service_duration"
                                    type="number"
                                    min={1}
                                    defaultValue={service?.duration_minutes ?? ''}
                                    required
                                    className="mt-1 w-full border px-3 py-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm">Price</label>
                                <input
                                    name="service_price"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    defaultValue={service?.price ?? ''}
                                    required
                                    className="mt-1 w-full border px-3 py-2 rounded"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                    Save and Finish
                </button>
            </form>
            <script dangerouslySetInnerHTML={{
                __html: `
                (function(){
                    const list = document.getElementById('service-list');
                    const addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.textContent = 'Add another service';
                    addBtn.className = 'mt-4 w-full bg-gray-100 text-gray-800 py-2 rounded';
                    addBtn.onclick = function(){
                        const row = document.createElement('div');
                        row.className = 'grid grid-cols-3 gap-3';
                        row.innerHTML = '<input type="hidden" name="service_id" value="" /><div><label class="block text-sm">Name</label><input name="service_name" required class="mt-1 w-full border px-3 py-2 rounded" /></div><div><label class="block text-sm">Duration (minutes)</label><input name="service_duration" type="number" min="1" required class="mt-1 w-full border px-3 py-2 rounded" /></div><div><label class="block text-sm">Price</label><input name="service_price" type="number" min="0" step="0.01" required class="mt-1 w-full border px-3 py-2 rounded" /></div>';
                        list.appendChild(row);
                    };
                    list.parentElement.appendChild(addBtn);
                })();
            ` }} />
        </div>
    )
}
