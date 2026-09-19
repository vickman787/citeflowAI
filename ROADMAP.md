# CiteFlowAI: Product Roadmap

CiteFlowAI is a pay-per-prompt research agent: a researcher locks a budget, the agent grounds its answer only in registered, ownership-verified sources, and every source it actually cites gets paid in USDC — automatically, the moment the citation happens. It's payable by humans through the web terminal, and by autonomous agents directly over HTTP via x402 or the bundled MCP server.

---

## ✅ Shipped

### 1. Pay-per-prompt economy
- Circle Programmable Wallets onboarding — email + PIN, no seed phrase.
- Budget escrow: researchers lock a budget upfront; unspent budget refunds automatically once the agent finishes.
- Embedding-based retrieval (Supabase pgvector) over registered sources, so citation is tied to relevance, not keyword match.
- Autonomous per-citation payouts straight to the creator's wallet, with a platform fee on top.
- Multi-model LLM fallback: Gemini 2.5 Flash primary, automatic fallback to Claude on rate limits.
- Terminal-themed live ledger dashboard showing budgets, citations, and payouts in real time.

### 2. Creator ownership verification (hard gate)
- Domain, X, Medium, and Substack verification required *before* a source can be registered.
- Enforced by a database constraint, not application logic — verified directly that even a privileged service-role write can't override an existing claim.
- Closes the gap where anyone could previously register someone else's article and intercept their payments.

### 3. The agent economy (x402 + MCP)
- `/api/agent/research` — a spec-compliant, agent-payable HTTP 402 endpoint (`@x402/core` + `@circle-fin/x402-batching`, settled via Circle Gateway on Arc Testnet).
- `/api/treasury/fund` — spec-compliant x402 funding endpoint.
- Standalone MCP server (`mcp-server/`) exposing a `citeflow_research` tool for any MCP-compatible client.
- Verified end-to-end against real, independent clients: Claude, Google Antigravity, OpenAI Codex, and a bare terminal script — not just internal testing.

### 4. Security & reliability hardening
- Removed an unauthenticated research route and a debug backdoor that ran the paid agent flow for anyone.
- Server-side payment verification with a replay guard, refunds routed to the verified payer only.
- Fixed Circle wallet SDK race conditions and a stale-session flicker on wallet reconnect (`router.refresh()` instead of a hard reload).
- Clean 401 handling on Circle token expiry instead of raw 500s.

---

## 🚧 Next

### 1. Mainnet
Move off Arc Testnet with real USDC and a production treasury.

### 2. Tighter refund/settlement guarantees
Gateway settlement is batched, so unspent-budget refunds currently rely on the treasury holding pre-existing slack rather than a guaranteed 1:1 accounting link. Tighten that so refunds never depend on treasury float.

### 3. Remote MCP
An HTTP transport for the MCP server, so cloud-hosted agent platforms can connect — not just local CLIs.

### 4. More verification rails
Expand beyond domain, X, Medium, and Substack as creators ask for them.

### 5. Creators on the agent economy, not just researchers
Two angles under consideration:
- **Creators as x402 sellers:** expose each registered source as its own x402-payable resource (an MCP tool like `citeflow_fetch_source`), so an agent can pay a creator directly for their raw content — no multi-source synthesis required. The groundwork already exists: sources store a per-creator price (`price_usdc`) and their full chunked text (`source_chunks`), and the x402 SDK supports per-request dynamic pricing.
- **Creator self-service via MCP:** let a creator's own agent register new sources or check earnings (`citeflow_register_source`, `citeflow_creator_stats`) via a per-creator API key, without touching the dashboard.
