# Use Circle Agent Wallet for x402 Research

This is the short end-to-end flow for letting an AI agent pay an x402 research
endpoint with Circle Agent Wallet on Arc Testnet. This is an alternative to
the direct `GatewayClient` and CiteFlow MCP server integrations: Circle CLI
manages the Agent Wallet and submits the x402 payment directly.

The question **"What is x402?"** is used only as a test example. Users can ask
any research question, provided CiteFlowAI has a registered source containing
relevant information for that question.

## Prerequisites

- Node.js 20.18.2 or later.
- Circle CLI installed with `npm install -g @circle-fin/cli`.
- A current Circle CLI version that supports the `--init` and `--output json`
  options used below. Run `circle --version` and update the CLI if an option is
  unavailable.
- Testnet USDC. The Circle CLI testnet funding command obtains it from the
  Circle Faucet.

## 1. Log In

Start the Circle testnet login:

```powershell
circle wallet login user@example.com --testnet --init --output json
```

Circle sends an OTP by email. Complete the login with the returned request ID:

```powershell
circle wallet login --testnet --request <request-id> --otp <otp> --output json
```

The OTP is user-mediated unless the user has explicitly granted the agent
access to the authentication inbox. Never expose or persist the OTP.

Check that the session is valid:

```powershell
circle wallet status --output json
```

## 2. Find the Arc Testnet Wallet

```powershell
circle wallet list --type agent --chain ARC-TESTNET --output json
```

Copy the returned public wallet address:

```powershell
$WALLET_ADDRESS = "0xYourAgentWalletAddress"
```

If the wallet does not have testnet USDC, fund it from the Circle Faucet:

```powershell
circle wallet fund `
  --address $WALLET_ADDRESS `
  --chain ARC-TESTNET `
  --output json
```

On testnet, omit `--amount` and `--method`; Circle CLI requests testnet USDC
from the faucet. Confirm it arrived with `circle wallet balance --address
$WALLET_ADDRESS --chain ARC-TESTNET --output json`.

## 3. Inspect the Research Endpoint

```powershell
circle services inspect `
  https://citeflowai.xyz/api/agent/research `
  --chain ARC-TESTNET `
  --output json
```

Confirm the endpoint is payable, the network is Arc Testnet, and the price is
expected. The price may vary by endpoint or request.

## 4. Check the Gateway Balance

```powershell
circle gateway balance `
  --address $WALLET_ADDRESS `
  --chain ARC-TESTNET `
  --all `
  --output json
```

The **Arc Testnet Gateway balance** must cover the payment. A regular wallet
balance does not automatically count as a Gateway balance.

## 5. Fund Gateway if Needed

If the Gateway balance is too low, deposit testnet USDC:

```powershell
circle gateway deposit `
  --amount 1 `
  --address $WALLET_ADDRESS `
  --chain ARC-TESTNET `
  --method direct `
  --timeout 180 `
  --output json
```

The Agent Wallet must already hold enough testnet USDC for this operation. The
deposit moves that wallet USDC into its Gateway balance; obtaining USDC in the
wallet and depositing it into Gateway are separate steps. Check the Gateway
balance again and wait until the deposit appears.

## 6. Estimate the Payment

```powershell
circle services pay `
  "https://citeflowai.xyz/api/agent/research?q=YOUR_ENCODED_QUESTION" `
  --address $WALLET_ADDRESS `
  --chain ARC-TESTNET `
  --estimate `
  --output json
```

Show the user the price, network, seller, and question. Ask for confirmation
before paying.

## 7. Pay and Get the Answer

After the user confirms:

```powershell
circle services pay `
  "https://citeflowai.xyz/api/agent/research?q=YOUR_ENCODED_QUESTION" `
  --address $WALLET_ADDRESS `
  --chain ARC-TESTNET `
  --max-amount 1 `
  --timeout 120 `
  --output json
```

Return the response's:

- `answer`
- `citationsUsed`
- `purchasedSources`
- `transaction`, when settlement information is present
- the x402 payment response or receipt exposed by the Circle CLI

## How a User Invokes It Through an Agent

The user can simply tell their agent. Replace the example question with any
question they want to research:

```text
Use my Circle Agent Wallet on Arc Testnet to research
"YOUR QUESTION" through:
https://citeflowai.xyz/api/agent/research

Show me the payment details and ask for confirmation before paying.
```

The agent performs Steps 2 through 7. Step 1 is also required when the Circle
testnet session is missing or expired and may require the user to provide the
email OTP interactively. The answer depends on relevant registered sources
being available in CiteFlowAI's corpus.

## Important Safety Rules

- Always show the payment details before spending.
- Use `--max-amount` to cap the payment.
- Do not automatically retry after a timeout; check payment status first.
- Never expose OTPs, private keys, access tokens, payment headers, or signatures.

## Arc Testnet Values

- Circle CLI chain: `ARC-TESTNET`
- x402 network: `eip155:5042002`
- EIP-712 Gateway domain ID: `26`
- Testnet faucet: https://faucet.circle.com

## References

- Circle Agent Wallets: https://developers.circle.com/agent-stack/agent-wallets
- Circle Agent Wallet quickstart: https://developers.circle.com/agent-stack/agent-wallets/quickstart
- Circle Gateway x402: https://developers.circle.com/gateway/nanopayments/concepts/x402
