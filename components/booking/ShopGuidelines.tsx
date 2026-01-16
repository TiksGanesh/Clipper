'use client'

import React, { useState, useEffect } from 'react'

interface ShopGuidelinesProps {
    compact?: boolean
}

const GUIDELINES = [
    {
        icon: '🕒',
        text: 'Please arrive 5 mins early.',
    },
    {
        icon: '👋',
        text: 'Check in at the counter.',
    },
    {
        icon: '⚠️',
        text: 'Cancel in advance if you cannot make it.',
    },
    {
        icon: '⚠️',
        text: 'Do not be more than 10 minutes late (or you may lose your slot).',
    },
]

export default function ShopGuidelines({ compact = false }: ShopGuidelinesProps) {
    const [showAll, setShowAll] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)

    // Auto-rotate ticker on mobile
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % GUIDELINES.length)
        }, 4000)

        return () => clearInterval(interval)
    }, [])

    const displayItems = compact && !showAll ? GUIDELINES.slice(0, 2) : GUIDELINES
    const currentItem = GUIDELINES[currentIndex]

    return (
        <section className="rounded-2xl border border-purple-100 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-purple-100 px-6 py-4">
                <span aria-hidden="true" className="text-lg text-purple-600">
                    💡
                </span>
                <h2 className="text-lg font-bold text-gray-800">Shop Guidelines</h2>
            </div>

            {/* Mobile Ticker View */}
            <div className="block p-4 md:hidden">
                <div className="flex items-center gap-3 text-sm text-gray-800">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-lg">
                        {currentItem.icon}
                    </div>
                    <span className="flex-1 text-gray-700 leading-relaxed">{currentItem.text}</span>
                </div>
                {/* Pagination Dots */}
                <div className="mt-4 flex items-center justify-center gap-1.5">
                    {GUIDELINES.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`Go to guideline ${idx + 1}`}
                            className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-purple-600' : 'w-1.5 bg-purple-200'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Desktop List View */}
            <div className="hidden p-6 md:block">
                <div className="space-y-4">
                    <ul className="space-y-4">
                        {displayItems.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-4">
                                {/* Icon Circle */}
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-lg">
                                    {item.icon}
                                </div>
                                {/* Text */}
                                <span className="text-sm text-gray-700 leading-relaxed">
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>

                    {/* View All Link - Compact Mode */}
                    {compact && !showAll && (
                        <button
                            onClick={() => setShowAll(true)}
                            className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                        >
                            View All →
                        </button>
                    )}

                    {/* Collapse Link - When Expanded */}
                    {compact && showAll && (
                        <button
                            onClick={() => setShowAll(false)}
                            className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                        >
                            Show Less ↑
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
