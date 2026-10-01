import { createAdminClient } from '@/utils/supabase/admin'
import { authorizePayment } from '../payments/treasury'
import { settleCreatorLicense } from '../payments/license'
import { queueRefund, claimRefund, processClaimedRefund } from '../payments/refunds'
import { embedQuery, cosineSimilarity, parseVector } from './embeddings'
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

const groundingVerificationSchema = z.object({
  grounded: z.boolean(),
  groundingScore: z.number().min(0).max(1),
  reasoning: z.string()
})

async function callOpenAIJSON(prompt: string, schema: any) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Please configure your OPENAI_API_KEY.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESEARCH_MODEL || 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'Return only a valid JSON object matching the requested schema. Do not use markdown code blocks.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`OpenAI API Error: ${data.error?.message || 'Unknown'}`)
  }

  try {
    const jsonString = data.choices[0].message.content
    const parsed = JSON.parse(jsonString)
    return schema.parse(parsed)
  } catch (e) {
    throw new Error('Failed to parse OpenAI output according to Zod schema')
  }
}

async function callLLM(prompt: string, schema: any, onProgress?: (msg: string) => void) {
  const errors: string[] = []
  if (process.env.OPENAI_API_KEY) {
    try { return await callOpenAIJSON(prompt, schema) }
    catch (error: any) { errors.push(`OpenAI: ${error.message}`); onProgress?.('Research provider unavailable; trying fallback...') }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_RESEARCH_MODEL || 'gemini-2.5-flash'}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || String(res.status))
      return schema.parse(JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || ''))
    } catch (error: any) { errors.push(`Gemini: ${error.message}`); onProgress?.('Research fallback unavailable; trying secondary provider...') }
  }
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({ model: process.env.OPENROUTER_RESEARCH_MODEL || 'openai/gpt-4o-mini',
          messages: [{ role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt }],
          response_format: { type: 'json_object' } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || String(res.status))
      return schema.parse(JSON.parse(data.choices?.[0]?.message?.content || ''))
    } catch (error: any) { errors.push(`OpenRouter: ${error.message}`) }
  }
  throw new Error(`All research providers failed or are unconfigured: ${errors.join('; ')}`)
}

async function verifyCitationGrounding(
  query: string,
  answer: string,
  source: { title: string; content: string },
  onProgress?: (msg: string) => void
) {
  const auditPrompt = `
    You are an impartial academic fact-checker and financial audit agent.
    An AI research agent synthesized an answer for a user and cited the following source.
    Your job is to determine whether the cited source actually substantiates and grounds the factual claims in the answer, or if it was merely hallucinated, loosely referenced, or superfluous.
    
    User Query: "${query}"
    Synthesized Answer: "${answer}"
    
    Cited Source Title: "${source.title}"
    Cited Source Content: "${source.content}"
    
    Instructions:
    1. Check whether specific facts, definitions, findings, or key claims in the Synthesized Answer are directly derived from or supported by this Cited Source Content.
    2. If the source directly supports claims made in the answer, mark grounded as true and assign a groundingScore between 0.65 and 1.0 based on how strongly and substantively it supports the answer.
    3. If the answer does not draw meaningful substance from this source, or if the source content contradicts or fails to contain the claims, mark grounded as false and assign a low groundingScore (< 0.65).
    
    Return a JSON object matching this schema:
    {
      "grounded": boolean,
      "groundingScore": number,
      "reasoning": string
    }
  `

  return await callLLM(auditPrompt, groundingVerificationSchema, onProgress)
}

// Per-source context budget shown to the LLM (in chunks of ~1000 chars).
// Chunks are ranked by embedding similarity to the query; chunks without
// embeddings (older sources) fall back to document order.
const TOP_CHUNKS_PER_SOURCE = 8

