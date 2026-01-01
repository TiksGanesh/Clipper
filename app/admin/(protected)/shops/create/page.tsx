import { redirect } from 'next/navigation'

/**
 * Admin shop creation flow
 * This page redirects to the setup flow (/setup/shop)
 * The setup flow handles creating the shop and configuring barbers, services, hours
 */
export default function AdminCreateShopPage() {
    // Redirect to setup flow
    // The middleware ensures only admins can access /setup/* routes
    redirect('/setup/shop')
}
