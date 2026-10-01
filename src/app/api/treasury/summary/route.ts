import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: NextRequest) {
  const network = request.nextUrl.searchParams.get('network')
  if (network !== 'arc-testnet' && network !== 'arc-mainnet') {
    return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  }
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await createAdminClient().from('treasury_limits')
    .select('daily_limit_usdc, spent_today_usdc').eq('date', today).eq('network', network).maybeSingle()
  if (error) return NextResponse.json({ error: 'Treasury summary unavailable' }, { status: 500 })
  return NextResponse.json({ dailyLimit: Number(data?.daily_limit_usdc ?? process.env.DAILY_TREASURY_LIMIT_USDC ?? 100), spent: Number(data?.spent_today_usdc ?? 0) })
}
