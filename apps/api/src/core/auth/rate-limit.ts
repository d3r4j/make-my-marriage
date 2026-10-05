import type { Request, Response, NextFunction } from 'express';

interface WindowEntry { count: number; resetAt: number }
const requests = new Map<string, WindowEntry>();
const windowMs = 15 * 60 * 1000;

/** A simple per-process auth limit for the initial single-instance V1 deployment. */
export function authRateLimit(limit: number) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${request.ip ?? 'unknown'}:${request.path}`;
    let entry = requests.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      requests.set(key, entry);
    }
    entry.count += 1;

    if (requests.size > 1000) {
      for (const [storedKey, storedEntry] of requests) {
        if (storedEntry.resetAt <= now) requests.delete(storedKey);
      }
    }
    response.setHeader('RateLimit-Limit', limit);
    response.setHeader('RateLimit-Remaining', Math.max(0, limit - entry.count));
    response.setHeader('RateLimit-Reset', Math.ceil((entry.resetAt - now) / 1000));
    if (entry.count > limit) {
      response.status(429).json({ success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many attempts. Please try again later.' } });
      return;
    }
    next();
  };
}
