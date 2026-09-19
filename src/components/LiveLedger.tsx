"use client";

import React, { useEffect, useState } from 'react';
import { useNetwork } from '@/context/NetworkContext';
import StatCounter from '@/components/StatCounter';

function timeAgo(dateString: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export interface LedgerStatsData {
  recentPayments: any[];
  totalPaidCitations: number;
  answersServed: number;
  paidToCreators: number;
  avgAnswerCost: number;
  registeredSources: number;
}

interface LiveLedgerProps {
  initialData: LedgerStatsData;
  children: React.ReactNode;
}

export default function LiveLedger({ initialData, children }: LiveLedgerProps) {
  const { network, networkId } = useNetwork();
  const [data, setData] = useState<{ networkId: typeof networkId; data: LedgerStatsData } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchStats() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stats?network=${networkId}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled) {
            setData({
              networkId,
              data: {
                recentPayments: json.recentPayments || [],
                totalPaidCitations: json.totalPaidCitations || 0,
                answersServed: json.answersServed || 0,
                paidToCreators: json.paidToCreators || 0,
                avgAnswerCost: json.avgAnswerCost || 0,
                registeredSources: json.registeredSources || 0,
              },
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch network stats:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchStats();

    return () => {
      isCancelled = true;
    };
  }, [networkId]);

  const isMainnet = network.isMainnet;
  const effectiveData: LedgerStatsData = data && data.networkId === networkId
    ? data.data
    : isMainnet
      ? {
          recentPayments: [],
          totalPaidCitations: 0,
          answersServed: 0,
          paidToCreators: 0,
          avgAnswerCost: 0,
          registeredSources: 0,
        }
      : initialData;

  const hasLiveActivity = effectiveData.recentPayments && effectiveData.recentPayments.length > 0;

  return (
    <>
      <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-16 lg:gap-8 w-full">
        {children}

        {/* Right: Structural Ledger Representation */}
        <section className="w-full lg:max-w-[480px] lg:ml-auto">
          <div className="card-panel shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[var(--color-panel-deep)] text-[var(--color-ink)] p-4 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
              <span className="font-mono font-medium text-sm">
                Live Citations {effectiveData.totalPaidCitations ? `(${effectiveData.totalPaidCitations})` : '(0)'}
              </span>
              <span
                className={`font-mono text-xs px-2 py-1 rounded-[2px] border flex items-center gap-1.5 ${
                  network.isMainnet
                    ? 'text-[var(--color-signal-green)] border-[var(--color-signal-green)]/40 bg-[var(--color-signal-green)]/10'
                    : 'text-amber-400 border-amber-400/40 bg-amber-400/10'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    network.isMainnet ? 'bg-[var(--color-signal-green)]' : 'bg-amber-400'
                  }`}
                />
                {network.name}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-[var(--color-border-subtle)] bg-[var(--color-panel)] min-h-[190px] justify-center">
              {hasLiveActivity ? (
                effectiveData.recentPayments.map((payment: any, index: number) => (
                  <div
                    key={payment.authorization_id || index}
                    className={`p-4 flex items-start justify-between ${index === 2 ? 'opacity-60' : ''}`}
                  >
                    <div className="overflow-hidden pr-4">
                      <p
                        className="font-sans font-medium text-sm text-[var(--color-ink)] mb-1 truncate"
                        title={payment.sources?.title || 'Unknown Source'}
                      >
                        {payment.sources?.title || 'Unknown Source'}
                      </p>
                      <p className="font-mono text-xs text-[var(--color-olive)] truncate">
                        Tx: {payment.authorization_id ? `${payment.authorization_id.substring(0, 12)}...` : 'pending'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-medium text-sm text-[var(--color-ink)]">
                        +{(parseFloat(payment.amount_usdc) * 0.80).toFixed(2)} USDC
                      </p>
                      <p className="font-sans text-xs text-[var(--color-soft-ink)]">
                        {payment.created_at ? timeAgo(payment.created_at) : 'Just now'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--color-olive)] font-mono text-xs leading-relaxed">
                  Waiting for first network transaction on {network.name}...
                </div>
              )}
            </div>

            <div className="bg-[var(--color-paper)] p-3 text-center border-t border-[var(--color-border-subtle)]">
              <span className="font-mono text-xs text-[var(--color-olive)] uppercase tracking-wider">
                {hasLiveActivity ? 'Live Network Activity' : 'Network Activity Ready'}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Network stats — live from the ledger */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-16 md:mt-24 w-full">
        <div className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded-[2px] p-5">
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-faint)]">
            Answers served
          </div>
          <div className="font-mono font-bold text-2xl md:text-3xl mt-2 text-[var(--color-ink)]">
            <StatCounter value={effectiveData.answersServed} />
          </div>
        </div>
        <div className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded-[2px] p-5">
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-faint)]">
            Paid to creators
          </div>
          <div className="font-mono font-bold text-2xl md:text-3xl mt-2 text-[var(--color-signal-green)]">
            <StatCounter value={effectiveData.paidToCreators} prefix="$" decimals={2} />
          </div>
        </div>
        <div className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded-[2px] p-5">
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-faint)]">
            Avg answer cost
          </div>
          <div className="font-mono font-bold text-2xl md:text-3xl mt-2 text-[var(--color-ink)]">
            <StatCounter value={effectiveData.avgAnswerCost} prefix="$" decimals={2} />
          </div>
        </div>
        <div className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded-[2px] p-5">
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-faint)]">
            Registered sources
          </div>
          <div className="font-mono font-bold text-2xl md:text-3xl mt-2 text-[var(--color-ink)]">
            <StatCounter value={effectiveData.registeredSources} />
          </div>
        </div>
      </div>
    </>
  );
}
