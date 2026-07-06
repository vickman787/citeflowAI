# CiteFlow AI 🖋️⚡️

> **The Decentralized Research Terminal.**
> Ask a question. Get a grounded answer. Pay the creator instantly.

CiteFlow AI is a Web3-native AI research agent built to solve a critical problem in the AI era: **content creators are rarely compensated when autonomous agents scrape and synthesize their work.** 

Built for the **Request for Build (RFB 02): Selling Agent Services via Nanopayments**, CiteFlow AI bypasses traditional SaaS subscriptions entirely. It introduces a two-sided micro-economy where users pay for agent services per-call via Circle User-Controlled Wallets, and the AI autonomously distributes royalties to creators whose intellectual property was utilized.

![CiteFlow AI Tech Stack](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase)
![Circle](https://img.shields.io/badge/Circle-Web3_Services-2B88D8?style=flat)
![Arc Testnet](https://img.shields.io/badge/Network-Arc_Testnet-success?style=flat)

---

## 🏆 Answering RFB 02: Selling Agent Services via Nanopayments

CiteFlow AI captures the essence of RFB 02 by monetizing an agent's work at the micro level through a unique **Pay-Per-Prompt** and **Dynamic Refund** architecture:

1. **User Budget Escrow:** The researcher connects a Circle User-Controlled Wallet. Every time they ask a question, they lock a micro-budget upfront (e.g., `$0.50 USDC`) to authorize the agent. No monthly subscriptions required.
2. **Metered Citation Payments:** The AI Agent acts as an autonomous treasury. As it researches, it evaluates registered articles. If it explicitly uses a creator's work to ground its answer, it programmatically executes a nanopayment (e.g., `$0.05 USDC`) directly to that creator.
3. **Micro-Platform Fees:** The protocol takes a small micro-fee (e.g., `$0.20 USDC`) per successful call to cover LLM compute costs and network maintenance.
4. **Dynamic Pricing via Refunds:** The final price of the agent service is dynamically determined by the complexity of the research. If the query was simple and required zero paid sources, the AI dynamically prices the service at `$0.00` and refunds 100% of the initial budget back to the user's wallet via smart contracts.

## ✨ Core Features

- **Invisible Web2-to-Web3 Auth (Circle + Supabase):** Seamless email OTP onboarding via Circle Programmable Wallets. The backend securely and invisibly maps the user's Circle Wallet identity (`0x...@citeflow.local`) directly into a Supabase auth session. Users enjoy a frictionless Web2 feel while holding full Web3 custody. No separate passwords required!
- **Cross-Device Persistent Research History:** The research history seamlessly follows the user. Research sessions and generated AI answers are stored natively in the Supabase backend, perfectly synced with their Circle Wallet identity across any device.
- **Automated Treasury Mapping:** The moment a user logs in via Circle, their wallet address is auto-mapped into the Supabase database. This entirely removes the need for manual payment configurations, allowing creators to instantly receive nanopayments with zero setup.
- **Autonomous Treasury Routing:** The backend LLM orchestration loop securely links user sessions to Circle's infrastructure, routing funds between users, creators, and the platform without human intervention.
- **RAG & Vector Search:** Fast retrieval of registered creator sources using Supabase.
- **Multi-Model LLM Fallback (Waterfall Architecture):** Primary synthesis via Gemini 2.5 Flash, with automatic rate-limit fallbacks to Claude Haiku via Anthropic API, ensuring enterprise-grade resilience.
- **Live Ledger Dashboard:** A beautiful, responsive "Paper & Ink" editorial UI that tracks real-time network activity, user budgets, and citation earnings.

## 🛠️ Primitives for Builders (Open Source)

If you are a builder looking to integrate autonomous micro-transactions into your AI workflows, CiteFlow AI exposes several highly reusable primitives:

1. **`research-agent.ts`:** A complete LLM orchestration loop that evaluates content relevance, processes transactions dynamically, and enforces strict UUID hallucination-prevention for structured ledger output.
2. **`circle-api.ts`:** A secure backend wrapper for interacting with Circle's Programmable Wallets API, handling gateway transfers, and signature orchestration.
3. **`treasury.ts`:** The logic layer managing the Pay-Per-Prompt micro-escrow and refund distribution system.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase Project
- A Circle Web3 Services API Key (User-Controlled & Developer-Controlled Wallets)

### Environment Variables
Rename `.env.example` to `.env.local` and fill in your keys:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key

# Circle Web3 Infrastructure
CIRCLE_API_KEY=your_circle_key
NEXT_PUBLIC_CIRCLE_APP_ID=your_circle_app_id
CIRCLE_WALLET_ID=your_circle_wallet_id
AGENT_TREASURY_ADDRESS=your_agent_treasury_address
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

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the live app.

## 📄 License
MIT License
