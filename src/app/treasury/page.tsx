'use client';

import React, { useEffect, useState } from 'react';
import { useNetwork } from '@/context/NetworkContext';
import { createClient } from '@/utils/supabase/client';

export default function TreasuryPage() {
  const { network, networkId } = useNetwork();
  const isMainnet = networkId === 'arc-mainnet';
  const today = new Date().toISOString().split('T')[0];

  const [spent, setSpent] = useState<number>(0);
  const dailyLimit = 100.00;

  useEffect(() => {
    let isCancelled = false;

    async function loadLimits() {
      if (isMainnet) {
        // Mainnet starts fresh with clean slate
        setSpent(0);
        return;
      }

      try {
        const supabase = createClient();
        const { data: limitData } = await supabase
          .from('treasury_limits')
          .select('*')
          .eq('date', today)
          .single();

        if (!isCancelled && limitData) {
          setSpent(parseFloat(limitData.spent_usdc) || 0);
        }
      } catch (e) {
        console.warn('Failed to load treasury limits:', e);
      }
    }

    loadLimits();

    return () => {
      isCancelled = true;
    };
  }, [networkId, isMainnet, today]);

  const remaining = Math.max(0, dailyLimit - spent);
  const percentage = (spent / dailyLimit) * 100;

  return (
    <div className="flex-1 flex flex-col pt-12 px-8 max-w-4xl mx-auto w-full">
      <div className="mb-12 border-b border-[var(--color-border-subtle)] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif mb-4 text-[var(--color-ink)]">Agent Treasury</h1>
          <p className="text-lg opacity-80 font-mono text-[var(--color-soft-ink)]">
            Live monitoring of the AI Agent&apos;s global {network.name} spending limits.
          </p>
        </div>
        <span
          className={`font-mono text-xs px-3 py-1.5 rounded-[2px] border flex items-center gap-1.5 w-fit ${
            isMainnet
              ? 'text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
              : 'text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${
              isMainnet ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          {network.name} (Chain ID: {network.chainId})
        </span>
      </div>

      <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] p-8 mb-12 shadow-sm">
        <h2 className="text-xs font-mono uppercase tracking-widest opacity-60 mb-8">
          Daily Global Budget ({today})
        </h2>

        <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end mb-8">
          <div>
            <div className="text-5xl font-mono text-[var(--color-ink)] font-bold">
              ${spent.toFixed(2)}
            </div>
            <div className="text-sm font-mono opacity-60 mt-2 uppercase tracking-widest">
              Total Spent Today
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono text-[var(--color-signal-green)] font-bold">
              ${remaining.toFixed(2)}
            </div>
            <div className="text-sm font-mono opacity-60 mt-2 uppercase tracking-widest">
              Remaining Limit
            </div>
          </div>
        </div>

        <div className="w-full h-4 bg-[var(--color-paper)] border border-[var(--color-border-subtle)] relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-[var(--color-signal-green)] transition-all duration-1000"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 font-mono text-xs opacity-60">
          <span>$0.00</span>
          <span>${dailyLimit.toFixed(2)} LIMIT</span>
        </div>
      </div>

      <div className="bg-[var(--color-panel-deep)] text-[var(--color-ink)] border border-[var(--color-border-subtle)] p-6 font-mono text-sm">
        <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-border-subtle)] pb-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-signal-green)] animate-pulse"></div>
          <span className="font-bold">TREASURY STATUS: OPERATIONAL</span>
        </div>
        <div className="opacity-80 leading-relaxed">
          The Agent Treasury operates as a server-side Developer-Controlled Wallet on{' '}
          <strong>{network.name}</strong> (Chain ID: {network.chainId}). It autonomously executes USDC
          settlements to acquire intellectual property licences during research synthesis, bounded
          strictly by the defined risk limits above.
        </div>
      </div>
    </div>
  );
}
