import { createServerActionClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'

export async function POST(request: NextRequest) {
    const supabase = await createServerActionClient()
    await supabase.auth.signOut()
    
    // Check for shop_slug query parameter to redirect back to shop experience
    const shopSlug = request.nextUrl.searchParams.get('shop_slug')
    
    if (shopSlug) {
        return redirect(`/shop/${shopSlug}`)
    }
    
    return redirect('/login')
}
