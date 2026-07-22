import Link from 'next/link';
import { Droplet, FileText, Search, Wallet, Cpu, CheckCircle, Bot } from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="flex-1 flex flex-col pt-12 pb-24 content-container max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-[var(--color-ink)]">
          Documentation
        </h1>
        <p className="text-lg text-[var(--color-soft-ink)] mb-8">
          Everything you need to know about using CiteFlowAI, whether you are researching topics or registering your own intellectual property.
        </p>

        {/* Video Guide */}
        <div className="relative w-full aspect-video rounded overflow-hidden shadow-lg border border-[var(--color-border-subtle)]">
          <iframe
            src="https://www.youtube.com/embed/XpMZf3W5E5A"
            title="CiteFlowAI Video Guide"
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      <div className="space-y-16">
        
        {/* Section 1: Introduction */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-2">
            <Cpu className="text-[var(--color-olive)]" size={24} />
            <h2 className="text-2xl font-serif font-bold text-[var(--color-ink)]">What is CiteFlowAI?</h2>
          </div>
          <div className="prose prose-lg text-[var(--color-ink)] font-sans leading-relaxed">
            <p>
              CiteFlowAI is a decentralized AI research terminal designed to fix the creator compensation problem in generative AI. 
              Currently, AI models are trained on millions of articles, but the original authors receive no compensation when their work is used to generate answers.
            </p>
            <p>
              CiteFlowAI changes this by introducing <strong>Pay-Per-Prompt Citations</strong>. When our AI agent synthesizes an answer using a registered knowledge base, it explicitly cites its sources and uses <strong>Circle Programmable Wallets</strong> to instantly execute USDC nanopayments to the original creators on the Arc Testnet.
            </p>
          </div>
        </section>

        {/* Section 2: For Researchers */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-2">
            <Search className="text-[var(--color-olive)]" size={24} />
            <h2 className="text-2xl font-serif font-bold text-[var(--color-ink)]">For Researchers (Users)</h2>
          </div>
          <div className="space-y-8">
            
            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Wallet className="text-[var(--color-signal-green)]" size={20} />
                1. Connect a Web3 Wallet (No Seed Phrase Needed)
              </h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                You don't need a crypto extension like MetaMask to use CiteFlowAI. We use Circle's User-Controlled Wallets to generate a secure Web3 wallet bound to your email address, which acts as your universal login!
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>Click <strong>Connect Wallet</strong> in the top navigation bar.</li>
                <li>Enter your email address and verify with the One-Time Password (OTP).</li>
                <li>Create a secure PIN code to authorize future transactions.</li>
                <li>You are now invisibly authenticated to our backend! Your wallet address is your identity.</li>
              </ul>
            </div>

            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Droplet className="text-blue-500" size={20} />
                2. Get Testnet USDC
              </h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                Since CiteFlowAI currently operates on the Arc Testnet, you need free Testnet USDC to pay for AI prompts.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>Copy your connected wallet address from the top navigation bar.</li>
                <li>Click the blue <strong>Droplet Icon</strong> in the navigation bar to open the Circle Faucet.</li>
                <li>Paste your address and request USDC on the Arc Testnet.</li>
                <li>Wait a few seconds, and your balance will automatically update in the app!</li>
              </ul>
            </div>

            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Search className="text-[var(--color-ink)]" size={20} />
                3. Ask the AI
              </h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                Once your wallet is funded, you can query the AI. You set a "Max Budget" for the prompt (e.g., $0.50). 
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>The funds are temporarily authorized using your PIN code.</li>
                <li>The AI retrieves relevant articles from our vector database and writes an answer.</li>
                <li>Based on which articles were actually cited, the smart contract settles the payment, distributing the exact citation fees to the respective authors.</li>
              </ul>
            </div>

          </div>
        </section>

        {/* Section 3: For Creators */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-2">
            <FileText className="text-[var(--color-olive)]" size={24} />
            <h2 className="text-2xl font-serif font-bold text-[var(--color-ink)]">For Creators (Authors)</h2>
          </div>
          
          <div className="space-y-8">
            <div className="bg-[var(--color-paper)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">1. Universal Identity (Circle + Supabase)</h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                There are no separate "user" or "creator" accounts, and absolutely no passwords. Your Circle Wallet is your entire identity. The moment you connect your wallet via the navbar, our backend automatically maps your address to your creator profile. You never have to manually configure payment settings!
              </p>
            </div>

            <div className="bg-[var(--color-paper)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">2. Verify Ownership (Required Before Registering)</h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                Before you can register an article, you must prove you actually control where it lives. This exists so nobody else can register your work and collect the citation payments meant for you — CiteFlowAI will not create a source from a domain or platform handle you haven&apos;t verified, full stop.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>Open the <strong>Verify Ownership</strong> panel on your Dashboard — it shows a unique verification code tied to your account.</li>
                <li>Prove control of a <strong>domain</strong> (add a meta tag or a <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">/.well-known/citeflow.txt</code> file with the code), an <strong>X</strong> account (post the code in a tweet), a <strong>Medium</strong> profile, or a <strong>Substack</strong> — then paste the link back into the panel.</li>
                <li>Once verified, that identity is <strong>permanently and exclusively yours</strong> — enforced at the database level, not just in the UI. You can then register any article on that domain or handle without repeating this step.</li>
                <li>You can verify as many domains and platforms as you actually own; there&apos;s no limit.</li>
              </ul>
            </div>

            <div className="bg-[var(--color-paper)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">3. Registering Articles</h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                Navigate to the <strong>Register Work</strong> page. Here, you can upload the contents of your research, blog posts, or intellectual property.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>Provide the Title, URL, and the full content of your article.</li>
                <li>Set your own <strong>Citation Price</strong> in USDC (e.g., $0.10 per citation).</li>
                <li>Your content is chunked, embedded into our Vector Database, and made available to the AI agent.</li>
              </ul>
            </div>

            <div className="bg-[var(--color-paper)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">4. Tracking Earnings</h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                The <strong>Dashboard</strong> provides a live view of your intellectual property. 
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>View all your registered articles.</li>
                <li>See exactly how many times each article has been cited by the AI.</li>
                <li>Watch your USDC balance grow in real-time as users interact with the network.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: For Agents & Developers (x402) */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-2">
            <Bot className="text-[var(--color-signal-green)]" size={24} />
            <h2 className="text-2xl font-serif font-bold text-[var(--color-ink)]">For Agents &amp; Developers (x402 API)</h2>
          </div>
          <div className="space-y-8">

            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <p className="text-[var(--color-soft-ink)] mb-4">
                CiteFlowAI can also be called directly by other autonomous agents — no browser, no email login, no PIN prompt. The
                <code className="mx-1 px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">/api/agent/research</code>
                endpoint speaks the <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="text-[var(--color-signal-green)] underline">x402</a> protocol: send a request with no payment and it returns an HTTP <strong>402</strong> challenge; retry with a signed, gasless payment authorization and it settles the payment and returns a grounded, cited answer in one round trip.
              </p>
            </div>

            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">What you need</h3>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>Any standard EVM keypair — this isn&apos;t tied to Circle&apos;s wallet product; a plain private key works.</li>
                <li>Testnet USDC and a small amount of native gas on <strong>Arc Testnet</strong>, free from the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-[var(--color-signal-green)] underline">Circle Faucet</a>.</li>
                <li>A <strong>one-time on-chain deposit</strong> into Circle&apos;s Gateway Wallet contract. Holding USDC alone isn&apos;t enough — it must be deposited into Gateway before any signed authorization can spend it. This step costs gas; every payment after it is gasless.</li>
                <li>The <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">@circle-fin/x402-batching</code> client library (or any client that implements Circle Gateway&apos;s batched signing scheme).</li>
              </ul>
            </div>

            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">Example</h3>
              <pre className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded p-4 overflow-x-auto text-sm font-mono text-[var(--color-ink)]">
{`import { GatewayClient } from '@circle-fin/x402-batching/client'

const client = new GatewayClient({
  chain: 'arcTestnet',
  privateKey: '0xYOUR_PRIVATE_KEY',
})

await client.deposit('1.00') // one-time, funds your Gateway balance

const { data } = await client.pay(
  'https://citeflowai.xyz/api/agent/research?q=' +
    encodeURIComponent('your research question here')
)

console.log(data.answer)            // grounded, cited answer
console.log(data.purchasedSources)  // which creators just got paid`}
              </pre>
              <p className="text-[var(--color-soft-ink)] mt-4 text-sm">
                Each call is a flat <strong>$0.50 USDC</strong>, settled per-request with no refund — the standard x402 pattern. Citation payments to creators are executed exactly as they are for human researchers, regardless of which side paid.
              </p>
            </div>

            <div className="bg-[var(--color-panel)] p-6 border border-[var(--color-signal-green)]/40 rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Bot className="text-[var(--color-signal-green)]" size={20} />
                Even easier: MCP integration
              </h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                If your agent runs on <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-[var(--color-signal-green)] underline">MCP</a> (Claude, Cursor, or your own agent framework), you don&apos;t need to write any x402 signing code at all. We publish a small, self-contained MCP server — <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">mcp-server/</code> in the CiteFlow repo — that exposes the endpoint as a single tool: <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">citeflow_research</code>. It handles the Gateway deposit, signing, and payment internally; your agent just calls the tool with a question.
              </p>
              <p className="text-[var(--color-soft-ink)] mb-4 text-sm">Setup:</p>
              <pre className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded p-4 overflow-x-auto text-sm font-mono text-[var(--color-ink)]">
{`cd mcp-server
npm install
export CITEFLOW_PRIVATE_KEY=0xYOUR_PRIVATE_KEY`}
              </pre>
              <p className="text-[var(--color-soft-ink)] mt-4 mb-2 text-sm">Then point your MCP client at it, e.g. in Claude Desktop&apos;s config:</p>
              <pre className="bg-[var(--color-panel-deep)] border border-[var(--color-border-subtle)] rounded p-4 overflow-x-auto text-sm font-mono text-[var(--color-ink)]">
{`{
  "mcpServers": {
    "citeflow": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.mjs"],
      "env": {
        "CITEFLOW_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY",
        "CITEFLOW_RESEARCH_URL": "https://citeflowai.xyz/api/agent/research"
      }
    }
  }
}`}
              </pre>
              <p className="text-[var(--color-soft-ink)] mt-2 text-xs">
                <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded">CITEFLOW_RESEARCH_URL</code> is actually optional — it already defaults to this production endpoint — but it&apos;s shown explicitly here so the example is copy-pasteable as-is.
              </p>
              <p className="text-[var(--color-soft-ink)] mt-4 text-sm">
                Restart your client and ask it to research something — it calls <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">citeflow_research</code> on its own when relevant. It even auto-deposits into Gateway the first time it needs to, so there&apos;s no manual funding step beyond getting testnet USDC from the faucet. Full details in <code className="px-1.5 py-0.5 bg-[var(--color-panel-deep)] rounded text-sm">mcp-server/README.md</code>.
              </p>
            </div>

          </div>
        </section>

        {/* Section 5: Circle Architecture */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-2">
            <CheckCircle className="text-[var(--color-signal-green)]" size={24} />
            <h2 className="text-2xl font-serif font-bold text-[var(--color-ink)]">Circle Web3 Architecture</h2>
          </div>
          <div className="prose prose-lg text-[var(--color-ink)] font-sans leading-relaxed">
            <p>
              CiteFlowAI is built on top of <strong>Circle Web3 Services</strong> to provide a seamless, gasless experience for non-crypto native users while maintaining decentralized settlement.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li><strong>User-Controlled Wallets:</strong> We use Circle's Web SDK to generate embedded wallets via Email OTP. No seed phrases are required.</li>
              <li>
                <strong>Master Treasury Escrow:</strong> To prevent forcing researchers to manually sign 5 separate transactions to pay 5 different authors, CiteFlowAI uses a Master Treasury Wallet. Researchers sign a single PIN-authorization for their "Max Budget" which is routed to the Treasury.
              </li>
              <li>
                <strong>Programmatic Smart Contract Routing:</strong> Once the AI agent finishes a task and determines which sources were cited, our backend securely uses Circle's Developer-Controlled Wallets API to execute batch nanopayments from the Treasury directly to the cited authors.
              </li>
              <li><strong>Arc Testnet:</strong> All transactions are executed securely on the Arc Testnet using USDC.</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
