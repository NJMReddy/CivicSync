/**
 * @file media.controller.js
 * @description Controller endpoints for media upload and protected media delivery.
 */

const https = require('https');
const http = require('http');
const mediaService = require('./media.service');
const { AppError } = require('../../stubs/error.stub');

/**
 * Upload an image file.
 * POST /api/v1/media
 */
async function uploadMedia(req, res, next) {
  try {
    if (!req.file && !req.body.buffer) {
      throw new AppError('FILE_REQUIRED', 'Multipart image file is required in field "image"', 400);
    }

    const fileBuffer = req.file ? req.file.buffer : Buffer.from(req.body.buffer, 'base64');
    const mimeType = req.file ? req.file.mimetype : req.body.mimeType || 'image/jpeg';
    const purpose = req.body.purpose || 'resident_evidence';
    const viewpointId = req.body.viewpointId || null;

    const mediaDto = await mediaService.handleMediaUpload({
      fileBuffer,
      mimeType,
      ownerId: req.user._id,
      purpose,
      viewpointId
    });

    res.status(201).json({
      success: true,
      media: mediaDto
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deliver protected media bytes to authorized client.
 * GET /api/v1/media/:id/content
 */
async function getMediaContent(req, res, next) {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    // Report lookup helper passed in or dynamically imported to avoid circular dependencies
    const reportLookupFn = req.app.get('reportLookupFn') || (async (reportId) => {
      const { Report } = require('../reports/report.model');
      return await Report.findById(reportId);
    });

    const { media, authenticatedStreamUrl } = await mediaService.authorizeAndServeMedia({
      mediaId: id,
      requestingUser,
      reportLookupFn
    });

    // Set secure private delivery headers
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', `image/${media.format === 'jpg' ? 'jpeg' : media.format}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // In mock/test environments or simulated stream URL
    if (!authenticatedStreamUrl || authenticatedStreamUrl.includes('mock_cloud')) {
      // Send a valid minimal 1x1 image placeholder buffer of correct format
      const mockBuffers = {
        jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]),
        png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
        webp: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x0e, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00])
      };
      return res.status(200).send(mockBuffers[media.format] || mockBuffers.jpg);
    }

    // Stream live Cloudinary bytes
    const client = authenticatedStreamUrl.startsWith('https') ? https : http;
    client.get(authenticatedStreamUrl, (streamRes) => {
      if (streamRes.statusCode >= 400) {
        return next(new AppError('UPSTREAM_MEDIA_ERROR', 'Cloudinary media stream failed', 502));
      }
      streamRes.pipe(res);
    }).on('error', (err) => {
      next(new AppError('UPSTREAM_MEDIA_UNAVAILABLE', 'Failed to retrieve media from storage', 503));
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadMedia,
  getMediaContent
};
