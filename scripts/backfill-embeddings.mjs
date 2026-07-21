// One-time backfill: embed all source_chunks rows that have no embedding yet.
// Usage: node scripts/backfill-embeddings.mjs
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Minimal .env.local loader so this runs outside Next.js
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.trim().match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_DIM = 1536

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function normalize(v) {
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0))
  return norm === 0 ? v : v.map(x => x / norm)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function embedBatch(texts) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBED_DIM,
            taskType: 'RETRIEVAL_DOCUMENT'
          }))
        })
      }
    )
    const data = await res.json()
    if (res.ok) return data.embeddings.map(e => normalize(e.values))
    if (res.status === 429) {
      const wait = /retry in (\d+(\.\d+)?)s/i.exec(data.error?.message || '')
      const ms = wait ? Math.ceil(parseFloat(wait[1]) * 1000) + 2000 : 62000
      console.log(`  rate limited, waiting ${Math.round(ms / 1000)}s...`)
      await sleep(ms)
      continue
    }
    throw new Error(`Embedding API error: ${data.error?.message || res.status}`)
  }
  throw new Error('Embedding API error: rate limit retries exhausted')
}

const { data: chunks, error } = await supabase
  .from('source_chunks')
  .select('id, chunk_text')
  .is('embedding', null)
  .order('id')

if (error) throw error
console.log(`${chunks.length} chunks need embeddings`)

let done = 0
for (let i = 0; i < chunks.length; i += 100) {
  const batch = chunks.slice(i, i + 100)
  const embeddings = await embedBatch(batch.map(c => c.chunk_text))

  for (let j = 0; j < batch.length; j++) {
    const { error: updateError } = await supabase
      .from('source_chunks')
      .update({ embedding: `[${embeddings[j].join(',')}]` })
      .eq('id', batch[j].id)
    if (updateError) throw updateError
  }

  done += batch.length
  console.log(`  ${done}/${chunks.length}`)
}

console.log('Backfill complete')
