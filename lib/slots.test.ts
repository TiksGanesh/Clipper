/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import { computeAvailableSlots, type WorkingHours } from './slots'

const baseHours: WorkingHours = {
    open_time: '09:00:00',
    close_time: '10:00:00',
    is_closed: false,
    day_of_week: 3,
}

describe('computeAvailableSlots', () => {
    it('returns empty when closed', () => {
        const slots = computeAvailableSlots({
            date: '2024-01-10',
            serviceDurationMinutes: 30,
            workingHours: { ...baseHours, is_closed: true },
            bookings: [],
        })
        expect(slots).toEqual([])
    })

    it('generates slots for open day with no bookings', () => {
        const slots = computeAvailableSlots({
            date: '2024-01-10',
            serviceDurationMinutes: 30,
            workingHours: baseHours,
            bookings: [],
        })

        expect(slots.map((s) => s.start)).toEqual([
            '2024-01-10T09:00:00.000Z',
            '2024-01-10T09:30:00.000Z',
        ])
    })

    it('omits overlapping slots when bookings exist', () => {
        const slots = computeAvailableSlots({
            date: '2024-01-10',
            serviceDurationMinutes: 30,
            workingHours: baseHours,
            bookings: [
                {
                    start_time: '2024-01-10T09:30:00.000Z',
                    end_time: '2024-01-10T10:00:00.000Z',
                },
            ],
        })

        expect(slots.map((s) => s.start)).toEqual(['2024-01-10T09:00:00.000Z'])
    })

    it('returns empty when service duration is invalid', () => {
        const slots = computeAvailableSlots({
            date: '2024-01-10',
            serviceDurationMinutes: 0,
            workingHours: baseHours,
            bookings: [],
        })
        expect(slots).toEqual([])
    })

    it('returns empty when service duration exceeds available window', () => {
        const slots = computeAvailableSlots({
            date: '2024-01-10',
            serviceDurationMinutes: 90,
            workingHours: baseHours,
            bookings: [],
        })
        expect(slots).toEqual([])
    })
})
