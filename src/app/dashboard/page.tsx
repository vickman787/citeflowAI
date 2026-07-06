import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import CopyButton from '@/components/CopyButton'
import { Trash } from 'lucide-react'


async function updateSourcePrice(formData: FormData) {
  'use server'
  const sourceId = formData.get('source_id') as string
  const newPrice = formData.get('price') as string
  if (!sourceId || !newPrice) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  
  if (!creator) return

  await supabase
    .from('sources')
    .update({ price_usdc: parseFloat(newPrice) })
    .eq('id', sourceId)
    .eq('creator_id', creator.id)

  revalidatePath('/dashboard')
}

async function deleteSource(formData: FormData) {
  'use server'
  const sourceId = formData.get('source_id') as string
  if (!sourceId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  
  if (!creator) return

  // Delete associated vector chunks first
  await supabase
    .from('source_chunks')
    .delete()
    .eq('source_id', sourceId)

  // Update the source status to deleted instead of actually deleting the row
  // This prevents foreign key constraint errors if the source has past payment authorizations
  await supabase
    .from('sources')
    .update({ status: 'deleted' })
    .eq('id', sourceId)
    .eq('creator_id', creator.id)

  revalidatePath('/dashboard')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center pt-24 pb-24 content-container text-center h-[70vh]">
        <div className="w-20 h-20 mb-6 text-[var(--color-olive)] flex items-center justify-center border-2 border-dashed border-[var(--color-olive)] rounded-full mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[var(--color-ink)] mb-4">Dashboard Locked</h1>
        <p className="text-lg text-[var(--color-soft-ink)] max-w-md mx-auto mb-8">
          Please connect your Circle Wallet using the button in the top navigation bar to view your creator dashboard and track your Arc Testnet earnings.
        </p>
      </div>
    )
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', user.id)
    .single()

  // Fetch creator profile & sources
  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sources: any[] = []
  let totalEarnings = 0

  if (creator) {
    const { data } = await supabase
      .from('sources')
      .select(`
        id, url, title, price_usdc, status, created_at,
        payment_authorizations(amount_usdc, status)
      `)
      .eq('creator_id', creator.id)
      
    if (data) {
      // Calculate earnings across ALL sources (including deleted ones)
      data.forEach(s => {
        const settledAuths = s.payment_authorizations?.filter((pa: any) => pa.status === 'settled') || []
        settledAuths.forEach((pa: any) => {
          totalEarnings += parseFloat(pa.amount_usdc) * 0.80
        })
      })

      // Only show active sources in the table
      sources = data.filter(s => s.status !== 'deleted')
      sources.forEach(s => {
        const settledAuths = s.payment_authorizations?.filter((pa: any) => pa.status === 'settled') || []
        s.payment_count = settledAuths.length
      })
    }
  }

  const walletAddress = profile?.wallet_address || ''
  


  return (
    <div className="flex-1 flex flex-col pt-12 content-container pb-24">
      <header className="mb-12 border-b border-[var(--color-border-subtle)] pb-6">
        <h1 className="text-4xl font-serif font-bold text-[var(--color-ink)] mb-3">Dashboard</h1>
        <p className="text-[var(--color-soft-ink)]">Manage your identity and track your Arc Testnet earnings.</p>
      </header>

      <div className="mb-16">
        {/* Account Summary */}
        <section className="card-panel p-6 sm:p-8 flex flex-col justify-between bg-white border border-[var(--color-border-subtle)]">
          <div>
            <h2 className="text-xl font-sans font-bold mb-6 text-[var(--color-ink)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-signal-green)] animate-pulse shadow-[0_0_8px_var(--color-signal-green)]"></span>
              Active Wallet connected
            </h2>
            <div className="space-y-4 mb-8">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-[var(--color-border-subtle)] pb-3 gap-2">
                <span className="text-sm font-medium text-[var(--color-soft-ink)] shrink-0">Wallet Address</span>
                <span className="font-mono text-xs sm:text-sm text-[var(--color-ink)] font-medium break-all sm:text-right">
                  {walletAddress || 'Not Configured'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-[var(--color-border-subtle)] pb-3 gap-2">
                <span className="text-sm font-medium text-[var(--color-soft-ink)]">Network</span>
                <span className="font-mono text-xs text-[var(--color-ink)] bg-[var(--color-signal-green)] px-2 py-1 w-fit">Arc Testnet</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-soft-ink)] mb-2">Total Platform Earnings</p>
            <p className="text-4xl font-mono font-bold text-[var(--color-ink)]">
              {totalEarnings.toFixed(2)} USDC
            </p>
            <p className="text-xs text-[var(--color-olive)] mt-2">These are your cumulative lifetime earnings from citations.</p>
          </div>
        </section>
      </div>

      <section>
        <h2 className="text-2xl font-sans font-bold mb-6 text-[var(--color-ink)]">Registered Sources</h2>
        <div className="card-panel table-container">
          <table className="data-table responsive-table">
            <thead>
              <tr className="bg-[var(--color-paper)]">
                <th>Title & URL</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-right">Citations Paid</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-[var(--color-olive)] font-mono text-sm">
                    No sources registered yet.
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sources.map((s: any) => (
                  <tr key={s.id} className="hover:bg-[var(--color-paper)] transition-colors">
                    <td data-label="Title & URL" className="align-top">
                      <div className="font-medium text-[var(--color-ink)] truncate max-w-[200px] sm:max-w-[300px]" title={s.title}>
                        {s.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-[var(--color-olive)] truncate max-w-[180px] sm:max-w-[280px]" title={s.url}>
                          {s.url}
                        </div>
                        <CopyButton text={s.url} title="Copy Article URL" />
                      </div>
                    </td>
                    <td data-label="Price" className="align-top">
                      <form action={updateSourcePrice} className="flex items-start gap-2">
                        <input type="hidden" name="source_id" value={s.id} />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm text-[var(--color-ink)] font-bold">$</span>
                            <input 
                              type="number" 
                              name="price" 
                              step="0.01" 
                              min="0" 
                              defaultValue={parseFloat(s.price_usdc).toFixed(2)}
                              className="w-16 px-1 py-0.5 border border-[var(--color-border-subtle)] rounded bg-[var(--color-paper)] font-mono text-sm font-bold focus:outline-none focus:border-[var(--color-ink)]"
                            />
                            <span className="font-mono text-sm text-[var(--color-ink)] font-bold">USDC</span>
                          </div>

                        </div>
                        <button type="submit" className="text-[10px] uppercase tracking-wider font-bold bg-[var(--color-ink)] text-[var(--color-paper)] px-2 py-1 rounded hover:opacity-80 transition-opacity">
                          Update
                        </button>
                      </form>
                      <form action={deleteSource} className="mt-3">
                        <input type="hidden" name="source_id" value={s.id} />
                        <button type="submit" className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-rust)] hover:bg-[var(--color-rust)]/10 px-2 py-1 rounded transition-colors flex items-center gap-1 w-fit">
                          <Trash size={12} /> Delete
                        </button>
                      </form>
                    </td>
                    <td data-label="Status" className="align-top">
                      <span className={`inline-block px-2 py-1 text-xs font-mono font-medium ${s.status === 'extracted' ? 'bg-[var(--color-signal-green)]/20 text-[var(--color-ink)]' : 'bg-black/5 text-[var(--color-soft-ink)]'}`}>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td data-label="Paid" className="align-top text-right font-mono font-bold text-[var(--color-ink)]">
                      {s.payment_count || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
