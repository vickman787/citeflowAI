import { NextRequest, NextResponse } from 'next/server'
import { runResearchAgent } from '@/lib/ai/research-agent'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Find any user id
    const { data: profile } = await supabase.from('profiles').select('id').limit(1).single()
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

    const { query, maxBudget } = await request.json()

    const { data: session } = await supabase
      .from('research_sessions')
      .insert({
        user_id: profile.id,
        query,
        budget_usdc: maxBudget,
        status: 'active'
      })
      .select('id')
      .single()

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const pushUpdate = (type: string, payload: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, payload }) + '\n'))
        }

        try {
          if (!session) throw new Error('Failed to create session')
          const result = await runResearchAgent(
            session.id, 
            query, 
            maxBudget,
            (msg) => pushUpdate('progress', msg)
          )
          pushUpdate('done', { result })
          controller.close()
        } catch (error: unknown) {
          pushUpdate('error', error instanceof Error ? error.message : 'Unknown error')
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
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
