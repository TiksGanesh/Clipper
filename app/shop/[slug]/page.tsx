import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ShopExperience } from '@/components/shop/ShopExperience';
import { Database } from '@/types/database';

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
    params: Promise<{ slug: string }>;
};

/**
 * Generate metadata for the shop landing page
 * Sets the page title based on the shop name
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;

    const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

    const shop = data as Database['public']['Tables']['shops']['Row'] | null;

    if (error || !shop) {
        return {
            title: 'Shop Not Found',
            description: 'The shop you are looking for does not exist.',
        };
    }

    return {
        title: shop.name,
        description: shop.tagline || `Book an appointment at ${shop.name}`,
        openGraph: {
            title: shop.name,
            description: shop.tagline || `Book an appointment at ${shop.name}`,
            images: shop.splash_image_url ? [{ url: shop.splash_image_url }] : [],
        },
    };
}

/**
 * Shop Landing Page - Server Component
 * Fetches shop details and renders the booking experience
 */
export default async function ShopPage({ params }: Props) {
    const { slug } = await params;

    // Fetch shop details from Supabase
    const { data: shop, error } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

    // Show 404 if shop not found
    if (error || !shop) {
        notFound();
    }

    return <ShopExperience shop={shop} />;
}
