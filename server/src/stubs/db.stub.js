/**
 * @file db.stub.js
 * @description Transaction and session helper adhering to PROJECT_PLAN.md transaction rules:
 * - "Pass the same transaction session to every participating operation"
 * - "External media/AI calls remain outside retryable transaction callbacks"
 * - "Rollback leaves no partial report/status/history write"
 */

const mongoose = require('./mongoose.stub');

/**
 * Runs a callback inside a MongoDB transaction.
 * If mongoose is connected and replica set is active, uses real mongoose session.
 * Otherwise, falls back to simulated transaction session context.
 */
async function runInTransaction(callback) {
  let session = null;
  const isMongooseConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (isMongooseConnected) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      if (session) {
        try {
          await session.abortTransaction();
        } catch (_) {}
      }
      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  } else {
    // Simulated session for non-MongoDB / mocked environments
    const simulatedSession = {
      id: `sim_session_${Date.now()}`,
      inTransaction: () => true,
      abortTransaction: async () => {},
      commitTransaction: async () => {},
      endSession: () => {}
    };
    return await callback(simulatedSession);
  }
}

module.exports = {
  runInTransaction
};
