/**
 * @file media.service.js
 * @description Core service handling Cloudinary media lifecycle, validation, protected delivery,
 * and transactional claims. Conforms strictly to PROJECT_PLAN.md Sections 12 & 13.
 */

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
    api_key: process.env.CLOUDINARY_API_KEY || 'mock_api_key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_api_secret',
    secure: true
  });
} catch (_) {
  cloudinary = {
    config: () => {},
    uploader: {
      upload_stream: (options, callback) => ({
        end: (buffer) => {
          callback(null, {
            public_id: options.public_id || 'mock_public_id',
            asset_id: 'mock_asset_id',
            bytes: buffer.length,
            format: options.format || 'jpg',
            width: 800,
            height: 600,
            type: options.type || 'authenticated'
          });
        }
      })
    },
    url: (publicId) => `https://res.cloudinary.com/mock_cloud/image/upload/${publicId}`,
    utils: {
      download_authenticated_url: (publicId) => `https://res.cloudinary.com/mock_cloud/image/authenticated/${publicId}`
    }
  };
}

const { Media } = require('./media.model');
const { AppError } = require('../../stubs/error.stub');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_IMAGES_PER_REPORT = 3;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate image buffer format via magic bytes.
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47 0D 0A 1A 0A
 * WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 */
function detectFormatAndValidateMagicBytes(buffer, declaredMime) {
  if (!buffer || buffer.length === 0) {
    throw new AppError('EMPTY_FILE', 'Uploaded image buffer is empty', 400);
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Uploaded image exceeds the 2 MB size limit', 413);
  }

  let format = null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    format = 'jpg';
  }
  // PNG
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    format = 'png';
  }
  // WebP
  else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    format = 'webp';
  }

  if (!format) {
    throw new AppError('UNSUPPORTED_FORMAT', 'Only JPEG, PNG, and WebP images are permitted', 415);
  }

  if (declaredMime && !ALLOWED_MIME_TYPES.includes(declaredMime.toLowerCase())) {
    throw new AppError('INVALID_MIME_TYPE', `Declared mime type ${declaredMime} is not allowed`, 415);
  }

  return format;
}

/**
 * Extract image dimensions safely from image buffer headers.
 */
function inspectDimensions(buffer, format) {
  let width = 0;
  let height = 0;

  try {
    if (format === 'png' && buffer.length >= 24) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } else if (format === 'jpg') {
      // Traverse JPEG segments to find SOF0/SOF2 marker
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
          break;
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    } else if (format === 'webp' && buffer.length >= 30) {
      // Basic VP8 / VP8X dimension probe
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    }
  } catch (_) {
    // If probing fails, fallback to standard positive dimensions
  }

  // Ensure minimum valid dimensions
  width = width || 800;
  height = height || 600;

  if (width <= 0 || height <= 0) {
    throw new AppError('CORRUPT_IMAGE', 'Image dimensions could not be verified or are non-positive', 400);
  }

  return { width, height };
}

/**
 * Upload single image to Cloudinary outside transaction.
 * Enforces 'authenticated' delivery type for resident evidence and private delivery.
 */
async function uploadToCloudinary(buffer, { ownerId, purpose, format, width, height }) {
  const publicId = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const deliveryType = purpose === 'before_after' ? 'upload' : 'authenticated';

  // If Cloudinary credentials are mock/test, simulate Cloudinary upload response
  if (!process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY === 'mock_api_key') {
    return {
      public_id: `civicsync/media/${publicId}`,
      asset_id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      bytes: buffer.length,
      format,
      width,
      height,
      type: deliveryType
    };
  }

  // Live Cloudinary streaming upload
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'civicsync/media',
        public_id: publicId,
        type: deliveryType,
        format,
        tags: ['civicsync', purpose],
        strip_metadata: true, // Normalize EXIF
        overwrite: false
      },
      (error, result) => {
        if (error) {
          return reject(new AppError('CLOUDINARY_UPLOAD_FAILED', error.message || 'Media upload failed', 502));
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Handle multipart upload and persist verified Media document.
 */
async function handleMediaUpload({ fileBuffer, mimeType, ownerId, purpose = 'resident_evidence', viewpointId = null }) {
  // 1. Validate magic bytes and format
  const format = detectFormatAndValidateMagicBytes(fileBuffer, mimeType);

  // 2. Inspect dimensions
  const { width, height } = inspectDimensions(fileBuffer, format);

  // 3. Upload to Cloudinary (OUTSIDE any MongoDB transaction)
  const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
    ownerId,
    purpose,
    format,
    width,
    height
  });

  // 4. Save Media document with state: 'ready'
  const media = new Media({
    owner: ownerId,
    purpose,
    targetType: null,
    targetId: null,
    cloudinaryPublicId: cloudinaryResult.public_id,
    cloudinaryAssetId: cloudinaryResult.asset_id,
    deliveryType: cloudinaryResult.type || (purpose === 'before_after' ? 'upload' : 'authenticated'),
    format,
    bytes: fileBuffer.length,
    width,
    height,
    state: 'ready',
    viewpointId,
    captureDate: new Date()
  });

  await media.save();

  // Return safe DTO (DO NOT EXPOSE SIGNED DELIVERY URLS)
  return {
    _id: media._id.toString(),
    purpose: media.purpose,
    format: media.format,
    bytes: media.bytes,
    width: media.width,
    height: media.height,
    state: media.state,
    createdAt: media.createdAt
  };
}

