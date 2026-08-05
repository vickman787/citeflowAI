import { safeFetch } from '@/lib/net/safe-fetch'

// Resolves any URL to the (platform, identifier) pair that owns it.
// Used both when a creator verifies an identity and when registration checks
// a target URL against that creator's verified identities. The identifier is
// always derived from the canonical source (oEmbed author, URL structure),
// never trusted blindly from user input.

export type Platform = 'domain' | 'x' | 'medium' | 'substack' | 'arc'

export interface ResolvedIdentity {
  platform: Platform
  identifier: string
}

const X_HOSTS = new Set(['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'])
const ARC_HOSTS = new Set(['community.arc.io'])

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

  if (ARC_HOSTS.has(hostname)) {
    return null // must be resolved via the post page — see resolveArcPost
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

export function isArcUrl(targetUrl: string): boolean {
  try {
    return ARC_HOSTS.has(stripWww(new URL(targetUrl).hostname))
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

export interface ArcPostResult {
  authorId: string    // the author's nanoId, e.g. "sv98lohp0c"
  authorName: string  // display name, for UI only — never used as the identity
  title: string
  text: string        // full post body, flattened to plain text
  canonicalUrl: string
}

// Arc House (community.arc.io) runs on Gradual. Public forum posts expose the
// data we need in two places, and we deliberately read each from the one that
// is actually trustworthy for it:
//
//   - AUTHOR from the schema.org DiscussionForumPosting JSON-LD. It is emitted
//     for SEO, so it is the closest thing to a stable public contract, and it
//     carries the canonical profile URL regardless of what the post URL claims.
//   - BODY from __NEXT_DATA__. This is an internal Next.js structure and may
//     change shape without notice, but there is no alternative: the JSON-LD
//     articleBody/text fields are truncated at ~250 characters, so a
//     verification code near the end of a long post is simply not in them.
//
// Member profiles, bios and comments are all behind auth on this platform, so a
// published post is the only public surface a creator can prove authorship with.
export async function resolveArcPost(targetUrl: string): Promise<ArcPostResult> {
  const res = await safeFetch(targetUrl)
  if (!res.ok) {
    throw new Error(
      `Could not fetch that Arc House post (status ${res.status}). Make sure it is published in a public board, not a gated board or private club.`
    )
  }
  const html = await res.text()

  const posting = extractForumPosting(html)
  const meta = extractForumPostMeta(html)

  // nanoId is the trailing segment of the profile slug (".../home/users/biig-classic-sv98lohp0c").
  // We key the identity on it rather than the whole slug because the slug embeds
  // the display name, and a rename would otherwise orphan a verified identity.
  const slug = posting?.author?.url?.match(/\/home\/users\/([A-Za-z0-9-]+)/)?.[1]
  const fromSlug = slug?.split('-').pop()?.toLowerCase()
  const authorId = fromSlug && /^[a-z0-9]{6,16}$/.test(fromSlug) ? fromSlug : meta?.author?.nanoId

  if (!authorId) {
    throw new Error('Could not determine who wrote that Arc House post. Check the link points to a public forum post.')
  }

  const text = meta?.content ? flattenRichText(meta.content) : ''
  if (!text) {
    throw new Error('Could not read the body of that Arc House post. It may be empty, or Arc House may have changed its page format.')
  }

  return {
    authorId,
    authorName: posting?.author?.name || meta?.author?.displayName || 'Unknown',
    title: posting?.headline || meta?.title || 'Untitled',
    text,
    canonicalUrl: stripQuery(targetUrl),
  }
}

interface ForumPosting {
  headline?: string
  author?: { name?: string; url?: string }
}

interface ForumPostMeta {
  title?: string
  content?: string
  author?: { nanoId?: string; displayName?: string }
}

function extractForumPosting(html: string): ForumPosting | null {
  const blocks = html.match(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g) || []
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    try {
      const parsed = JSON.parse(json)
      if (parsed?.['@type'] === 'DiscussionForumPosting') return parsed
    } catch {
      // a malformed block shouldn't stop us checking the others
    }
  }
  return null
}

function extractForumPostMeta(html: string): ForumPostMeta | null {
  // The script tag carries a CSP nonce, so the attribute list can't be matched literally.
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1])?.props?.pageProps?.forumPostMeta ?? null
  } catch {
    return null
  }
}

// Post bodies are stored as a serialized rich-text document (a tree of block
// nodes whose leaves hold the text). Flatten it to plain text, keeping blocks
// separated so the registration pipeline chunks on real paragraph boundaries.
function flattenRichText(raw: string): string {
  let nodes: unknown
  try {
    nodes = JSON.parse(raw)
  } catch {
    return ''
  }
  if (!Array.isArray(nodes)) return ''

  const leaves = (node: any, out: string[] = []): string[] => {
    if (Array.isArray(node)) {
      node.forEach((child) => leaves(child, out))
    } else if (node && typeof node === 'object') {
      if (typeof node.text === 'string') out.push(node.text)
      if (Array.isArray(node.children)) leaves(node.children, out)
    }
    return out
  }

  return nodes
    .map((block) => leaves(block).join('').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

function stripQuery(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return targetUrl
  }
}
