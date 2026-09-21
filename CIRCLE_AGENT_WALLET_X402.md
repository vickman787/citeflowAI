# Use Circle Agent Wallet for x402 Research on Arc Mainnet

This is the end to end guide for letting an artificial intelligence agent pay an x402 research endpoint with Circle Agent Wallet on Arc Mainnet (Chain ID 5042). This is an alternative to the direct `GatewayClient` and CiteFlow AI MCP server integrations: Circle CLI manages the Agent Wallet and submits the x402 payment directly.

## Prerequisites

* Node.js 20.18.2 or later.
* Circle CLI installed via `npm install -g @circle-fin/cli`.
* A funded Agent Wallet on Arc Mainnet holding USDC.

## 1. Log In

Authenticate with Circle CLI:

```powershell
circle wallet login user@example.com --init --output json
```

Circle sends an OTP to your email. Complete the login with the returned request ID:

```powershell
circle wallet login --request <request-id> --otp <otp> --output json
```

Verify that the session is valid:

```powershell
circle wallet status --output json
```

## 2. Find the Arc Mainnet Wallet

List your agent wallets on Arc Mainnet:

```powershell
circle wallet list --type agent --chain ARC --output json
```

Store your agent wallet address:

```powershell
$WALLET_ADDRESS = "0xYourAgentWalletAddress"
```

Verify your Arc Mainnet USDC balance:

```powershell
circle wallet balance --address $WALLET_ADDRESS --chain ARC --output json
```

## 3. Inspect the Research Endpoint

```powershell
circle services inspect `
  https://citeflowai.xyz/api/agent/research `
  --chain ARC `
  --output json
```

Confirm the endpoint is payable and the network is Arc Mainnet (Chain ID 5042).

## 4. Check the Gateway Balance

```powershell
circle gateway balance `
  --address $WALLET_ADDRESS `
  --chain ARC `
  --all `
  --output json
```

The Arc Mainnet Gateway balance covers the micropayment.

## 5. Fund Gateway if Needed

If the Gateway balance is low, deposit Arc Mainnet USDC:

```powershell
circle gateway deposit `
  --amount 1 `
  --address $WALLET_ADDRESS `
  --chain ARC `
  --method direct `
  --timeout 180 `
  --output json
```

## 6. Estimate the Payment

```powershell
circle services pay `
  "https://citeflowai.xyz/api/agent/research?q=YOUR_ENCODED_QUESTION" `
  --address $WALLET_ADDRESS `
  --chain ARC `
  --estimate `
  --output json
```

## 7. Pay and Receive Grounded Research

Execute the paid research request:

```powershell
circle services pay `
  "https://citeflowai.xyz/api/agent/research?q=YOUR_ENCODED_QUESTION" `
  --address $WALLET_ADDRESS `
  --chain ARC `
  --max-amount 1 `
  --timeout 120 `
  --output json
```

The response includes:
* `answer`: The synthesized answer grounded strictly in verified sources.
* `citationsUsed`: List of citations that answered the prompt.
* `purchasedSources`: Creators compensated in real time.
* `transaction`: On chain settlement reference on Arc Mainnet.

## Arc Mainnet Network Values

* Circle CLI chain: `ARC`
* x402 network: `eip155:5042`
* EIP 712 Gateway domain ID: `26`
* Explorer: `https://explorer.arc.io`

## References

* Circle Agent Wallets: https://developers.circle.com/agent-stack/agent-wallets
* Circle Gateway x402: https://developers.circle.com/gateway/nanopayments/concepts/x402
