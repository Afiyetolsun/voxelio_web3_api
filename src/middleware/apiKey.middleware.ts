import type { Request, Response, NextFunction } from 'express';
import env from '../config/env';

/**
 * Cheap shared-secret check between the iOS app and the relay. The iOS
 * app sends X-Voxelio-Key on every request; we reject anything missing
 * or wrong. This isn't device-attestation-grade — it's just a gate to
 * keep random internet traffic out of the Orbitport / minter calls.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const provided = req.header('X-Voxelio-Key');
  if (!provided || provided !== env.IOS_SHARED_SECRET) {
    res.status(401).json({ error: { message: 'Unauthorized' } });
    return;
  }
  next();
}
