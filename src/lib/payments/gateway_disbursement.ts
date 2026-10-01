import crypto from 'crypto'
import { pad, parseUnits, maxUint256 } from 'viem'
import { generateDynamicCiphertext } from './circle-api'
import { getCircleCredentials, getTreasuryAddress } from '@/lib/circle-credentials'
import { getCircleTransaction } from './circle-api'
import { createAdminClient } from '@/utils/supabase/admin'

const MAINNET_GATEWAY_WALLET = '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE'
const MAINNET_GATEWAY_MINTER = '0x2222222d7164433c4C09B0b0D809a9b52C04C205'
const USDC_ARC_MAINNET = '0x3600000000000000000000000000000000000000'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const BASE_SETTLEMENT_FEE = 0.0035

export async function autoDisburseGatewayBalance(network: string = 'arc-mainnet'): Promise<{
  success: boolean
  message: string
  txHash?: string
  amount?: string
}> {
  let sweepId: string | null = null
  try {
    const isMainnet = network === 'arc-mainnet'
    if (!isMainnet) {
      return { success: false, message: 'Automated Gateway disbursement only active for Arc Mainnet' }
    }

    let apiKey: string
    let walletId: string
    let rawSecret: string
    let treasuryAddress: string
    try {
      const creds = getCircleCredentials('arc-mainnet')
      apiKey = creds.apiKey
      walletId = creds.walletId
      rawSecret = creds.rawEntitySecret
      treasuryAddress = getTreasuryAddress('arc-mainnet')
    } catch (credErr: any) {
      return { success: false, message: credErr.message }
    }

    // 1. Check live Gateway available balance
    const balRes = await fetch('https://gateway-api.circle.com/v1/balances', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ARC-PRIVATE-MAINNET-ENABLED': 'true'
      },
      body: JSON.stringify({
        token: 'USDC',
        sources: [{ depositor: treasuryAddress, domain: 26 }]
      })
    })

    const balData = await balRes.json()
    if (!balRes.ok) return { success: false, message: `Gateway balance request failed: ${balData.message || balRes.status}` }
    const availableStr = balData.balances?.[0]?.balance || '0'
    const available = parseFloat(availableStr)

    // Ensure there is enough balance to cover the withdrawal and the 0.0035 fee
    if (available <= BASE_SETTLEMENT_FEE + 0.01) {
      return {
        success: false,
        message: `Available balance (${available.toFixed(6)} USDC) below minimum disbursement threshold`
      }
    }

    // Calculate maximum net withdrawal amount leaving margin for base settlement fee
    const netWithdrawAmount = (available - BASE_SETTLEMENT_FEE - 0.001).toFixed(4)
    if (parseFloat(netWithdrawAmount) <= 0) {
      return { success: false, message: 'Net withdraw amount is zero or negative' }
    }

    const db = createAdminClient()
    const { data: sweep, error: sweepError } = await db.from('gateway_sweeps')
      .insert({ network: 'arc-mainnet', amount_usdc: netWithdrawAmount, status: 'processing' })
      .select('id').single()
    if (sweepError || !sweep) {
      return { success: false, message: `Gateway sweep already active or ledger unavailable: ${sweepError?.message || 'unknown'}` }
    }
    sweepId = sweep.id

    const addressToBytes32 = (addr: string) => pad(addr.toLowerCase() as `0x${string}`, { size: 32 })
    const valueAtomic = parseUnits(netWithdrawAmount, 6)
    const maxFeeAtomic = parseUnits('2.01', 6)
    const salt = `0x${crypto.randomBytes(32).toString('hex')}` as `0x${string}`

    const burnIntent = {
      maxBlockHeight: maxUint256.toString(),
      maxFee: maxFeeAtomic.toString(),
      spec: {
        version: 1,
        sourceDomain: 26,
        destinationDomain: 26,
        sourceContract: addressToBytes32(MAINNET_GATEWAY_WALLET),
        destinationContract: addressToBytes32(MAINNET_GATEWAY_MINTER),
        sourceToken: addressToBytes32(USDC_ARC_MAINNET),
        destinationToken: addressToBytes32(USDC_ARC_MAINNET),
        sourceDepositor: addressToBytes32(treasuryAddress),
        destinationRecipient: addressToBytes32(treasuryAddress),
        sourceSigner: addressToBytes32(treasuryAddress),
        destinationCaller: addressToBytes32(ZERO_ADDRESS),
        value: valueAtomic.toString(),
        salt: salt,
        hookData: '0x'
      }
    }

    const typedData = {
      domain: { name: 'GatewayWallet', version: '1' },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' }
        ],
        TransferSpec: [
          { name: 'version', type: 'uint32' },
          { name: 'sourceDomain', type: 'uint32' },
          { name: 'destinationDomain', type: 'uint32' },
          { name: 'sourceContract', type: 'bytes32' },
          { name: 'destinationContract', type: 'bytes32' },
          { name: 'sourceToken', type: 'bytes32' },
          { name: 'destinationToken', type: 'bytes32' },
          { name: 'sourceDepositor', type: 'bytes32' },
          { name: 'destinationRecipient', type: 'bytes32' },
          { name: 'sourceSigner', type: 'bytes32' },
          { name: 'destinationCaller', type: 'bytes32' },
          { name: 'value', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
          { name: 'hookData', type: 'bytes' }
        ],
        BurnIntent: [
          { name: 'maxBlockHeight', type: 'uint256' },
          { name: 'maxFee', type: 'uint256' },
          { name: 'spec', type: 'TransferSpec' }
        ]
      },
      primaryType: 'BurnIntent',
      message: burnIntent
    }

    // 2. Request EIP 712 signature from Circle Developer Controlled Wallet API
    const ciphertext = await generateDynamicCiphertext(rawSecret, apiKey)
    const signRes = await fetch('https://api.circle.com/v1/w3s/developer/sign/typedData', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletId: walletId,
        entitySecretCiphertext: ciphertext,
        data: JSON.stringify(typedData)
      })
    })

    const signData = await signRes.json()
    if (!signRes.ok) {
      await db.from('gateway_sweeps').update({ status: 'failed', last_error: signData.message }).eq('id', sweepId)
      return { success: false, message: `Circle sign API failed: ${signData.message}` }
    }

    const signature = signData.data?.signature
    if (!signature) {
      await db.from('gateway_sweeps').update({ status: 'failed', last_error: 'No Circle signature' }).eq('id', sweepId)
      return { success: false, message: 'No signature returned from Circle API' }
    }

    // 3. Submit signed BurnIntent to Circle Gateway API
    const transferRes = await fetch('https://gateway-api.circle.com/v1/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ARC-PRIVATE-MAINNET-ENABLED': 'true'
      },
      body: JSON.stringify([{ burnIntent, signature }])
    })

    const transferResult = await transferRes.json()
    if (!transferRes.ok || !transferResult.attestation || !transferResult.signature) {
      await db.from('gateway_sweeps').update({ last_error: transferResult.message || 'No Gateway attestation' }).eq('id', sweepId)
      return { success: false, message: `Gateway transfer error: ${transferResult.message || 'No attestation'}` }
    }
    await db.from('gateway_sweeps').update({ attestation: transferResult.attestation,
      gateway_signature: transferResult.signature, updated_at: new Date().toISOString() }).eq('id', sweepId)

    // 4. Submit gatewayMint transaction to Arc Mainnet
    const mintCiphertext = await generateDynamicCiphertext(rawSecret, apiKey)
    const mintRes = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        walletId: walletId,
        contractAddress: MAINNET_GATEWAY_MINTER,
        abiFunctionSignature: 'gatewayMint(bytes,bytes)',
        abiParameters: [transferResult.attestation, transferResult.signature],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: mintCiphertext
      })
    })

    const mintData = await mintRes.json()
    const txId = mintData.data?.id
    if (!mintRes.ok || !txId) {
      await db.from('gateway_sweeps').update({ last_error: mintData.message || 'Mint submission returned no ID' }).eq('id', sweepId)
      return { success: false, message: `Gateway mint submission failed: ${mintData.message || 'no transaction ID'}` }
    }
    await db.from('gateway_sweeps').update({ status: 'submitted', mint_transaction_id: txId,
      updated_at: new Date().toISOString() }).eq('id', sweepId)
    const mint = await getCircleTransaction(txId, 'arc-mainnet')
    if (mint.state !== 'COMPLETE' || !mint.txHash) {
      return { success: false, message: `Gateway mint ${mint.state}; transaction ${txId} requires reconciliation`, txHash: txId, amount: netWithdrawAmount }
    }
    await db.from('gateway_sweeps').update({ status: 'confirmed', transaction_hash: mint.txHash,
      updated_at: new Date().toISOString() }).eq('id', sweepId)

    return {
      success: true,
      message: `Disbursement of ${netWithdrawAmount} USDC confirmed to ${treasuryAddress}`,
      amount: netWithdrawAmount,
      txHash: mint.txHash
    }
  } catch (err: any) {
    if (sweepId) {
      await createAdminClient().from('gateway_sweeps').update({ last_error: err.message || 'Unknown error' }).eq('id', sweepId)
    }
    console.error('autoDisburseGatewayBalance exception:', err)
    return { success: false, message: err.message || 'Unknown error' }
  }
}

