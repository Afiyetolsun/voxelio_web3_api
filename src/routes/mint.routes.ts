import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/error.middleware';
import { mintRealityProof } from '../services/chain.service';

const router = Router();

const MintBody = z.object({
  swarmRef: z.string().min(1),
  bundleHash: z.string().min(1),
  satSig: z.string().default('STUB'),
  attestation: z.string().default('MOCK'),
  recipient: z.string().optional(),
});

/**
 * POST /api/mint
 * Body: { swarmRef, bundleHash, attestation, satSig?, recipient? }
 * Returns: { txHash, tokenId, ensName, stub }
 *
 * Final step in the pipeline. iOS calls this after /api/upload returns
 * a swarmRef, passing the App Attest assertion over the bundle hash.
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
