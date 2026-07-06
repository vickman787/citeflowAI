'use client'

import { useState, useEffect } from 'react'
import { Copy, LogOut, Check, Trash2 } from 'lucide-react'
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk'

export default function ResearchWorkspacePage() {
  const [query, setQuery] = useState('')
  const [maxBudget, setMaxBudget] = useState('0.50')
  const [loading, setLoading] = useState(false)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<string | null>(null)
  const [userToken, setUserToken] = useState<string | null>(null)
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [sdk, setSdk] = useState<W3SSdk | null>(null)

  interface HistoryItem {
    id?: string;
    query: string;
    timestamp: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
  }
  const [history, setHistory] = useState<HistoryItem[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('circle_wallet_address')
    const savedToken = localStorage.getItem('circle_user_token')
    const savedEncKey = localStorage.getItem('circle_encryption_key')

    if (savedAddress) setWalletAddress(savedAddress)
    if (savedToken) setUserToken(savedToken)
    if (savedEncKey) setEncryptionKey(savedEncKey)

    if (savedToken) {
      fetch('/api/circle/wallet', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject('Failed'))
      .then(data => {
        if (data.balance) setWalletBalance(data.balance)
      })
      .catch(console.error)

      fetch('/api/research/history')
        .then(res => res.ok ? res.json() : Promise.reject('Failed'))
        .then(data => {
          if (data.history) setHistory(data.history)
        })
        .catch(console.error)
    }

    if (!sdk) {
      const circleSdk = new W3SSdk({
        appSettings: { appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID as string }
      })
      setSdk(circleSdk)
    }
  }, [sdk])

  const handleCopy = () => {
    if (walletAddress) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(walletAddress)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = walletAddress
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
        } catch (err) {
          console.error('Copy failed', err)
        }
        document.body.removeChild(textArea)
      }
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleLogout = () => {
    setWalletAddress(null)
    setWalletBalance(null)
    setUserToken(null)
    setEncryptionKey(null)
    localStorage.removeItem('circle_wallet_address')
    localStorage.removeItem('circle_user_token')
    localStorage.removeItem('circle_encryption_key')
    window.dispatchEvent(new Event('wallet_changed'))
  }

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/research/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete history", err);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    setProgressLog([])

    try {
      if (!userToken || !walletAddress || !encryptionKey || !sdk) {
        throw new Error('Wallet not fully connected. Please disconnect and reconnect.');
      }

      setProgressLog(prev => [...prev, 'Initiating Pay-Per-Prompt transfer...'])
      
      const paymentRes = await fetch('/api/circle/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken, walletAddress: walletAddress, amount: maxBudget })
      })

      if (!paymentRes.ok) {
        const errText = await paymentRes.text()
        let parsedErrMsg = errText;
        try {
          parsedErrMsg = JSON.parse(errText).error || errText;
        } catch {}
        
        if (parsedErrMsg.includes("Wallet not found")) {
          handleLogout();
          throw new Error("Your wallet session expired or was reset. Please click 'Connect Wallet' to reconnect.");
        }
        throw new Error(parsedErrMsg || 'Payment challenge failed');
      }

      const { challengeId } = await paymentRes.json()
      
      setProgressLog(prev => [...prev, 'Awaiting PIN authorization for upfront payment...'])

      // Promisify the SDK execution
      await new Promise<void>((resolve, reject) => {
        sdk.setAuthentication({ userToken, encryptionKey })
        sdk.execute(challengeId, (err, result) => {
          if (err) {
            reject(new Error(err.message || 'Payment authorization failed'))
          } else {
            resolve()
          }
        })
      })

      setProgressLog(prev => [...prev, 'Payment authorized successfully!', 'Booting autonomous AI agent...'])

      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxBudget: parseFloat(maxBudget), walletAddress })
      })

      if (!res.ok) {
        const errText = await res.text()
        let parsedErrMsg = errText;
        try {
          parsedErrMsg = JSON.parse(errText).error || errText;
        } catch {}
        throw new Error(parsedErrMsg || 'API Request Failed');
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            if (data.type === 'progress') {
              setProgressLog(prev => [...prev, data.payload])
            } else if (data.type === 'done') {
              const finalResult = data.payload.result;
              setResult(finalResult)
              setHistory(prev => {
                const newHistory = [{
                  query: query,
                  timestamp: new Date().toISOString(),
                  result: finalResult
                }, ...prev].slice(0, 20);
                return newHistory;
              });
            } else if (data.type === 'error') {
              setError(data.payload)
            }
          } catch (e) {
            console.error('Failed to parse stream chunk', e)
          }
        }
      }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col pt-12 pb-24 content-container">
      <div className="mb-12 md:text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-[var(--color-ink)]">Research Workspace</h1>
        <p className="text-lg text-[var(--color-soft-ink)] max-w-2xl mx-auto">
          Query the network. The AI agent will search registered articles, evaluate relevance, and execute Arc Testnet nanopayments for citations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-12 card-panel p-6 sm:p-8 bg-[var(--color-paper)]">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="query" className="label-text">
              Research Query
            </label>
            <input
              id="query"
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are the latest advancements in zero-knowledge proofs?"
              className="input-field"
              disabled={loading}
            />
          </div>

          <div className="w-full md:w-48">
            <label htmlFor="budget" className="label-text">
              Max Budget
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[var(--color-soft-ink)]">$</span>
              <input
                id="budget"
                type="number"
                required
                min="0.01"
                step="0.01"
                max="100"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                className="input-field font-mono"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button
              type="submit"
              disabled={loading || !walletAddress}
              className="btn btn-primary w-full"
            >
              {loading ? 'Executing...' : 'Ask AI'}
            </button>
          </div>
        </div>
      </form>

      {history.length > 0 && !result && !loading && (
        <div className="mb-12 card-panel p-6 sm:p-8 bg-white">
          <h2 className="text-xl font-serif font-bold mb-4 text-[var(--color-ink)] border-b border-[var(--color-border-subtle)] pb-2">Recent Research</h2>
          <div className="space-y-4">
            {history.map((item, idx) => (
              <div key={item.id || idx} className="relative group w-full text-left p-4 border border-[var(--color-border-subtle)] hover:border-[var(--color-ink)] transition-colors rounded bg-[var(--color-paper)] flex items-center justify-between">
                <button 
                  onClick={() => {
                    setQuery(item.query);
                    setResult(item.result);
                  }}
                  className="flex-1 flex flex-col gap-1 text-left outline-none pr-4"
                >
                  <div className="font-bold text-[var(--color-ink)] truncate max-w-[200px] sm:max-w-xs md:max-w-sm">{item.query}</div>
                  <div className="text-xs text-[var(--color-soft-ink)] font-mono">{new Date(item.timestamp).toLocaleString()}</div>
                </button>
                {item.id && (
                  <button 
                    onClick={(e) => handleDeleteHistory(item.id!, e)}
                    className="p-2 text-[var(--color-rust)] hover:bg-[var(--color-rust)]/10 rounded transition-colors opacity-60 hover:opacity-100"
                    title="Delete session"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}



      {error && (
        <div className="mb-8 p-4 border border-[var(--color-rust)] text-[var(--color-rust)] bg-[var(--color-rust)]/5 font-mono text-sm rounded">
          ERROR: {error}
        </div>
      )}

      {/* Streaming Agent Timeline */}
      {progressLog.length > 0 && !result && (
        <div className="mb-12 card-panel p-6 font-mono text-sm text-[var(--color-ink)] bg-white">
          <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-border-subtle)] pb-4">
            <div className="w-2 h-2 rounded-full bg-[var(--color-signal-green)]"></div>
            <span className="font-bold tracking-widest uppercase text-xs">Agent Terminal // Live Execution</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto font-normal pb-2">
            {progressLog.map((log, index) => (
              <div key={index} className="flex gap-4">
                <span className="text-[var(--color-olive)] select-none">[{String(index + 1).padStart(3, '0')}]</span>
                <span>{log}</span>
              </div>
            ))}
            <div className="flex gap-4">
              <span className="text-[var(--color-olive)] select-none">[{String(progressLog.length + 1).padStart(3, '0')}]</span>
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-8">
          <section className="card-panel p-6 sm:p-10 bg-white">
            <h2 className="text-2xl font-serif font-bold mb-6 border-b border-[var(--color-border-subtle)] pb-4 text-[var(--color-ink)]">
              Grounded Answer
            </h2>
            <div className="text-[var(--color-ink)] leading-relaxed text-lg font-sans whitespace-pre-wrap">
              {result.answer}
            </div>
          </section>

          <section className="card-panel p-6 sm:p-10 bg-[var(--color-paper)]">
            <h2 className="text-xl font-serif font-bold mb-6 border-b border-[var(--color-border-subtle)] pb-4 text-[var(--color-ink)]">
              Financial Ledger: Citation Payments
            </h2>
            <div className="space-y-4">
              {result.purchasedSources.length === 0 ? (
                <p className="font-mono text-sm text-[var(--color-olive)]">No paid sources were required for this answer.</p>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                result.purchasedSources.map((source: any, i: number) => (
                  <div key={i} className="bg-white border border-[var(--color-border-subtle)] p-5 rounded font-mono text-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div>
                      <div className="font-bold text-[var(--color-ink)] mb-1 truncate max-w-md text-base font-sans">{source.title}</div>
                      <div className="text-xs text-[var(--color-olive)] truncate max-w-md">{source.url}</div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-[var(--color-ink)] font-bold bg-[var(--color-signal-green)] px-3 py-1.5 text-xs tracking-widest inline-block mb-2">
                        PAYMENT SETTLED
                      </div>
                      <div className="text-xs text-[var(--color-soft-ink)] break-all max-w-xs mb-1">
                        <span className="text-[var(--color-olive)]">Auth:</span> {source.receipt?.payload?.split(':')[1] || 'Unknown'}
                      </div>
                      <div className="text-xs text-[var(--color-soft-ink)] break-all max-w-xs">
                        <span className="text-[var(--color-olive)]">Batch:</span> {source.receipt?.gatewaySettlementId || 'Unknown'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
