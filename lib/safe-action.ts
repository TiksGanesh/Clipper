'use client'

import NProgress from 'nprogress'

/**
 * Wraps any async operation with NProgress loading indicator
 * 
 * Usage:
 *   const result = await withProgress(fetchData())
 * 
 * @param promise The async operation to wrap
 * @param options Configuration options
 * @returns The result of the promise
 * 
 * @example
 * // Wrap API calls
 * const slots = await withProgress(fetchAvailableSlots(date))
 * 
 * @example
 * // Wrap server actions
 * const response = await withProgress(createBooking(data))
 * 
 * IMPORTANT: Do NOT use this in BookingForm.tsx payment logic
 * The payment flow has its own PaymentStatusOverlay
 */
export async function withProgress<T>(
    promise: Promise<T>,
    options?: {
        /**
         * Custom error message to log
         * Default: 'Operation failed'
         */
        errorMessage?: string
        /**
         * Whether to swallow the error (default: false)
         * If false, the error will be re-thrown
         */
        swallowError?: boolean
    },
): Promise<T> {
    NProgress.start()

    try {
        const result = await promise
        NProgress.done()
        return result
    } catch (error) {
        NProgress.done()

        if (options?.errorMessage) {
            console.error(options.errorMessage, error)
        }

        if (!options?.swallowError) {
            throw error
        }

        return undefined as unknown as T
    }
}

/**
 * Alternative: Wrap individual NProgress calls for fine-grained control
 * 
 * @example
 * NProgress.start()
 * try {
 *   const result = await slowOperation()
 *   return result
 * } finally {
 *   NProgress.done()
 * }
 */
export { NProgress }
