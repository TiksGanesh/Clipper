'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const navLinks = [
	{ label: 'Dashboard', href: '/admin/dashboard' },
	{ label: 'Shops', href: '/admin/shops' },
	{ label: 'Create Shop', href: '/admin/shops/create' },
]

export default function AdminNav() {
	const pathname = usePathname()

	const isActive = (href: string) => {
		// Exact match for dashboard
		if (href === '/admin/dashboard') {
			return pathname === '/admin/dashboard'
		}
		// Prefix match for shops
		return pathname.startsWith(href)
	}

	return (
		<nav className="border-b border-gray-200 bg-white">
			<div className="mx-auto max-w-6xl px-4">
				<div className="flex gap-8">
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={`py-4 text-sm font-medium border-b-2 transition-colors ${
								isActive(link.href)
									? 'border-gray-900 text-gray-900'
									: 'border-transparent text-gray-600 hover:text-gray-900'
							}`}
						>
							{link.label}
						</Link>
					))}
				</div>
			</div>
		</nav>
	)
}
