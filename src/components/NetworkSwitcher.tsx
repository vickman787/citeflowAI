"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useNetwork } from '@/context/NetworkContext';
import { NETWORKS, NetworkId } from '@/lib/network';
import { ChevronDown, Check } from 'lucide-react';

export default function NetworkSwitcher() {
  const { networkId, setNetwork } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
                onClick={() => {
                  setNetwork(id);
                  setIsOpen(false);
                }}
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
