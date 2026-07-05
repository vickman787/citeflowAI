import { createAdminClient } from '@/utils/supabase/admin'
import { authorizePayment } from '../payments/treasury'
import { executeGatewayTransfer } from '../payments/circle-api'
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
      max_tokens: 700,
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

async function callGroqJSON(prompt: string, schema: any) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(`Groq API Error: ${data.error?.message || 'Unknown'}`)
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
    throw new Error('Failed to parse Groq output according to Zod schema')
  }
}

async function callAnthropicJSON(prompt: string, schema: any) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: 'You must return a valid JSON object matching the requested schema. Output only the raw JSON without any markdown code blocks.',
      messages: [{ role: 'user', content: prompt }]
    })
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(`Anthropic API Error: ${data.error?.message || 'Unknown'}`)
  }

  try {
    const jsonString = data.content[0].text
    let cleanString = jsonString.trim()
    const firstBrace = cleanString.indexOf('{')
    const lastBrace = cleanString.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanString = cleanString.substring(firstBrace, lastBrace + 1)
    }
    const parsed = JSON.parse(cleanString)
    return schema.parse(parsed)
  } catch (e) {
    throw new Error('Failed to parse Anthropic output according to Zod schema')
  }
}

async function callLLM(prompt: string, schema: any, onProgress?: (msg: string) => void) {
  try {
    if (process.env.GROQ_API_KEY) {
      return await callGroqJSON(prompt, schema)
    }
    throw new Error('Groq not configured')
  } catch (e: any) {
    console.warn(`Groq API failed or not configured: ${e.message}. Falling back...`)
    
    try {
      if (process.env.GEMINI_API_KEY) {
        if (onProgress) onProgress('Groq rate limited. Falling back to Gemini 2.5 Flash...')
        return await callGeminiJSON(prompt, schema)
      }
      throw new Error('Gemini not configured')
    } catch (geminiError: any) {
      console.warn(`Gemini API failed: ${geminiError.message}. Falling back...`)
      if (process.env.ANTHROPIC_API_KEY) {
        if (onProgress) onProgress('Gemini rate limited. Falling back to Claude Haiku (via Anthropic API)...')
        return await callAnthropicJSON(prompt, schema)
      }
      if (process.env.OPENROUTER_API_KEY) {
        if (onProgress) onProgress('Gemini rate limited. Falling back to Claude Haiku (via OpenRouter)...')
        return await callOpenRouterJSON(prompt, schema)
      }
      throw e
    }
  }
}

