import type { SupabaseClient } from '@supabase/supabase-js'
import { safeFetch } from '@/lib/net/safe-fetch'
import { resolveByStructure, resolveXPost, isXUrl, resolveArcPost, isArcUrl, resolveYouTubeVideo, isYouTubeUrl, resolveLensPost, isLensUrl, isGitHubUrl, type Platform } from './resolve'

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

// Arc House has no publicly readable profile or bio, so unlike Medium/Substack
// the code can only be proven from a published post. One post is enough for
// good: the identity is the author, so every post they've written becomes
// registerable off a single proof.
async function verifyArc(proofUrl: string, code: string): Promise<VerifyResult> {
  if (!isArcUrl(proofUrl)) {
    throw new Error('That does not look like an Arc House post URL (community.arc.io).')
  }

  const { authorId, text, canonicalUrl } = await resolveArcPost(proofUrl)

  if (!text.includes(code)) {
    throw new Error(`Verification code not found in that post. Make sure the post contains "${code}" exactly, then paste the link to it.`)
  }

  return { platform: 'arc', identifier: authorId, proofUrl: canonicalUrl }
}

// ---------------------------------------------------------------------------
// Ghost — fetch post and search for verification code in HTML body
// ---------------------------------------------------------------------------
async function verifyGhost(proofUrl: string, code: string): Promise<VerifyResult> {
  let hostname: string
  try { hostname = new URL(proofUrl).hostname.toLowerCase().replace(/^www\./, '') } catch {
    throw new Error('Enter a valid Ghost blog URL.')
  }
  if (!hostname.endsWith('.ghost.io')) {
    throw new Error('Enter a ghost.io post URL (yourname.ghost.io/post-slug) for Ghost verification.')
  }
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Ghost post (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" anywhere in the post body, then try again.`)
  }
  return { platform: 'ghost', identifier: hostname, proofUrl }
}

// ---------------------------------------------------------------------------
// Mirror.xyz — fetch entry and search for code; identifier is the 0x wallet address
// ---------------------------------------------------------------------------
async function verifyMirror(proofUrl: string, code: string): Promise<VerifyResult> {
  let url: URL
  try { url = new URL(proofUrl) } catch {
    throw new Error('Enter a valid Mirror.xyz entry URL.')
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (hostname !== 'mirror.xyz') {
    throw new Error('That does not look like a Mirror.xyz entry URL (mirror.xyz/0xYourAddress/entry-slug).')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments[0]?.startsWith('0x')) {
    throw new Error('Enter a Mirror.xyz entry URL that includes your wallet address (mirror.xyz/0xYourAddress/entry-slug).')
  }
  const identifier = segments[0].toLowerCase()
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Mirror entry (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the entry body, then try again.`)
  }
  return { platform: 'mirror', identifier, proofUrl }
}

// ---------------------------------------------------------------------------
// Paragraph.xyz — paragraph.xyz/@handle/post-slug
// ---------------------------------------------------------------------------
async function verifyParagraph(proofUrl: string, code: string): Promise<VerifyResult> {
  let url: URL
  try { url = new URL(proofUrl) } catch {
    throw new Error('Enter a valid Paragraph.xyz post URL.')
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (hostname !== 'paragraph.xyz') {
    throw new Error('That does not look like a Paragraph.xyz post URL (paragraph.xyz/@yourhandle/post-slug).')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments[0]?.startsWith('@')) {
    throw new Error('Enter a Paragraph.xyz post URL with your handle (paragraph.xyz/@yourhandle/post-slug).')
  }
  const identifier = segments[0].toLowerCase()
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Paragraph post (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the post body, then try again.`)
  }
  return { platform: 'paragraph', identifier, proofUrl }
}

// ---------------------------------------------------------------------------
// Hashnode — yourhandle.hashnode.dev/post-slug
// ---------------------------------------------------------------------------
async function verifyHashnode(proofUrl: string, code: string): Promise<VerifyResult> {
  let hostname: string
  try { hostname = new URL(proofUrl).hostname.toLowerCase().replace(/^www\./, '') } catch {
    throw new Error('Enter a valid Hashnode post URL.')
  }
  if (!hostname.endsWith('.hashnode.dev')) {
    throw new Error('Enter a Hashnode post URL on your yourhandle.hashnode.dev domain.')
  }
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Hashnode post (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the post body, then try again.`)
  }
  return { platform: 'hashnode', identifier: hostname, proofUrl }
}

// ---------------------------------------------------------------------------
// Dev.to — dev.to/handle/post-slug
// ---------------------------------------------------------------------------
async function verifyDevTo(proofUrl: string, code: string): Promise<VerifyResult> {
  let url: URL
  try { url = new URL(proofUrl) } catch {
    throw new Error('Enter a valid Dev.to post URL.')
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (hostname !== 'dev.to') {
    throw new Error('That does not look like a Dev.to post URL (dev.to/yourhandle/post-slug).')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments[0]) {
    throw new Error('Enter a Dev.to post URL with your handle (dev.to/yourhandle/post-slug).')
  }
  const identifier = segments[0].toLowerCase()
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Dev.to post (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the post body, then try again.`)
  }
  return { platform: 'devto', identifier, proofUrl }
}

