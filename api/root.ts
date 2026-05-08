import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Cheap probe handler for `/` and `/favicon.ico`. Avoids booting the
 * full Express app for browser pings.
 */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  const path = (req.url ?? '/').split('?')[0] ?? '/';

  if (path === '/favicon.ico') {
    res.status(204).end();
    return;
  }

  res.status(200).json({
    name: 'voxelio-web3-api',
    docs: 'https://github.com/lagodish/voxelio_web3_api',
  });
}
