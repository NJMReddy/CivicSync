/**
 * @file auth.middleware.stub.js
 * @description Named stub for JWT authentication and server-side authorization middleware (Task I3 dependency).
 * In accordance with PROJECT_PLAN.md:
 * - JWTs are in Secure, HttpOnly cookies (30-minute absolute expiry).
 * - Protected routes verify user in MongoDB (active status, role, departmentId).
 * - Unauthorized resident/official/cross-department requests fail server-side.
 */

const { AppError } = require('./error.stub');

/**
 * Middleware stub to authenticate user and verify active status.
 */
function authenticateUser(req, res, next) {
  // If user is already set by test harness or session stub, use it
  if (req.user) {
    if (!req.user.active) {
      return next(new AppError('ACCOUNT_INACTIVE', 'User account is deactivated', 401));
    }
    return next();
  }

  // Simulated cookie extraction or mock token check
  const authHeader = req.headers['authorization'];
  const mockToken = req.cookies?.['civicsync_token'] || (authHeader && authHeader.split(' ')[1]);

  if (!mockToken) {
    return next(new AppError('UNAUTHENTICATED', 'Sign-in required to access this resource', 401));
  }

  // Decode mock token or test payload
  try {
    const parsed = JSON.parse(Buffer.from(mockToken, 'base64').toString('utf8'));
    if (!parsed._id || !parsed.role) {
      return next(new AppError('INVALID_TOKEN', 'Malformed authentication token', 401));
    }
    if (parsed.active === false) {
      return next(new AppError('ACCOUNT_INACTIVE', 'User account is deactivated', 401));
    }
    req.user = parsed;
    next();
  } catch (err) {
    return next(new AppError('INVALID_TOKEN', 'Invalid or expired token', 401));
  }
}

/**
 * Middleware stub to enforce required roles.
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHENTICATED', 'Sign-in required', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN_ROLE', 'Insufficient authority for this operation', 403));
    }
    next();
  };
}

/**
 * Enforces CSRF token check for cookie-authenticated state-changing requests.
 */
function requireCsrf(req, res, next) {
  // Safe methods pass through
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken) {
    return next(new AppError('CSRF_MISSING', 'Missing CSRF token in X-CSRF-Token header', 403));
  }
  next();
}

module.exports = {
  authenticateUser,
  requireRole,
  requireCsrf
};
