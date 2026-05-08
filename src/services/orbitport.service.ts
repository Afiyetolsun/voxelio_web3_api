import { randomBytes } from 'node:crypto';
import env from '../config/env';
import logger from '../utils/logger';

export interface CosmicNonce {
  nonce: string;        // 32-byte hex from Orbitport's data field
  satSig: string;       // satellite signature value
  satPk: string;        // satellite public key
  src: string;          // 'aptosorbital' | 'derived' | 'stub'
  expiresAt: number;    // unix seconds; 2 minutes after fetch
  stub: boolean;        // true when no Orbitport keys configured
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Lazy OAuth token fetch. Caches the access_token in process memory
 * (warm Vercel invocations reuse it) until ~1 minute before its real
 * expiry. Falls back to a fresh fetch on every request if caching is
 * stripped by a cold start.
 */
async function getAccessToken(): Promise<string | null> {
  if (!env.ORBITPORT_CLIENT_ID || !env.ORBITPORT_CLIENT_SECRET) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const response = await fetch(env.ORBITPORT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.ORBITPORT_CLIENT_ID,
      client_secret: env.ORBITPORT_CLIENT_SECRET,
      audience: env.ORBITPORT_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Orbitport token fetch failed: ${response.status} ${body}`);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };
  return cachedToken.value;
}

export async function fetchCosmicNonce(): Promise<CosmicNonce> {
  const expiresAt = Math.floor(Date.now() / 1000) + 120;
  const token = await getAccessToken();

  if (!token) {
    logger.warn('Orbitport keys missing — returning stub nonce');
    return {
      nonce: randomBytes(32).toString('hex'),
      satSig: 'STUB',
      satPk: 'STUB',
      src: 'stub',
      expiresAt,
      stub: true,
    };
  }

  const url = `${env.ORBITPORT_TRNG_URL}?src=aptosorbital`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Orbitport TRNG failed: ${response.status} ${body}`);
  }

  const json = (await response.json()) as {
    service: string;
    src: string;
    data: string;
    signature: { value: string; pk: string };
  };

  return {
    nonce: json.data,
    satSig: json.signature.value,
    satPk: json.signature.pk,
    src: json.src,
    expiresAt,
    stub: false,
  };
}
