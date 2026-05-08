import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/error.middleware';
import { mintRealityProof } from '../services/chain.service';

const router = Router();

const MintBody = z.object({
  swarmRef: z.string().min(1),
  bundleRef: z.string().min(1),
  bundleHash: z.string().min(1),
  satSig: z.string().default('STUB'),
  cosmoSig: z.string().default(''),
  attestation: z.string().default('MOCK'),
  attestationType: z.number().int().min(0).max(1).default(0),
  attestor: z.string().optional(),
  capturedAt: z.number().int().nonnegative(),
  mode: z.number().int().min(0).max(2),
  recipient: z.string().optional(),
});

/**
 * POST /api/mint
 * Body matches the RealityProof.sol mint() signature plus a few iOS
 * convenience fields. iOS calls this after /api/upload (or skip-upload)
 * with the App Attest assertion over the bundle hash.
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = MintBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid mint payload', parsed.error.flatten());
    }
    const result = await mintRealityProof(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
