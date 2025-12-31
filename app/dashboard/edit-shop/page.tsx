import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import EditShopInformation from '@/components/dashboard/EditShopInformation'

export default async function EditShopPage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Fetch shop
    const { data: shop } = await supabase
        .from('shops')
        .select('id, name')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    if (!shop) {
        redirect('/setup/shop')
    }

    // Fetch barbers
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, phone')
        .eq('shop_id', shop.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

    // Fetch working hours
    const { data: workingHoursData } = await supabase
        .from('working_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('shop_id', shop.id)

    // Map working hours to days
    const workingHours: Record<string, any> = {}
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    DAYS.forEach((day, idx) => {
        const dayData = (workingHoursData ?? []).find((h) => h.day_of_week === idx)
        workingHours[day] = {
            isOpen: !dayData?.is_closed,
            openTime: dayData?.open_time || '09:00',
            closeTime: dayData?.close_time || '18:00',
        }
    })

    return (
        <EditShopInformation
            shop={shop}
            barbers={barbers ?? []}
            workingHours={workingHours}
            userEmail={user.email ?? ''}
        />
    )
}
