'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Copy, LogOut, Check, Trash2 } from 'lucide-react'
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk'
import { useNetwork } from '@/context/NetworkContext'

export default function ResearchWorkspacePage() {
  const { network, networkId, appId } = useNetwork()
  const [query, setQuery] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [viewingHistory, setViewingHistory] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [refund, setRefund] = useState<{ amount_usdc: string; status: string; paid_transaction_id: string | null; transaction_hash: string | null } | null>(null)
  const [refundChecked, setRefundChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<string | null>(null)
  const [userToken, setUserToken] = useState<string | null>(null)
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [sdk, setSdk] = useState<W3SSdk | null>(null)
  type PendingAttempt = {
    sessionId: string
    challengeId: string
    query?: string
    budget?: string
    status?: 'awaiting_funding' | 'funding_pending' | string
  }
  const [pendingAttempt, setPendingAttempt] = useState<PendingAttempt | null>(null)
  const resuming = useRef(false)
  const attemptKey = `citeflow_research_attempt_${networkId}`

  interface HistoryItem {
    id?: string;
    query: string;
    timestamp: string;
    result: any;
  }
  const [history, setHistory] = useState<HistoryItem[]>([])

  const getStored = useCallback((baseKey: string) => {
    if (typeof window === 'undefined') return null;
    const scoped = localStorage.getItem(`${baseKey}_${networkId}`);
    if (scoped) return scoped;
    if (networkId === 'arc-testnet') return localStorage.getItem(baseKey);
    return null;
  }, [networkId]);

  const handleLogout = useCallback(() => {
    setWalletAddress(null)
    setWalletBalance(null)
    setUserToken(null)
    setEncryptionKey(null)
    localStorage.removeItem(`circle_wallet_address_${networkId}`)
    localStorage.removeItem(`circle_user_token_${networkId}`)
    localStorage.removeItem(`circle_encryption_key_${networkId}`)
    if (networkId === 'arc-testnet') {
      localStorage.removeItem('circle_wallet_address')
      localStorage.removeItem('circle_user_token')
      localStorage.removeItem('circle_encryption_key')
    }
    window.dispatchEvent(new Event('wallet_changed'))
  }, [networkId])

  const syncWallet = useCallback(() => {
    setWalletBalance(null)
    setHistory([])
    const savedAddress = getStored('circle_wallet_address')
    const savedToken = getStored('circle_user_token')
    const savedEncKey = getStored('circle_encryption_key')

    setWalletAddress(savedAddress)
    setUserToken(savedToken)
    setEncryptionKey(savedEncKey)

    if (savedToken) {
      fetch(`/api/circle/wallet?network=${networkId}`, {
        headers: { 
          'Authorization': `Bearer ${savedToken}`,
          'x-network': networkId
        }
      })
      .then(res => {
        if (res.ok) return res.json()
        setWalletBalance(null)
        if (res.status === 401 || res.status === 400) {
          handleLogout()
        }
        return null
      })
      .then(data => {
        if (data?.balance) setWalletBalance(data.balance)
      })
      .catch(e => {
        console.warn('Wallet balance fetch failed:', e)
        setWalletBalance(null)
      })

      fetch(`/api/research/history?network=${networkId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.history) setHistory(data.history)
        })
        .catch(e => console.warn('History fetch failed:', e))
    }
  }, [getStored, networkId, handleLogout])

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(null)
      setViewingHistory(false)
      setActiveSessionId(null)
      setRefund(null)
      setRefundChecked(false)
      setProgressLog([])
      setHistory([])
    }, 0)
    return () => clearTimeout(timer)
  }, [networkId])

  useEffect(() => {
    if (!activeSessionId) return
    let cancelled = false
    const checkRefund = async () => {
      try {
        const response = await fetch(`/api/research/refund?sessionId=${activeSessionId}`)
        if (response.ok && !cancelled) {
          setRefund((await response.json()).refund)
          setRefundChecked(true)
        }
      } catch (error) { console.warn('Refund status unavailable', error) }
    }
    void checkRefund()
    const timer = setInterval(checkRefund, 10000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [activeSessionId])

  useEffect(() => {
    const timer = setTimeout(syncWallet, 0)
    window.addEventListener('wallet_changed', syncWallet)
    return () => { clearTimeout(timer); window.removeEventListener('wallet_changed', syncWallet) }
  }, [syncWallet])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSdk(appId ? new W3SSdk({ appSettings: { appId } }) : null)
    }, 0)
    return () => clearTimeout(timer)
  }, [appId])

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

  const resumeResearch = useCallback(async (attempt: PendingAttempt, token: string) => {
    if (resuming.current) return
    resuming.current = true
    setLoading(true)
    setError(null)
    try {
      // Keep checking while the research page is open; Circle may remain SENT
      // longer than one minute even though the transfer is already submitted.
      for (let check = 0; check < 120; check++) {
        const res = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-network': networkId },
          body: JSON.stringify({ ...attempt, userToken: token, network: networkId })
        })
        if (res.status === 202) {
          const pending = await res.json()
          if (check === 0 || check % 12 === 0) {
            setProgressLog(prev => [...prev, pending.message || 'Waiting for payment confirmation...'])
          }
          if (check < 119) await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }
        if (!res.ok) {
          const failure = await res.json().catch(() => ({}))
          const terminal = res.status === 409 && /already completed|is refunded/i.test(failure.error || '')
          if (res.status === 402 || terminal) {
            localStorage.removeItem(attemptKey)
            setPendingAttempt(null)
          }
          if (terminal) {
            const historyRes = await fetch(`/api/research/history?network=${networkId}`)
            if (historyRes.ok) setHistory((await historyRes.json()).history || [])
          }
          throw new Error(failure.error || 'Could not resume payment')
        }
        if (!res.body) throw new Error('No research response body')
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
            const data = JSON.parse(line)
            if (data.type === 'progress') setProgressLog(prev => [...prev, data.payload])
            if (data.type === 'error') setError(data.payload)
            if (data.type === 'done') {
              setResult(data.payload.result)
              setViewingHistory(false)
              setActiveSessionId(data.payload.sessionId)
              setRefundChecked(false)
              localStorage.removeItem(attemptKey)
              setPendingAttempt(null)
              const historyRes = await fetch(`/api/research/history?network=${networkId}`)
              if (historyRes.ok) setHistory((await historyRes.json()).history || [])
            }
          }
        }
        return
      }
      setError('Payment is still pending. Your attempt is saved; use Check payment later. Do not pay again.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not check payment')
    } finally {
      setLoading(false)
      resuming.current = false
    }
  }, [attemptKey, networkId])

  const executePaymentChallenge = useCallback(async (challengeId: string, token: string, key: string) => {
    if (!sdk) throw new Error('Circle payment window is not ready. Refresh and try again.')
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const deadline = setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('Payment authorization timed out. Your attempt is saved; check it before trying again.'))
        }
      }, 5 * 60 * 1000)

      try {
        sdk.setAuthentication({ userToken: token, encryptionKey: key })
        sdk.execute(challengeId, (err) => {
          if (settled) return
          if (err) {
            if ((err as { code?: number }).code === 155706) {
              setProgressLog(prev => [...prev, 'Secure payment window is taking longer than usual to load...'])
              return
            }
            settled = true
            clearTimeout(deadline)
            reject(new Error(err.message || 'Payment authorization failed'))
            return
          }
          settled = true
          clearTimeout(deadline)
          resolve()
        })
      } catch (error) {
        settled = true
        clearTimeout(deadline)
        reject(error)
      }
    })
  }, [sdk])

  const explainPaymentError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Payment authorization failed'
    if (/invalid encryption key/i.test(message)) {
      handleLogout()
      return 'Your Circle wallet security session expired. Reconnect the wallet, then authorize the saved payment. No payment was made and you must not create a second attempt.'
    }
    return message
  }, [handleLogout])

  const authorizePendingPayment = useCallback(async () => {
    if (!pendingAttempt || !userToken || !encryptionKey) {
      setError('Reconnect your wallet before authorizing the saved payment.')
      return
    }
    setLoading(true)
    setError(null)
    setProgressLog(prev => [...prev, 'Opening PIN authorization for the saved payment...'])
    try {
      await executePaymentChallenge(pendingAttempt.challengeId, userToken, encryptionKey)
      const submittedAttempt = { ...pendingAttempt, status: 'funding_pending' }
      localStorage.setItem(attemptKey, JSON.stringify(submittedAttempt))
      setPendingAttempt(submittedAttempt)
      setProgressLog(prev => [...prev, 'Payment authorized; checking on-chain confirmation...'])
      await resumeResearch(submittedAttempt, userToken)
    } catch (error) {
      setError(explainPaymentError(error))
    } finally {
      setLoading(false)
    }
  }, [attemptKey, encryptionKey, executePaymentChallenge, explainPaymentError, pendingAttempt, resumeResearch, userToken])

  useEffect(() => {
    if (!userToken) return
    const stored = localStorage.getItem(attemptKey)
    const restore = async () => {
      try {
        let attempt = stored ? JSON.parse(stored) : null
        const response = await fetch(`/api/research/pending?network=${networkId}`)
        if (response.ok) {
          // The database is authoritative and also restores the saved question
          // and budget for attempts created by older local code.
          attempt = (await response.json()).attempt
        }
        if (!attempt) { localStorage.removeItem(attemptKey); setPendingAttempt(null); return }
        if (typeof attempt.sessionId !== 'string' || typeof attempt.challengeId !== 'string') throw new Error('invalid attempt')
        if (typeof attempt.query === 'string') setQuery(attempt.query)
        if (typeof attempt.budget === 'string') setMaxBudget(attempt.budget)
        localStorage.setItem(attemptKey, JSON.stringify(attempt))
        setPendingAttempt(attempt)
        // A newly created challenge may still need its PIN authorization.
        // Do not enter a long confirmation poll until it has been submitted.
        if (attempt.status !== 'awaiting_funding') void resumeResearch(attempt, userToken)
      } catch { localStorage.removeItem(attemptKey) }
    }
    void restore()
  }, [attemptKey, networkId, userToken, resumeResearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pendingAttempt) { setError('Check the saved payment before starting another one.'); return }
    setLoading(true)
    setError(null)
    setResult(null)
    setViewingHistory(false)
    setProgressLog([])

    try {
      if (!userToken || !walletAddress || !encryptionKey || !sdk) {
        throw new Error('Wallet not fully connected. Please disconnect and reconnect.');
      }

      setProgressLog(prev => [...prev, 'Initiating Pay-Per-Prompt transfer...'])
      
      const paymentRes = await fetch('/api/circle/payment/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-network': networkId 
        },
        body: JSON.stringify({ 
          userToken, 
          walletAddress: walletAddress, 
          amount: maxBudget,
          query,
          network: networkId 
        })
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

      const { challengeId, sessionId } = await paymentRes.json()
      const attempt: PendingAttempt = { challengeId, sessionId, query, budget: maxBudget, status: 'awaiting_funding' }
      localStorage.setItem(attemptKey, JSON.stringify(attempt))
      setPendingAttempt(attempt)

      setProgressLog(prev => [...prev, 'Awaiting PIN authorization for upfront payment...'])

      // Promisify the SDK execution
      await new Promise<void>((resolve, reject) => {
        let settled = false
        // Our own overall deadline — generous, since the user may take a while to enter their PIN
        const deadline = setTimeout(() => {
          if (!settled) {
            settled = true
            reject(new Error('Payment authorization timed out. Please try again.'))
          }
        }, 5 * 60 * 1000)

        sdk.setAuthentication({ userToken, encryptionKey })
        sdk.execute(challengeId, (err, result) => {
          if (settled) return
          if (err) {
            // The SDK fires a spurious "Network error" (155706) 10s after launch if its
            // secure iframe is slow to load. The challenge is still live and the PIN
            // prompt will still appear, so keep waiting instead of aborting.
            if ((err as { code?: number }).code === 155706) {
              setProgressLog(prev => [...prev, 'Secure payment window is taking longer than usual to load...'])
              return
            }
            settled = true
            clearTimeout(deadline)
            reject(new Error(err.message || 'Payment authorization failed'))
          } else {
            settled = true
            clearTimeout(deadline)
            resolve()
          }
        })
      })

      setProgressLog(prev => [...prev, 'Payment authorized; checking on-chain confirmation...'])
      const submittedAttempt = { ...attempt, status: 'funding_pending' }
      localStorage.setItem(attemptKey, JSON.stringify(submittedAttempt))
      setPendingAttempt(submittedAttempt)
      await resumeResearch(submittedAttempt, userToken)

    } catch (err: any) {
      setError(explainPaymentError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col pt-12 pb-24 content-container max-w-[1100px] mx-auto">
      <div className="mb-10">
        <div className="font-mono text-xs text-[var(--color-faint)] mb-3">
          <span className="text-[var(--color-signal-green)] font-bold">~/citeflow</span> $ ask --grounded --pay-per-citation
        </div>
        <h1 className="font-mono font-semibold text-3xl md:text-4xl mb-4 text-[var(--color-ink)] tracking-tight">
          Research that <span className="text-[var(--color-signal-green)]">pays its sources</span>.
        </h1>
        <p className="text-base text-[var(--color-soft-ink)] max-w-2xl leading-relaxed">
          The agent reads the registered corpus, grounds every claim, and streams USDC micro-settlements to the authors it cites. Receipts for everything.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-12">
        <div className={`flex flex-col md:flex-row bg-[var(--color-panel-deep)] border border-[var(--color-border-strong)] focus-within:border-[var(--color-signal-green)] focus-within:shadow-[0_0_0_1px_var(--color-signal-green),0_0_30px_var(--green-glow)] transition-all rounded-[2px]`}>
          <div className="hidden md:flex items-center pl-4 font-mono font-bold text-[var(--color-signal-green)]" aria-hidden="true">❯</div>
          <input
            id="query"
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="what do you want to know?"
            className="flex-1 bg-transparent border-0 outline-none px-4 py-4 font-mono text-sm text-[var(--color-ink)] placeholder:text-[var(--color-faint)]"
            disabled={loading || !!pendingAttempt}
          />
          <div className="flex items-center gap-1 border-t md:border-t-0 md:border-l border-[var(--color-border-subtle)] px-4 py-2 md:py-0 font-mono text-sm text-[var(--color-soft-ink)]">
            <span>$</span>
            <input
              id="budget"
              type="number"
              required
              min="0.01"
              step="0.01"
              max="100"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder="0.50"
              className="w-16 bg-transparent border-0 outline-none font-mono text-[var(--color-ink)] placeholder:text-[var(--color-faint)]"
              disabled={loading || !!pendingAttempt}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !walletAddress || !!pendingAttempt}
            className="font-mono font-bold text-sm bg-[var(--color-signal-green)] text-[var(--color-paper)] px-8 py-4 md:py-0 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all cursor-pointer"
          >
            {loading ? 'RUNNING…' : 'EXECUTE'}
          </button>
        </div>
        {!walletAddress && (
          <div className="mt-3 font-mono text-xs text-[var(--color-amber)]">
            ⚠ wallet not connected — connect to execute queries
          </div>
        )}
        {pendingAttempt && (
          <div className="mt-3 font-mono text-xs text-[var(--color-amber)]">
            A payment attempt is saved. Do not pay again.
            <button type="button" className="ml-2 underline" disabled={loading || !userToken}
              onClick={() => userToken && void resumeResearch(pendingAttempt, userToken)}>Check payment</button>
            {pendingAttempt.status === 'awaiting_funding' && (
              <button type="button" className="ml-2 underline" disabled={loading || !userToken || !encryptionKey}
                onClick={() => void authorizePendingPayment()}>Authorize payment</button>
            )}
          </div>
        )}
      </form>

      {history.length > 0 && !result && !loading && (
        <div className="mb-12 card-panel">
          <div className="panel-h">recent research <span className="ml-auto text-[var(--color-faint)]">{history.length} sessions</span></div>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {history.map((item, idx) => (
              <div key={item.id || idx} className="relative group w-full text-left p-4 hover:bg-[var(--color-panel-deep)] transition-colors flex items-center justify-between">
                <button
                  onClick={() => {
                    setQuery(item.query);
                    setResult(item.result);
                    setViewingHistory(true);
                    setActiveSessionId(item.id || null);
                    setRefund(null);
                    setRefundChecked(false);
                  }}
                  className="flex-1 flex flex-col gap-1 text-left outline-none pr-4 cursor-pointer"
                >
                  <div className="font-mono text-sm text-[var(--color-ink)] truncate max-w-[200px] sm:max-w-xs md:max-w-lg">{item.query}</div>
                  <div className="text-xs text-[var(--color-faint)] font-mono">{new Date(item.timestamp).toLocaleString()}</div>
                </button>
                {item.id && (
                  <button
                    onClick={(e) => handleDeleteHistory(item.id!, e)}
                    className="p-2 text-[var(--color-rust)] hover:bg-[var(--color-rust)]/10 rounded transition-colors opacity-60 hover:opacity-100"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}



      {error && (
        <div className="mb-8 p-4 border border-[var(--color-rust)] text-[var(--color-rust)] bg-[var(--color-rust)]/10 font-mono text-sm rounded-[2px]">
          ✗ ERROR: {error}
        </div>
      )}

      {/* Streaming Agent Timeline */}
      {progressLog.length > 0 && !result && (
        <div className="mb-12 card-panel font-mono text-sm">
          <div className="panel-h">
            <span className="glow-dot"></span>
            live execution
            <span className="ml-auto text-[var(--color-faint)]">streaming</span>
          </div>
          <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto text-[0.8rem] leading-relaxed">
            {progressLog.map((log, index) => {
              const isSettle = /settled|refunded|authorized successfully/i.test(log)
              const isFail = /failed|warning|error/i.test(log)
              return (
                <div key={index} className="flex gap-4">
                  <span className="text-[var(--color-faint)] select-none flex-shrink-0">{String(index + 1).padStart(3, '0')}</span>
                  <span className={isSettle ? 'text-[var(--color-signal-green)]' : isFail ? 'text-[var(--color-rust)]' : 'text-[var(--color-soft-ink)]'}>
                    {isSettle ? '✓ ' : isFail ? '✗ ' : ''}{log}
                  </span>
                </div>
              )
            })}
            <div className="flex gap-4">
              <span className="text-[var(--color-faint)] select-none">{String(progressLog.length + 1).padStart(3, '0')}</span>
              <span className="cursor-blink"></span>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-8">
          {viewingHistory && (
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setViewingHistory(false)
                setActiveSessionId(null)
                setRefund(null)
                setRefundChecked(false)
                setProgressLog([])
                setError(null)
              }}
              className="inline-flex items-center gap-2 font-mono text-sm text-[var(--color-soft-ink)] hover:text-[var(--color-signal-green)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to research history
            </button>
          )}
          <section className="card-panel">
            <div className="panel-h">
              grounded answer
              <span className="ml-auto text-[var(--color-faint)]">{result.purchasedSources.length} cited source{result.purchasedSources.length === 1 ? '' : 's'}</span>
            </div>
            <div className="p-6 sm:p-8 text-[var(--color-ink)] leading-[1.85] text-base whitespace-pre-wrap max-w-[75ch]">
              {result.answer}
            </div>
          </section>

          <section className="card-panel">
            <div className="panel-h">
              financial ledger
              <span className="ml-auto text-[var(--color-faint)]">{network.name.toLowerCase()} · usdc</span>
            </div>
            {refund && (
              <div className="p-5 border-b border-[var(--color-border-subtle)] font-mono text-sm text-[var(--color-soft-ink)]">
                Refund: {refund.amount_usdc} USDC — {refund.status === 'paid' ? 'CONFIRMED ON-CHAIN' : refund.status === 'submitted' ? 'SUBMITTED — AWAITING CONFIRMATION' : refund.status.toUpperCase()}
                {refund.paid_transaction_id && <div className="break-all">Circle ID: {refund.paid_transaction_id}</div>}
                {refund.transaction_hash && <div className="break-all">On-chain hash: {refund.transaction_hash}</div>}
              </div>
            )}
            {refundChecked && !refund && (
              <div className="p-5 border-b border-[var(--color-border-subtle)] font-mono text-sm text-[var(--color-soft-ink)]">
                Refund: 0.00 USDC — FULL BUDGET SPENT ON CITATIONS
              </div>
            )}
            <div>
              {result.purchasedSources.length === 0 ? (
                <p className="font-mono text-sm text-[var(--color-soft-ink)] p-6">No citation payouts. Any refund is queued and shown as paid only after on-chain confirmation.</p>
              ) : (
                result.purchasedSources.map((source: any, i: number) => (
                  <div key={i} className="border-b border-[var(--color-border-subtle)] last:border-0 p-5 font-mono text-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="min-w-0">
                      <div className="font-sans font-semibold text-[var(--color-ink)] mb-1 truncate max-w-md text-base">{source.title}</div>
                      <div className="text-xs text-[var(--color-faint)] truncate max-w-md">{source.url}</div>
                    </div>
                    <div className="text-left md:text-right flex-shrink-0">
                      <div className="mb-2"><span className="tag">{source.paymentStatus === 'free' ? 'FREE SOURCE' : source.paymentStatus === 'confirmed' ? 'CONFIRMED' : source.paymentStatus === 'submitted' ? 'SUBMITTED — PENDING CONFIRMATION' : 'LEGACY CITATION'}</span></div>
                      {source.paymentStatus ? <>
                        <div className="text-xs text-[var(--color-soft-ink)] break-all max-w-xs mb-1">
                          <span className="text-[var(--color-faint)]">Circle ID</span> {source.receipt?.transactionId || 'pending'}
                        </div>
                        <div className="text-xs text-[var(--color-soft-ink)] break-all max-w-xs">
                          <span className="text-[var(--color-faint)]">On-chain hash</span> {source.receipt?.txHash || 'pending'}
                        </div>
                      </> : <div className="text-xs text-[var(--color-faint)] max-w-xs">Created before payment receipts were stored.</div>}
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
