import type { Metadata } from "next";
import { validateEnv } from "@/lib/env";
import { Merriweather, Inter, JetBrains_Mono } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import "./globals.css";

const serif = Merriweather({
  weight: ["300", "400", "700"],
  variable: "--font-serif",
  subsets: ["latin"],
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CiteFlowAI | Arc Testnet",
  description: "Editorial research terminal powered by Arc Testnet nanopayments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[var(--color-paper)] text-[var(--color-ink)]">
        {(() => {
          const env = validateEnv();
          if (!env.isValid) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--color-paper)]">
                <div className="card-panel p-10 max-w-2xl w-full">
                  <h1 className="text-3xl font-serif font-bold text-[var(--color-ink)] mb-6 border-b border-[var(--color-border-subtle)] pb-4">
                    Setup Required
                  </h1>
                  <p className="text-lg mb-6 text-[var(--color-soft-ink)]">
                    The application is missing critical environment variables. Please configure the following in your <code className="text-[var(--color-olive)] font-mono bg-black/5 px-2 py-1 rounded">.env.local</code> file:
                  </p>
                  <ul className="space-y-3 mb-8">
                    {env.errors.map((err: string) => (
                      <li key={err} className="font-mono text-sm text-[var(--color-rust)] bg-black/5 p-3 rounded border border-[var(--color-border-subtle)]">
                        {err}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-[var(--color-olive)]">
                    After adding these variables, restart the Next.js development server to continue.
                  </p>
                </div>
              </div>
            );
          }

          return (
            <>
              {/* Persistent ARC TESTNET indicator */}
              <div className="w-full bg-[var(--color-ink)] text-center py-2 text-xs font-mono font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--color-signal-green)]"></div>
                <span className="text-[var(--color-paper)]">LIVE ON ARC TESTNET</span>
              </div>
              
              <Navigation />

              <div className="flex-1 flex flex-col">
                {children}
              </div>
            </>
          );
        })()}
      </body>
    </html>
  );
}
