/**
 * Centralized error handling middleware
 * @module server/middleware/errorHandler
 */

/**
 * Error handler middleware - must be last middleware
 */
export function errorHandler(err, req, res, next) {
  // Log error details for debugging
  const errorInfo = {
    message: err.message,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  };
  
  if (process.env.NODE_ENV === 'development') {
    errorInfo.stack = err.stack;
  }
  
  console.error('[error]', errorInfo);
  
  // Send appropriate error response
  const status = err.status || err.statusCode || 500;
  const message = err.expose !== false ? err.message : 'Internal server error';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * Not found handler - use before error handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export default { errorHandler, notFoundHandler };
