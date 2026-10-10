/**
 * @file coordination.controller.js
 * @description Controller endpoints for conflict detection and official decisions.
 */

const coordinationService = require('./coordination.service');

/**
 * GET /api/v1/projects/:id/conflicts
 * Public read of project's coordination candidates and decisions.
 */
async function getProjectConflicts(req, res, next) {
  try {
    const { id } = req.params;
    const isOfficial = Boolean(req.user && ['officer', 'coordinator'].includes(req.user.role));

    const candidates = await coordinationService.getConflictsForProject(id, isOfficial);
    res.status(200).json({
      success: true,
      conflicts: candidates
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/conflicts
 * Official queue of coordination candidates across projects.
 */
async function getCoordinationQueue(req, res, next) {
  try {
    const { departmentId, status, page, limit } = req.query;

    const result = await coordinationService.getCoordinationQueue({
      officialUser: req.user,
      departmentId,
      status,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/conflicts/actions
 * Version-guarded official conflict decision.
 */
async function recordDecision(req, res, next) {
  try {
    const {
      pairId,
      ruleId,
      expectedProjectVersions,
      decision,
      publicExplanation,
      scheduleEdits
    } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || null;

    const result = await coordinationService.recordConflictDecision({
      pairId,
      ruleId,
      expectedProjectVersions,
      decision,
      publicExplanation,
      scheduleEdits,
      officialUser: req.user,
      idempotencyKey
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjectConflicts,
  getCoordinationQueue,
  recordDecision
};
