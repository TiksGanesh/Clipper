'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Database } from '@/types/database';
import { getShopTerminology, BusinessType } from '@/src/hooks/useShopTerminology';

type Shop = Database['public']['Tables']['shops']['Row'];

interface ShopExperienceProps {
    shop: Shop & { business_type?: string; terminology_overrides?: any };
}

/**
 * ShopExperience - Client Component
 * Displays a splash screen followed by the shop landing page with branding
 */
export function ShopExperience({ shop }: ShopExperienceProps) {
    const [showSplash, setShowSplash] = useState(true);
    const [logoError, setLogoError] = useState(false);
    const safeSlug = shop.slug ?? '';
    const canNavigate = Boolean(safeSlug);
    const bookingHref = canNavigate ? `/shop/${safeSlug}/book` : '#';
    const trackHref = canNavigate ? `/shop/${safeSlug}/track` : '#';

    // Get dynamic terminology based on business type
    const terms = getShopTerminology(
        (shop.business_type as BusinessType) || 'barber',
        shop.terminology_overrides
    );

    // Auto-hide splash screen after 1.5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    const handleLogoError = () => {
        setLogoError(true);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            {/* Splash Screen */}
            <div
                className={`absolute inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${showSplash ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                style={{ backgroundColor: shop.brand_color }}
            >
                <div className="flex flex-col items-center gap-6">
                    {/* Logo */}
                    {shop.logo_url && !logoError ? (
                        <div className="relative w-24 h-24 animate-fade-in">
                            <Image
                                src={shop.logo_url}
                                alt={shop.name}
                                fill
                                className="object-contain"
                                priority
                                onError={handleLogoError}
                            />
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center animate-fade-in">
                            <span className="text-2xl font-bold" style={{ color: shop.brand_color }}>
                                {shop.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}

                    {/* Shop Name */}
                    <h1 className="text-white text-3xl font-bold text-center px-4 animate-fade-in">
                        {shop.name}
                    </h1>

                    {/* Tagline */}
                    {shop.tagline && (
                        <p className="text-white text-lg font-medium text-center px-4 animate-fade-in">
                            {shop.tagline}
                        </p>
                    )}
                </div>
            </div>

            {/* Landing Page */}
            <div className="w-full h-full flex flex-col bg-gray-50">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                    <div className="max-w-4xl mx-auto flex items-center gap-3">
                        {shop.logo_url && !logoError ? (
                            <div className="relative w-10 h-10">
                                <Image
                                    src={shop.logo_url}
                                    alt={shop.name}
                                    fill
                                    className="object-contain"
                                    onError={handleLogoError}
                                />
                            </div>
                        ) : (
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: shop.brand_color }}
                            >
                                {shop.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <h1 className="text-xl font-bold text-gray-900">{shop.name}</h1>
                    </div>
                </header>

                {/* Hero Section */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                    <div className="max-w-md text-center space-y-8">
                        <div>
                            <h2 className="text-4xl font-bold text-gray-900 mb-3">
                                Welcome to {shop.name}
                            </h2>
                            {shop.tagline && (
                                <p className="text-lg text-gray-600">{shop.tagline}</p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {/* Book Appointment Button */}
                            <Link
                                href={bookingHref}
                                aria-disabled={!canNavigate}
                                className={`block w-full py-3 px-6 rounded-lg font-semibold text-white transition-transform hover:scale-105 active:scale-95 ${!canNavigate ? 'pointer-events-none opacity-60' : ''}`}
                                style={{ backgroundColor: shop.brand_color }}
                            >
                                {terms.booking_action}
                            </Link>

                            {/* Track Booking Button */}
                            <Link
                                href={trackHref}
                                aria-disabled={!canNavigate}
                                className={`block w-full rounded-lg border border-gray-100 bg-white py-3 px-6 font-semibold shadow-sm transition-transform hover:shadow-md active:scale-95 ${!canNavigate ? 'pointer-events-none opacity-60' : ''}`}
                                style={{ color: shop.brand_color }}
                            >
                                Track My Status
                            </Link>

                            {/* Barber Login Button */}
                            <Link
                                href={`/login?shop_id=${shop.id}&shop_slug=${safeSlug}`}
                                className="block w-full py-3 px-6 rounded-lg font-semibold transition-colors hover:bg-gray-100"
                                style={{
                                    color: shop.brand_color,
                                    borderColor: shop.brand_color,
                                    borderWidth: '2px',
                                }}
                            >
                                {terms.staff_label} Login
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center">
                    <p className="text-sm text-gray-600">
                        Powered by Clipper ❤️
                    </p>
                </footer>
            </div>
        </div>
    );
}
