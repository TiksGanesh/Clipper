'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import QRCode from 'react-qr-code'

export default function WalkInSuccessPage() {
    const params = useParams()
    const router = useRouter()
    const bookingId = params.id as string

    const [copied, setCopied] = useState(false)

    // Construct the full tracking URL
    const trackingUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/track/${bookingId}`
        : `https://clipper.example.com/track/${bookingId}`

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(trackingUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const handleBackToDashboard = () => {
        router.push('/dashboard')
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
            {/* Main Container */}
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-3">
                            <div className="bg-emerald-100 rounded-full p-3">
                                <svg
                                    className="w-6 h-6 text-emerald-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                            Walk-In Confirmed
                        </h1>
                        <p className="text-sm text-gray-600">
                            Share this receipt with your customer
                        </p>
                    </div>

                    {/* QR Code Section */}
                    <div className="flex flex-col items-center space-y-3 py-6 border-y border-gray-200">
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Scan to Track Status
                        </p>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm print-qr-code">
                            <QRCode
                                value={trackingUrl}
                                size={256}
                                level="H"
                                className="w-64 h-64"
                            />
                        </div>
                        <p className="text-xs text-gray-600 text-center mt-2 print-hidden">
                            Customer can scan this QR code to track appointment status
                        </p>
                    </div>

                    {/* Link Section */}
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Tracking Link:</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={trackingUrl}
                                className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono text-gray-700 focus:outline-none"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <button
                                onClick={handleCopyLink}
                                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 print-hidden ${
                                    copied
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                            >
                                {copied ? (
                                    <span className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        Copied
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M8 3a1 1 0 011-1h2a1 1 0 011 1v0h4a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h4V3z" />
                                            <path d="M9 3.5A.5.5 0 0110 3h0a.5.5 0 01.5.5v0a.5.5 0 01-.5.5h0a.5.5 0 01-.5-.5v0z" />
                                        </svg>
                                        Copy
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Booking ID Display */}
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">Booking ID</p>
                        <p className="text-sm font-mono font-semibold text-gray-900 mt-1">{bookingId}</p>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 print-hidden">
                        <p className="text-xs font-medium text-blue-900 flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span>
                                Customer can scan the QR code or use the link to track their appointment status in
                                real-time.
                            </span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 print-hidden">
                        <button
                            onClick={handlePrint}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H7a2 2 0 01-2-2v-4a2 2 0 012-2h10a2 2 0 012 2v4a2 2 0 01-2 2zm-6-4a2 2 0 100-4 2 2 0 000 4z"
                                />
                            </svg>
                            Print
                        </button>
                        <button
                            onClick={handleBackToDashboard}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                            </svg>
                            Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Print-specific styles note */}
                <style>{`
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                            background: white;
                        }
                        .min-h-screen {
                            min-height: auto;
                            padding: 0;
                        }
                        .shadow-lg {
                            box-shadow: none;
                            border: 1px solid #e5e7eb;
                        }
                        .print-hidden {
                            display: none !important;
                        }
                        .print-qr-code {
                            border: 2px solid #000;
                            padding: 8px;
                            margin: 16px auto;
                        }
                        h1 {
                            font-size: 24px;
                            margin-bottom: 8px;
                        }
                        .max-w-md {
                            max-width: 100%;
                        }
                    }
                `}</style>
            </div>
        </div>
    )
}
