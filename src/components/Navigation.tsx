"use client"

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, LogIn, LogOut, Copy, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import logoImage from "../../public/logo.jpg";

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

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
    { href: "/research", label: "Workspace" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/register-article", label: "Register Work" },
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
        <div className="hidden md:flex items-center gap-4 lg:gap-6 flex-shrink-0 mr-4 lg:mr-8">
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
          
          {user ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-sans font-medium text-[var(--color-rust)] hover:opacity-80 transition-opacity"
            >
              <LogOut size={16} />
              Logout
            </button>
          ) : (
            <Link 
              href="/login"
              className="flex items-center gap-2 text-sm font-sans font-medium text-ink hover:opacity-80 transition-opacity"
            >
              <LogIn size={16} />
              Login
            </Link>
          )}

          {walletAddress && (
            <div className="hidden lg:flex items-center gap-3 text-sm text-[var(--color-olive)] font-mono bg-white px-3 py-1.5 border border-[var(--color-border-subtle)] rounded shadow-sm whitespace-nowrap flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-signal-green)] animate-pulse"></span>
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </div>
              {walletBalance && (
                <>
                  <div className="w-px h-4 bg-[var(--color-border-subtle)]"></div>
                  <div className="font-bold text-[var(--color-ink)]">${Number(walletBalance).toFixed(2)} USDC</div>
                </>
              )}
              <div className="w-px h-4 bg-[var(--color-border-subtle)]"></div>
              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={handleCopy}
                  className="p-1 hover:text-[var(--color-ink)] transition-colors"
                  title="Copy Address"
                >
                  {isCopied ? <Check size={14} className="text-[var(--color-signal-green)]" /> : <Copy size={14} />}
                </button>
                <button 
                  type="button"
                  onClick={handleWalletLogout}
                  className="p-1 hover:text-[var(--color-rust)] transition-colors"
                  title="Logout Wallet"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
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
          {user ? (
            <button 
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-2 text-base font-sans font-medium text-[var(--color-rust)] py-2"
            >
              <LogOut size={18} />
              Logout
            </button>
          ) : (
            <Link 
              href="/login"
              className="flex items-center gap-2 text-base font-sans font-medium text-ink py-2"
              onClick={() => setIsOpen(false)}
            >
              <LogIn size={18} />
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
