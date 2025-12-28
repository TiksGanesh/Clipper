import { createServerActionClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function POST() {
    const supabase = await createServerActionClient()
    await supabase.auth.signOut()
    return redirect('/login')
}
