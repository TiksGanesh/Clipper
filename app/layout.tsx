import type { Metadata } from 'next'
import { validateEnv } from '@/lib/env'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'

export const metadata: Metadata = {
    title: 'Clipper - Barber Appointment Scheduling',
    description: 'Simple appointment scheduling for barber shops',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Fail fast in dev if required env vars are missing
    // Safe on server; does not expose secrets to client
    if (process.env.NODE_ENV !== 'production') {
        try {
            validateEnv()
        } catch (err) {
            // Log a clear error to server console to aid setup
            console.error(err)
        }
    }
    return (
        <html lang="en" className="overflow-x-hidden">
            <body className="overflow-x-hidden">
                <NextTopLoader
                    color="#4F46E5"
                    initialPosition={0.08}
                    crawlSpeed={200}
                    height={3}
                    crawl={true}
                    showSpinner={false}
                    easing="ease"
                    speed={200}
                    zIndex={9999}
                />
                {children}
            </body>
        </html>
    )
}
