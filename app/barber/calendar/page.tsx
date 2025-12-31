import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import DayView from '@/components/calendar/DayView'

type BarberOption = {
    id: string
    name: string
}

export default async function BarberCalendarPage({ searchParams }: { searchParams: { barber?: string } }) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    const shopId = shop?.id
    if (!shopId) {
        redirect('/setup/shop')
    }

    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('name')

    const barberOptions = (barbers as BarberOption[] | null) ?? []
    if (barberOptions.length === 0) {
        redirect('/setup/barbers')
    }

    const today = new Date().toISOString().split('T')[0]

    return (
        <main className="bg-gray-50 min-h-screen overflow-x-hidden">
            <div className="max-w-7xl mx-auto p-4 md:p-6">
                <DayView
                    barbers={barberOptions}
                    initialDate={today}
                    initialBarberId={searchParams?.barber}
                    isReadOnly={false}
                />
            </div>
        </main>
    )
}
