import { createClient } from '@/utils/supabase/server'

export default async function TreasuryPage() {
  const supabase = await createClient()

  // Get current date string in YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0]

  // Fetch or initialize treasury limits
  const { data: limitData } = await supabase
    .from('treasury_limits')
    .select('*')
    .eq('date', today)
    .single()

  const dailyLimit = 100.00
  const spent = limitData ? parseFloat(limitData.spent_usdc) : 0.00
  const remaining = dailyLimit - spent
  const percentage = (spent / dailyLimit) * 100

  return (
    <div className="flex-1 flex flex-col pt-12 px-8 max-w-4xl mx-auto w-full">
      <div className="mb-12 border-b border-thin-line pb-8">
        <h1 className="text-4xl font-serif mb-4">Agent Treasury</h1>
        <p className="text-lg opacity-80 font-mono">
          Live monitoring of the AI Agent's global Arc Testnet spending limits.
        </p>
      </div>

      <div className="bg-white border border-thin-line p-8 shadow-sm mb-12">
        <h2 className="text-xs font-mono uppercase tracking-widest opacity-60 mb-8">Daily Global Budget ({today})</h2>
        
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end mb-8">
          <div>
            <div className="text-5xl font-mono text-deep-ink font-bold">${spent.toFixed(2)}</div>
            <div className="text-sm font-mono opacity-60 mt-2 uppercase tracking-widest">Total Spent Today</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono text-signal-green font-bold">${remaining.toFixed(2)}</div>
            <div className="text-sm font-mono opacity-60 mt-2 uppercase tracking-widest">Remaining Limit</div>
          </div>
        </div>

        <div className="w-full h-4 bg-warm-paper border border-thin-line relative overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-deep-ink transition-all duration-1000"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 font-mono text-xs opacity-60">
          <span>$0.00</span>
          <span>${dailyLimit.toFixed(2)} LIMIT</span>
        </div>
      </div>

      <div className="bg-deep-ink text-warm-paper p-6 font-mono text-sm">
        <div className="flex items-center gap-3 mb-4 border-b border-warm-paper/30 pb-2">
          <div className="w-2 h-2 rounded-full bg-signal-green animate-pulse"></div>
          <span>TREASURY STATUS: OPERATIONAL</span>
        </div>
        <div className="opacity-80 leading-relaxed">
          The Agent Treasury operates as a server-side Externally Owned Account (EOA) on the Arc Testnet. 
          It autonomously issues EIP-3009 signed authorizations to acquire intellectual property licences 
          during research synthesis, bounded strictly by the defined risk limits above.
        </div>
      </div>
    </div>
  )
}
