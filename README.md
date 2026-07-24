# CiteFlowAI

> **The research agent that pays its sources.**
> Ask a question. Get a grounded, cited answer. The creators behind it get paid — in USDC, automatically, the moment the citation happens.

CiteFlowAI is a Web3-native AI research agent built to solve a problem every AI product shares: **content creators are rarely compensated when an agent scrapes and synthesizes their work.** A researcher locks a budget, the agent grounds its answer only in registered, verified sources, and every source it actually cites gets paid on the spot — no subscriptions, no ad revenue splits, no invoices.

CiteFlowAI is payable by humans through the web terminal, and by autonomous agents directly over HTTP via the [x402 payment protocol](https://x402.org) or the bundled [MCP server](mcp-server/README.md) — so Claude, Codex, Antigravity, or any x402-aware client can pay for and run a research session with no login and no API key.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase)
![Circle](https://img.shields.io/badge/Circle-Web3_Services-2B88D8?style=flat)
![x402](https://img.shields.io/badge/x402-Agent_Payments-orange?style=flat)
![Arc Testnet](https://img.shields.io/badge/Network-Arc_Testnet-success?style=flat)

---

## How the money moves

1. **Budget escrow:** The researcher connects a Circle User-Controlled Wallet and locks a budget upfront for the prompt (e.g. `$1.00 USDC`) — one signature, no recurring subscription.
2. **Metered citation payments:** The agent evaluates registered, ownership-verified sources against the query. Every source it actually cites gets paid — the rest cost nothing.
3. **Platform fee:** A small percentage of each citation payment covers LLM inference and infrastructure.
4. **Refund of unspent budget:** Whatever wasn't paid out settles back to the researcher's wallet automatically — a simple query with fewer citations costs less, by construction.
5. **Agent-native payment (x402):** The same research endpoint is callable by any autonomous agent over HTTP: the agent pays via the x402 protocol (settled through Circle Gateway on Arc), the research runs, and unspent budget is refunded the same way.

## ✨ Core Features

- **Creator ownership verification (hard gate):** Before anyone can register a source, they must prove control of it — domain, X, Medium, or Substack. Enforced by a database constraint, not application logic, so no one can register someone else's work and intercept their payments.
- **Invisible Web2-to-Web3 auth (Circle + Supabase):** Email + PIN onboarding via Circle Programmable Wallets, no seed phrase. The backend maps the Circle Wallet identity into a Supabase auth session so research history and payouts persist across devices.
- **RAG via embeddings:** Registered sources are embedded and retrieved by relevance (`src/lib/ai/embeddings.ts`), not keyword match, so citation and payment are tied to what actually grounded the answer.
- **Multi-model LLM fallback:** Primary synthesis via Gemini 2.5 Flash, with automatic fallback to Claude on rate limits.
- **Live ledger:** A terminal-themed dashboard showing real-time budgets, citations, and payouts as they settle on-chain.
- **x402 agent endpoint + MCP server:** `/api/agent/research` is a spec-compliant, agent-payable HTTP 402 endpoint; `mcp-server/` wraps it as an MCP tool (`citeflow_research`) for Claude, Codex, Antigravity, or any MCP-compatible client. See [docs](src/app/docs/page.tsx) and the [MCP server README](mcp-server/README.md) for setup.

## 🛠️ Primitives for builders (open source)

- **`src/lib/ai/research-agent.ts`** — the LLM orchestration loop: evaluates source relevance, decides what to cite, and drives the payment ledger.
- **`src/lib/ai/embeddings.ts`** — embedding generation and similarity retrieval over registered sources.
- **`src/lib/payments/circle-api.ts`** / **`src/lib/payments/treasury.ts`** — Circle Wallets integration and the pay-per-prompt escrow/refund logic for the human (non-agent) flow.
- **`src/lib/x402/server.ts`** / **`src/lib/x402/next-adapter.ts`** — the x402 resource server (via `@x402/core` + `@circle-fin/x402-batching`) and its Next.js route adapter, backing the agent-payable research endpoint.
- **`src/lib/verification/`** — domain/social ownership verification used to gate source registration.
- **`mcp-server/`** — standalone MCP server exposing CiteFlowAI research as a tool any MCP client can call.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase project
- A Circle Web3 Services API key (User-Controlled & Developer-Controlled Wallets)

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

For agent/MCP integration, see [`src/app/docs/page.tsx`](src/app/docs/page.tsx) and [`mcp-server/README.md`](mcp-server/README.md).

## 📄 License
MIT License
