import { NextRequest, NextResponse } from 'next/server'
import { registerArticle } from '@/lib/registration/pipeline'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

const registrationSchema = z.object({
  url: z.string().url(),
  price: z.number().min(0).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the creator profile ID
    const { data: creatorProfile, error: creatorError } = await supabase
      .from('creator_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (creatorError || !creatorProfile) {
      return NextResponse.json({ error: 'Creator profile not found. Please complete setup.' }, { status: 403 })
    }

    // Resolve network: prefer x-network header, fall back to cookie
    const headerNetwork = request.headers.get('x-network')
    const cookieStore = await cookies()
    const network = headerNetwork || cookieStore.get('citeflow_network')?.value || 'arc-testnet'

    const body = await request.json()
    const parsed = registrationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { url, price } = parsed.data

    const result = await registerArticle(url, creatorProfile.id, price, network)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, sourceId: result.sourceId }, { status: 201 })

  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
