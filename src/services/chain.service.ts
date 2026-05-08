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
 * ABI for RealityProof.sol on Base Sepolia.
 * Source: github.com/Afiyetolsun/proof_of_reality/blob/main/contracts/contracts/RealityProof.sol
 *
 * Each captured proof bundle becomes one ERC-721 token. The contract
 * stores commitments only; verification is off-chain in the viewer.
 */
export const RealityProofAbi = parseAbi([
  'event RealityMinted(uint256 indexed tokenId, address indexed to, bytes32 indexed bundleHash, string swarmRef, string bundleRef, uint8 attestationType, address attestor, uint8 mode, uint64 capturedAt)',
  'function mint(address to, bytes32 bundleHash, string swarmRef, string bundleRef, bytes satSig, bytes cosmoSig, bytes attestation, uint8 attestationType, address attestor, uint64 capturedAt, uint8 mode) external returns (uint256)',
]);

export interface MintInput {
  swarmRef: string;
  bundleRef: string;
  bundleHash: string;
  satSig: string;            // hex from Orbitport (or 'STUB')
  cosmoSig?: string;         // optional KMS co-sig, may be ''
  attestation: string;       // base64 from App Attest (or 'MOCK')
  attestationType: number;   // 0 = appAttest, 1 = deviceSE
  attestor?: string;         // optional org address for deviceSE
  capturedAt: number;        // unix seconds when the user pressed start
  mode: number;              // 0 = roomPlan, 1 = objectCapture, 2 = stereoFusion
  recipient?: string;        // defaults to the minter wallet
}

export interface MintResult {
  txHash: string;
  tokenId: string;
  ensName: string | null;
  stub: boolean;
}

const ZERO_ADDRESS: Hex = '0x0000000000000000000000000000000000000000';

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
  const satSig = asBytes(input.satSig === 'STUB' ? '0x00' : input.satSig);
  const cosmoSig = asBytes(input.cosmoSig ?? '');
  const attestation = encodeAttestation(input.attestation);
  const attestor = (input.attestor ?? ZERO_ADDRESS) as Hex;

  const txHash = await wallet.writeContract({
    address: env.REALITY_PROOF_ADDRESS as Hex,
    abi: RealityProofAbi,
    functionName: 'mint',
    args: [
      recipient,
      bundleHash,
      input.swarmRef,
      input.bundleRef,
      satSig,
      cosmoSig,
      attestation,
      input.attestationType,
      attestor,
      BigInt(input.capturedAt),
      input.mode,
    ],
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
      if (decoded.eventName === 'RealityMinted') {
        tokenId = decoded.args.tokenId.toString();
        break;
      }
    } catch {
      // not our event
    }
  }

  return { txHash, tokenId, ensName: null, stub: false };
}

function asHex(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

/** Coerces "stub", '', '0x...', or raw hex to a non-empty hex bytes value. */
function asBytes(value: string): Hex {
  if (!value || value === 'STUB' || value === 'MOCK') return '0x';
  return asHex(value);
}

function encodeAttestation(value: string): Hex {
  if (!value || value === 'MOCK') {
    // Contract requires non-empty attestation, so use a single sentinel byte.
    return '0x00';
  }
  try {
    const buf = Buffer.from(value, 'base64');
    return `0x${buf.toString('hex')}` as Hex;
  } catch {
    return '0x00';
  }
}
