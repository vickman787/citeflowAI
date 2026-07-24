# CiteFlowAI: Pitch Deck Outline

Use this outline to copy and paste text into a slide builder like Google Slides, Canva, or Pitch.com. It mirrors the 14-slide deck (`CiteFlowAI-Pitch-Deck.pptx`) and reflects the current, shipped product — x402 agent payments, MCP support, and creator ownership verification included.

---

## Slide 1: Title
**Headline:** CITEFLOW_AI
**Sub-headline:** The research agent that pays its sources — in USDC, per citation, in real time.
**Visual Idea:** A terminal-style "boot sequence" panel above the headline:
```
[001] connecting to arc-testnet…  ok
[002] initializing circle gateway…  ok
[003] agent ready.
```

---

## Slide 2: The Problem
**Headline:** AI reads everything. Creators earn nothing.
**Stats:**
- **∞** — articles indexed, summarized, and re-served by AI
- **$0** — paid to the author, per synthesis
**Body:** Every research agent has the same architecture: scrape, embed, answer. The person who actually wrote the source material is invisible to the transaction — there isn't one.

---

## Slide 3: The Idea
**Headline:** Every citation pays its author.
**Body:** CiteFlowAI is a pay-per-prompt research agent. A researcher locks a budget, the agent grounds its answer in registered sources, and every source it actually cites gets paid — automatically, the moment the answer is generated.
**Stats:**
- **80%** — to the creator, per citation
- **20%** — platform fee
- **$0** — charged for sources never used

---

## Slide 4: How It Works — Researchers
**Headline:** Ask a question. Watch it get paid for.
**Steps:**
1. **Connect a wallet** — Email and a PIN, no seed phrase, no extension.
2. **Ask, and set a budget** — One signature authorizes an upfront budget for the prompt.
3. **The agent reads and decides** — Every registered source is scored for relevance. Only what's cited gets paid.
4. **Unspent budget comes back** — The difference refunds to the same wallet automatically.

---

## Slide 5: How It Works — Creators
**Headline:** Register once. Get paid every time.
**Steps:**
1. **Verify you own it** — Prove control of a domain, X, Medium, or Substack — required before registering.
2. **Register your work** — Submit the URL, set your own citation price.
3. **Get cited, get paid** — USDC settles to your wallet the moment your work is used.
4. **Track it live** — A dashboard shows every citation and payout in real time.

---

## Slide 6: Live Execution
**Headline:** Not a mockup. A real session.
**Visual Idea:** Live terminal transcript:
```
[001] query: "what does the rollup post say about state root publishing?"
[002] budget authorized: $0.50 · evaluating 20 registered sources…
[003] An Incomplete Guide to Rollups — relevance 0.91 — accepted
[004] grounding answer in accepted source, generating citation…
[005] ✓ settled $0.50 -> creator wallet · batch de979faf-db16
```

---

## Slide 7: The Receipt
**Headline:** Every dollar, accounted for.
**Ledger:**
| Line item | Amount |
|---|---|
| Budget locked | $1.00 |
| Citation — An Incomplete Guide to Rollups | −$0.50 |
| Platform fee | −$0.20 |
| Unspent budget — refunded | +$0.30 |
**Body:** Verified on-chain, not just in a database: the paying wallet's balance moved by exactly $0.30 when a citation came in under budget.

---

## Slide 8: Anti-Imposter
**Headline:** No one can register your work but you.
**Body:** Before this, anyone could register anyone's article and collect the payments meant for the real author. CiteFlowAI closes that permanently — with a hard gate, not a warning label.
**Verification rails:** Domain · X · Medium · Substack
**Detail:** One identity, one owner — enforced by a database constraint, not application logic. Verified directly: even a privileged, service-role write couldn't override an existing claim.

---

## Slide 9: The Agent Economy
**Headline:** Humans aren't the only customers anymore.
**Body:** CiteFlowAI speaks x402 — an open payment protocol built into HTTP itself. Any autonomous agent can pay for research directly: no login, no API key, no human clicking a wallet popup.
**Visual Idea:** The whole integration, in three lines:
```js
const client = new GatewayClient({ chain, privateKey })
await client.deposit('10.00')
const { data } = await client.pay(researchUrl + '?q=...')
```

---

## Slide 10: Proven, Not Promised
**Headline:** Tested with three different companies' agents.
**Platforms:** Claude · Antigravity (Google) · Codex (OpenAI)
**Body:** Same tool, same protocol, three independent agent platforms — plus a bare terminal test, six lines of code in an empty folder. Every run settled a real payment and returned a real, cited answer.
**Visual Idea:** Settlement confirmation:
```
tx:  fbbfb3a1-0efc-4ced-807e-c16134afe336
net: eip155:5042002 · arc testnet
```

---

## Slide 11: Under the Hood
**Headline:** Built on real rails, not a demo shortcut.
**Stack:**
- **Identity & Funds** — Circle Wallets, Circle Gateway
- **Data** — Supabase, Embeddings
- **Reasoning** — Gemini 2.5 Flash, Claude fallback
- **Access** — Web app, x402 + MCP
**Footer:** Arc Testnet · USDC · settled on-chain

---

## Slide 12: Why Now
**Headline:** The infrastructure just became real.
**Points:**
- **Agents are becoming buyers.** Autonomous systems increasingly need to purchase data and compute on their own, without a human in the loop.
- **Nanopayments finally work.** x402 and Circle Gateway make gasless, per-request payment practical at fractions of a cent.
- **Attribution is unresolved.** Every AI product answers with someone else's work. Almost none of them pay for it.

---

## Slide 13: What's Next
**Headline:** Honest about what's left.
**Roadmap:**
1. **Mainnet** — Move off Arc Testnet with real USDC and a production treasury.
2. **Refund timing** — Gateway settlement is batched; tighten the guarantee it never outruns settled funds.
3. **Remote MCP** — An HTTP transport so cloud-hosted agent platforms can connect, not just local CLIs.
4. **More verification rails** — Expand beyond domain, X, Medium, and Substack as creators ask for them.

---

## Slide 14: Close
**Headline:** CiteFlowAI
**Sub-headline:** A research agent for humans and other agents alike — grounded answers, paid citations, no exceptions.
**Call to Action:** Try the live terminal at **citeflowai.xyz**
**Contact:** [x.com/CiteFlowAI](https://x.com/CiteFlowAI) | [github.com/vickman787/citeflowAI](https://github.com/vickman787/citeflowAI)