export async function runResearchAgent(
  sessionId: string, 
  query: string, 
  initialBudget: number,
  walletAddress: string | undefined,
  onProgress?: (msg: string) => void
) {
  let maxBudget = initialBudget;
  let totalSpentOnSources = 0;
  const platformFee = 0.20; // Ensure we keep $0.20 as platform revenue per prompt
  
  try {
  const supabase = createAdminClient()

  if (onProgress) onProgress('Initializing Agent Treasury and querying network...')

  // 1. Fetch available registered sources
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, url, title, price_usdc, source_chunks(chunk_text)')
    .eq('status', 'extracted')

  if (sourcesError || !sources) throw new Error('Failed to fetch sources')

  const purchasedSources: any[] = []
  const relevantSources: any[] = []
  let allocatedBudget = 0;
  
  // 2. Evaluate Sources and Execute Payments
  if (onProgress) onProgress(`Found ${sources.length} registered sources. Beginning evaluation...`)
  for (const source of sources) {
    if (onProgress) onProgress(`Evaluating relevance of: ${source.title}`)
    // Only evaluate sources we can afford within our remaining allocated budget
    if (allocatedBudget + parseFloat(source.price_usdc) > initialBudget) continue

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
    
    // If deemed highly relevant, add to context
    if (evaluation.relevant && evaluation.contributionScore >= 0.5) {
      relevantSources.push({
        id: source.id,
        title: source.title,
        url: source.url,
        content: sourceContent,
        price_usdc: source.price_usdc
      })
      allocatedBudget += parseFloat(source.price_usdc);
      if (onProgress) onProgress(`Evaluated ${source.title}. Score: ${evaluation.contributionScore.toFixed(2)}. Deemed highly relevant, adding to context...`)
    } else {
      if (onProgress) onProgress(`Evaluated ${source.title}. Score: ${evaluation.contributionScore.toFixed(2)}. Not relevant enough, skipping.`)
    }
  }

  // 3. Generate Final Grounded Answer
  if (onProgress) onProgress(`Synthesis phase. Generating factual answer grounded exclusively in relevant citations...`)
  
  let finalPrompt = `
    Answer the following query using ONLY the provided sources. 
    You must ground every factual claim in these explicitly provided citations.
    Query: "${query}"
    
    Available Sources:
  `
  
  relevantSources.forEach((s, index) => {
    finalPrompt += `\n[Source ${index + 1}] (ID: ${s.id}, Title: ${s.title}):\n${s.content}\n`
  })

  finalPrompt += `
    Return a JSON object matching this schema:
    {
      "answer": "Your detailed answer...",
      "citationsUsed": ["ID_of_source1", "ID_of_source2"]
    }
    
    CRITICAL: The 'citationsUsed' array MUST contain ONLY the exact raw UUID strings of the sources provided above (e.g. "a1b2c3d4-..."). Do not use titles, "Source 1", or any other format. If you use a source, you MUST include its exact ID in this array so the creator can be compensated.
  `

  const finalOutput = await callLLM(finalPrompt, finalOutputSchema, onProgress)

  // 4. Execute Payments ONLY for Used Citations
  if (onProgress) onProgress(`Executing payments for ${finalOutput.citationsUsed.length} citations explicitly used in the final answer...`)
  
  for (const usedId of finalOutput.citationsUsed) {
    const source = relevantSources.find(s => s.id === usedId)
    if (!source) continue

    try {
      const { payload } = await authorizePayment(sessionId, source.id, parseFloat(source.price_usdc), 'recipient_placeholder')
      
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
          content: source.content,
          receipt: licenseData.receipt
        })
        const price = parseFloat(source.price_usdc);
        maxBudget -= price;
        totalSpentOnSources += price;
        if (onProgress) onProgress(`Payment Settled. Gateway Batch ID: ${licenseData.receipt.gatewaySettlementId}`)
      }
    } catch (e: any) {
      console.error(`Failed to purchase source ${source.id}:`, e.message)
      if (onProgress) onProgress(`Payment execution failed for ${source.title}.`)
    }
  }

  // --- Backend Refund Mechanism ---
  if (walletAddress) {
    // Waive the platform fee if no sources were useful (100% full refund)
    const actualPlatformFee = totalSpentOnSources > 0 ? platformFee : 0;
    const unspentBudget = initialBudget - totalSpentOnSources - actualPlatformFee;
    
    if (unspentBudget >= 0.05) {
      if (onProgress) onProgress(`Calculating budget... Unspent budget is $${unspentBudget.toFixed(2)}. Initiating refund...`)
      try {
        await executeGatewayTransfer(walletAddress, unspentBudget.toFixed(2));
        if (onProgress) onProgress(`Refunded $${unspentBudget.toFixed(2)} to your wallet.`)
      } catch (err: any) {
        console.error("Refund failed:", err);
        if (onProgress) onProgress(`Warning: Refund transfer failed (${err.message})`)
      }
    } else {
      if (onProgress) onProgress(`Unspent budget is $${unspentBudget.toFixed(2)} (below $0.05 minimum threshold). Retained by Treasury.`)
    }
  }

  return {
    answer: finalOutput.answer,
    citationsUsed: purchasedSources.filter(s => finalOutput.citationsUsed.includes(s.id)),
    purchasedSources
  }
  
  } catch (err: any) {
    // --- Crash / Failure Full Refund Mechanism ---
    if (walletAddress) {
      if (onProgress) onProgress(`Research execution failed. Initiating full refund of $${initialBudget.toFixed(2)}...`)
      try {
        await executeGatewayTransfer(walletAddress, initialBudget.toFixed(2));
        if (onProgress) onProgress(`Refunded $${initialBudget.toFixed(2)} to your wallet.`)
      } catch (refundErr: any) {
        console.error("Crash Refund failed:", refundErr);
      }
    }
    throw err;
  }
}
