'use client'

import { useState } from 'react'

export default function AdminLogoutButton() {
	const [isLoading, setIsLoading] = useState(false)

	const handleLogout = async () => {
		setIsLoading(true)
		try {
			const response = await fetch('/api/admin/signout', {
				method: 'POST',
			})
			if (response.ok) {
				// Redirect happens on the server side
				window.location.href = '/admin/login'
			}
		} catch (error) {
			console.error('Logout error:', error)
			setIsLoading(false)
		}
	}

	return (
		<button
			onClick={handleLogout}
			disabled={isLoading}
			className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
		>
			{isLoading ? 'Logging out...' : 'Logout'}
		</button>
	)
}