function selectRelevantChunks(
  chunks: { chunk_text: string, embedding: string | number[] | null }[],
  queryEmbedding: number[] | null
): string {
  let ranked = chunks
  if (queryEmbedding) {
    const scored = chunks.map((c, i) => {
      const v = parseVector(c.embedding)
      return { i, score: v ? cosineSimilarity(queryEmbedding, v) : -1 }
    })
    // If nothing has embeddings every score is -1 and document order is preserved (stable sort)
    scored.sort((a, b) => b.score - a.score)
    ranked = scored.slice(0, TOP_CHUNKS_PER_SOURCE)
      .sort((a, b) => a.i - b.i) // restore document order for readability
      .map(s => chunks[s.i])
  } else {
    ranked = chunks.slice(0, TOP_CHUNKS_PER_SOURCE)
  }
  return ranked.map(c => c.chunk_text).join('\n[...]\n')
}

// Attempt a refund, recording it first so it is never lost. If the inline
// transfer fails (typically insufficient on-chain float, because Circle Gateway
// settles asynchronously), the row stays pending and the scheduled disbursement
// endpoint retries it once the funds have been swept on-chain.
async function recordAndAttemptRefund(
  sessionId: string,
  walletAddress: string,
  amount: number,
  network: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const refund = await queueRefund(sessionId, walletAddress, amount, network as 'arc-testnet' | 'arc-mainnet')
  if (refund.status === 'paid') { onProgress?.('Refund already confirmed.'); return }
  const claimed = await claimRefund(refund.id)
  if (claimed) {
    const outcome = await processClaimedRefund(claimed)
    onProgress?.(outcome === 'paid' ? 'Refund confirmed on-chain.' : 'Refund queued or submitted; awaiting on-chain confirmation.')
  } else {
    onProgress?.('Refund queued for processing; it is not paid yet.')
  }
}

