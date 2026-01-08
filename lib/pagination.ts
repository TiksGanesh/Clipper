/**
 * Pagination constants and utilities for consistent data fetching across the app
 *
 * These limits are set based on:
 * - Business constraints (e.g., max 2 barbers per shop)
 * - Performance requirements (fetch only what's displayed)
 * - UX best practices (avoid excessive data in lists)
 */

export const PAGINATION_LIMITS = {
  // Barbers: Max 2 per shop (business constraint)
  BARBERS: 2,

  // Services: Display limit in dashboard/forms
  SERVICES: 20,

  // Bookings: Display limit in lists
  BOOKINGS: 50,

  // Admin shop list
  ADMIN_SHOPS: 20,

  // Default page size for most collections
  DEFAULT: 20,
} as const

/**
 * Calculate pagination offset from page number and page size
 * @example
 * getPaginationOffset(1, 20) // => 0
 * getPaginationOffset(2, 20) // => 20
 */
export function getPaginationOffset(page: number, pageSize: number): number {
  return Math.max(page - 1, 0) * pageSize
}

/**
 * Type for paginated results
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

/**
 * Helper to create paginated result object
 */
export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasNextPage: page * pageSize < total,
  }
}
