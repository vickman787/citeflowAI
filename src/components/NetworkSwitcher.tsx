"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useNetwork } from '@/context/NetworkContext';
import { NETWORKS, NetworkId } from '@/lib/network';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, Check } from 'lucide-react';

export default function NetworkSwitcher() {
  const { networkId, setNetwork } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const switchNetwork = async (id: NetworkId) => {
    if (id === networkId || switching) return;
    setSwitching(true);
    setSwitchError(null);

    try {
      const token = localStorage.getItem(`circle_user_token_${id}`) ||
        (id === 'arc-testnet' ? localStorage.getItem('circle_user_token') : null);
      const savedAddress = localStorage.getItem(`circle_wallet_address_${id}`) ||
        (id === 'arc-testnet' ? localStorage.getItem('circle_wallet_address') : null);

      if (token) {
        const response = await fetch('/api/circle/wallet-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-network': id },
          body: JSON.stringify({ userToken: token, network: id }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.walletAddress ||
            (savedAddress && result.walletAddress.toLowerCase() !== savedAddress.toLowerCase())) {
          const { error } = await createClient().auth.signOut();
          if (error) throw error;
          setSwitchError(`Reconnect your ${NETWORKS[id].name} wallet to view its articles.`);
        } else {
          localStorage.setItem(`circle_wallet_address_${id}`, result.walletAddress);
        }
      } else {
        // A session from the previous network must not own the next dashboard.
        const { error } = await createClient().auth.signOut();
        if (error) throw error;
        setSwitchError(`Connect your ${NETWORKS[id].name} wallet to view its articles.`);
      }

      setNetwork(id);
      setIsOpen(false);
      // Reload after the wallet cookie changes so server-rendered account data
      // and verification state both belong to the selected network.
      window.location.reload();
    } catch (error) {
      console.error('Network switch failed:', error);
      setIsOpen(false);
      setSwitchError('Could not switch wallets. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const current = NETWORKS[networkId];

  return (
    <div className="relative font-mono" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={switching}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 text-xs text-[var(--color-ink)] bg-[var(--color-panel-deep)] px-3 py-2 border border-[var(--color-border-strong)] rounded-[2px] hover:border-[var(--color-signal-green)] transition-all cursor-pointer whitespace-nowrap"
      >
        <span
          className={`w-2 h-2 rounded-full animate-pulse ${
            current.isMainnet ? 'bg-[var(--color-signal-green)] shadow-[0_0_8px_var(--color-signal-green)]' : 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
          }`}
        />
        <span className="font-semibold tracking-tight">{current.name}</span>
        <ChevronDown
          size={13}
          className={`text-[var(--color-faint)] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {switchError && <p role="alert" className="absolute right-0 top-full z-50 mt-1 w-60 bg-[var(--color-panel)] p-2 text-xs text-[var(--color-rust)] border border-[var(--color-border-strong)]">{switchError}</p>}

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] w-60 bg-[var(--color-panel)] border border-[var(--color-border-strong)] rounded-[2px] shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-50 overflow-hidden text-xs"
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-panel-deep)]/50">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-faint)]">
              Select Network
            </span>
          </div>

          {(Object.keys(NETWORKS) as NetworkId[]).map((id) => {
            const net = NETWORKS[id];
            const isSelected = id === networkId;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => void switchNetwork(id)}
                disabled={switching}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors border-b border-[var(--color-border-subtle)] last:border-b-0 ${
                  isSelected
                    ? 'bg-[var(--color-panel-deep)] text-[var(--color-signal-green)] font-semibold'
                    : 'text-[var(--color-soft-ink)] hover:text-[var(--color-ink)] hover:bg-[var(--color-panel-deep)]/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      net.isMainnet ? 'bg-[var(--color-signal-green)]' : 'bg-amber-400'
                    }`}
                  />
                  <div>
                    <div className="text-xs">{net.name}</div>
                    <div className="text-[0.62rem] text-[var(--color-faint)]">
                      Chain ID: {net.chainId} {net.isMainnet && '· Live'}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={14} className="text-[var(--color-signal-green)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
