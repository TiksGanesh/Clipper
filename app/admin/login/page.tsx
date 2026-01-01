'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Sign out any existing session first by calling signout endpoint
            // This ensures a clean login for the new admin user
            try {
                await fetch('/api/admin/signout', {
                    method: 'POST',
                })
            } catch (error) {
                // Signout failure is not critical, continue with login
                console.log('Signout attempt completed')
            }
            
            // Wait for signout to complete
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Login failed')
                return
            }

            // Store tokens in localStorage for client use
            if (data.accessToken) {
                localStorage.setItem('adminAccessToken', data.accessToken)
                localStorage.setItem('adminRefreshToken', data.refreshToken || '')
            }

            // Wait for session to be fully established
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Redirect to dashboard
            router.push('/admin/dashboard')
            router.refresh()
        } catch (error) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
            <h1>Admin Login</h1>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="email">Email:</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="password">Password:</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', padding: '10px', cursor: 'pointer' }}
                >
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
            {error && (
                <div
                    style={{
                        marginTop: '15px',
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: '#f8d7da',
                        color: '#721c24',
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    )
}
