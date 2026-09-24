import fs from 'fs';
import crypto from 'crypto';
import { pad, parseUnits, formatUnits, maxUint256 } from 'viem';

const envContent = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf-8') : '';
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=["']?([^"'\r\n]+)["']?`));
  return match ? match[1].trim() : process.env[key] || null;
};

const apiKey = getEnv('CIRCLE_API_KEY_MAINNET');
const rawSecret = getEnv('RAW_ENTITY_SECRET_MAINNET');
const walletId = getEnv('CIRCLE_WALLET_ID_MAINNET');
const treasuryAddress = getEnv('AGENT_TREASURY_ADDRESS_MAINNET') || '0x30d20839e4279358dd0c908cb7d96424e683aba3';
const privateKey = getEnv('PRIVATE_KEY') || getEnv('TREASURY_PRIVATE_KEY');

const withdrawAmountArg = process.argv[2] || '1';

console.log('====================================================');
console.log(' CiteFlow AI: On Demand Gateway Balance Withdrawal ');
console.log('====================================================');
console.log('Network: Arc Mainnet (Chain ID 5042, Domain 26)');
console.log('Treasury Address:', treasuryAddress);
console.log('Requested Withdrawal Amount:', withdrawAmountArg, 'USDC\n');

async function getGatewayBalance(address) {
  const res = await fetch('https://gateway-api.circle.com/v1/balances', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ARC-PRIVATE-MAINNET-ENABLED': 'true'
    },
    body: JSON.stringify({
      token: 'USDC',
      sources: [{ depositor: address, domain: 26 }]
    })
  });

  const data = await res.json();
  if (data.balances && data.balances.length > 0) {
    return data.balances[0];
  }
  return { balance: '0.000000', pendingBatch: '0', domain: 26 };
}

async function generateFreshCiphertext() {
  const response = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Failed to fetch Circle public key: ' + JSON.stringify(data));
  const publicKeyPem = data.data.publicKey;

  return crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(rawSecret, 'hex')
  ).toString('base64');
}

async function withdrawViaGatewayClient(pk, amount) {
  console.log('Executing withdrawal using @circle-fin/x402-batching GatewayClient...');
  const { GatewayClient } = await import('@circle-fin/x402-batching/client');
  const client = new GatewayClient({
    chain: 'arc',
    privateKey: pk,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    arcPrivateMainnet: true
  });

  const balances = await client.getBalances();
  console.log(`Current Available Balance: ${balances.gateway.formattedAvailable} USDC`);

  const result = await client.withdraw(amount);
  console.log('\nWithdrawal successful!');
  console.log('Mint Transaction Hash:', result.mintTxHash);
  console.log('Explorer:', `https://explorer.arc.io/tx/${result.mintTxHash}`);
  return result;
}

async function withdrawViaCircleWallet(amount) {
  console.log('Executing withdrawal using Circle Developer Controlled Wallet API...');
  
  if (!apiKey || !rawSecret || !walletId) {
    throw new Error('Missing Circle Developer Wallet credentials in .env.local');
  }

  const MAINNET_GATEWAY_WALLET = '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE';
  const MAINNET_GATEWAY_MINTER = '0x2222222d7164433c4C09B0b0D809a9b52C04C205';
  const USDC_ARC_MAINNET = '0x3600000000000000000000000000000000000000';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const addressToBytes32 = (addr) => pad(addr.toLowerCase(), { size: 32 });
  const valueAtomic = parseUnits(amount, 6);
  const maxFeeAtomic = parseUnits('2.01', 6);
  const salt = `0x${crypto.randomBytes(32).toString('hex')}`;

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
  };

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
  };

  console.log('1. Generating fresh entity secret ciphertext...');
  const ciphertext = await generateFreshCiphertext();

  console.log('2. Requesting EIP 712 signature from Circle Developer Controlled Wallet API...');
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
  });

  const signData = await signRes.json();
  console.log('Circle Sign API Response Status:', signRes.status);
  
  if (!signRes.ok) {
    console.log('Sign API Details:', JSON.stringify(signData, null, 2));
    throw new Error(`Circle sign API failed: ${signData.message || JSON.stringify(signData)}`);
  }

  const signature = signData.data?.signature;
  console.log('Obtained signature from Circle API:', signature ? 'Success' : 'Pending challenge');

  console.log('3. Submitting signed BurnIntent to Circle Gateway API (/transfer)...');
  const transferRes = await fetch('https://gateway-api.circle.com/v1/transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ARC-PRIVATE-MAINNET-ENABLED': 'true'
    },
    body: JSON.stringify([{ burnIntent, signature }])
  });

  const transferResult = await transferRes.json();
  console.log('Circle Gateway API Transfer Response:');
  console.log(JSON.stringify(transferResult, null, 2));

  if (!transferResult.attestation || !transferResult.signature) {
    throw new Error(`Circle Gateway did not return an attestation: ${transferResult.message || 'Unknown error'}`);
  }

  console.log('\n4. Executing gatewayMint on Arc Mainnet Gateway Minter...');
  console.log('Minter Contract:', MAINNET_GATEWAY_MINTER);
  const mintCiphertext = await generateFreshCiphertext();

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
  });

  const mintData = await mintRes.json();
  console.log('Contract Execution API Response:');
  console.log(JSON.stringify(mintData, null, 2));

  if (mintData.data?.id) {
    console.log(`\nMint transaction initiated! Transaction ID: ${mintData.data.id}`);
  }

  return { transferResult, mintData };
}

async function main() {
  try {
    const bal = await getGatewayBalance(treasuryAddress);
    console.log(`Current Verified Gateway Available Balance: ${bal.balance} USDC`);

    if (parseFloat(bal.balance) < parseFloat(withdrawAmountArg)) {
      console.log(`\nNotice: Available balance (${bal.balance} USDC) is less than requested withdrawal (${withdrawAmountArg} USDC).`);
      return;
    }

    if (privateKey) {
      await withdrawViaGatewayClient(privateKey, withdrawAmountArg);
    } else {
      await withdrawViaCircleWallet(withdrawAmountArg);
    }
  } catch (err) {
    console.error('\nWithdrawal operation error:', err.message);
  }
}

main();
