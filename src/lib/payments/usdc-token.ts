import { NETWORKS, type NetworkId } from '@/lib/network'

export interface CircleTokenLike {
  id: string
  symbol?: string
  blockchain?: string
  tokenAddress?: string
  isNative?: boolean
}

// A symbol alone is not sufficient: a wallet can hold lookalike tokens.
export function isArcUsdcToken(token: CircleTokenLike | null | undefined, network: NetworkId): boolean {
  if (!token || token.symbol !== 'USDC' || token.blockchain !== NETWORKS[network].circleChain) return false
  return token.tokenAddress?.toLowerCase() === NETWORKS[network].usdcAddress.toLowerCase()
    || (token.isNative === true && !token.tokenAddress)
}
