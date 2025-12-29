/**
 * Utility to load Razorpay script dynamically
 * Prevents multiple loads and handles errors gracefully
 */

let razorpayScriptLoaded = false
let razorpayScriptPromise: Promise<boolean> | null = null

export function loadRazorpayScript(): Promise<boolean> {
    // Return cached promise if already loading
    if (razorpayScriptPromise) {
        return razorpayScriptPromise
    }

    // Return immediately if already loaded
    if (razorpayScriptLoaded && typeof window !== 'undefined' && (window as any).Razorpay) {
        return Promise.resolve(true)
    }

    razorpayScriptPromise = new Promise((resolve) => {
        try {
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.async = true

            script.onload = () => {
                razorpayScriptLoaded = true
                resolve(true)
            }

            script.onerror = () => {
                console.error('Failed to load Razorpay script')
                resolve(false)
            }

            document.body.appendChild(script)
        } catch (error) {
            console.error('Error loading Razorpay script:', error)
            resolve(false)
        }
    })

    return razorpayScriptPromise
}

export interface RazorpayCheckoutOptions {
    key: string
    order_id: string
    name: string
    description: string
    amount: number
    currency: string
    customer_name: string
    customer_phone: string
    onPaymentSuccess: (paymentId: string, orderId: string, signature: string) => void
    onPaymentError: (error: string) => void
}

/**
 * Open Razorpay checkout modal
 * Assumes Razorpay script is already loaded
 */
export function openRazorpayCheckout(options: RazorpayCheckoutOptions) {
    if (typeof window === 'undefined' || !(window as any).Razorpay) {
        options.onPaymentError('Razorpay checkout unavailable')
        return
    }

    const razorpay = new (window as any).Razorpay({
        key: options.key,
        order_id: options.order_id,
        name: options.name,
        description: options.description,
        amount: options.amount,
        currency: options.currency,
        prefill: {
            name: options.customer_name,
            contact: options.customer_phone,
        },
        handler: (response: any) => {
            options.onPaymentSuccess(
                response.razorpay_payment_id,
                response.razorpay_order_id,
                response.razorpay_signature
            )
        },
        modal: {
            ondismiss: () => {
                options.onPaymentError('Payment cancelled by user')
            },
        },
    })

    razorpay.open()
}