export async function runResearchAgent(
  sessionId: string,
  query: string,
  initialBudget: number,
  walletAddress: string | undefined,
  onProgress?: (msg: string) => void,
  cookieHeader?: string,
  network: string = 'arc-testnet'
) {
  const isMainnet = network === 'arc-mainnet';
  const supabase = createAdminClient()

  try {
  if (onProgress) onProgress(`Agent 1 initialized on ${isMainnet ? 'Arc Mainnet' : 'Arc Testnet'}. Querying network corpus...`)

  // 1. Fetch available registered sources
  const { data: allSources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, url, title, price_usdc, creator_id, created_at, network, source_chunks(chunk_text, embedding)')
    .eq('status', 'extracted')

  if (sourcesError || !allSources) throw new Error('Failed to fetch sources')

  // Hard network isolation: a source is citable only on the network it was
  // registered on. Testnet sources never surface on mainnet, and vice versa.
  // Each network owns a separate source row and payment history.
  const activeNetworkId = isMainnet ? 'arc-mainnet' : 'arc-testnet'
  const sources = allSources.filter(s => (s.network || 'arc-testnet') === activeNetworkId)

  // Embed the query once for chunk-level retrieval across all sources.
  // If embedding fails (e.g. quota), fall back to document-order chunk selection.
  let queryEmbedding: number[] | null = null
  try {
    queryEmbedding = await embedQuery(query)
  } catch (e: any) {
    console.warn('Query embedding failed, falling back to document-order retrieval:', e.message)
    if (onProgress) onProgress('Vector index unavailable. Falling back to sequential scan...')
  }

  const purchasedSources: any[] = []
  let evaluationFailures = 0
  let paymentFailures = 0
  const relevantSources: any[] = []
  let allocatedBudget = 0;
  
  // 2. Evaluate Sources and Execute Payments
  if (onProgress) onProgress(`Found ${sources.length} registered sources. Beginning evaluation...`)
  for (const source of sources) {
    if (onProgress) onProgress(`Evaluating relevance of: ${source.title}`)
    // Only evaluate sources we can afford within our remaining allocated budget
    if (allocatedBudget + parseFloat(source.price_usdc) > initialBudget) continue

    const sourceContent = selectRelevantChunks(source.source_chunks, queryEmbedding)

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
      evaluationFailures++
      console.warn(`Evaluation failed for source ${source.id}`, e)
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

  // Partial provider outages must not silently narrow the corpus or produce a
  // misleading "no relevant sources" answer.
  if (evaluationFailures > 0) {
    throw new Error(`Research providers could not evaluate ${evaluationFailures} source(s); query aborted.`)
  }

  // If no registered sources are available or deemed relevant, prevent hallucinations and queue a refund
  if (relevantSources.length === 0) {
    if (onProgress) {
      onProgress(sources.length === 0
        ? 'No registered sources found in the corpus for this network. Issuing full refund...'
        : 'No registered sources in the corpus were relevant to this query. Issuing full refund...'
      );
    }

    if (walletAddress && initialBudget >= 0.05) {
      await recordAndAttemptRefund(sessionId, walletAddress, initialBudget, network, onProgress)
    }

    return {
      answer: sources.length === 0
        ? `No sources are currently registered on ${isMainnet ? 'Arc Mainnet' : 'Arc Testnet'}. A refund has been queued; check its on-chain status.`
        : 'No registered sources in the corpus contained information relevant to your query. A refund has been queued; check its on-chain status.',
      citationsUsed: [],
      purchasedSources: []
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

    CRITICAL: The 'answer' text itself must read as plain, natural prose — do NOT append inline citation markers like "[a1b2c3d4-...]" or "[Source 1]" to it. Citations are tracked exclusively via the 'citationsUsed' array; the answer text should contain no bracketed IDs, footnote numbers, or source references at all.
  `

  const finalOutput = await callLLM(finalPrompt, finalOutputSchema, onProgress)

  // 4. Grounding Verification & Audit Gate (Critic Step)
  // Before releasing payment to creators, verify that each cited source
  // genuinely substantiated the factual claims in the synthesized answer.
  if (onProgress) {
    onProgress(`Audit phase: Verifying factual grounding for ${finalOutput.citationsUsed.length} cited source${finalOutput.citationsUsed.length === 1 ? '' : 's'} before releasing payment...`)
  }

  const verifiedSources: any[] = []

  for (const usedId of finalOutput.citationsUsed) {
    const source = relevantSources.find(s => s.id === usedId)
    if (!source) continue

    if (onProgress) onProgress(`Auditing citation grounding: ${source.title}...`)

    let verification
    try {
      verification = await verifyCitationGrounding(query, finalOutput.answer, source, onProgress)
    } catch (auditErr: any) {
      console.warn(`Grounding verification failed for source ${source.id}:`, auditErr.message)
      verification = {
        grounded: false,
        groundingScore: 0,
        reasoning: `Grounding audit check could not be completed (${auditErr.message}). Payment withheld for safety.`
      }
    }

    const passed = verification.grounded && verification.groundingScore >= 0.65

    // Record the audit decision in the database ledger
    await supabase.from('citation_decisions').insert({
      session_id: sessionId,
      source_id: source.id,
      contribution_score: verification.groundingScore,
      accepted: passed,
      reasoning: passed
        ? `[Grounding Verified: ${verification.groundingScore.toFixed(2)}] ${verification.reasoning}`
        : `[Grounding Rejected: ${verification.groundingScore.toFixed(2)}] ${verification.reasoning}`
    })

    if (passed) {
      verifiedSources.push(source)
      if (onProgress) {
        onProgress(`Citation verified (${verification.groundingScore.toFixed(2)}): ${source.title}. Grounding confirmed ✓`)
      }
    } else {
      if (onProgress) {
        onProgress(`Citation rejected (${verification.groundingScore.toFixed(2)}): ${source.title}. Insufficient grounding; creator payment withheld.`)
      }
    }
  }

  if (verifiedSources.length === 0 || verifiedSources.length !== new Set(finalOutput.citationsUsed).size) {
    throw new Error('Grounding audit rejected one or more cited sources. The answer was withheld and unused funds will be refunded.')
  }

  // 5. Execute Payments ONLY for Verified Citations
  if (onProgress) {
    onProgress(`Executing payments for ${verifiedSources.length} verified citation${verifiedSources.length === 1 ? '' : 's'}...`)
  }

  for (const source of verifiedSources) {
    try {
      if (Number(source.price_usdc) === 0) {
        purchasedSources.push({ id: source.id, title: source.title, url: source.url,
          content: source.content, paymentStatus: 'free', receipt: null })
        continue
      }
      const { authorizationId } = await authorizePayment(sessionId, source.id, parseFloat(source.price_usdc), 'recipient_placeholder', activeNetworkId)
      const license = await settleCreatorLicense(authorizationId, source.id, activeNetworkId)
      purchasedSources.push({
        id: source.id, title: source.title, url: source.url, content: source.content,
        paymentStatus: license.status,
        receipt: { transactionId: license.transactionId, txHash: license.txHash || null }
      })
      if (onProgress) onProgress(license.status === 'confirmed'
        ? `Creator payout confirmed on-chain: ${license.txHash}`
        : `Creator payout submitted (${license.transactionId}); confirmation pending.`)
    } catch (e: any) {
      paymentFailures++
      console.error(`Failed to purchase source ${source.id}:`, e.message)
      if (onProgress) onProgress(`Payment execution failed for ${source.title}.`)
    }
  }
  if (paymentFailures > 0) {
    throw new Error(`${paymentFailures} creator payout(s) failed or require reconciliation. The answer was withheld.`)
  }

  // --- Backend Refund Mechanism ---
  if (walletAddress) {
    // Researcher only pays for the actual sources cited. Platform take rate is already
    // factored into each citation payout in the license endpoint (80% creator / 20% platform).
    const { data: allAuthorizations, error: authReadError } = await supabase
      .from('payment_authorizations').select('amount_usdc, status').eq('session_id', sessionId)
    if (authReadError) throw new Error('Could not audit reserved creator payouts before refund')
    const reserved = (allAuthorizations || []).filter((a: any) => a.status !== 'failed')
      .reduce((sum: number, a: any) => sum + Number(a.amount_usdc), 0)
    const unspentBudget = Math.max(0, initialBudget - reserved);
    
    if (unspentBudget >= 0.000001) {
      if (onProgress) onProgress(`Unspent budget is $${unspentBudget.toFixed(6)}. Queuing refund...`)
      await recordAndAttemptRefund(sessionId, walletAddress, unspentBudget, network, onProgress)
    }
  }

  return {
    answer: finalOutput.answer,
    citationsUsed: purchasedSources.filter(s => finalOutput.citationsUsed.includes(s.id)),
    purchasedSources
  }
  
  } catch (err: any) {
    // Reserve every authorization that may already have triggered a payout.
    // A crash after Circle submission must never result in a full refund too.
    if (walletAddress) {
      const { data: auths, error: authReadError } = await supabase.from('payment_authorizations')
        .select('amount_usdc, status').eq('session_id', sessionId)
      if (authReadError) {
        throw new Error('Research failed; payout state could not be verified, so refund is withheld for reconciliation')
      }
      const reserved = (auths || []).filter((a: any) => !['failed'].includes(a.status))
        .reduce((sum: number, a: any) => sum + Number(a.amount_usdc), 0)
      const refundable = Math.max(0, initialBudget - reserved)
      if (refundable >= 0.000001) {
        onProgress?.(`Research failed. Queuing ${refundable.toFixed(6)} USDC refund; pending payouts remain reserved.`)
        await recordAndAttemptRefund(sessionId, walletAddress, refundable, network, onProgress)
      }
    }
    throw err;
  }
}
