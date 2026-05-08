import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/app';

// Reuse the Express app across warm Vercel invocations to dodge cold-start cost.
let app: ReturnType<typeof createApp> | null = null;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) app = createApp();
  return app(req, res);
}
