'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ text, title = "Copy" }: { text: string, title?: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Copy failed', err);
      }
      document.body.removeChild(textArea);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <button 
      type="button"
      onClick={handleCopy}
      className="p-1 hover:bg-[var(--color-border-subtle)] rounded transition-colors inline-flex items-center justify-center text-[var(--color-olive)] hover:text-[var(--color-ink)]"
      title={title}
    >
      {isCopied ? <Check size={14} className="text-[var(--color-signal-green)]" /> : <Copy size={14} />}
    </button>
  );
}
