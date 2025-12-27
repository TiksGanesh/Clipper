import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Clipper - Barber Appointment Scheduling',
    description: 'Simple appointment scheduling for barber shops',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
