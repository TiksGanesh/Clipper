'use client'

import { useState } from 'react'

export default function AdminSetupUserPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const res = await fetch('/api/admin/setup-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to create admin user' })
            } else {
                setMessage({ type: 'success', text: data.message })
                setEmail('')
                setPassword('')
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
            <h1>Create Admin User</h1>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="email">Email:</label>
                    <input
                        id="email"
                        type="email"
                        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        maxLength={255}
                        value={email}
                        onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                        required
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="password">Password:</label>
                    <input
                        id="password"
                        type="password"
                        minLength={8}
                        maxLength={128}
                        pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
                        title="Password must be 8+ characters with uppercase, lowercase, and number"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', padding: '10px', cursor: 'pointer' }}
                >
                    {loading ? 'Creating...' : 'Create Admin User'}
                </button>
            </form>
            {message && (
                <div
                    style={{
                        marginTop: '15px',
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
                        color: message.type === 'success' ? '#155724' : '#721c24',
                    }}
                >
                    {message.text}
                </div>
            )}
        </div>
    )
}
