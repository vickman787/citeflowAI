// Resolves any URL to the (platform, identifier) pair that owns it.
// Used both when a creator verifies an identity and when registration checks
// a target URL against that creator's verified identities. The identifier is
// always derived from the canonical source (oEmbed author, URL structure),
// never trusted blindly from user input.

export type Platform = 'domain' | 'x' | 'medium' | 'substack'

export interface ResolvedIdentity {
  platform: Platform
  identifier: string
}

const X_HOSTS = new Set(['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'])

function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

// Resolves a URL by its structure alone — used for Medium/Substack/domain,
// where the identifier is derivable without a network call. X requires a
// network call (oEmbed) to get the true author, handled separately.
export function resolveByStructure(targetUrl: string): ResolvedIdentity | null {
  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return null
  }

  const hostname = stripWww(parsed.hostname)

  if (X_HOSTS.has(hostname)) {
    return null // must be resolved via oEmbed — see resolveXIdentity
  }

  if (hostname.endsWith('.substack.com')) {
    const subdomain = hostname.replace('.substack.com', '')
    return { platform: 'substack', identifier: `${subdomain}.substack.com` }
  }

  if (hostname === 'medium.com') {
    // medium.com/@handle/... or medium.com/@handle
    const match = parsed.pathname.match(/^\/(@[a-zA-Z0-9_.-]+)/)
    if (match) {
      return { platform: 'medium', identifier: match[1].toLowerCase() }
    }
    return null // publication URL with no @handle in path — can't resolve by structure alone
  }

  // Custom-domain Medium blogs, personal blogs, news sites, etc.
  return { platform: 'domain', identifier: hostname }
}

export function isXUrl(targetUrl: string): boolean {
  try {
    return X_HOSTS.has(stripWww(new URL(targetUrl).hostname))
  } catch {
    return false
  }
}

export interface XOEmbedResult {
  authorHandle: string // canonical, lowercase, no leading @
  text: string          // rendered tweet HTML — used to search for a verification code
  canonicalUrl: string
}

// Resolves an X/Twitter URL to its true author and content via the public
// oEmbed endpoint, regardless of the URL's own shape (desktop, mobile
// share link with no handle, or a spoofed handle in the path — oEmbed
// always returns the real author, never trusts the path).
export async function resolveXPost(targetUrl: string): Promise<XOEmbedResult> {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl)}&omit_script=true`

  const res = await fetch(endpoint, {
    headers: {
      // The oEmbed endpoint returns an empty body without a browser UA
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!res.ok) {
    throw new Error(`Could not resolve X post (status ${res.status}). Check the link is public and correct.`)
  }

  const data = await res.json()
  const authorUrl: string | undefined = data.author_url
  const match = authorUrl?.match(/x\.com\/([a-zA-Z0-9_]+)/) || authorUrl?.match(/twitter\.com\/([a-zA-Z0-9_]+)/)

  if (!match) {
    throw new Error('Could not determine the author of that X post.')
  }

  return {
    authorHandle: match[1].toLowerCase(),
    text: data.html || '',
    canonicalUrl: data.url || targetUrl,
  }
}
