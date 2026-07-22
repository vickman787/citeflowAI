# CiteFlow MCP Server

Exposes CiteFlow AI's [x402](https://x402.org)-payable research endpoint as a native tool for any [MCP](https://modelcontextprotocol.io)-compatible agent — Claude, Cursor, or your own agent framework. Your agent just calls `citeflow_research("your question")`; this server handles the Gateway deposit, signing, and payment internally.

This folder is self-contained — copy it out of the CiteFlow repo into your own project if you like. It doesn't depend on anything else here.

## Setup

```bash
cd mcp-server
npm install
```

Set your own wallet's private key as an environment variable — **never CiteFlow's**, this is the wallet that pays for your agent's calls:

```bash
export CITEFLOW_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

Get testnet USDC and gas for that address from the [Circle Faucet](https://faucet.circle.com) (select Arc Testnet). The server auto-deposits into Gateway the first time it needs to, so no manual deposit step is required.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CITEFLOW_PRIVATE_KEY` | Yes | — | Your agent's EVM private key |
| `CITEFLOW_RESEARCH_URL` | No | production endpoint | Override for local testing, e.g. `http://localhost:3000/api/agent/research` |
| `CITEFLOW_CHAIN` | No | `arcTestnet` | Chain name, per `@circle-fin/x402-batching`'s supported chains |
| `CITEFLOW_AUTO_DEPOSIT_USDC` | No | `5.00` | Top-up amount when the Gateway balance runs low |

## Adding it to an MCP client

For Claude Desktop or Claude Code, add to your MCP config (e.g. `claude_desktop_config.json`):

```json
{
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
}
```

`CITEFLOW_RESEARCH_URL` is optional — it already defaults to the production endpoint above — but it's included explicitly so this example is copy-pasteable as-is. Drop it (or point it at `http://localhost:3000/api/agent/research`) if you're testing against a local dev server instead.

Restart your client, then just ask it to research something — it'll call `citeflow_research` on its own when relevant.

## Running it directly

```bash
npm start
```

It speaks MCP over stdio — you won't see anything but a "running on stdio" line until an MCP client connects to it.
