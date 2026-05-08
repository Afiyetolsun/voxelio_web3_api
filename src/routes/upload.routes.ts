import { Router } from 'express';
import multer from 'multer';
import { HttpError } from '../middleware/error.middleware';
import { pinToSwarm, sha256Hex } from '../services/swarm.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 4 },
});

/**
 * POST /api/upload
 * multipart/form-data:
 *   bundle  — bundle.json (required)
 *   scene   — scene.usdz (required)
 *   audio   — nonce_audio.m4a (optional)
 * Returns: { swarmRef, bundleHash, sceneBytes, stub }
 */
router.post(
  '/',
  upload.fields([
    { name: 'bundle', maxCount: 1 },
    { name: 'scene', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const bundle = files?.bundle?.[0];
      const scene = files?.scene?.[0];

      if (!bundle) throw new HttpError(400, 'Missing "bundle" part');
      if (!scene) throw new HttpError(400, 'Missing "scene" part');

      // Hash the bundle bytes as received. iOS sent canonical (sorted-keys)
      // JSON, so this matches the hash the device computed and the value
      // the smart contract will store.
      const bundleHash = sha256Hex(bundle.buffer);

      const scenePin = await pinToSwarm(
        scene.buffer,
        scene.mimetype || 'model/vnd.usdz+zip',
        scene.originalname || 'scene.usdz',
      );

      res.json({
        swarmRef: scenePin.swarmRef,
        bundleHash,
        sceneBytes: scenePin.bytes,
        stub: scenePin.stub,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
