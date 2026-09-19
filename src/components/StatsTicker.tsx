"use client";

import { useEffect, useState } from 'react'
import type { NetworkStats } from '@/lib/stats'
import { useNetwork } from '@/context/NetworkContext'
import type { NetworkId } from '@/lib/network'

// Terminal ticker tape — scrolls live ledger stats across the top of every page.
// Pure CSS animation; the track is rendered twice for a seamless loop.
export default function StatsTicker({ stats }: { stats: NetworkStats }) {
  const { network, networkId } = useNetwork();
  const [data, setData] = useState<{ networkId: NetworkId; stats: NetworkStats } | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchStats() {
      try {
        const res = await fetch(`/api/stats?network=${networkId}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled) {
            setData({
              networkId,
              stats: {
                answersServed: json.answersServed || 0,
                paidToCreators: json.paidToCreators || 0,
                avgAnswerCost: json.avgAnswerCost || 0,
                registeredSources: json.registeredSources || 0,
              },
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch ticker stats:', err);
      }
    }

    fetchStats();

    return () => {
      isCancelled = true;
    };
  }, [networkId]);

  // If we already fetched stats for this network, use them.
  // Otherwise, guard: Mainnet must NEVER show testnet SSR data (fallback to 0s),
  // while Testnet can safely display the SSR stats.
  const effectiveStats: NetworkStats = data && data.networkId === networkId
    ? data.stats
    : network.isMainnet
      ? { answersServed: 0, paidToCreators: 0, avgAnswerCost: 0, registeredSources: 0 }
      : stats;

  const items = [
    <span key="net" className="flex items-center gap-2">
      <span className="glow-dot"></span>
      <span className="text-[var(--color-signal-green)]">{network.badge} · LIVE</span>
    </span>,
    <span key="ans">ANSWERS SERVED: <b className="text-[var(--color-ink)]">{effectiveStats.answersServed.toLocaleString('en-US')}</b></span>,
    <span key="paid">PAID TO CREATORS: <b className="text-[var(--color-signal-green)]">${effectiveStats.paidToCreators.toFixed(2)} USDC</b></span>,
    <span key="avg">AVG ANSWER COST: <b className="text-[var(--color-ink)]">${effectiveStats.avgAnswerCost.toFixed(2)}</b></span>,
    <span key="src">REGISTERED SOURCES: <b className="text-[var(--color-ink)]">{effectiveStats.registeredSources.toLocaleString('en-US')}</b></span>,
    <span key="ppp">PAY-PER-PROMPT · NO SUBSCRIPTIONS</span>,
    <span key="w3s">CIRCLE W3S · USDC SETTLEMENTS</span>,
  ]

  const half = (keyPrefix: string) => (
    <div className="flex items-center flex-shrink-0" aria-hidden={keyPrefix === 'b'}>
      {items.map((item, i) => (
        <span key={`${keyPrefix}${i}`} className="flex items-center">
          <span className="px-5 flex items-center gap-2">{item}</span>
          <span className="text-[var(--color-faint)]">✦</span>
        </span>
      ))}
    </div>
  )

  return (
    <div className="ticker-wrap w-full border-b border-[var(--color-border-subtle)] font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--color-soft-ink)] py-2">
      <div className="ticker-track">
        {half('a')}
        {half('b')}
      </div>
    </div>
  )
}
