import { NextRequest, NextResponse } from 'next/server'
import { runResearchAgent } from '@/lib/ai/research-agent'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const researchRequestSchema = z.object({
  query: z.string().min(5),
  maxBudget: z.number().min(0).max(100)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = researchRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { query, maxBudget } = parsed.data

    // 1. Create a Research Session
    const { data: session, error: sessionError } = await supabase
      .from('research_sessions')
      .insert({
        user_id: user.id,
        query,
        budget_usdc: maxBudget,
        status: 'active'
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      console.error("Session creation error:", sessionError)
      return NextResponse.json({ error: 'Failed to create research session', details: sessionError?.message || "Unknown DB Error" }, { status: 500 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        const pushUpdate = (type: string, payload: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, payload }) + '\n'))
        }

        try {
          const result = await runResearchAgent(
            session.id, 
            query, 
            maxBudget,
            (msg) => pushUpdate('progress', msg)
          )

          // Mark session complete
          await supabase
            .from('research_sessions')
            .update({ status: 'completed' })
            .eq('id', session.id)

          pushUpdate('done', { result, sessionId: session.id })
          controller.close()
        } catch (error: any) {
          pushUpdate('error', error.message)
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Research API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
