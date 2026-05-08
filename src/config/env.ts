import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),

  IOS_SHARED_SECRET: z.string().min(1).default('changeme'),

  // Orbitport (cosmic randomness). All optional — when missing, /api/nonce
  // falls back to a deterministic stub that mirrors the response shape.
  ORBITPORT_CLIENT_ID: z.string().optional(),
  ORBITPORT_CLIENT_SECRET: z.string().optional(),
  ORBITPORT_AUDIENCE: z.string().default('https://op.spacecomputer.io/api'),
  ORBITPORT_TOKEN_URL: z.string().default('https://auth.spacecomputer.io/oauth/token'),
  ORBITPORT_TRNG_URL: z.string().default('https://op.spacecomputer.io/api/v1/services/trng'),

  // Swarm (decentralised storage). Without a postage batch, /api/upload
  // returns a stub swarmRef.
  SWARM_BEE_URL: z.string().default('https://api.gateway.ethswarm.org'),
  SWARM_POSTAGE_BATCH_ID: z.string().optional(),

  // Base Sepolia minter. Without these, /api/mint returns a stub txHash.
  BASE_SEPOLIA_RPC: z.string().default('https://sepolia.base.org'),
  MINTER_PRIVATE_KEY: z.string().optional(),
  REALITY_PROOF_ADDRESS: z.string().optional(),

  ENS_PARENT_DOMAIN: z.string().default('realityproof.eth'),
  ENS_RESOLVER_PRIVATE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[ENV] Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = parsed.data;
export default env;
