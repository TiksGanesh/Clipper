import { ReactNode } from 'react'
import { requireAdminContext } from '@/lib/auth'

// Admin-only layout: guards all /admin routes except separately grouped public ones
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
    await requireAdminContext()
    return children
}
