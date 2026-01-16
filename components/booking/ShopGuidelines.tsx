'use client'

import React, { useState, useEffect } from 'react'

const DO_ITEMS = [
    'Arrive 5 minutes before your slot.',
    'Check-in with the barber upon arrival.',
    'Cancel in advance if you cannot make it.',
]

const DONT_ITEMS = [
    'Do not be more than 10 minutes late (or you may lose your slot).',
    'Do not attend if you are feeling unwell.',
]

// Combine all items for ticker view on mobile
const ALL_ITEMS = [
    ...DO_ITEMS.map((text) => ({ text, type: 'do' as const })),
    ...DONT_ITEMS.map((text) => ({ text, type: 'dont' as const })),
]

export default function ShopGuidelines() {
    const [currentIndex, setCurrentIndex] = useState(0)

    // Auto-rotate ticker on mobile
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % ALL_ITEMS.length)
        }, 4000)

        return () => clearInterval(interval)
    }, [])

    const currentItem = ALL_ITEMS[currentIndex]

    return (
        <section className="rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
            {/* Title */}
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-900 md:px-6 md:py-4 md:text-lg">
                <span aria-hidden="true">💡</span>
                <span>Things to Keep in Mind</span>
            </div>

            {/* Mobile Ticker View */}
            <div className="block p-4 md:hidden">
                <div className="flex items-start gap-3 text-sm text-gray-800">
                    <span
                        aria-hidden="true"
                        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base ${currentItem.type === 'do'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                    >
                        {currentItem.type === 'do' ? '✅' : '❌'}
                    </span>
                    <span className="flex-1 pt-0.5">{currentItem.text}</span>
                </div>
                {/* Pagination Dots */}
                <div className="mt-3 flex items-center justify-center gap-1.5">
                    {ALL_ITEMS.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`Go to tip ${idx + 1}`}
                            className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-gray-700' : 'w-1.5 bg-gray-300'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Desktop Two-Column View */}
            <div className="hidden p-6 md:block">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-green-700">
                            Do&apos;s
                        </h3>
                        <ul className="space-y-3">
                            {DO_ITEMS.map((item) => (
                                <li key={item} className="flex items-start gap-3 text-sm text-gray-800">
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-base text-green-700"
                                    >
                                        ✅
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-red-700">
                            Don&apos;ts
                        </h3>
                        <ul className="space-y-3">
                            {DONT_ITEMS.map((item) => (
                                <li key={item} className="flex items-start gap-3 text-sm text-gray-800">
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-base text-red-700"
                                    >
                                        ❌
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}
