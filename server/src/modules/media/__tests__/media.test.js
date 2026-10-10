/**
 * @file media.test.js
 * @description Test suite for Task I6: Cloudinary media lifecycle and protected delivery.
 * Verifies format detection, magic bytes validation, byte limits, ownership enforcement,
 * protected streaming headers, and double-claim prevention.
 */

const assert = require('assert');
const {
  detectFormatAndValidateMagicBytes,
  inspectDimensions,
  handleMediaUpload,
  authorizeAndServeMedia,
  claimMediaForReport,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_REPORT
} = require('../media.service');
const { Media } = require('../media.model');
const { AppError } = require('../../../stubs/error.stub');

// Synthetic sample buffers with exact magic bytes
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x08, 0x06, 0x00, 0x00, 0x00]);
const VALID_WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c]);
const FAKE_IMAGE_TEXT = Buffer.from('NOT AN IMAGE FILE; JUST TEXT');

async function runMediaTests() {
  const results = [];
  function record(testName, passed, error = null) {
    results.push({ testName, passed, error: error ? error.message : null });
    if (!passed) {
      console.error(`FAIL: ${testName}`, error);
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  console.log('--- Running I6 Media Lifecycle and Protected Delivery Checks ---');

  // 1. Magic bytes format detection
  try {
    const fmtJpg = detectFormatAndValidateMagicBytes(VALID_JPEG, 'image/jpeg');
    assert.strictEqual(fmtJpg, 'jpg');

    const fmtPng = detectFormatAndValidateMagicBytes(VALID_PNG, 'image/png');
    assert.strictEqual(fmtPng, 'png');

    const fmtWebp = detectFormatAndValidateMagicBytes(VALID_WEBP, 'image/webp');
    assert.strictEqual(fmtWebp, 'webp');

    record('Valid formats (JPEG, PNG, WebP) recognized by magic bytes', true);
  } catch (err) {
    record('Valid formats recognized by magic bytes', false, err);
  }

  // 2. Reject fake image text file
  try {
    assert.throws(
      () => detectFormatAndValidateMagicBytes(FAKE_IMAGE_TEXT, 'image/jpeg'),
      (err) => err instanceof AppError && err.code === 'UNSUPPORTED_FORMAT'
    );
    record('Corrupted/spoofed images rejected via magic bytes verification', true);
  } catch (err) {
    record('Corrupted/spoofed images rejected via magic bytes verification', false, err);
  }

  // 3. Byte limit check (> 2MB rejected)
  try {
    const oversizedBuffer = Buffer.alloc(MAX_IMAGE_BYTES + 10);
    assert.throws(
      () => detectFormatAndValidateMagicBytes(oversizedBuffer, 'image/jpeg'),
      (err) => err instanceof AppError && err.code === 'FILE_TOO_LARGE'
    );
    record('Oversized files exceeding 2 MB rejected with 413', true);
  } catch (err) {
    record('Oversized files exceeding 2 MB rejected with 413', false, err);
  }

  // 4. In-memory Media model mock for delivery & claim tests
  const inMemoryMediaStore = new Map();
  Media.findById = async (id) => inMemoryMediaStore.get(id.toString()) || null;
  Media.prototype.save = async function () {
    this._id = this._id || `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    inMemoryMediaStore.set(this._id.toString(), this);
    return this;
  };
  Media.updateMany = async (filter, update) => {
    let matchedCount = 0;
    for (const [id, media] of inMemoryMediaStore.entries()) {
      const matchOwner = !filter.owner || media.owner.toString() === filter.owner.toString();
      const matchState = !filter.state || media.state === filter.state;
      const matchIds = !filter._id?.$in || filter._id.$in.map((i) => i.toString()).includes(id);

      if (matchOwner && matchState && matchIds) {
        Object.assign(media, update.$set);
        matchedCount++;
      }
    }
    return { matchedCount, modifiedCount: matchedCount };
  };

  // 5. Upload media produces ready document with 'authenticated' delivery
  let createdMediaId = null;
  try {
    const residentUser = { _id: 'user_resident_1', role: 'resident', active: true };
    const mediaDto = await handleMediaUpload({
      fileBuffer: VALID_JPEG,
      mimeType: 'image/jpeg',
      ownerId: residentUser._id,
      purpose: 'resident_evidence'
    });

    assert.ok(mediaDto._id);
    assert.strictEqual(mediaDto.state, 'ready');
    assert.strictEqual(mediaDto.format, 'jpg');
    assert.ok(!mediaDto.deliveryUrl, 'Delivery URL must NOT be exposed in upload DTO');

    const stored = await Media.findById(mediaDto._id);
    assert.strictEqual(stored.deliveryType, 'authenticated', 'Resident evidence must be authenticated delivery');
    createdMediaId = mediaDto._id;

    record('Media upload produces ready document with authenticated delivery type', true);
  } catch (err) {
    record('Media upload produces ready document with authenticated delivery type', false, err);
  }

  // 6. Protected media delivery authorization
  try {
    const residentOwner = { _id: 'user_resident_1', role: 'resident', active: true };
    const otherResident = { _id: 'user_resident_2', role: 'resident', active: true };
    const coordinator = { _id: 'user_coord_1', role: 'coordinator', active: true };
    const inactiveOwner = { _id: 'user_resident_1', role: 'resident', active: false };

    // Owner can access
    const ownerRes = await authorizeAndServeMedia({
      mediaId: createdMediaId,
      requestingUser: residentOwner
    });
    assert.ok(ownerRes.media);
    assert.ok(ownerRes.authenticatedStreamUrl);

    // Coordinator can access
    const coordRes = await authorizeAndServeMedia({
      mediaId: createdMediaId,
      requestingUser: coordinator
    });
    assert.ok(coordRes.media);

    // Other resident FORBIDDEN (403)
    await assert.rejects(
      async () =>
        authorizeAndServeMedia({
          mediaId: createdMediaId,
          requestingUser: otherResident
        }),
      (err) => err instanceof AppError && err.code === 'FORBIDDEN_MEDIA_ACCESS' && err.statusCode === 403
    );

    // Inactive account rejected (401)
    await assert.rejects(
      async () =>
        authorizeAndServeMedia({
          mediaId: createdMediaId,
          requestingUser: inactiveOwner
        }),
      (err) => err instanceof AppError && err.code === 'ACCOUNT_INACTIVE' && err.statusCode === 401
    );

    // Anonymous visitor rejected (401)
    await assert.rejects(
      async () =>
        authorizeAndServeMedia({
          mediaId: createdMediaId,
          requestingUser: null
        }),
      (err) => err instanceof AppError && err.code === 'UNAUTHENTICATED' && err.statusCode === 401
    );

    record('Protected media authorization correctly grants owner/coordinator and rejects unauthorized users', true);
  } catch (err) {
    record('Protected media authorization correctly grants owner/coordinator and rejects unauthorized users', false, err);
  }

  // 7. Atomic media claim & double-claim prevention
  try {
    const residentId = 'user_resident_1';
    const reportId = 'report_101';

    // First claim succeeds
    const claimed = await claimMediaForReport({
      mediaIds: [createdMediaId],
      reportId,
      residentId,
      session: null
    });
    assert.deepStrictEqual(claimed, [createdMediaId]);

    const updatedMedia = await Media.findById(createdMediaId);
    assert.strictEqual(updatedMedia.state, 'attached');
    assert.strictEqual(updatedMedia.targetId, reportId);

    // Second claim of already-attached media fails with 409 Conflict
    await assert.rejects(
      async () =>
        claimMediaForReport({
          mediaIds: [createdMediaId],
          reportId: 'report_102',
          residentId,
          session: null
        }),
      (err) => err instanceof AppError && err.code === 'MEDIA_ATTACHMENT_CONFLICT' && err.statusCode === 409
    );

    // Max 3 images limit enforced
    await assert.rejects(
      async () =>
        claimMediaForReport({
          mediaIds: ['1', '2', '3', '4'],
          reportId,
          residentId,
          session: null
        }),
      (err) => err instanceof AppError && err.code === 'MAX_MEDIA_EXCEEDED' && err.statusCode === 400
    );

    record('Transactional media claim prevents double-claiming and enforces 3-image limit', true);
  } catch (err) {
    record('Transactional media claim prevents double-claiming and enforces 3-image limit', false, err);
  }

  return results;
}

if (require.main === module) {
  runMediaTests()
    .then((results) => {
      const allPassed = results.every((r) => r.passed);
      console.log(`\nMedia Tests Finished. All Passed: ${allPassed}`);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMediaTests };
