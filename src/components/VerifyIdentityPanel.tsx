'use client'

import { useState, useEffect } from 'react'
import { Check, Copy, ShieldCheck, Loader2 } from 'lucide-react'

type Platform = 'domain' | 'x' | 'medium' | 'substack'

interface Identity {
  platform: Platform
  identifier: string
  proof_url: string
  verified_at: string
}

const PLATFORM_LABEL: Record<Platform, string> = {
  domain: 'Website / Domain',
  x: 'X (Twitter)',
  medium: 'Medium',
  substack: 'Substack',
}

const PLATFORM_INSTRUCTIONS: Record<Platform, (code: string) => string> = {
  domain: (code) =>
    `Add <meta name="citeflow-owner" content="${code}"> to your homepage's <head>, or create a file at /.well-known/citeflow.txt containing just the code. Then paste any URL on your domain below.`,
  x: (code) =>
    `Post a tweet containing exactly "${code}", then paste the link to that post below. Works with any link format, including mobile share links.`,
  medium: (code) =>
    `Add "${code}" to your Medium bio, or publish a post containing it. Then paste your profile (medium.com/@you) or post URL below.`,
  substack: (code) =>
    `Publish a post (or add to your About page) containing "${code}" on your Substack. Then paste that URL below.`,
}

export default function VerifyIdentityPanel() {
  const [code, setCode] = useState<string | null>(null)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [platform, setPlatform] = useState<Platform>('domain')
  const [proofUrl, setProofUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const loadIdentities = () => {
    fetch('/api/creator/verify')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCode(data.verificationCode)
          setIdentities(data.identities || [])
        }
      })
      .catch((e) => console.warn('Failed to load verification status:', e))
      .finally(() => setInitialLoading(false))
  }

  useEffect(() => {
    loadIdentities()
  }, [])

  const handleCopyCode = () => {
    if (!code) return
    navigator.clipboard?.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/creator/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, proofUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      setSuccess(`Verified! You can now register content from ${data.identifier}.`)
      setProofUrl('')
      loadIdentities()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <section className="card-panel p-6 sm:p-8 bg-[var(--color-panel)] border border-[var(--color-border-subtle)] mb-16">
        <div className="flex items-center gap-2 text-[var(--color-faint)] font-mono text-sm">
          <Loader2 size={14} className="animate-spin" /> loading verification status…
        </div>
      </section>
    )
  }

  return (
    <section className="card-panel p-6 sm:p-8 bg-[var(--color-panel)] border border-[var(--color-border-subtle)] mb-16">
      <h2 className="text-xl font-sans font-bold mb-2 text-[var(--color-ink)] flex items-center gap-2">
        <ShieldCheck size={20} className="text-[var(--color-signal-green)]" />
        Verify Ownership
      </h2>
      <p className="text-sm text-[var(--color-soft-ink)] mb-6">
        You can only register content from a domain or platform handle you&apos;ve verified. This prevents anyone from registering your work and collecting your citation payments.
      </p>

      {/* Your verification code */}
      {code && (
        <div className="mb-6 p-4 bg-[var(--color-panel-deep)] border border-[var(--color-border-strong)] rounded-[2px] flex items-center justify-between gap-3 font-mono">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-faint)] mb-1">your verification code</div>
            <div className="text-[var(--color-signal-green)] font-bold text-sm break-all">{code}</div>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-2 hover:text-[var(--color-signal-green)] text-[var(--color-soft-ink)] transition-colors flex-shrink-0"
            title="Copy code"
          >
            {codeCopied ? <Check size={16} className="text-[var(--color-signal-green)]" /> : <Copy size={16} />}
          </button>
        </div>
      )}

      {/* Already verified identities */}
      {identities.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {identities.map((id) => (
            <span
              key={`${id.platform}-${id.identifier}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono bg-[var(--color-signal-green)]/10 border border-[var(--color-signal-green)]/40 text-[var(--color-ink)] px-2.5 py-1 rounded-[2px]"
              title={`Verified ${new Date(id.verified_at).toLocaleDateString()}`}
            >
              <ShieldCheck size={12} className="text-[var(--color-signal-green)]" />
              {PLATFORM_LABEL[id.platform]}: {id.identifier}
            </span>
          ))}
        </div>
      )}

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setPlatform(p); setError(null); setSuccess(null); }}
            className={`text-xs font-mono px-3 py-1.5 rounded-[2px] border transition-colors ${
              platform === p
                ? 'bg-[var(--color-signal-green)] text-[var(--color-paper)] border-[var(--color-signal-green)] font-bold'
                : 'text-[var(--color-soft-ink)] border-[var(--color-border-strong)] hover:text-[var(--color-ink)]'
            }`}
          >
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--color-olive)] mb-4 leading-relaxed">
        {code && PLATFORM_INSTRUCTIONS[platform](code)}
      </p>

      {error && (
        <div className="mb-4 p-3 border border-[var(--color-rust)] text-[var(--color-rust)] bg-[var(--color-rust)]/10 font-mono text-xs rounded-[2px]">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 border border-[var(--color-signal-green)] text-[var(--color-ink)] bg-[var(--color-signal-green)]/10 font-mono text-xs rounded-[2px]">
          {success}
        </div>
      )}

      <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          required
          value={proofUrl}
          onChange={(e) => setProofUrl(e.target.value)}
          placeholder={
            platform === 'domain' ? 'https://your-domain.com' :
            platform === 'x' ? 'https://x.com/you/status/...' :
            platform === 'medium' ? 'https://medium.com/@you/...' :
            'https://you.substack.com/p/...'
          }
          className="input-field flex-1 font-mono text-sm"
          disabled={loading}
        />
        <button type="submit" disabled={loading} className="btn btn-primary whitespace-nowrap">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </section>
  )
}
