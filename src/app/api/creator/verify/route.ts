import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { generateVerificationCode, verifyIdentity, saveVerifiedIdentity } from '@/lib/verification/verify'
import { z } from 'zod'

const verifySchema = z.object({
  platform: z.enum(['domain', 'x', 'medium', 'substack', 'arc']),
  proofUrl: z.string().url(),
})

async function getCreatorId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, status: 401 as const }

  const { data: creatorProfile } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!creatorProfile) return { error: 'Creator profile not found.' as const, status: 403 as const }
  return { creatorId: creatorProfile.id as string }
}

async function getNetwork(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get('citeflow_network')?.value || 'arc-testnet'
}

export async function GET() {
  try {
    const supabase = await createClient()
    const result = await getCreatorId(supabase)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const network = await getNetwork()

    const { data: identities } = await supabase
      .from('platform_identities')
      .select('platform, identifier, proof_url, verified_at')
      .eq('creator_id', result.creatorId)
      .eq('network', network)
      .order('verified_at', { ascending: false })

    return NextResponse.json({
      verificationCode: generateVerificationCode(result.creatorId),
      identities: identities || [],
    })
  } catch (error: any) {
    console.error('Verify GET Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const result = await getCreatorId(supabase)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const network = await getNetwork()

    const body = await request.json()
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { platform, proofUrl } = parsed.data
    const code = generateVerificationCode(result.creatorId)

    const verified = await verifyIdentity(platform, proofUrl, result.creatorId)
    await saveVerifiedIdentity(supabase, result.creatorId, verified, code, network)

    return NextResponse.json({ success: true, platform: verified.platform, identifier: verified.identifier })
  } catch (error: any) {
    console.error('Verify POST Error:', error)
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 400 })
  }
}
