import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getNetworkStats } from '@/lib/stats'
import LiveLedger from '@/components/LiveLedger'
import type { NetworkId } from '@/lib/network'

export default async function LandingPage() {
  const cookieStore = await cookies()
  const networkCookie = cookieStore.get('citeflow_network')?.value as NetworkId | undefined
  const isMainnet = networkCookie === 'arc-mainnet'
  const supabase = await createClient()

  let recentPayments: any[] = []
  let totalPaidCitations = 0

  if (isMainnet) {
    const [payRes, countRes] = await Promise.all([
      supabase
        .from('payment_authorizations')
        .select(`
          authorization_id,
          amount_usdc,
          created_at,
          sources (
            title
          )
        `)
        .eq('status', 'settled')
        .eq('network', 'arc-mainnet')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('payment_authorizations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'settled')
        .eq('network', 'arc-mainnet'),
    ])
    recentPayments = payRes.data || []
    totalPaidCitations = countRes.count || 0
  } else {
    const [payRes, countRes] = await Promise.all([
      supabase
        .from('payment_authorizations')
        .select(`
          authorization_id,
          amount_usdc,
          created_at,
          sources (
            title
          )
        `)
        .eq('status', 'settled')
        .eq('network', 'arc-testnet')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('payment_authorizations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'settled')
        .eq('network', 'arc-testnet'),
    ])
    recentPayments = payRes.data || []
    totalPaidCitations = countRes.count || 0
  }

  // Network stats from the ledger
  const { answersServed, paidToCreators, avgAnswerCost, registeredSources } = await getNetworkStats(networkCookie)

  const initialData = {
    recentPayments,
    totalPaidCitations,
    answersServed: answersServed || 0,
    paidToCreators: paidToCreators || 0,
    avgAnswerCost: avgAnswerCost || 0,
    registeredSources: registeredSources || 0,
  }

  return (
    <div className="flex-1 flex flex-col pt-12 md:pt-24 section-spacing content-container">
      <LiveLedger initialData={initialData}>
        {/* Left: Hero copy */}
        <section className="flex flex-col max-w-[620px]">
          <div className="font-mono text-xs text-[var(--color-faint)] mb-4">
            <span className="text-[var(--color-signal-green)] font-bold">~/citeflow</span> $ init --pay-per-citation
          </div>
          <h1 className="font-mono font-semibold text-3xl md:text-4xl lg:text-[2.6rem] leading-[1.15] tracking-tight mb-5 text-[var(--color-ink)]">
            Every citation <span className="text-[var(--color-signal-green)]">pays its author</span>.
          </h1>
          <p className="text-base md:text-lg font-sans text-[var(--color-soft-ink)] mb-9 leading-relaxed">
            Ask a question, watch the agent read the registered corpus, and see USDC land in creators&apos; wallets the moment their work gets cited. No subscriptions, no scraping — just receipts.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/research"
              className="btn btn-primary"
            >
              Start researching
            </Link>
            <Link
              href="/register-article"
              className="btn btn-secondary"
            >
              Register your work
            </Link>
          </div>
        </section>
      </LiveLedger>
    </div>
  )
}
