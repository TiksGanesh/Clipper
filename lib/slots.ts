import type { Database } from '@/types/database'

export type WorkingHours = Pick<Database['public']['Tables']['working_hours']['Row'], 'open_time' | 'close_time' | 'is_closed' | 'day_of_week'>
export type BookingWindow = Pick<Database['public']['Tables']['bookings']['Row'], 'start_time' | 'end_time'>

export type Slot = {
    start: string
    end: string
}

export function getUtcDayRange(dateString: string) {
    const parsed = new Date(dateString)
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date provided')
    }

    const start = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)

    return { start, end }
}

function timeToMinutes(time: string) {
    const [hours, minutes, seconds] = time.split(':').map(Number)
    return (hours || 0) * 60 + (minutes || 0) + Math.floor((seconds || 0) / 60)
}

function addMinutes(base: Date, minutes: number) {
    const next = new Date(base)
    next.setUTCMinutes(next.getUTCMinutes() + minutes)
    return next
}

function overlaps(candidateStart: Date, candidateEnd: Date, booking: BookingWindow) {
    const bookingStart = new Date(booking.start_time)
    const bookingEnd = new Date(booking.end_time)
    return candidateStart < bookingEnd && candidateEnd > bookingStart
}

export function computeAvailableSlots(params: {
    date: string
    serviceDurationMinutes: number
    workingHours: WorkingHours | null
    bookings: BookingWindow[]
}): Slot[] {
    const { date, serviceDurationMinutes, workingHours, bookings } = params
    if (!workingHours || workingHours.is_closed || !workingHours.open_time || !workingHours.close_time) {
        return []
    }

    const duration = Math.floor(serviceDurationMinutes)
    if (!Number.isFinite(duration) || duration <= 0) {
        return []
    }

    const { start: dayStart } = getUtcDayRange(date)

    const openMinutes = timeToMinutes(workingHours.open_time)
    const closeMinutes = timeToMinutes(workingHours.close_time)

    if (closeMinutes <= openMinutes) {
        return []
    }

    const slots: Slot[] = []
    
    // Generate slots only if the service duration fits within working hours
    if (duration > closeMinutes - openMinutes) {
        return []
    }
    
    // Use 15-minute intervals for slot generation regardless of service duration
    const slotInterval = 15
    
    for (let minute = openMinutes; minute + duration <= closeMinutes; minute += slotInterval) {
        const candidateStart = addMinutes(dayStart, minute)
        const candidateEnd = addMinutes(dayStart, minute + duration)
        
        // Sanity check: ensure candidateEnd is still on the same day
        // Slots should not cross past midnight (end should be within the same calendar day)
        if (candidateEnd.getUTCDate() !== dayStart.getUTCDate()) {
            break
        }
        
        const isBlocked = bookings.some((booking) => overlaps(candidateStart, candidateEnd, booking))
        if (!isBlocked) {
            slots.push({ start: candidateStart.toISOString(), end: candidateEnd.toISOString() })
        }
    }

    return slots
}
