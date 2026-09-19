'use client';

import React from 'react';
import { useNetwork } from '@/context/NetworkContext';

export default function DashboardNetworkBadge() {
  const { network } = useNetwork();
  return (
    <span
      className={`font-mono text-xs px-2 py-1 rounded-[2px] w-fit font-bold ${
        network.isMainnet
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'bg-[var(--color-signal-green)] text-[var(--color-paper)]'
      }`}
    >
      {network.name}
    </span>
  );
}
