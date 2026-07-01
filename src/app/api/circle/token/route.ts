import { NextRequest, NextResponse } from 'next/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: 'Missing CIRCLE_API_KEY' }, { status: 500 })
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    })

    // 1. If email provided, make a deterministic ID. Otherwise generate one.
    // In a real app, this should lookup the userId in your database.
    let id = crypto.randomUUID()
    if (body.email) {
      // Deterministic pseudo-UUID from email for testing/hackathons
      const hash = Array.from(body.email).reduce((acc: number, char: any) => (acc * 31 + char.charCodeAt(0)) | 0, 0)
      id = `00000000-0000-0000-0000-${Math.abs(hash).toString(16).padStart(12, '0')}`
    } else if (userId) {
      id = userId
    }

    // 2. Ensure user exists before generating token
    try {
      await circleClient.createUser({ userId: id })
    } catch (e: any) {
      // 409 Conflict means the user already exists, which is fine
      if (e?.response?.status !== 409) {
        console.error("Failed to create user:", e?.response?.data || e.message)
        // We'll continue anyway to let createUserToken fail and give a better error
      }
    }

    // 3. Generate Session Token
    const res = await circleClient.createUserToken({
      userId: id
    })

    return NextResponse.json({
      userId: id,
      userToken: res.data?.userToken,
      encryptionKey: res.data?.encryptionKey
    })

  } catch (error: any) {
    console.error('Circle Token Error:', error?.response?.data || error)
    return NextResponse.json({ error: 'Failed to generate Circle user token' }, { status: 500 })
  }
}
