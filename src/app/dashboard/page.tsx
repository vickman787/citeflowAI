import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import CopyButton from '@/components/CopyButton'
import { Trash } from 'lucide-react'

async function updateWalletAddress(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const walletAddress = formData.get('wallet_address') as string

  // Update profile directly
  await supabase
    .from('profiles')
    .update({ wallet_address: walletAddress })
    .eq('id', user.id)

  revalidatePath('/dashboard')
}

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
    .from('document_chunks')
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
    redirect('/login')
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
      .neq('status', 'deleted')
      
    if (data) {
      sources = data
      sources.forEach(s => {
        // Filter for settled payments
        const settledAuths = s.payment_authorizations?.filter((pa: any) => pa.status === 'settled') || []
        
        // Attach count to the object for the UI to use
        s.payment_count = settledAuths.length
        
        // Sum historical earnings with 20% fee applied
        settledAuths.forEach((pa: any) => {
          totalEarnings += parseFloat(pa.amount_usdc) * 0.80
        })
      })
    }
  }

  const walletAddress = profile?.wallet_address || ''
  
  // Helper to visually shorten wallet addresses
  const shortenWallet = (address: string) => {
    if (!address || address.length < 10) return "Not Configured"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="flex-1 flex flex-col pt-12 content-container pb-24">
      <header className="mb-12 border-b border-[var(--color-border-subtle)] pb-6">
        <h1 className="text-4xl font-serif font-bold text-[var(--color-ink)] mb-3">Dashboard</h1>
        <p className="text-[var(--color-soft-ink)]">Manage your identity and track your Arc Testnet earnings.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-8 mb-16">
        
        {/* Left: Payment Config */}
        <section className="card-panel p-6 sm:p-8">
          <h2 className="text-xl font-sans font-bold mb-6 text-[var(--color-ink)]">Payment Configuration</h2>
          <form action={updateWalletAddress} className="space-y-6">
            <div>
              <label htmlFor="wallet_address" className="label-text">
                Arc Testnet Wallet Address
              </label>
              <input
                id="wallet_address"
                name="wallet_address"
                type="text"
                defaultValue={walletAddress}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                required
                className="input-field font-mono text-sm"
              />
              <p className="mt-2 text-xs text-[var(--color-olive)]">
                The AI agent will authorize nanopayments to this address.
              </p>
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full sm:w-auto"
            >
              Save Configuration
            </button>
          </form>
        </section>

        {/* Right: Wallet & Earnings Summary */}
        <section className="card-panel p-6 sm:p-8 flex flex-col justify-between bg-[var(--color-paper)]">
          <div>
            <h2 className="text-xl font-sans font-bold mb-6 text-[var(--color-ink)]">Account Summary</h2>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center border-b border-[var(--color-border-subtle)] pb-3">
                <span className="text-sm font-medium text-[var(--color-soft-ink)]">Active Wallet</span>
                <span className="font-mono text-sm text-[var(--color-ink)] font-medium">
                  {shortenWallet(walletAddress)}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--color-border-subtle)] pb-3">
                <span className="text-sm font-medium text-[var(--color-soft-ink)]">Network</span>
                <span className="font-mono text-xs text-[var(--color-ink)] bg-[var(--color-signal-green)] px-2 py-1">Arc Testnet</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-soft-ink)] mb-2">Total Earnings</p>
            <p className="text-4xl font-mono font-bold text-[var(--color-ink)]">
              {totalEarnings.toFixed(2)} USDC
            </p>
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
