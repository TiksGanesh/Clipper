import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | Clipper",
    description: "Terms of Service for Clipper barber appointments",
};

export default function TermsPage() {
    return (
        <main className="px-4 py-12">
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
                <div className="flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        <span aria-hidden="true">←</span>
                        Back to Home
                    </Link>
                </div>

                <header className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Terms of Service
                    </p>
                    <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
                    <p className="text-slate-600">
                        Please review these terms carefully. By booking an appointment, you agree to
                        the policies outlined below.
                    </p>
                </header>

                <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-slate-900">1. Appointments</h2>
                        <p className="text-slate-700">
                            Please arrive on time. We reserve the right to cancel bookings that are more
                            than 10 minutes late.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-slate-900">2. Cancellations</h2>
                        <p className="text-slate-700">
                            Cancellations must be made at least 1 hour in advance.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-slate-900">3. No-Shows</h2>
                        <p className="text-slate-700">
                            Repeated no-shows may result in account suspension.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-slate-900">4. Payment</h2>
                        <p className="text-slate-700">
                            Prices are subject to change. Payment is due upon completion of service
                            (unless prepaid).
                        </p>
                    </div>
                </section>

                <footer className="text-sm text-slate-500">Last Updated: January 16, 2026</footer>
            </div>
        </main>
    );
}