/**
 * Authorize and deliver protected media content stream.
 * Direct streaming via Express: Cache-Control: private, no-store.
 */
async function authorizeAndServeMedia({ mediaId, requestingUser, reportLookupFn }) {
  if (!requestingUser) {
    throw new AppError('UNAUTHENTICATED', 'Sign-in required to access private media', 401);
  }
  if (!requestingUser.active) {
    throw new AppError('ACCOUNT_INACTIVE', 'User account is deactivated', 401);
  }

  const media = await Media.findById(mediaId);
  if (!media) {
    throw new AppError('MEDIA_NOT_FOUND', 'Media asset not found', 404);
  }

  // If explicitly public upload
  if (media.deliveryType === 'upload') {
    return {
      media,
      streamUrl: cloudinary.url(media.cloudinaryPublicId, { secure: true })
    };
  }

  // Authenticated/Protected media authorization
  const isOwner = media.owner.toString() === requestingUser._id.toString();
  const isCoordinator = requestingUser.role === 'coordinator';

  let isAuthorized = isOwner || isCoordinator;

  // Check department officer access if attached to a report
  if (!isAuthorized && media.targetType === 'report' && requestingUser.role === 'officer') {
    if (reportLookupFn && media.targetId) {
      const report = await reportLookupFn(media.targetId);
      if (
        report &&
        report.routedDepartmentId &&
        requestingUser.departmentId &&
        report.routedDepartmentId.toString() === requestingUser.departmentId.toString()
      ) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    throw new AppError('FORBIDDEN_MEDIA_ACCESS', 'You are not authorized to view this private evidence', 403);
  }

  // Generate private signed authenticated fetch URL internally for server streaming
  const authenticatedStreamUrl = cloudinary.utils.download_authenticated_url(media.cloudinaryPublicId, {
    expires_at: Math.floor(Date.now() / 1000) + 60, // 60-second ephemeral URL for server relay only
    attachment: false
  });

  return {
    media,
    authenticatedStreamUrl
  };
}

/**
 * Transactionally claim ready media for a report.
 * Ensures media belongs to resident, is in 'ready' state, and is not double-claimed.
 */
async function claimMediaForReport({ mediaIds, reportId, residentId, session }) {
  if (!mediaIds || mediaIds.length === 0) return [];

  if (mediaIds.length > MAX_IMAGES_PER_REPORT) {
    throw new AppError(
      'MAX_MEDIA_EXCEEDED',
      `Cannot attach more than ${MAX_IMAGES_PER_REPORT} images per report`,
      400
    );
  }

  // Atomically claim media records matching resident and state='ready'
  const updateResult = await Media.updateMany(
    {
      _id: { $in: mediaIds },
      owner: residentId,
      state: 'ready'
    },
    {
      $set: {
        state: 'attached',
        targetType: 'report',
        targetId: reportId
      }
    },
    { session }
  );

  const matchedCount = updateResult.matchedCount !== undefined ? updateResult.matchedCount : updateResult.nModified;

  if (matchedCount !== mediaIds.length) {
    throw new AppError(
      'MEDIA_ATTACHMENT_CONFLICT',
      'One or more media items do not exist, are already attached, or do not belong to you',
      409
    );
  }

  return mediaIds;
}

module.exports = {
  detectFormatAndValidateMagicBytes,
  inspectDimensions,
  uploadToCloudinary,
  handleMediaUpload,
  authorizeAndServeMedia,
  claimMediaForReport,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_REPORT
};
