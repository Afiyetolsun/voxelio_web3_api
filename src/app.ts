import express, { Express } from 'express';

export function createApp(): Express {
  const app: Express = express();
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  return app;
}

export default createApp();
