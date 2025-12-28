import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { saveServicesAction } from '@/app/setup/actions'

export default async function SetupServicesPage() {
    const user = await requireAuth()
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

    return (
        <div className="max-w-2xl mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">Step 4: Add Services</h1>
            <form action={saveServicesAction} className="space-y-4">
                <div id="service-list" className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm">Name</label>
                            <input name="service_name" required className="mt-1 w-full border px-3 py-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm">Duration (minutes)</label>
                            <input name="service_duration" type="number" min={1} required className="mt-1 w-full border px-3 py-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm">Price</label>
                            <input name="service_price" type="number" min={0} step="0.01" required className="mt-1 w-full border px-3 py-2 rounded" />
                        </div>
                    </div>
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
                        row.innerHTML = '<div><label class="block text-sm">Name</label><input name="service_name" required class="mt-1 w-full border px-3 py-2 rounded" /></div><div><label class="block text-sm">Duration (minutes)</label><input name="service_duration" type="number" min="1" required class="mt-1 w-full border px-3 py-2 rounded" /></div><div><label class="block text-sm">Price</label><input name="service_price" type="number" min="0" step="0.01" required class="mt-1 w-full border px-3 py-2 rounded" /></div>';
                        list.appendChild(row);
                    };
                    list.parentElement.appendChild(addBtn);
                })();
            ` }} />
        </div>
    )
}
