import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NETWORKS } from '@/lib/network'

export async function GET(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const network = request.nextUrl.searchParams.get('network') || 'arc-testnet'
  if (!(network in NETWORKS)) return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  const { data: source } = await createAdminClient()
    .from('sources')
    .select('price_usdc, network, creator_profiles(profiles(wallet_address))')
    .eq('id', sourceId).eq('network', network).eq('status', 'extracted').maybeSingle()
  if (!source) return NextResponse.json({ error: 'Source not found on this network' }, { status: 404 })
  const recipient = (source as any).creator_profiles?.profiles?.wallet_address
  if (!recipient) return NextResponse.json({ error: 'Creator wallet not configured' }, { status: 400 })
  return NextResponse.json({ message: 'Payment Required', amount: source.price_usdc, currency: 'USDC', recipient, network }, { status: 402 })
}

// A public request, even with a copied authorization ID, must never send money.
export async function POST() {
  return NextResponse.json({ error: 'License settlement is server-only' }, { status: 405 })
}
