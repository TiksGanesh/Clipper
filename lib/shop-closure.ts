import { createServerSupabaseClient } from '@/lib/supabase'

export async function getShopClosure(shopId: string) {
    const supabase = await createServerSupabaseClient()

    const { data: closure, error } = await supabase
        .from('shop_closures')
        .select('closed_from, closed_to')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .maybeSingle()

    if (error || !closure) {
        return null
    }

    const today = new Date().toISOString().split('T')[0]
    const closedFrom = closure.closed_from
    const closedTo = closure.closed_to

    // Check if today falls within closure range
    if (today >= closedFrom && today <= closedTo) {
        return {
            closedFrom,
            closedTo,
        }
    }

    return null
}

export function isShopClosed(bookingDate: string, closedFrom: string, closedTo: string): boolean {
    return bookingDate >= closedFrom && bookingDate <= closedTo
}

export function formatClosurePeriod(from: string, to: string): string {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const fromFormatted = fromDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
    const toFormatted = toDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
    return `${fromFormatted} to ${toFormatted}`
}
