import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import ManageBarberLeave from '@/components/dashboard/ManageBarberLeave'

export default async function ManageLeavePage() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Get shop
    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    if (!shop) {
        redirect('/setup/shop')
    }

    // Fetch barbers
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('shop_id', shop.id)
        .is('deleted_at', null)
        .order('name', { ascending: true })

    // Fetch leaves
    const { data: leavesData } = await supabase
        .from('barber_leaves')
        .select(`
            id,
            barber_id,
            leave_date,
            barbers!inner(name)
        `)
        .in(
            'barber_id',
            (barbers ?? []).map((b: any) => b.id)
        )
        .order('leave_date', { ascending: false })

    const leaves = (leavesData ?? []).map((leave: any) => ({
        id: leave.id,
        barberId: leave.barber_id,
        barberName: leave.barbers?.name || '',
        leaveDate: leave.leave_date,
    }))

    return <ManageBarberLeave barbers={barbers ?? []} leaves={leaves} userEmail={user.email ?? ''} />
}
