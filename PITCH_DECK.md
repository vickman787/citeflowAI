# CiteFlow AI: Pitch Deck Outline (Arc Mainnet Edition)

This outline reflects the **live Arc Mainnet production deployment** of CiteFlow AI. Use this document to copy and paste text directly into your Google Slides presentation or upload the updated PowerPoint file (`CiteFlowAI-Pitch-Deck.pptx`).

Google Slides Reference: [CiteFlow AI Pitch Deck on Google Slides](https://docs.google.com/presentation/d/1Piq87JIlAy_Ah-1pUMrMaIE1xqXgg6Ms)

---

## Slide 1: Title & Boot Sequence
* **Headline:** CITEFLOW_AI
* **Sub headline:** The research agent that pays its sources, in USDC, per citation, in real time.
* **Terminal Boot Sequence:**
```text
[001] connecting to arc-mainnet…  ok
[002] initializing circle gateway…  ok
[003] loading citation ledger…  ok
[004] agent ready.
```

---

## Slide 2: The Problem
* **Tag:** 01 THE PROBLEM
* **Headline:** AI reads everything. Creators earn nothing.
* **Key Metrics:**
  * **∞** : articles indexed, summarized, and re-served by AI
  * **$0** : paid to the author, per synthesis
* **Body:** Every research agent has the same architecture: scrape, embed, answer. The person who actually wrote the source material is invisible to the transaction, because there is no payment rail.

---

## Slide 3: The Idea
* **Tag:** 02 THE IDEA
* **Headline:** Every citation pays its author.
* **Body:** CiteFlow AI is a pay-per-prompt research agent. A researcher locks a budget, the agent grounds its answer in registered sources, and every source it actually cites gets paid automatically, in USDC, the moment the answer is generated. No subscriptions. No ad revenue split. No scraping.
* **Value Breakdown:**
  * **80%** : to the creator, per citation
  * **20%** : platform fee, compute and network
  * **$0** : charged for sources never used

---

## Slide 4: How It Works (Researchers)
* **Tag:** 03 HOW IT WORKS (RESEARCHERS)
* **Headline:** Ask a question. Watch it get paid for.
* **Steps:**
  1. **Connect a wallet:** Email and a PIN, no seed phrase, no extension. Circle's user-controlled wallets handle custody invisibly.
  2. **Ask, and set a budget:** One signature authorizes an upfront budget for the prompt, say, fifty cents.
  3. **The agent reads and decides:** Every registered source gets scored for relevance. Only what is actually cited gets paid.
  4. **Unspent budget comes back:** Did not need the whole budget? The difference refunds to the same wallet automatically.

---

## Slide 5: How It Works (Creators)
* **Tag:** 04 HOW IT WORKS (CREATORS)
* **Headline:** Register once. Get paid every time.
* **Steps:**
  1. **Verify you own it:** Prove control of a domain, X account, Medium, Substack, or Arc House before registering.
  2. **Register your work:** Submit the URL, set your own citation price. It is chunked, embedded, and made available to the agent.
  3. **Get cited, get paid:** Every time the agent grounds an answer in your work, USDC settles to your wallet with no invoice and no delay.
  4. **Track it live:** A live dashboard shows every citation and every payout, updating in real time.

---

## Slide 6: Live Execution
* **Tag:** 05 LIVE EXECUTION
* **Headline:** Not a mockup. A real session.
* **Agent Terminal Transcript:**
```text
agent terminal: session 91229693 (Arc Mainnet)
[001] query: "How does CiteFlow AI handle creator attribution and micropayments on Arc Mainnet?"
[002] budget authorized: $0.50, evaluating 20 registered sources...
[003] CiteFlowAI: The Research Agent That Pays Its Sources, relevance 0.94, accepted
[004] grounding answer in accepted source, generating citation...
[005] settled on Arc Mainnet to creator wallet, settlement 67c741c4
```
* **Footnote:** Real chunk level embedding retrieval finds the exact passage, not just the intro, so the answer is grounded in what the source actually says.

---

## Slide 7: The Receipt
* **Tag:** 06 THE RECEIPT
* **Headline:** Every dollar, accounted for.
* **Ledger Breakdown:**
  * Budget locked: **$1.00**
  * Citation (CiteFlowAI: The Research Agent That Pays Its Sources): **$0.50 deduction**
  * Platform fee: **$0.20 deduction**
  * Unspent budget refunded: **+$0.30**
* **Verification:** Verified on Arc Mainnet, not just in a database: the paying wallet balance moved on chain via Circle Gateway.

---

## Slide 8: Anti-Imposter Protection
* **Tag:** 07 ANTI-IMPOSTER
* **Headline:** No one can register your work but you.
* **Body:** Before this, anyone could register anyone's article and collect the payments meant for the real author. CiteFlow AI closes that permanently with a hard cryptographic gate, not a warning label.
* **Verified Methods:** Domain, X, Medium, Substack, Arc House.
* **Enforcement:** One identity, one owner, enforced by database cryptographic constraints, not application logic.

---

## Slide 9: Verified Ecosystem Sources
* **Tag:** 08 NEWEST VERIFIED PLATFORM
* **Headline:** The first source platform on the same chain as the payment.
* **Body:** Arc House, the Arc builder community, is a fully verifiable source. A creator posts in the forum, and when the agent cites it, USDC settles on Arc Mainnet itself. One post verifies the whole account, so every post that creator ever writes becomes registerable from that single proof.

---

## Slide 10: The Agent Economy
* **Tag:** 09 THE AGENT ECONOMY
* **Headline:** Humans are not the only customers anymore.
* **Body:** CiteFlow AI speaks x402, an open payment protocol built into HTTP itself. Any autonomous agent can pay for research directly: no login, no API key, no human clicking a wallet popup.
* **Integration Code:**
```javascript
const client = new GatewayClient({ chain: 'ARC', privateKey })
await client.deposit('10.00')
const { data } = await client.pay(researchUrl + '?q=...')
```

---

## Slide 11: Proven, Not Promised
* **Tag:** 10 PROVEN, NOT PROMISED
* **Headline:** We tested it with three different companies' agents.
* **Platforms:** Claude, Antigravity (Google), Codex (OpenAI).
* **Live Mainnet Settlement:**
```text
settlement confirmed
tx:   67c741c4-0d04-4a53-af85-dac01e291d54
net:  eip155:5042 · arc mainnet
```
* **Body:** Same tool, same protocol, three independent agent platforms, plus a completely bare terminal test. Every run settled a real payment and returned a real, cited answer on Arc Mainnet.

---

## Slide 12: Under The Hood
* **Tag:** 11 UNDER THE HOOD
* **Headline:** Built on real rails, not a demo shortcut.
* **Architecture:**
  * **Identity & Funds:** Circle Wallets (email-based, no seed phrase), Circle Gateway (batched x402 settlement).
  * **Data:** Supabase (auth, ledger, pgvector), Embeddings (chunk-level retrieval).
  * **Reasoning:** Gemini 2.5 Flash (primary synthesis), Claude fallback (rate-limit waterfall).
  * **Access:** Web app (human researchers), x402 + MCP (autonomous agents).
* **Footer:** Arc Mainnet · USDC · settled on-chain

---

## Slide 13: Why Now
* **Tag:** 12 WHY NOW
* **Headline:** The infrastructure just became real.
* **Core Drivers:**
  * **Agents are becoming buyers:** Autonomous systems increasingly need to purchase data and compute on their own, without a human in the loop.
  * **Nanopayments finally work:** x402 and Circle Gateway make gasless, per-request payment practical at fractions of a cent.
  * **Attribution is unresolved:** Every AI product answers with someone else's work. Almost none of them pay for it.

---

## Slide 14: Roadmap
* **Tag:** 13 WHAT'S NEXT
* **Headline:** Shipped to mainnet, building forward.
* **Milestones:**
  * **01 Arc Mainnet [SHIPPED]:** Deployed on Arc Mainnet with Circle Agent Wallets, live Circle Gateway x402 batching, and production USDC treasury.
  * **02 Refund Timing:** Continuous optimization of Gateway batch cadence and immediate liquidity buffers.
  * **03 Remote MCP Gateway:** HTTP transport for cloud-hosted agent swarms like Claude Desktop and ChatGPT.
  * **04 Autonomous Marketplace:** Creator revenue streaming, automated citation bidding, and expanded verification rails (GitHub, Lens).

---

## Slide 15: Meet The Founder
* **Tag:** 14 MEET THE FOUNDER
* **Headline:** Victor Chukwudi Ezenwa
* **Title:** Founder & Lead Systems Engineer, CiteFlow AI
* **Profile:** Vickman (`@stratton001`)
* **Founder Picture:** Embedded in `public/founder-slide.png` (400x400 avatar with neon green highlight)
* **Engineering Specialization:**
  * AI Search Systems, Semantic RAG & Autonomous Agent Protocols.
  * Experienced software engineer focused on AI-powered research platforms, chunk-level vector retrieval, agentic workflows, and machine-to-machine financial infrastructure.
* **Why CiteFlow AI:**
  * "Every AI tool summarizes creators' work, sells the answer, and gives the writer nothing. I built CiteFlow AI to invert this model: where every citation is a real on-chain payment. I architected the full stack single-handedly, from anti-imposter verification algorithms to Circle Agent Wallets and gasless x402 batching on Arc Mainnet."
* **Shipped & Proven:**
  * Autonomous Mainnet Settlement, 5 Verification Rails, MCP Integration, and Multi-Agent compatibility.
* **Connect:**
  * GitHub: [github.com/vickman787](https://github.com/vickman787)
  * Portfolio: [vickman.pages.dev](https://vickman.pages.dev)
  * X: [@stratton001](https://x.com/stratton001) / [@CiteFlowAI](https://x.com/CiteFlowAI)

---

## Slide 16: Close
* **Headline:** CiteFlow AI
* **Sub headline:** A research agent for humans and other agents alike: grounded answers, paid citations, no exceptions.
* **Terminal Prompt:** `citeflow_ai $ every citation pays its author.`
* **Links:** [citeflowai.xyz](https://citeflowai.xyz) · [@CiteFlowAI](https://x.com/CiteFlowAI)
