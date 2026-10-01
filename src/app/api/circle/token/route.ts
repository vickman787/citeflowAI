import { NextResponse } from 'next/server'

// The legacy endpoint accepted an arbitrary userId and minted a Circle user
// token without authenticating the caller. No app flow uses it.
export async function POST() {
  return NextResponse.json({ error: 'Legacy token issuance is disabled' }, { status: 410 })
}
