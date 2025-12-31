import { createServerSupabaseClient } from '@/lib/supabase'

export async function getBarberLeaveStatuses(shopId: string): Promise<Record<string, boolean>> {
    const supabase = await createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: leaves, error } = await supabase
        .from('barber_leaves')
        .select('barber_id')
        .eq('leave_date', today)

    if (error || !leaves) {
        return {}
    }

    return leaves.reduce(
        (acc, leave) => {
            acc[(leave as any).barber_id] = true
            return acc
        },
        {} as Record<string, boolean>
    )
}
