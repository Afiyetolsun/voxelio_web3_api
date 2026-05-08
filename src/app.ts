import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import env from './config/env';
import { requireApiKey } from './middleware/apiKey.middleware';
import { errorHandler } from './middleware/error.middleware';
import mintRoutes from './routes/mint.routes';
import nonceRoutes from './routes/nonce.routes';
import uploadRoutes from './routes/upload.routes';
import logger from './utils/logger';

declare module 'express' {
  interface Request { id?: string; }
}

export function createApp(): Express {
  const app: Express = express();
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // CORS off — the iOS app talks to this directly, no browsers in the loop.
  app.use(cors({ origin: false, credentials: false }));

  // Generous JSON limit so signed bundle payloads have room. File uploads
  // go through multer in upload.routes and bypass this.
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/nonce', requireApiKey, nonceRoutes);
  app.use('/api/upload', requireApiKey, uploadRoutes);
  app.use('/api/mint', requireApiKey, mintRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Route not found' } });
  });

  app.use(errorHandler);

  logger.info(`createApp() ready (env=${env.NODE_ENV})`);
  return app;
}

export default createApp();
