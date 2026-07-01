# CiteFlow 🖋️⚡️

> **The Decentralized Research Terminal.**
> Ask a question. Get a grounded answer. Pay the creator instantly.

CiteFlow is a Web3-native AI research agent built for the Arc Testnet. It solves a critical problem in the AI era: **content creators are rarely compensated when autonomous agents scrape and synthesize their work.** 

With CiteFlow, creators register their articles on-chain with a set licensing price. When the autonomous AI agent uses their work to synthesize an answer to a user's query, it automatically executes an instant USDC nanopayment to the creator's wallet.

![CiteFlow Tech Stack](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase)
![Circle](https://img.shields.io/badge/Circle-Web3_Services-2B88D8?style=flat)
![Arc Testnet](https://img.shields.io/badge/Network-Arc_Testnet-success?style=flat)

---

## ✨ Features

- **Autonomous Agent Nanopayments:** The system utilizes Circle Web3 Services (Developer-Controlled Wallets) as an "Agent Treasury." The LLM programmatically authorizes `x402` nanopayments before synthesizing final outputs.
- **Protocol Fee Engine:** Built-in marketplace mechanics. Creators receive 80% of the citation price, while a 20% platform fee is securely retained in the Agent's Treasury.
- **RAG & Vector Search:** Fast retrieval of registered sources using Supabase.
- **Multi-Model LLM Fallback:** Primary synthesis via Gemini 2.5 Flash, with automatic rate-limit fallbacks to Claude 3.5 Haiku via OpenRouter.
- **Live Ledger Dashboard:** A beautiful, responsive "Paper & Ink" editorial UI that tracks real-time network activity and citation earnings.

## 🛠️ Primitives for Arc Builders (Arc OSS)

If you are a builder looking to integrate autonomous micro-transactions into your AI workflows, CiteFlow exposes several highly reusable primitives:

1. **`research-agent.ts`:** A complete LLM orchestration loop that evaluates content relevance, purchases licenses dynamically via internal API routes, and synthesizes grounded answers using *only* paid citations.
2. **`treasury.ts`:** A secure backend module linking user sessions to Circle's Developer-Controlled Wallets.
3. **Database Schema:** A robust Supabase schema combining `profiles`, `creator_profiles`, `sources`, `payment_authorizations`, and `payment_settlements` to map traditional Web2 user sessions to Web3 transaction lifecycle tracking.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase Project
- A Circle Web3 Services API Key (Developer-Controlled Wallets)
- API Keys for Gemini and OpenRouter

### Environment Variables
Rename `.env.example` to `.env.local` and fill in your keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

CIRCLE_API_KEY=your_circle_key
CIRCLE_WALLET_ID=your_circle_wallet_id
RAW_ENTITY_SECRET=your_circle_entity_secret
```

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📄 License
MIT License
