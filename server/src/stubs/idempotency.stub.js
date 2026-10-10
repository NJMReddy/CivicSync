/**
 * @file idempotency.stub.js
 * @description Named stub for idempotency record operations (Task I2/I3 dependency).
 * Stores actor, operation, key, request hash, committed outcome/reference and expiry.
 * Same key + same hash -> returns original committed result.
 * Same key + different hash -> returns 409 Conflict.
 */

const crypto = require('crypto');
const { AppError } = require('./error.stub');

// In-memory or simulated Mongoose idempotency collection
const idempotencyStore = new Map();

function hashPayload(payload) {
  const normalized = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check if an idempotency record exists.
 * Returns cached result if hash matches, throws 409 if hash differs.
 */
async function checkIdempotency({ actorId, operation, key, payload, session = null }) {
  if (!key) return null;
  const storeKey = `${actorId}:${operation}:${key}`;
  const record = idempotencyStore.get(storeKey);

  if (record) {
    const currentHash = hashPayload(payload);
    if (record.requestHash !== currentHash) {
      throw new AppError(
        'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'Idempotency key was previously used with a different request payload',
        409
      );
    }
    return record.outcome;
  }
  return null;
}

/**
 * Save committed idempotency outcome within the current transaction session.
 */
async function recordIdempotency({ actorId, operation, key, payload, outcome, session = null }) {
  if (!key) return;
  const storeKey = `${actorId}:${operation}:${key}`;
  const requestHash = hashPayload(payload);

  idempotencyStore.set(storeKey, {
    actorId,
    operation,
    key,
    requestHash,
    outcome,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
}

function clearIdempotencyStore() {
  idempotencyStore.clear();
}

module.exports = {
  checkIdempotency,
  recordIdempotency,
  clearIdempotencyStore,
  hashPayload
};
