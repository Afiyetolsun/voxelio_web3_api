import { createHash, randomBytes } from 'node:crypto';
import env from '../config/env';
import logger from '../utils/logger';

export interface SwarmPin {
  swarmRef: string;
  bytes: number;
  stub: boolean;
}

/**
 * Pins a single file to Swarm via the bee gateway. Without a postage
 * batch we can't actually pay for storage, so we fabricate a deterministic
 * stub reference (sha256 of the bytes) and flag it so the verifier can
 * tell. Same response shape either way.
 */
export async function pinToSwarm(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<SwarmPin> {
  if (!env.SWARM_POSTAGE_BATCH_ID) {
    logger.warn(`Swarm postage batch missing — stubbing pin for ${filename}`);
    const sha = createHash('sha256').update(buffer).digest('hex');
    return { swarmRef: `stub:${sha}`, bytes: buffer.length, stub: true };
  }

  const url = `${env.SWARM_BEE_URL}/bzz?name=${encodeURIComponent(filename)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'swarm-postage-batch-id': env.SWARM_POSTAGE_BATCH_ID,
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Swarm pin failed: ${response.status} ${body}`);
  }

  const json = (await response.json()) as { reference: string };
  return { swarmRef: json.reference, bytes: buffer.length, stub: false };
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function freshTraceId(): string {
  return randomBytes(8).toString('hex');
}
