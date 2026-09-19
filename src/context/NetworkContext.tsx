"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { NetworkConfig, NetworkId, NETWORKS, DEFAULT_NETWORK_ID, getNetworkConfig } from '@/lib/network';

interface NetworkContextType {
  network: NetworkConfig;
  networkId: NetworkId;
  setNetwork: (id: NetworkId) => void;
  appId: string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const STORAGE_KEY = 'citeflow_network';

export function NetworkProvider({
  children,
  initialNetworkId,
}: {
  children: React.ReactNode;
  initialNetworkId?: NetworkId;
}) {
  const [networkId, setNetworkIdState] = useState<NetworkId>(() => {
    if (initialNetworkId && initialNetworkId in NETWORKS) {
      return initialNetworkId;
    }
    return DEFAULT_NETWORK_ID;
  });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as NetworkId | null;
      if (saved && saved in NETWORKS) {
        setNetworkIdState(saved);
        document.cookie = `${STORAGE_KEY}=${saved}; path=/; max-age=31536000; SameSite=Lax`;
      } else if (initialNetworkId && initialNetworkId in NETWORKS) {
        localStorage.setItem(STORAGE_KEY, initialNetworkId);
      }
    } catch (e) {
      console.warn('Could not read network from localStorage:', e);
    }
    setIsInitialized(true);
  }, [initialNetworkId]);

  const setNetwork = (id: NetworkId) => {
    if (id === networkId) return;
    setNetworkIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      document.cookie = `${STORAGE_KEY}=${id}; path=/; max-age=31536000; SameSite=Lax`;
      // Dispatch event so other components / tabs synchronize immediately
      window.dispatchEvent(new CustomEvent('network_changed', { detail: { networkId: id } }));
    } catch (e) {
      console.warn('Could not persist network to localStorage:', e);
    }
  };

  const network = useMemo(() => getNetworkConfig(networkId), [networkId]);

  const appId = useMemo(() => {
    if (networkId === 'arc-mainnet') {
      return (
        process.env.NEXT_PUBLIC_CIRCLE_APP_ID_MAINNET ||
        process.env.NEXT_PUBLIC_CIRCLE_APP_ID ||
        ''
      );
    }
    return process.env.NEXT_PUBLIC_CIRCLE_APP_ID || '';
  }, [networkId]);

  return (
    <NetworkContext.Provider value={{ network, networkId, setNetwork, appId }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      network: NETWORKS[DEFAULT_NETWORK_ID],
      networkId: DEFAULT_NETWORK_ID,
      setNetwork: () => {},
      appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID || '',
    };
  }
  return context;
}
