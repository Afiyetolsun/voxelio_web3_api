import { randomBytes } from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import env from '../config/env';
import logger from '../utils/logger';

/**
 * Tentative ABI for the RealityProof contract on Base Sepolia. The
 * contracts repo will own the canonical version — this stays in sync
 * by hand for now and gets re-extracted from the artifact once the
 * teammate publishes it.
 */
export const RealityProofAbi = parseAbi([
  'event Minted(uint256 indexed tokenId, address indexed to, bytes32 indexed bundleHash)',
  'function mint(address to, bytes32 bundleHash, string swarmRef, bytes satSig, bytes attestation) external returns (uint256)',
]);

export interface MintInput {
  swarmRef: string;
  bundleHash: string;        // 0x-prefixed or bare hex; we normalise
  satSig: string;            // hex from Orbitport (or 'STUB')
  attestation: string;       // base64 from App Attest (or 'MOCK')
  recipient?: string;        // optional — defaults to the minter wallet
}

export interface MintResult {
  txHash: string;
  tokenId: string;
  ensName: string | null;
  stub: boolean;
}

export async function mintRealityProof(input: MintInput): Promise<MintResult> {
  const stub = !env.MINTER_PRIVATE_KEY || !env.REALITY_PROOF_ADDRESS;
  if (stub) {
    logger.warn('Minter / contract address missing — stubbing mint');
    return {
      txHash: `0x${randomBytes(32).toString('hex')}`,
      tokenId: String(Math.floor(Math.random() * 100_000)),
      ensName: null,
      stub: true,
    };
  }

  const account = privateKeyToAccount(asHex(env.MINTER_PRIVATE_KEY!));
  const wallet = createWalletClient({
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC),
    account,
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC),
  });

  const recipient = (input.recipient ?? account.address) as Hex;
  const bundleHash = asHex(input.bundleHash);
  const satSig = asHex(input.satSig === 'STUB' ? '0x00' : input.satSig);
  const attestation = encodeAttestation(input.attestation);

  const txHash = await wallet.writeContract({
    address: env.REALITY_PROOF_ADDRESS as Hex,
    abi: RealityProofAbi,
    functionName: 'mint',
    args: [recipient, bundleHash, input.swarmRef, satSig, attestation],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let tokenId = '0';
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: RealityProofAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'Minted') {
        tokenId = decoded.args.tokenId.toString();
        break;
      }
    } catch {
      // Not our event, keep scanning.
    }
  }

  return { txHash, tokenId, ensName: null, stub: false };
}

function asHex(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

function encodeAttestation(value: string): Hex {
  if (value === 'MOCK') return '0x00';
  // App Attest assertions arrive base64-encoded from iOS.
  try {
    const buf = Buffer.from(value, 'base64');
    return `0x${buf.toString('hex')}` as Hex;
  } catch {
    return '0x00';
  }
}
