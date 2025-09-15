# Security Knowledge

## Critical Security Fixes Applied

### Path Traversal Protection
- Sanitize all file paths from user input
- Restrict to base directories using `path.resolve()` and `.startsWith()` checks
- Only allow .json files for savegame operations
- Validate IDs to alphanumeric format in strain/device stores

### Authentication & Control
- Default `ALLOW_UNSAFE_CONTROL=false` in production
- Only enable unsafe control explicitly in development
- Add rate limiting middleware (100 req/min default)
- Validate and clamp all numeric inputs

### CORS Configuration
- Make CORS origins configurable via `CORS_ORIGINS` env variable
- Support comma-separated list of allowed origins
- Default to localhost:5173 for development

### Input Validation
- Limit request body size to 256kb
- Validate ticks (1-1000), speed (0.25-16)
- Sanitize RUN_ID to alphanumeric only
- Schema validation for strains using Ajv

### Async Safety
- Fixed tick overlap using inFlight guard
- Replaced setInterval with guarded setTimeout loop
- Prevents concurrent simulation steps

## Environment Variables

Secure defaults:
```
NODE_ENV=production
ALLOW_UNSAFE_CONTROL=false
CORS_ORIGINS=https://your-domain.com
RATE_LIMIT_MAX=100
SAVEGAME_BASE_DIR=data/savegames
```

## Best Practices

1. **Never trust user input** - Always validate and sanitize
2. **Default to secure** - Require explicit opt-in for dangerous features
3. **Rate limit everything** - Prevent DoS attacks
4. **Log security events** - Track path traversal attempts
5. **Use environment config** - Don't hardcode security settings
6. **Validate schemas** - Use Ajv for JSON validation
7. **Guard async operations** - Prevent race conditions

## Testing Security

Run tests after security changes:
```bash
npm test
```

Check for vulnerabilities:
```bash
npm audit
```
