/**
 * @file error.stub.js
 * @description Standard error definition and response formatter conforming to CivicSync error contract.
 */

class AppError extends Error {
  constructor(code, message, statusCode = 400, fieldErrors = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Express error middleware handler returning standard error shape.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const responseBody = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      requestId
    }
  };

  if (err.fieldErrors) {
    responseBody.error.fieldErrors = err.fieldErrors;
  }

  res.status(statusCode).json(responseBody);
}

module.exports = {
  AppError,
  errorHandler
};
