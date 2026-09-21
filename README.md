# CiteFlow AI

> **The research agent that pays its sources.**
> Ask a question. Get a grounded, cited answer. The creators behind it get paid: in USDC, automatically, the moment the citation happens.

CiteFlow AI is a Web3 native artificial intelligence research agent built to solve a fundamental problem: content creators are rarely compensated when an agent scrapes and synthesizes their work. A researcher locks a budget, the agent grounds its answer only in registered, verified sources, and every source it actually cites gets paid on the spot: no subscriptions, no ad revenue splits, no invoices.

CiteFlow AI is payable by humans through the web terminal, and by autonomous agents directly over HTTP via the [x402 payment protocol](https://x402.org), [Circle Agent Wallet](CIRCLE_AGENT_WALLET_X402.md), or the bundled [MCP server](mcp-server/README.md): so Claude, Codex, Antigravity, or any x402 aware client can pay for and run a research session with no CiteFlow AI login or API key.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase)
![Circle](https://img.shields.io/badge/Circle-Web3_Services-2B88D8?style=flat)
![x402](https://img.shields.io/badge/x402-Agent_Payments-orange?style=flat)
![Arc Mainnet](https://img.shields.io/badge/Network-Arc_Mainnet_5042-C6FF4D?style=flat&labelColor=0B0D09)

**Live Production:** [citeflowai.xyz](https://citeflowai.xyz)

***

## How the money moves

1. **Budget escrow:** The researcher connects a Circle User Controlled Wallet and locks an upfront prompt budget (e.g. $1.00 USDC): one signature, no recurring subscription.
2. **Metered citation payments:** The agent evaluates registered, ownership verified sources against the query. Every source it actually cites gets paid: the rest cost nothing.
3. **Platform fee:** A small percentage of each citation payment covers LLM inference and infrastructure.
4. **Refund of unspent budget:** Whatever was not paid out settles back to the researcher wallet automatically: a simple query with fewer citations costs less, by construction.
5. **Agent native payment (x402):** The same research endpoint is callable by any autonomous agent over HTTP: the agent pays via the x402 protocol (settled through Circle Gateway on Arc Mainnet), the research runs, and unspent budget is refunded the same way.

## Core Features

* **Arc Mainnet settlement:** All USDC micropayments settle on Arc Mainnet (chain ID 5042) with sub second finality.
* **Creator ownership verification (hard gate):** Before anyone can register a source, they must prove control of it: domain, X, Medium, Substack, or Arc House. Enforced at the database level so no one can register someone else work and intercept their payments.
* **Invisible Web2 to Web3 auth (Circle + Supabase):** Email plus PIN onboarding via Circle User Controlled Wallets, no seed phrase. The backend maps the Circle Wallet identity into a Supabase auth session so research history and payouts persist across devices.
* **RAG via embeddings:** Registered sources are embedded and retrieved by relevance (`src/lib/ai/embeddings.ts`), not keyword match, so citation and payment are tied to what actually grounded the answer.
* **Strict grounding gate:** The agent will never synthesize an ungrounded answer. If no registered sources match the query, it refuses to respond and issues an immediate full budget refund.
* **Multi model LLM fallback:** Uses OpenAI first when `OPENAI_API_KEY` is configured, then falls back to Gemini and OpenRouter if a provider is unavailable.
* **Live ledger:** A terminal themed dashboard showing real time budgets, citations, and payouts as they settle on chain.
* **x402 agent endpoint and agent integrations:** `/api/agent/research` is a spec compliant, agent payable HTTP 402 endpoint. Call it with the direct Gateway SDK, a [Circle Agent Wallet](CIRCLE_AGENT_WALLET_X402.md), or the `citeflow_research` tool from the bundled [MCP server](mcp-server/README.md).

## Primitives for builders (open source)

* **`src/lib/ai/research-agent.ts`**: the LLM orchestration loop: evaluates source relevance, decides what to cite, and drives the payment ledger.
* **`src/lib/ai/embeddings.ts`**: embedding generation and similarity retrieval over registered sources.
* **`src/lib/payments/circle-api.ts` / `src/lib/payments/treasury.ts`**: Circle Wallets integration and the pay per prompt escrow and refund logic. USDC token ID is resolved live from the treasury wallet balance on Arc Mainnet.
* **`src/lib/x402/server.ts` / `src/lib/x402/next-adapter.ts`**: the x402 resource server (via `@x402/core` plus `@circle-fin/x402-batching`) and its Next.js route adapter, backing the agent payable research endpoint.
* **`src/lib/verification/`**: domain and social ownership verification used to gate source registration.
* **`src/context/NetworkContext.tsx`**: network context providing Arc Mainnet production configuration across the application.
* **`mcp-server/`**: standalone MCP server exposing CiteFlow AI research as a tool any MCP client can call.

***

## Getting Started

### Prerequisites
* Node.js (v18+)
* A Supabase project
* A Circle Web3 Services account (User Controlled and Developer Controlled Wallets)

### Environment Variables
Rename `.env.example` to `.env.local` and fill in your keys:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
# Optional: defaults to gpt-4o-mini
OPENAI_RESEARCH_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=your_anthropic_key

# Circle Web3 Infrastructure (Arc Mainnet Production)
CIRCLE_API_KEY_MAINNET=your_circle_mainnet_key
NEXT_PUBLIC_CIRCLE_APP_ID_MAINNET=your_circle_mainnet_app_id
CIRCLE_WALLET_ID_MAINNET=your_mainnet_treasury_wallet_id
AGENT_TREASURY_ADDRESS_MAINNET=your_mainnet_treasury_address
RAW_ENTITY_SECRET_MAINNET=your_mainnet_entity_secret
```

CiteFlow AI operates in production on Arc Mainnet (Chain ID 5042). All citation micropayments and agent transactions settle directly on chain in live USDC.

To generate an Arc Mainnet treasury wallet and register your entity secret:

```bash
node scripts/setup-mainnet-treasury.mjs
```

### Installation

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/vickman787/citeflowAI.git
cd citeflowAI
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the live app.

For agent integrations, see the [web documentation](src/app/docs/page.tsx), [Circle Agent Wallet guide](CIRCLE_AGENT_WALLET_X402.md), and [MCP server guide](mcp-server/README.md).

## License
MIT License