// ---------------------------------------------------------------------------
// Beehiiv — yourpublication.beehiiv.com/p/post-slug
// ---------------------------------------------------------------------------
async function verifyBeehiiv(proofUrl: string, code: string): Promise<VerifyResult> {
  let hostname: string
  try { hostname = new URL(proofUrl).hostname.toLowerCase().replace(/^www\./, '') } catch {
    throw new Error('Enter a valid Beehiiv post URL.')
  }
  if (!hostname.endsWith('.beehiiv.com')) {
    throw new Error('Enter a Beehiiv post URL on your yourpublication.beehiiv.com domain.')
  }
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Beehiiv post (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the post body, then try again.`)
  }
  return { platform: 'beehiiv', identifier: hostname, proofUrl }
}

// ---------------------------------------------------------------------------
// Farcaster / Warpcast — warpcast.com/handle/cast-hash
// ---------------------------------------------------------------------------
async function verifyFarcaster(proofUrl: string, code: string): Promise<VerifyResult> {
  let url: URL
  try { url = new URL(proofUrl) } catch {
    throw new Error('Enter a valid Warpcast cast URL.')
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (hostname !== 'warpcast.com') {
    throw new Error('That does not look like a Warpcast cast URL (warpcast.com/yourhandle/cast-hash).')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments[0] || segments[0].startsWith('0x')) {
    throw new Error('Enter a Warpcast cast URL (warpcast.com/yourhandle/0xcasthash).')
  }
  const identifier = segments[0].toLowerCase()
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Warpcast cast (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found in that cast. Post the code "${code}" as a cast, then try again.`)
  }
  return { platform: 'farcaster', identifier, proofUrl }
}

