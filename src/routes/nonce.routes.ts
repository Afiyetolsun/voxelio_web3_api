import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKey.middleware';
import { fetchCosmicNonce } from '../services/orbitport.service';

const router = Router();

/**
 * POST /api/nonce
 * Body: empty
 * Returns: { nonce, satSig, expiresAt, src, stub }
 *
 * The iOS ProofSession calls this once per scan, just before starting
 * capture, so the nonce ends up bound into the scene (visual QR + spoken
 * audio) and the Orbitport signature ends up in the proof bundle.
 */
router.post('/', async (_req, res, next) => {
  try {
    const nonce = await fetchCosmicNonce();
    res.json({
      nonce: nonce.nonce,
      satSig: nonce.satSig,
      satPk: nonce.satPk,
      src: nonce.src,
      expiresAt: nonce.expiresAt,
      stub: nonce.stub,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
