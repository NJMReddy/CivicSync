/**
 * @file media.routes.js
 * @description Express routes for Media domain in CivicSync.
 * Registered under /api/v1/media
 */

const express = require('express');
const mediaController = require('./media.controller');
const { authenticateUser, requireCsrf } = require('../../stubs/auth.middleware.stub');

const router = express.Router();

// Memory-based file upload middleware (using multer if installed, or body parser fallback)
let uploadMiddleware;
try {
  const multer = require('multer');
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 2 * 1024 * 1024 // 2 MB limit
    }
  });
  uploadMiddleware = upload.single('image');
} catch (_) {
  // Graceful fallback for lightweight testing environments
  uploadMiddleware = (req, res, next) => next();
}

/**
 * POST /api/v1/media
 * Upload bounded image to Cloudinary (authenticated delivery by default).
 * Enforces CSRF check and authenticated user.
 */
router.post(
  '/',
  authenticateUser,
  requireCsrf,
  uploadMiddleware,
  mediaController.uploadMedia
);

/**
 * GET /api/v1/media/:id/content
 * Retrieve protected media bytes. Direct streaming with Cache-Control: private, no-store.
 * Enforces ownership or department/coordinator authority.
 */
router.get(
  '/:id/content',
  authenticateUser,
  mediaController.getMediaContent
);

module.exports = router;
