/**
 * @file activity.stub.js
 * @description Named stub for activityEvents logging (Task I2/I3 dependency).
 */

const activityLogs = [];

/**
 * Log activity event within transaction session.
 */
async function logActivityEvent({ entityType, entityId, actorId, event, details = {}, session = null }) {
  const record = {
    entityType,
    entityId: entityId.toString(),
    actorId: actorId ? actorId.toString() : null,
    event,
    details,
    timestamp: new Date()
  };
  activityLogs.push(record);
  return record;
}

function getActivityLogs() {
  return [...activityLogs];
}

function clearActivityLogs() {
  activityLogs.length = 0;
}

module.exports = {
  logActivityEvent,
  getActivityLogs,
  clearActivityLogs
};
