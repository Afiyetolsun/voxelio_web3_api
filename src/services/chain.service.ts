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
 *
 * Custom errors are listed so viem can decode reverts by name instead
 * of opaque selectors like 0xfbce6490.
 */
export const RealityProofAbi = parseAbi([
  'event RealityMinted(uint256 indexed tokenId, address indexed to, bytes32 indexed bundleHash, string swarmRef, string bundleRef, uint8 attestationType, address attestor, uint8 mode, uint64 capturedAt)',
  'function mint(address to, bytes32 bundleHash, string swarmRef, string bundleRef, bytes satSig, bytes cosmoSig, bytes attestation, uint8 attestationType, address attestor, uint64 capturedAt, uint8 mode) external returns (uint256)',
  'error EmptySwarmRef()',
  'error EmptyBundleRef()',
  'error EmptySatSig()',
  'error EmptyCosmoSig()',
  'error EmptyAttestation()',
  'error InvalidMode(uint8 mode)',
  'error InvalidAttestationType(uint8 attestationType)',
  'error DuplicateBundle(bytes32 hash, uint256 existingTokenId)',
  'error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)',
]);

export interface MintInput {
  swarmRef: string;
  bundleRef: string;
  bundleHash: string;
  satSig: string;
  cosmoSig?: string;
  attestation: string;
  attestationType: number;
  attestor?: string;
  capturedAt: number;
  mode: number;
  recipient?: string;
}

export interface MintResult {
  txHash: string;
  tokenId: string;
  ensName: string | null;
  stub: boolean;
}

const ZERO_ADDRESS: Hex = '0x0000000000000000000000000000000000000000';
const SENTINEL: Hex = '0x00';

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

  // Contract reverts with EmptySatSig / EmptyAttestation if these are
  // zero-length, so always pass at least one sentinel byte. The verifier
  // off-chain treats 0x00 as "not yet anchored".
  const satSig = nonEmptyBytes(input.satSig);
  const attestation = nonEmptyBytes(encodeAttestation(input.attestation));
  const cosmoSig = maybeEmptyBytes(input.cosmoSig ?? '');
  const attestor = (input.attestor ?? ZERO_ADDRESS) as Hex;

  const args = [
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
  ] as const;

  logger.info(
    `mint() to=${recipient} bundleHash=${bundleHash} mode=${input.mode} ` +
      `satSig=${satSig.length}b attestation=${attestation.length}b`,
  );

  const txHash = await wallet.writeContract({
    address: env.REALITY_PROOF_ADDRESS as Hex,
    abi: RealityProofAbi,
    functionName: 'mint',
    args,
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

/** Coerces falsy / placeholder strings ('STUB', 'MOCK', '', '0x') to a
 *  one-byte sentinel so the contract's length-check passes. */
function nonEmptyBytes(value: string): Hex {
  if (!value || value === 'STUB' || value === 'MOCK' || value === '0x') {
    return SENTINEL;
  }
  const hex = asHex(value);
  return hex === '0x' ? SENTINEL : hex;
}

/** For fields the contract allows to be empty (cosmoSig). */
function maybeEmptyBytes(value: string): Hex {
  if (!value || value === 'STUB' || value === 'MOCK') return '0x';
  return asHex(value);
}

function encodeAttestation(value: string): string {
  if (!value || value === 'MOCK') return '';
  try {
    const buf = Buffer.from(value, 'base64');
    return `0x${buf.toString('hex')}`;
  } catch {
    return '';
  }
}
