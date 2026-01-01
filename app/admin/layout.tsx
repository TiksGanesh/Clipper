'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import AdminNav from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: ReactNode }) {
	const pathname = usePathname()
	const [adminEmail, setAdminEmail] = useState('Admin')
	const isLoginPage = pathname === '/admin/login'
	const isSetupUserPage = pathname === '/admin/setup-user'

	// Get admin email from localStorage (set during login)
	useEffect(() => {
		const email = localStorage.getItem('adminEmail')
		if (email) {
			setAdminEmail(email)
		}
	}, [])

	// For login and setup-user pages, show simple layout without header/nav
	if (isLoginPage || isSetupUserPage) {
		return <div className="min-h-screen bg-white">{children}</div>
	}

	// For protected pages, show full layout with header/nav
	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="h-16 border-b border-gray-200 bg-white shadow-sm">
				<div className="h-full px-6 flex items-center justify-between">
					{/* App name (left) */}
					<div className="text-lg font-semibold text-gray-900">
						Clipper Admin
					</div>

					{/* Admin info & logout (right) */}
					<div className="flex items-center gap-4">
						<span className="text-sm text-gray-600">
							{adminEmail}
						</span>
						<AdminLogoutButton />
					</div>
				</div>
			</header>

			{/* Navigation */}
			<AdminNav />

			{/* Content */}
			<div className="bg-gray-50 py-6">
				<div className="mx-auto max-w-6xl px-4">
					{children}
				</div>
			</div>
		</div>
	)
}
