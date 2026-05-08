import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { message: err.message, details: err.details },
    });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Unhandled error', err);
  res.status(500).json({ error: { message } });
}
