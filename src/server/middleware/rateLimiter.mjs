/**
 * Simple in-memory rate limiter middleware
 * @module server/middleware/rateLimiter
 */

const requestCounts = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 100;

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > WINDOW_MS) {
      requestCounts.delete(key);
    }
  }
}, WINDOW_MS);

/**
 * Create a rate limiter middleware
 * @param {{ maxRequests?: number, windowMs?: number }} options
 */
export function createRateLimiter(options = {}) {
  const maxRequests = options.maxRequests || MAX_REQUESTS;
  const windowMs = options.windowMs || WINDOW_MS;

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    let data = requestCounts.get(key);
    
    if (!data || now - data.windowStart > windowMs) {
      data = { count: 0, windowStart: now };
      requestCounts.set(key, data);
    }
    
    data.count++;
    
    if (data.count > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((data.windowStart + windowMs - now) / 1000)
      });
    }
    
    next();
  };
}

export default createRateLimiter;
