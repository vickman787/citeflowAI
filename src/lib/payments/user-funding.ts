import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'
import { getCircleCredentials, getTreasuryAddress } from '@/lib/circle-credentials'
import { NETWORKS, type NetworkId } from '@/lib/network'
import { isArcUsdcToken } from './usdc-token'

export const DEAD_FUNDING_STATES = ['FAILED', 'DENIED', 'CANCELLED']

export async function inspectUserFunding(input: {
  transactionId: string; userToken?: string; circleUserId?: string; network: NetworkId;
  payerAddress: string; budget: number; requireConfirmed?: boolean;
}) {
  const client = initiateUserControlledWalletsClient({ apiKey: getCircleCredentials(input.network).apiKey })
  if (!input.userToken && !input.circleUserId) throw new Error('Circle user authentication is missing')
  // Social-login users cannot always mint a replacement token from userId.
  // Prefer the fresh token supplied by the authenticated browser session.
  let response
  try {
    response = await client.getTransaction(input.userToken
      ? { userToken: input.userToken, id: input.transactionId }
      : { userId: input.circleUserId!, id: input.transactionId })
  } catch (error: any) {
    throw new Error(`Circle transaction lookup failed: ${error.message}`)
  }
  const tx = response.data?.transaction
  if (!tx) throw new Error('Circle funding transaction not found')
  if (tx.blockchain !== NETWORKS[input.network].circleChain) throw new Error('Funding network mismatch')
  if (!tx.sourceAddress || tx.sourceAddress.toLowerCase() !== input.payerAddress.toLowerCase()) {
    throw new Error('Funding payer mismatch')
  }
  if (!tx.destinationAddress || tx.destinationAddress.toLowerCase() !== getTreasuryAddress(input.network).toLowerCase()) {
    throw new Error('Funding destination mismatch')
  }
  if (!tx.tokenId) throw new Error('Funding token missing')
  if (input.userToken) {
    // Circle's token lookup currently rejects some Arc token IDs. Validate the
    // transaction token against the payer wallet balance metadata instead.
    try {
      const wallets = await client.listWallets({ userToken: input.userToken })
      const payerWallet = wallets.data?.wallets?.find(wallet =>
        wallet.address.toLowerCase() === input.payerAddress.toLowerCase() &&
        wallet.blockchain === NETWORKS[input.network].circleChain)
      if (!payerWallet) throw new Error('payer wallet not found')
      const balances = await client.getWalletTokenBalance({
        userToken: input.userToken,
        walletId: payerWallet.id,
      })
      const usdc = balances.data?.tokenBalances?.find(balance =>
        isArcUsdcToken(balance.token, input.network))?.token
      if (!usdc || usdc.id !== tx.tokenId) throw new Error('transaction token does not match Arc USDC')
    } catch (error: any) {
      throw new Error(`Circle funding asset validation failed: ${error.message}`)
    }
  } else {
    const token = await client.getToken({ id: tx.tokenId })
    if (!isArcUsdcToken(token.data?.token, input.network)) throw new Error('Funding asset mismatch')
  }
  const paid = (tx.amounts || []).reduce((sum, amount) => sum + Number(amount), 0)
  if (!Number.isFinite(paid) || paid + 0.000001 < input.budget) throw new Error('Funding amount is too small')
  if (input.requireConfirmed && (tx.state !== 'COMPLETE' || !tx.txHash)) {
    throw new Error(`Funding transaction is ${tx.state}; awaiting on-chain confirmation`)
  }
  return { state: tx.state, txHash: tx.txHash || null, paid }
}
