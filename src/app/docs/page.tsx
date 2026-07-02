import Link from 'next/link';
import { Droplet, FileText, Search, Wallet, Cpu, CheckCircle } from 'lucide-react';

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
            src="https://www.youtube.com/embed/2Ld-0Sq2dxE"
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
            
            <div className="bg-white p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Wallet className="text-[var(--color-signal-green)]" size={20} />
                1. Connect a Web3 Wallet (No Seed Phrase Needed)
              </h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                You don't need a crypto extension like MetaMask to use CiteFlowAI. We use Circle's User-Controlled Wallets to generate a secure Web3 wallet bound to your email address.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink)]">
                <li>Click <strong>Connect Wallet</strong> on the Research page.</li>
                <li>Enter your email address.</li>
                <li>Enter the One-Time Password (OTP) sent to your email.</li>
                <li>Create a secure PIN code to authorize future transactions.</li>
              </ul>
            </div>

            <div className="bg-white p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
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

            <div className="bg-white p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
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
              <h3 className="text-xl font-bold mb-3">1. Registering an Account</h3>
              <p className="text-[var(--color-soft-ink)] mb-4">
                To get paid for your work, you must create a standard CiteFlowAI account. Once logged in, a creator profile is generated for you. 
                You can then link a Web3 wallet to your profile to receive payouts.
              </p>
            </div>

            <div className="bg-[var(--color-paper)] p-6 border border-[var(--color-border-subtle)] rounded shadow-sm">
              <h3 className="text-xl font-bold mb-3">2. Registering Articles</h3>
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
              <h3 className="text-xl font-bold mb-3">3. Tracking Earnings</h3>
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

        {/* Section 4: Circle Architecture */}
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
              <li><strong>Smart Contract Execution:</strong> When an AI agent finishes a task, our backend securely uses Circle's Server SDK to execute a batch payment from the Treasury to the cited authors.</li>
              <li><strong>Arc Testnet:</strong> All transactions are executed securely on the Arc Testnet using USDC.</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
