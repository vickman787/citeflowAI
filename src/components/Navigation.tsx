"use client"

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, LogIn, LogOut, Copy, Check, Droplet, Send } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import logoImage from "../../public/logo.jpg";
import SendModal from "./SendModal";
import WalletModal from "./WalletModal";

export function Navigation({ initialUser }: { initialUser?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(initialUser || null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const supabase = createClient();

  // Sync prop changes from layout
  useEffect(() => {
    setUser(initialUser || null);
    
    // Automatically restore backend session if frontend has a wallet token but backend has no user
    const token = localStorage.getItem('circle_user_token');
    if (!initialUser && token) {
      fetch('/api/circle/wallet-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken: token }),
      })
      .then(res => {
        if (res.ok) {
          // Force a full reload to get the new session from the server
          window.location.reload();
        } else {
          // Token is invalid/expired, log out locally
          localStorage.removeItem('circle_wallet_address');
          localStorage.removeItem('circle_user_token');
          localStorage.removeItem('circle_encryption_key');
          window.dispatchEvent(new Event('wallet_changed'));
        }
      })
      .catch(console.error);
    }
  }, [initialUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    const fetchBalance = async (token: string) => {
      try {
        const res = await fetch('/api/circle/wallet', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.balance) setWalletBalance(data.balance)
        }
      } catch(e) {
        console.error(e)
      }
    }

    const initWallet = () => {
      setWalletAddress(localStorage.getItem('circle_wallet_address'));
      const token = localStorage.getItem('circle_user_token');
      if (token) fetchBalance(token); else setWalletBalance(null);
    }

    initWallet();
    
    const handleStorage = () => initWallet();
    const handleCustom = () => initWallet();
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('wallet_changed', handleCustom);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('wallet_changed', handleCustom);
    };
  }, [supabase]);

  const handleLogout = async () => {
    handleWalletLogout();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleWalletLogout = () => {
    setWalletAddress(null);
    setWalletBalance(null);
    localStorage.removeItem('circle_wallet_address');
    localStorage.removeItem('circle_user_token');
    localStorage.removeItem('circle_encryption_key');
    window.dispatchEvent(new Event('wallet_changed'));
  };

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
  };

  const navLinks = [
    { href: "/research", label: "Agent" },
    { href: "/register-article", label: "Register Work" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/docs", label: "Docs" },
  ];

  return (
    <nav className="w-full bg-paper border-b border-[var(--color-border-subtle)] sticky top-0 z-50">
      <div className="content-container h-16 flex items-center justify-between gap-4 xl:gap-8">
        
        {/* Logo and Wordmark */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <Image 
            src={logoImage} 
            alt="CiteFlowAI Logo" 
            width={32} 
            height={32} 
            className="rounded" 
            style={{ objectFit: 'contain' }}
            priority
          />
          <span className="font-sans font-bold text-xl tracking-tight text-ink">CiteFlowAI</span>
        </Link>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6 flex-shrink-0">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className="text-sm font-sans font-medium text-soft-ink hover:text-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
          
          <div className="h-6 w-px bg-[var(--color-border-subtle)]"></div>
          
          {walletAddress ? (
            <div className="hidden lg:flex items-center gap-3 text-sm text-[var(--color-olive)] font-mono bg-white px-3 py-1.5 border border-[var(--color-border-subtle)] rounded shadow-sm whitespace-nowrap flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-signal-green)] animate-pulse shadow-[0_0_8px_var(--color-signal-green)]"></span>
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </div>
              {walletBalance && (
                <>
                  <div className="w-px h-4 bg-[var(--color-border-subtle)]"></div>
                  <div className="font-bold text-[var(--color-ink)]">${Number(walletBalance).toFixed(2)} USDC</div>
                </>
              )}
              <div className="w-px h-4 bg-[var(--color-border-subtle)]"></div>
              <div className="flex items-center gap-1 text-[var(--color-soft-ink)]">
                <button 
                  type="button"
                  onClick={handleCopy}
                  className="p-1 hover:text-[var(--color-ink)] transition-colors"
                  title="Copy Address"
                >
                  {isCopied ? <Check size={14} className="text-[var(--color-signal-green)]" /> : <Copy size={14} />}
                </button>
                <a 
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:text-blue-500 transition-colors"
                  title="Get Testnet USDC from Circle Faucet"
                >
                  <Droplet size={14} />
                </a>
                <button 
                  type="button"
                  onClick={() => setIsSendModalOpen(true)}
                  className="p-1 hover:text-[var(--color-ink)] transition-colors"
                  title="Send USDC"
                >
                  <Send size={14} />
                </button>
                <button 
                  type="button"
                  onClick={handleLogout}
                  className="p-1 hover:text-[var(--color-rust)] transition-colors"
                  title="Logout Wallet"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsWalletModalOpen(true)}
              className="flex items-center gap-2 text-sm font-sans font-bold bg-[var(--color-ink)] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Mobile Nav Toggle */}
        <button 
          className="md:hidden p-2 text-ink"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-paper border-b border-[var(--color-border-subtle)] px-6 py-4 flex flex-col gap-4 shadow-lg">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className="text-base font-sans font-medium text-ink py-2"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="h-px w-full bg-[var(--color-border-subtle)] my-2"></div>
          {!walletAddress && (
            <button 
              onClick={() => {
                setIsOpen(false);
                setIsWalletModalOpen(true);
              }}
              className="flex items-center gap-2 text-base font-sans font-medium text-ink py-2 text-left"
            >
              <LogIn size={18} />
              Connect Wallet
            </button>
          )}
          
          {walletAddress && (
            <>
              <div className="h-px w-full bg-[var(--color-border-subtle)] my-2"></div>
              <div className="flex flex-col gap-3 py-2">
                <div className="text-xs uppercase tracking-wider font-bold text-[var(--color-soft-ink)]">Connected Wallet</div>
                <div className="flex items-center justify-between bg-white px-3 py-2 border border-[var(--color-border-subtle)] rounded shadow-sm">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-mono text-sm text-[var(--color-olive)]">
                      <span className="w-2 h-2 rounded-full bg-[var(--color-signal-green)] animate-pulse"></span>
                      {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                    </div>
                    {walletBalance && (
                      <div className="font-bold text-[var(--color-ink)]">${Number(walletBalance).toFixed(2)} USDC</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-l border-[var(--color-border-subtle)] pl-3">
                    <button 
                      type="button"
                      onClick={handleCopy}
                      className="p-2 hover:bg-[var(--color-paper)] rounded transition-colors"
                      title="Copy Address"
                    >
                      {isCopied ? <Check size={16} className="text-[var(--color-signal-green)]" /> : <Copy size={16} />}
                    </button>
                    <a 
                      href="https://faucet.circle.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-[var(--color-paper)] text-blue-500 rounded transition-colors"
                      title="Get Testnet USDC from Circle Faucet"
                    >
                      <Droplet size={16} />
                    </a>
                    <button 
                      type="button"
                      onClick={() => setIsSendModalOpen(true)}
                      className="p-2 hover:bg-[var(--color-paper)] text-[var(--color-ink)] rounded transition-colors"
                      title="Send USDC"
                    >
                      <Send size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="p-2 hover:bg-[var(--color-paper)] text-[var(--color-rust)] rounded transition-colors"
                      title="Logout Wallet"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {walletAddress && (
        <SendModal 
          isOpen={isSendModalOpen} 
          onClose={() => setIsSendModalOpen(false)} 
          userToken={typeof window !== 'undefined' ? localStorage.getItem('circle_user_token') || '' : ''}
          encryptionKey={typeof window !== 'undefined' ? localStorage.getItem('circle_encryption_key') || '' : ''}
          onSuccess={() => {
            setIsSendModalOpen(false);
            window.dispatchEvent(new Event('wallet_changed'));
          }}
        />
      )}

      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
        onSuccess={(address, token, encKey) => {
          setIsWalletModalOpen(false);
          localStorage.setItem('circle_wallet_address', address);
          localStorage.setItem('circle_user_token', token);
          localStorage.setItem('circle_encryption_key', encKey);
          window.dispatchEvent(new Event('wallet_changed'));
          // Reload to fetch Supabase user context
          window.location.reload();
        }} 
      />
    </nav>
  );
}
