import dns from 'dns'
import { promisify } from 'util'
import { URL } from 'url'
import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'

const lookupAsync = promisify(dns.lookup)

// SSRF Protection: Check if IP is private
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    if (parts[0] === 10) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 127) return true // localhost
    if (parts[0] === 169 && parts[1] === 254) return true // link-local
  }
  
  // Basic IPv6 check
  if (ip.includes(':')) {
    if (ip === '::1') return true // localhost
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true // Unique local
    if (ip.toLowerCase().startsWith('fe80')) return true // Link-local
  }
  
  return false
}

// Fetch with redirect limit and SSRF protection
async function safeFetch(targetUrl: string, maxRedirects = 5): Promise<Response> {
  let currentUrl = targetUrl
  let redirects = 0

  while (redirects < maxRedirects) {
    const parsedUrl = new URL(currentUrl)
    
    // Only allow http and https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol')
    }

    // SSRF Check
    const { address } = await lookupAsync(parsedUrl.hostname)
    if (isPrivateIP(address)) {
      throw new Error(`Access to private IP ${address} is blocked`)
    }

    const response = await fetch(currentUrl, {
      redirect: 'manual', // handle manually to check intermediate URLs for SSRF
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    })

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      const location = response.headers.get('location')!
      currentUrl = new URL(location, currentUrl).toString()
      redirects++
    } else {
      return response
    }
  }

  throw new Error('Too many redirects')
}

function extractMetadata(html: string) {
  // Extremely rudimentary metadata extraction regex for demonstration
  // In production, we would use cheerio and sanitize-html
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
  
  // Naive text extraction (strip tags)
  const readableText = html
    .replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
    .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    
  return { title, readableText }
}

export async function registerArticle(targetUrl: string, creatorId: string, price: number = 0.00) {
  const supabase = await createClient()
  
  try {
    // 1. Normalize URL
    const normalizedUrl = new URL(targetUrl).toString()

    // 2. Safe fetch (SSRF, redirect limit)
    const response = await safeFetch(normalizedUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`)
    }

    // 3. Content type validation
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      throw new Error('Invalid content type. Expected text/html.')
    }

    const html = await response.text()

    // 4. Extraction
    const { title, readableText } = extractMetadata(html)
    const contentHash = crypto.createHash('sha256').update(readableText).digest('hex')

    // 5. Database Insertion
    const { data, error } = await supabase
      .from('sources')
      .insert({
        url: normalizedUrl,
        title,
        content_hash: contentHash,
        price_usdc: price,
        creator_id: creatorId,
        status: 'extracted'
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Article already registered (Duplicate)')
      }
      throw error
    }

    // 6. Chunking (naive for now)
    const chunks = readableText.match(/.{1,1000}/g) || []
    
    // Insert chunks without embeddings for now
    if (chunks.length > 0) {
      const chunkInserts = chunks.map(chunk => ({
        source_id: data.id,
        chunk_text: chunk
      }))
      
      await supabase.from('source_chunks').insert(chunkInserts)
    }

    return { success: true, sourceId: data.id }

  } catch (error: any) {
    console.error('Registration error:', error.message)
    return { success: false, error: error.message }
  }
}