// ---------------------------------------------------------------------------
// YouTube — oEmbed gives us the channel handle; code must be in video description
// ---------------------------------------------------------------------------
async function verifyYouTube(proofUrl: string, code: string): Promise<VerifyResult> {
  const hostname = (() => { try { return new URL(proofUrl).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' } })()
  if (!['youtube.com', 'youtu.be'].includes(hostname)) {
    throw new Error('That does not look like a YouTube video URL.')
  }
  const { channelHandle } = await resolveYouTubeVideo(proofUrl)
  // YouTube embeds the description in the page HTML (ytInitialData) — a plain include check works
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that YouTube video page (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the video description, then try again.`)
  }
  return { platform: 'youtube', identifier: channelHandle, proofUrl }
}

// ---------------------------------------------------------------------------
// Lens / Hey.xyz — resolve author handle from __NEXT_DATA__, code in post body
// ---------------------------------------------------------------------------
async function verifyLens(proofUrl: string, code: string): Promise<VerifyResult> {
  const hostname = (() => { try { return new URL(proofUrl).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' } })()
  if (!['hey.xyz'].includes(hostname)) {
    throw new Error('That does not look like a Hey.xyz post URL (hey.xyz/posts/postId).')
  }
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that Hey.xyz post (status ${res.status}).`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to the post body, then try again.`)
  }
  // Extract author handle from __NEXT_DATA__
  let authorHandle = ''
  const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1])
      const pp = nd?.props?.pageProps
      authorHandle = (
        pp?.profile?.handle?.localName ||
        pp?.publication?.by?.handle?.localName ||
        pp?.post?.by?.handle?.localName ||
        pp?.profile?.handle || ''
      ).toLowerCase()
    } catch {}
  }
  if (!authorHandle) {
    const ogM = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)
    const m = ogM?.[1]?.match(/hey\.xyz\/u\/([a-zA-Z0-9_.]+)/i)
    if (m) authorHandle = m[1].toLowerCase()
  }
  if (!authorHandle) {
    throw new Error('Could not determine the author of that Hey.xyz post. Make sure the post is publicly visible.')
  }
  return { platform: 'lens', identifier: authorHandle, proofUrl }
}

// ---------------------------------------------------------------------------
// GitHub — profile README, public gist, or any public repo page
// ---------------------------------------------------------------------------
async function verifyGitHub(proofUrl: string, code: string): Promise<VerifyResult> {
  let url: URL
  try { url = new URL(proofUrl) } catch {
    throw new Error('Enter a valid GitHub URL.')
  }
  if (!isGitHubUrl(proofUrl)) {
    throw new Error('That does not look like a GitHub URL (github.com/yourhandle or gist.github.com/yourhandle/gistid).')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments[0]) {
    throw new Error('Enter your GitHub profile URL (github.com/yourhandle), a Gist URL, or a public repository URL.')
  }
  const identifier = segments[0].toLowerCase()
  const res = await safeFetch(proofUrl)
  if (!res.ok) throw new Error(`Could not fetch that GitHub page (status ${res.status}). Make sure it is publicly accessible.`)
  const html = await res.text()
  if (!html.includes(code)) {
    throw new Error(`Verification code not found. Add "${code}" to your profile README or a public Gist, then try again.`)
  }
  return { platform: 'github', identifier, proofUrl }
}

export async function verifyIdentity(platform: Platform, proofUrl: string, creatorId: string): Promise<VerifyResult> {
  const code = generateVerificationCode(creatorId)
  switch (platform) {
    case 'domain':    return verifyDomain(proofUrl, code)
    case 'x':         return verifyX(proofUrl, code)
    case 'medium':    return verifyMedium(proofUrl, code)
    case 'substack':  return verifySubstack(proofUrl, code)
    case 'arc':       return verifyArc(proofUrl, code)
    case 'ghost':     return verifyGhost(proofUrl, code)
    case 'mirror':    return verifyMirror(proofUrl, code)
    case 'paragraph': return verifyParagraph(proofUrl, code)
    case 'hashnode':  return verifyHashnode(proofUrl, code)
    case 'devto':     return verifyDevTo(proofUrl, code)
    case 'beehiiv':   return verifyBeehiiv(proofUrl, code)
    case 'farcaster': return verifyFarcaster(proofUrl, code)
    case 'youtube':   return verifyYouTube(proofUrl, code)
    case 'lens':      return verifyLens(proofUrl, code)
    case 'github':    return verifyGitHub(proofUrl, code)
  }
}

export async function saveVerifiedIdentity(
  supabase: SupabaseClient,
  creatorId: string,
  result: VerifyResult,
  code: string,
  network: string = 'arc-testnet'
) {
  // ignoreDuplicates makes this a no-op on conflict instead of an update —
  // the FIRST creator to verify an identifier on this network permanently owns
  // the row. Testnet and mainnet are fully isolated via the network column.
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
        network,
      },
      { onConflict: 'platform,identifier,network', ignoreDuplicates: true }
    )

  if (error) throw new Error(`Failed to save verification: ${error.message}`)

  // Confirm we actually own the row now — if it already belonged to someone
  // else on this network, the insert above was silently skipped and this
  // creator_id won't match.
  const { data: owner } = await supabase
    .from('platform_identities')
    .select('creator_id')
    .eq('platform', result.platform)
    .eq('identifier', result.identifier)
    .eq('network', network)
    .single()

  if (!owner || owner.creator_id !== creatorId) {
    throw new Error(`${result.identifier} is already verified by another account on this network.`)
  }
}

// Registration gate: does this creator own the identity behind targetUrl on this network?
export async function resolveOwningIdentity(
  targetUrl: string,
  creatorId: string,
  supabase: SupabaseClient,
  network: string = 'arc-testnet'
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

  if (!resolved && isArcUrl(targetUrl)) {
    try {
      const { authorId } = await resolveArcPost(targetUrl)
      resolved = { platform: 'arc', identifier: authorId }
    } catch (e: any) {
      return { allowed: false, reason: `Could not verify ownership of this Arc House post: ${e.message}` }
    }
  }

  if (!resolved && isYouTubeUrl(targetUrl)) {
    try {
      const { channelHandle } = await resolveYouTubeVideo(targetUrl)
      resolved = { platform: 'youtube', identifier: channelHandle }
    } catch (e: any) {
      return { allowed: false, reason: `Could not verify ownership of this YouTube video: ${e.message}` }
    }
  }

  if (!resolved && isLensUrl(targetUrl)) {
    try {
      const { authorHandle } = await resolveLensPost(targetUrl)
      resolved = { platform: 'lens', identifier: authorHandle }
    } catch (e: any) {
      return { allowed: false, reason: `Could not verify ownership of this Hey.xyz post: ${e.message}` }
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
    .eq('network', network)
    .maybeSingle()

  if (data && data.creator_id === creatorId) {
    return { allowed: true }
  }

  if (data && data.creator_id !== creatorId) {
    return { allowed: false, reason: `${resolved.identifier} is registered to a different verified creator on this network.` }
  }

  return {
    allowed: false,
    reason: `You haven't verified ${resolved.identifier} yet. Verify it from your dashboard before registering content from there.`,
  }
}
