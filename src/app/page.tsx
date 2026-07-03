import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

// Simple time formatter
function timeAgo(dateString: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function LandingPage() {
  const supabase = await createClient()

  // Fetch the latest 3 settled payments to display real network activity
  const { data: recentPayments } = await supabase
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
    .order('created_at', { ascending: false })
    .limit(3)

  const { count: totalPaidCitations } = await supabase
    .from('payment_authorizations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'settled')

  const hasLiveActivity = recentPayments && recentPayments.length > 0

  return (
    <div className="flex-1 flex flex-col pt-12 md:pt-24 section-spacing content-container">
      <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-16 lg:gap-8 w-full">
        
        {/* Left: Editorial Copy */}
        <section className="flex flex-col max-w-[620px]">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold leading-[1.1] mb-6 text-[var(--color-ink)]">
            Sources deserve<br />a share.
          </h1>
          <p className="text-lg md:text-xl font-sans text-[var(--color-soft-ink)] mb-10 leading-relaxed">
            CiteFlowAI is an editorial research terminal powered by autonomous AI. When the agent uses your registered work to synthesize an answer, you receive instant nanopayments on the Arc Testnet.
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

        {/* Right: Structural Ledger Representation */}
        <section className="w-full lg:max-w-[480px] lg:ml-auto">
          <div className="card-panel shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[var(--color-ink)] text-[var(--color-paper)] p-4 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
              <span className="font-sans font-medium text-sm">Live Citations {totalPaidCitations ? `(${totalPaidCitations})` : ''}</span>
              <span className="font-mono text-xs text-[var(--color-signal-green)] bg-[var(--color-signal-green)]/10 px-2 py-1 rounded">Arc Testnet</span>
            </div>
            <div className="flex flex-col divide-y divide-[var(--color-border-subtle)] bg-white">
              {hasLiveActivity ? (
                recentPayments.map((payment: any, index: number) => (
                  <div key={payment.authorization_id} className={`p-4 flex items-start justify-between ${index === 2 ? 'opacity-60' : ''}`}>
                    <div className="overflow-hidden pr-4">
                      <p className="font-sans font-medium text-sm text-[var(--color-ink)] mb-1 truncate" title={payment.sources?.title || 'Unknown Source'}>
                        {payment.sources?.title || 'Unknown Source'}
                      </p>
                      <p className="font-mono text-xs text-[var(--color-olive)] truncate">
                        Tx: {payment.authorization_id.substring(0, 10)}...
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-medium text-sm text-[var(--color-ink)]">
                        +{(parseFloat(payment.amount_usdc) * 0.80).toFixed(2)} USDC
                      </p>
                      <p className="font-sans text-xs text-[var(--color-soft-ink)]">
                        {timeAgo(payment.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--color-olive)] font-mono text-sm">
                  Waiting for first network transaction...
                </div>
              )}
            </div>
            <div className="bg-[var(--color-paper)] p-3 text-center border-t border-[var(--color-border-subtle)]">
              <span className="font-mono text-xs text-[var(--color-olive)] uppercase tracking-wider">
                {hasLiveActivity ? 'Live Network Activity' : 'Simulated Network Activity'}
              </span>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