// Current USDC held in the treasury's Arc mainnet Gateway balance. Used by the
// Gateway rail to wait for a settled payment to land before sweeping it on-chain.
export async function getTreasuryGatewayBalance(): Promise<number> {
  const treasuryAddress = getTreasuryAddress('arc-mainnet')
  const res = await fetch('https://gateway-api.circle.com/v1/balances', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ARC-PRIVATE-MAINNET-ENABLED': 'true',
    },
    body: JSON.stringify({ token: 'USDC', sources: [{ depositor: treasuryAddress, domain: 26 }] }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Gateway balance fetch failed: ${data.message || res.statusText}`)
  }
  return parseFloat(data.balances?.[0]?.balance || '0')
}

// Withdraw a specific amount from the treasury's Arc mainnet Gateway balance
// straight to an arbitrary destination. This is how the Gateway rail refunds a
// buyer: the unspent budget comes from the very pool their payment settled into,
// so it does not depend on on-chain float. Falls back to on-chain elsewhere.
export async function withdrawGatewayTo(
  destination: string,
  amountUsdc: string,
  network: string = 'arc-mainnet'
): Promise<{ success: boolean; message: string; txHash?: string }> {
  try {
    if (network !== 'arc-mainnet') {
      return { success: false, message: 'Gateway withdrawal refunds are only enabled for Arc Mainnet' }
    }

    const amount = parseFloat(amountUsdc)
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid refund amount' }
    }

    let apiKey: string
    let walletId: string
    let rawSecret: string
    let treasuryAddress: string
    try {
      const creds = getCircleCredentials('arc-mainnet')
      apiKey = creds.apiKey
      walletId = creds.walletId
      rawSecret = creds.rawEntitySecret
      treasuryAddress = getTreasuryAddress('arc-mainnet')
    } catch (credErr: any) {
      return { success: false, message: credErr.message }
    }

    const available = await getTreasuryGatewayBalance()
    if (amount + BASE_SETTLEMENT_FEE > available) {
      return {
        success: false,
        message: `Insufficient Gateway balance (${available.toFixed(4)}) for refund of ${amount}`,
      }
    }

    const addressToBytes32 = (addr: string) => pad(addr.toLowerCase() as `0x${string}`, { size: 32 })
    const valueAtomic = parseUnits(amount.toFixed(6), 6)
    const salt = `0x${crypto.randomBytes(32).toString('hex')}` as `0x${string}`

    const burnIntent = {
      maxBlockHeight: maxUint256.toString(),
      maxFee: parseUnits('2.01', 6).toString(),
      spec: {
        version: 1,
        sourceDomain: 26,
        destinationDomain: 26,
        sourceContract: addressToBytes32(MAINNET_GATEWAY_WALLET),
        destinationContract: addressToBytes32(MAINNET_GATEWAY_MINTER),
        sourceToken: addressToBytes32(USDC_ARC_MAINNET),
        destinationToken: addressToBytes32(USDC_ARC_MAINNET),
        sourceDepositor: addressToBytes32(treasuryAddress),
        destinationRecipient: addressToBytes32(destination),
        sourceSigner: addressToBytes32(treasuryAddress),
        destinationCaller: addressToBytes32(ZERO_ADDRESS),
        value: valueAtomic.toString(),
        salt,
        hookData: '0x',
      },
    }

    const typedData = {
      domain: { name: 'GatewayWallet', version: '1' },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        TransferSpec: [
          { name: 'version', type: 'uint32' },
          { name: 'sourceDomain', type: 'uint32' },
          { name: 'destinationDomain', type: 'uint32' },
          { name: 'sourceContract', type: 'bytes32' },
          { name: 'destinationContract', type: 'bytes32' },
          { name: 'sourceToken', type: 'bytes32' },
          { name: 'destinationToken', type: 'bytes32' },
          { name: 'sourceDepositor', type: 'bytes32' },
          { name: 'destinationRecipient', type: 'bytes32' },
          { name: 'sourceSigner', type: 'bytes32' },
          { name: 'destinationCaller', type: 'bytes32' },
          { name: 'value', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
          { name: 'hookData', type: 'bytes' },
        ],
        BurnIntent: [
          { name: 'maxBlockHeight', type: 'uint256' },
          { name: 'maxFee', type: 'uint256' },
          { name: 'spec', type: 'TransferSpec' },
        ],
      },
      primaryType: 'BurnIntent',
      message: burnIntent,
    }

    const ciphertext = await generateDynamicCiphertext(rawSecret, apiKey)
    const signRes = await fetch('https://api.circle.com/v1/w3s/developer/sign/typedData', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletId, entitySecretCiphertext: ciphertext, data: JSON.stringify(typedData) }),
    })
    const signData = await signRes.json()
    if (!signRes.ok || !signData.data?.signature) {
      return { success: false, message: `Circle sign failed: ${signData.message || 'no signature'}` }
    }

    const transferRes = await fetch('https://gateway-api.circle.com/v1/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ARC-PRIVATE-MAINNET-ENABLED': 'true' },
      body: JSON.stringify([{ burnIntent, signature: signData.data.signature }]),
    })
    const transferResult = await transferRes.json()
    if (!transferRes.ok || !transferResult.attestation || !transferResult.signature) {
      return { success: false, message: `Gateway transfer failed: ${transferResult.message || 'no attestation'}` }
    }

    const mintCiphertext = await generateDynamicCiphertext(rawSecret, apiKey)
    const mintRes = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        walletId,
        contractAddress: MAINNET_GATEWAY_MINTER,
        abiFunctionSignature: 'gatewayMint(bytes,bytes)',
        abiParameters: [transferResult.attestation, transferResult.signature],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: mintCiphertext,
      }),
    })
    const mintData = await mintRes.json()
    if (!mintRes.ok || !mintData.data?.id) {
      return { success: false, message: `gatewayMint failed: ${mintData.message || 'unknown error'}` }
    }

    const mint = await getCircleTransaction(mintData.data.id, 'arc-mainnet')
    if (mint.state !== 'COMPLETE' || !mint.txHash) {
      return { success: false, message: `Gateway withdrawal ${mint.state}; transaction ${mintData.data.id} requires reconciliation`, txHash: mintData.data.id }
    }
    return { success: true, message: `Gateway withdrawal confirmed to ${destination}`, txHash: mint.txHash }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gateway withdrawal failed' }
  }
}
