/**
 * useShopTerminology Hook
 *
 * Provides business-type-specific terminology for shops.
 * Supports Barber, Salon, and Clinic business types with optional custom overrides.
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

export type BusinessType = 'barber' | 'salon' | 'clinic';

export interface ShopTerminology {
    staff_label: string;
    service_label: string;
    customer_label: string;
    booking_action: string;
    queue_msg: string;
}

export type TerminologyOverrides = Partial<ShopTerminology>;

// ========================================
// DEFAULT TERMINOLOGY BY BUSINESS TYPE
// ========================================

const DEFAULT_TERMS: Record<BusinessType, ShopTerminology> = {
    barber: {
        staff_label: 'Barber',
        service_label: 'Haircut',
        customer_label: 'Customer',
        booking_action: 'Book Seat',
        queue_msg: 'People ahead in chair',
    },
    salon: {
        staff_label: 'Stylist',
        service_label: 'Treatment',
        customer_label: 'Client',
        booking_action: 'Book Appointment',
        queue_msg: 'Clients ahead',
    },
    clinic: {
        staff_label: 'Doctor',
        service_label: 'Consultation',
        customer_label: 'Patient',
        booking_action: 'Book Visit',
        queue_msg: 'Patients in waiting',
    },
};

// ========================================
// HOOK
// ========================================

/**
 * getShopTerminology
 *
 * Merges default terminology for a business type with optional custom overrides.
 *
 * @param businessType - The type of business ('barber', 'salon', 'clinic')
 * @param overrides - Optional custom terminology overrides (from database JSONB)
 * @returns Merged ShopTerminology object with all fields populated
 *
 * @example
 * // In a React component or server component
 * const terms = getShopTerminology(shop.business_type, shop.terminology_overrides);
 *
 * // Use the terminology in UI
 * <button>{terms.booking_action}</button>
 * <p>We have {peopleAhead} {terms.queue_msg}</p>
 * <h2>{terms.staff_label}s Available</h2>
 */
export function getShopTerminology(
    businessType: BusinessType,
    overrides?: TerminologyOverrides | null
): ShopTerminology {
    // Get the base terminology for the business type
    // Default to 'barber' if invalid type is provided
    const baseTerms =
        DEFAULT_TERMS[businessType] || DEFAULT_TERMS.barber;

    // If no overrides provided, return base terms as-is
    if (!overrides) {
        return baseTerms;
    }

    // Merge base terms with overrides
    // Overrides take precedence over default values
    return {
        ...baseTerms,
        ...overrides,
    };
}

// ========================================
// UTILITY EXPORTS
// ========================================

/**
 * Get all available business types
 */
export const BUSINESS_TYPES: BusinessType[] = ['barber', 'salon', 'clinic'];

/**
 * Get default terminology for a specific business type
 */
export function getDefaultTerminology(
    businessType: BusinessType
): ShopTerminology {
    return DEFAULT_TERMS[businessType] || DEFAULT_TERMS.barber;
}

/**
 * @deprecated Use getShopTerminology instead
 * Backwards compatibility alias for useShopTerminology
 */
export const useShopTerminology = getShopTerminology;
