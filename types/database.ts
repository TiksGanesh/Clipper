/**
 * Database types generated from Supabase schema
 * Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            admin_users: {
                Row: {
                    user_id: string
                    created_at: string
                }
                Insert: {
                    user_id: string
                    created_at?: string
                }
                Update: {
                    user_id?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "admin_users_user_id_fkey"
                        columns: ["user_id"]
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            shops: {
                Row: {
                    id: string
                    owner_id: string
                    name: string
                    phone: string
                    address: string | null
                    deleted_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    owner_id: string
                    name: string
                    phone: string
                    address?: string | null
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    owner_id?: string
                    name?: string
                    phone?: string
                    address?: string | null
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            working_hours: {
                Row: {
                    id: string
                    shop_id: string
                    day_of_week: number // 0=Sunday ... 6=Saturday
                    open_time: string | null // 'HH:MM:SS'
                    close_time: string | null // 'HH:MM:SS'
                    is_closed: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    shop_id: string
                    day_of_week: number
                    open_time?: string | null
                    close_time?: string | null
                    is_closed?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    shop_id?: string
                    day_of_week?: number
                    open_time?: string | null
                    close_time?: string | null
                    is_closed?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "working_hours_shop_id_fkey"
                        columns: ["shop_id"]
                        referencedRelation: "shops"
                        referencedColumns: ["id"]
                    }
                ]
            }
            barbers: {
                Row: {
                    id: string
                    shop_id: string
                    name: string
                    phone: string | null
                    is_active: boolean
                    current_delay_minutes: number
                    deleted_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    shop_id: string
                    name: string
                    phone?: string | null
                    is_active?: boolean
                    current_delay_minutes?: number
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    shop_id?: string
                    name?: string
                    phone?: string | null
                    is_active?: boolean
                    current_delay_minutes?: number
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "barbers_shop_id_fkey"
                        columns: ["shop_id"]
                        referencedRelation: "shops"
                        referencedColumns: ["id"]
                    }
                ]
            }
            services: {
                Row: {
                    id: string
                    shop_id: string
                    name: string
                    duration_minutes: number
                    price: number
                    advance_amount: number
                    requires_advance: boolean
                    is_active: boolean
                    deleted_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    shop_id: string
                    name: string
                    duration_minutes: number
                    price: number
                    advance_amount?: number
                    requires_advance?: boolean
                    is_active?: boolean
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    shop_id?: string
                    name?: string
                    duration_minutes?: number
                    price?: number
                    advance_amount?: number
                    requires_advance?: boolean
                    is_active?: boolean
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "services_shop_id_fkey"
                        columns: ["shop_id"]
                        referencedRelation: "shops"
                        referencedColumns: ["id"]
                    }
                ]
            }
            bookings: {
                Row: {
                    id: string
                    shop_id: string
                    barber_id: string
                    service_id: string
                    customer_name: string
                    customer_phone: string
                    start_time: string
                    end_time: string
                    status: 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'
                    is_walk_in: boolean
                    notes: string | null
                    deleted_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    shop_id: string
                    barber_id: string
                    service_id: string
                    customer_name: string
                    customer_phone: string
                    start_time: string
                    end_time: string
                    status?: 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'
                    is_walk_in?: boolean
                    notes?: string | null
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    shop_id?: string
                    barber_id?: string
                    service_id?: string
                    customer_name?: string
                    customer_phone?: string
                    start_time?: string
                    end_time?: string
                    status?: 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'
                    is_walk_in?: boolean
                    notes?: string | null
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "bookings_shop_id_fkey"
                        columns: ["shop_id"]
                        referencedRelation: "shops"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "bookings_barber_id_fkey"
                        columns: ["barber_id"]
                        referencedRelation: "barbers"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "bookings_service_id_fkey"
                        columns: ["service_id"]
                        referencedRelation: "services"
                        referencedColumns: ["id"]
                    }
                ]
            }
            subscriptions: {
                Row: {
                    id: string
                    shop_id: string
                    razorpay_subscription_id: string | null
                    razorpay_plan_id: string | null
                    status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
                    trial_ends_at: string | null
                    current_period_start: string | null
                    current_period_end: string | null
                    canceled_at: string | null
                    deleted_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    shop_id: string
                    razorpay_subscription_id?: string | null
                    razorpay_plan_id?: string | null
                    status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
                    trial_ends_at?: string | null
                    current_period_start?: string | null
                    current_period_end?: string | null
                    canceled_at?: string | null
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    shop_id?: string
                    razorpay_subscription_id?: string | null
                    razorpay_plan_id?: string | null
                    status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
                    trial_ends_at?: string | null
                    current_period_start?: string | null
                    current_period_end?: string | null
                    canceled_at?: string | null
                    deleted_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "subscriptions_shop_id_fkey"
                        columns: ["shop_id"]
                        referencedRelation: "shops"
                        referencedColumns: ["id"]
                    }
                ]
            }
            payments: {
                Row: {
                    id: string
                    booking_id: string | null
                    razorpay_order_id: string
                    razorpay_payment_id: string | null
                    amount: number
                    status: 'created' | 'paid' | 'failed'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    booking_id?: string | null
                    razorpay_order_id: string
                    razorpay_payment_id?: string | null
                    amount: number
                    status?: 'created' | 'paid' | 'failed'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    booking_id?: string | null
                    razorpay_order_id?: string
                    razorpay_payment_id?: string | null
                    amount?: number
                    status?: 'created' | 'paid' | 'failed'
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'payments_booking_id_fkey'
                        columns: ['booking_id']
                        isOneToOne: false
                        referencedRelation: 'bookings'
                        referencedColumns: ['id']
                    }
                ]
            }
        }
        Views: {
            active_shops: {
                Row: {
                    id: string
                    owner_id: string
                    name: string
                    phone: string
                    address: string | null
                    created_at: string
                    updated_at: string
                }
            }
            active_barbers: {
                Row: {
                    id: string
                    shop_id: string
                    name: string
                    phone: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
            }
            active_services: {
                Row: {
                    id: string
                    shop_id: string
                    name: string
                    duration_minutes: number
                    price: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
            }
            active_bookings: {
                Row: {
                    id: string
                    shop_id: string
                    barber_id: string
                    service_id: string
                    customer_name: string
                    customer_phone: string
                    start_time: string
                    end_time: string
                    status: 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'
                    is_walk_in: boolean
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
            }
        }
        Functions: {}
        Enums: {
            subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
            booking_status: 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'
            payment_status: 'created' | 'paid' | 'failed'
        }
    }
}
