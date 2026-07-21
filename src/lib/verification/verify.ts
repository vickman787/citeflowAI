import type { SupabaseClient } from '@supabase/supabase-js'
import { safeFetch } from '@/lib/net/safe-fetch'
import { resolveByStructure, resolveXPost, isXUrl, type Platform } from './resolve'

// Deterministic per-creator code. Not a one-time secret like an OTP — it's
// a durable proof token (same idea as a domain TXT record), checked live
// against the page/post each time, so it doesn't need to expire.
export function generateVerificationCode(creatorId: string): string {
  return `citeflow-verify-${creatorId.replace(/-/g, '').slice(0, 12)}`
}

interface VerifyResult {
  platform: Platform
  identifier: string
  proofUrl: string
}

function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

async function verifyDomain(proofUrl: string, code: string): Promise<VerifyResult> {
  let hostname: string
  try {
    hostname = stripWww(new URL(proofUrl).hostname)
  } catch {
    throw new Error('Enter a valid URL on the domain you want to verify.')
  }

  const rootUrl = `https://${hostname}/`

  // 1. Meta tag on the homepage
  try {
    const res = await safeFetch(rootUrl)
    if (res.ok) {
      const html = await res.text()
      const tagMatch = html.match(/<meta[^>]+name=["']citeflow-owner["'][^>]+content=["']([^"']+)["']/i)
      if (tagMatch && tagMatch[1].trim() === code) {
        return { platform: 'domain', identifier: hostname, proofUrl: rootUrl }
      }
    }
  } catch {
    // fall through to well-known file
  }

  // 2. /.well-known/citeflow.txt
  try {
    const wellKnownUrl = `https://${hostname}/.well-known/citeflow.txt`
    const res = await safeFetch(wellKnownUrl)
    if (res.ok) {
      const text = (await res.text()).trim()
      if (text === code) {
        return { platform: 'domain', identifier: hostname, proofUrl: wellKnownUrl }
      }
    }
  } catch {
    // both methods failed
  }

  throw new Error(
    `Could not find the verification code on ${hostname}. Add the meta tag or /.well-known/citeflow.txt file, then try again.`
  )
}

async function verifyX(proofUrl: string, code: string): Promise<VerifyResult> {
  if (!isXUrl(proofUrl)) {
    throw new Error('That does not look like an X (twitter.com/x.com) post URL.')
  }

  const { authorHandle, text, canonicalUrl } = await resolveXPost(proofUrl)

  if (!text.includes(code)) {
    throw new Error(`Verification code not found in that post. Make sure you posted "${code}" exactly, then paste the link to that post.`)
  }

  return { platform: 'x', identifier: authorHandle, proofUrl: canonicalUrl }
}

async function verifyMedium(proofUrl: string, code: string): Promise<VerifyResult> {
  const resolved = resolveByStructure(proofUrl)
  if (!resolved || resolved.platform !== 'medium') {
    throw new Error('Enter a medium.com/@yourhandle URL — a profile page or a published post.')
  }

  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Medium page (status ${res.status}).`)
  const html = await res.text()

  if (!html.includes(code)) {
    throw new Error(`Verification code not found on that page. Add "${code}" to your bio or publish a post containing it, then try again.`)
  }

  return { platform: 'medium', identifier: resolved.identifier, proofUrl }
}

async function verifySubstack(proofUrl: string, code: string): Promise<VerifyResult> {
  const resolved = resolveByStructure(proofUrl)
  if (!resolved || resolved.platform !== 'substack') {
    throw new Error('Enter a URL on your yourname.substack.com domain.')
  }

  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Substack page (status ${res.status}).`)
  const html = await res.text()

  if (!html.includes(code)) {
    throw new Error(`Verification code not found on that page. Publish a post (or add to your About page) containing "${code}", then try again.`)
  }

  return { platform: 'substack', identifier: resolved.identifier, proofUrl }
}

export async function verifyIdentity(platform: Platform, proofUrl: string, creatorId: string): Promise<VerifyResult> {
  const code = generateVerificationCode(creatorId)
  switch (platform) {
    case 'domain': return verifyDomain(proofUrl, code)
    case 'x': return verifyX(proofUrl, code)
    case 'medium': return verifyMedium(proofUrl, code)
    case 'substack': return verifySubstack(proofUrl, code)
  }
}

export async function saveVerifiedIdentity(
  supabase: SupabaseClient,
  creatorId: string,
  result: VerifyResult,
  code: string
) {
  // ignoreDuplicates makes this a no-op on conflict instead of an update —
  // the FIRST creator to verify an identifier permanently owns the row.
  // A plain upsert would UPDATE on conflict, letting a second verifier
  // silently steal an already-claimed handle; this closes that race.
  const { error } = await supabase
    .from('platform_identities')
    .upsert(
      {
        creator_id: creatorId,
        platform: result.platform,
        identifier: result.identifier,
        proof_url: result.proofUrl,
        verification_code: code,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'platform,identifier', ignoreDuplicates: true }
    )

  if (error) throw new Error(`Failed to save verification: ${error.message}`)

  // Confirm we actually own the row now — if it already belonged to someone
  // else, the insert above was silently skipped and this creator_id won't match.
  const { data: owner } = await supabase
    .from('platform_identities')
    .select('creator_id')
    .eq('platform', result.platform)
    .eq('identifier', result.identifier)
    .single()

  if (!owner || owner.creator_id !== creatorId) {
    throw new Error(`${result.identifier} is already verified by another account.`)
  }
}

// Registration gate: does this creator own the identity behind targetUrl?
export async function resolveOwningIdentity(
  targetUrl: string,
  creatorId: string,
  supabase: SupabaseClient
): Promise<{ allowed: boolean; reason?: string }> {
  let resolved = resolveByStructure(targetUrl)

  if (!resolved && isXUrl(targetUrl)) {
    try {
      const { authorHandle } = await resolveXPost(targetUrl)
      resolved = { platform: 'x', identifier: authorHandle }
    } catch (e: any) {
      return { allowed: false, reason: `Could not verify ownership of this X post: ${e.message}` }
    }
  }

  if (!resolved) {
    return { allowed: false, reason: 'Could not determine who owns this URL.' }
  }

  const { data } = await supabase
    .from('platform_identities')
    .select('creator_id')
    .eq('platform', resolved.platform)
    .eq('identifier', resolved.identifier)
    .maybeSingle()

  if (data && data.creator_id === creatorId) {
    return { allowed: true }
  }

  if (data && data.creator_id !== creatorId) {
    return { allowed: false, reason: `${resolved.identifier} is registered to a different verified creator.` }
  }

  return {
    allowed: false,
    reason: `You haven't verified ${resolved.identifier} yet. Verify it from your dashboard before registering content from there.`,
  }
}
