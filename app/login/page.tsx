'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50" aria-busy="true" />}>
            <LoginPageContent />
        </Suspense>
    )
}

function LoginPageContent() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const shopId = searchParams.get('shop_id')
    const shopSlug = searchParams.get('shop_slug')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const supabase = createClient()
            
            // Sign out any existing session first
            // This ensures a clean login for the new user
            await supabase.auth.signOut()
            
            // Wait for signout to complete
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) {
                setError(signInError.message)
                return
            }

            // Wait for session to be fully established
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Refresh to ensure middleware picks up the new session
            router.refresh()
            
            // Redirect to dashboard
            router.push('/dashboard')
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 overflow-x-hidden">
            <div className="w-full max-w-md mx-4">
                {/* Card */}
                <div className="w-full bg-white border border-gray-100 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <h1 className="text-2xl font-black text-gray-900">Sign in</h1>
                        <p className="text-sm text-gray-500 mt-2 mb-8">
                            Manage your barber shop bookings
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                            <p className="text-sm text-red-700 break-words">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form className="space-y-4" onSubmit={handleLogin}>
                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
