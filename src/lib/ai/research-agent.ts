import { createClient } from '@/utils/supabase/server'
import { authorizePayment } from '../payments/treasury'
import { z } from 'zod'

const evaluationSchema = z.object({
  relevant: z.boolean(),
  contributionScore: z.number().min(0).max(1),
  reasoning: z.string()
})

const finalOutputSchema = z.object({
  answer: z.string(),
  citationsUsed: z.array(z.string())
})

// Basic helper for Gemini REST API
async function callGeminiJSON(prompt: string, schema: any) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(`Gemini API Error: ${data.error?.message || 'Unknown'}`)
  }

  try {
    const jsonString = data.candidates[0].content.parts[0].text
    const parsed = JSON.parse(jsonString)
    return schema.parse(parsed)
  } catch (e) {
    throw new Error('Failed to parse Gemini output according to Zod schema')
  }
}

async function callOpenRouterJSON(prompt: string, schema: any) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(`OpenRouter API Error: ${data.error?.message || 'Unknown'}`)
  }

  try {
    const jsonString = data.choices[0].message.content
    let cleanString = jsonString.trim()
    const firstBrace = cleanString.indexOf('{')
    const lastBrace = cleanString.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanString = cleanString.substring(firstBrace, lastBrace + 1)
    }
    const parsed = JSON.parse(cleanString)
    return schema.parse(parsed)
  } catch (e) {
    throw new Error('Failed to parse OpenRouter output according to Zod schema')
  }
}

async function callLLM(prompt: string, schema: any, onProgress?: (msg: string) => void) {
  try {
    return await callGeminiJSON(prompt, schema)
  } catch (e: any) {
    console.warn(`Gemini API failed: ${e.message}. Falling back to OpenRouter (Anthropic)...`)
    if (process.env.OPENROUTER_API_KEY) {
      if (onProgress) onProgress('Gemini rate limited. Falling back to Claude 3.5 Haiku (via OpenRouter)...')
      return await callOpenRouterJSON(prompt, schema)
    }
    throw e
  }
}

export async function runResearchAgent(
  sessionId: string, 
  query: string, 
  maxBudget: number,
  onProgress?: (msg: string) => void
) {
  const supabase = await createClient()

  if (onProgress) onProgress('Initializing Agent Treasury and querying network...')

  // 1. Fetch available registered sources
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, url, title, price_usdc, source_chunks(chunk_text)')
    .eq('status', 'extracted')

  if (sourcesError || !sources) throw new Error('Failed to fetch sources')

  const purchasedSources: any[] = []
  
  // 2. Evaluate Sources and Execute Payments
  if (onProgress) onProgress(`Found ${sources.length} registered sources. Beginning evaluation...`)
  for (const source of sources) {
    if (onProgress) onProgress(`Evaluating relevance of: ${source.title}`)
    // Only search through sources we can afford
    if (parseFloat(source.price_usdc) > maxBudget) continue

    const sourceContent = source.source_chunks.map((c: any) => c.chunk_text).join('\n').substring(0, 5000)

    const evalPrompt = `
      Evaluate the relevance and contribution of the following source text to the user's research query.
      Query: "${query}"
      Source Content: "${sourceContent}"
      
      Return a JSON object matching this schema:
      {
        "relevant": boolean,
        "contributionScore": number (0 to 1),
        "reasoning": string
      }
    `
    
    let evaluation
    try {
      evaluation = await callLLM(evalPrompt, evaluationSchema, onProgress)
    } catch (e) {
      console.warn(`Evaluation failed for source ${source.id}`)
      continue
    }

    // Record decision
    await supabase.from('citation_decisions').insert({
      session_id: sessionId,
      source_id: source.id,
      contribution_score: evaluation.contributionScore,
      accepted: evaluation.relevant && evaluation.contributionScore >= 0.5,
      reasoning: evaluation.reasoning
    })
    
    if (onProgress) onProgress(`Evaluated ${source.title}. Score: ${evaluation.contributionScore.toFixed(2)}. ${evaluation.relevant && evaluation.contributionScore >= 0.5 ? 'Deemed highly relevant, preparing payment...' : 'Not relevant enough, skipping.'}`)

    // If deemed highly relevant, purchase the licence
    if (evaluation.relevant && evaluation.contributionScore >= 0.5) {
      try {
        const { payload } = await authorizePayment(sessionId, source.id, parseFloat(source.price_usdc), 'recipient_placeholder')
        
        // Call the dynamic x402 endpoint (in a real scenario, this would be absolute URL, simulating here with internal route for simplicity)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const licenseRes = await fetch(`${baseUrl}/api/sources/${source.id}/license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (licenseRes.ok) {
          const licenseData = await licenseRes.json()
          purchasedSources.push({
            id: source.id,
            title: source.title,
            url: source.url,
            content: sourceContent,
            receipt: licenseData.receipt
          })
          maxBudget -= parseFloat(source.price_usdc)
          if (onProgress) onProgress(`Payment Settled. Gateway Batch ID: ${licenseData.receipt.gatewaySettlementId}`)
        }
      } catch (e: any) {
        console.error(`Failed to purchase source ${source.id}:`, e.message)
        if (onProgress) onProgress(`Payment execution failed for ${source.title}. Source excluded from generation.`)
        // Ensure we EXCLUDE sources whose payments fail per requirements
      }
    }
  }

  // 3. Generate Final Grounded Answer
  if (onProgress) onProgress(`Synthesis phase. Generating factual answer grounded exclusively in ${purchasedSources.length} paid citations...`)
  
  let finalPrompt = `
    Answer the following query using ONLY the provided sources. 
    You must ground every factual claim in these explicitly purchased citations.
    Query: "${query}"
    
    Purchased Sources:
  `
  
  purchasedSources.forEach((s, index) => {
    finalPrompt += `\n[Source ${index + 1}] (ID: ${s.id}, Title: ${s.title}):\n${s.content}\n`
  })

  finalPrompt += `
    Return a JSON object matching this schema:
    {
      "answer": "Your detailed answer...",
      "citationsUsed": ["ID_of_source1", "ID_of_source2"]
    }
  `

  const finalOutput = await callLLM(finalPrompt, finalOutputSchema, onProgress)

  return {
    answer: finalOutput.answer,
    citationsUsed: purchasedSources.filter(s => finalOutput.citationsUsed.includes(s.id)),
    purchasedSources
  }
}
