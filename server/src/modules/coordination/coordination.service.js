/**
 * @file coordination.service.js
 * @description Core service for CivicSync conflict detection and decision management.
 * Conforms strictly to PROJECT_PLAN.md Section 10 and TASKS.md I8:
 * - Pure rule evaluation with canonical pairs
 * - Fact fingerprint matching and stale review reopening
 * - Version-checked conditional writes to both projects inside transaction
 * - Public explanations for coordinated and dismissed decisions
 */

const { ConflictDecision } = require('./coordination.model');
const {
  evaluateCoordinationRules,
  canonicalizePair,
  computeFactFingerprint
} = require('./coordination.rules');
const { findProjectById } = require('../../stubs/project.stub');
const { runInTransaction } = require('../../stubs/db.stub');
const { checkIdempotency, recordIdempotency } = require('../../stubs/idempotency.stub');
const { logActivityEvent } = require('../../stubs/activity.stub');
const { AppError } = require('../../stubs/error.stub');

// Helper to query all published projects (using project stub or injected registry)
let projectListFn = null;
function setProjectListProvider(fn) {
  projectListFn = fn;
}

async function getAllPublishedProjects() {
  if (projectListFn) {
    return await projectListFn();
  }
  // Fallback to project stub if available
  const { projectRegistry } = require('../../stubs/project.stub');
  if (projectRegistry) {
    return Array.from(projectRegistry.values()).filter(
      (p) => p.publicationState === 'published'
    );
  }
  return [];
}

/**
 * Get active coordination candidates and decisions for a single project.
 * Draft projects are excluded from public discovery.
 */
async function getConflictsForProject(projectId, isOfficial = false) {
  const targetProject = await findProjectById(projectId);
  if (!targetProject) {
    throw new AppError('PROJECT_NOT_FOUND', 'Project not found', 404);
  }

  if (targetProject.publicationState === 'draft' && !isOfficial) {
    throw new AppError('FORBIDDEN_DRAFT', 'Draft projects are not accessible publicly', 403);
  }

  const allProjects = await getAllPublishedProjects();
  const candidates = [];

  for (const other of allProjects) {
    if (other._id.toString() === targetProject._id.toString()) continue;
    if (other.publicationState === 'draft' && !isOfficial) continue;

    const evaluation = evaluateCoordinationRules(targetProject, other);
    if (!evaluation.hasActiveMatch && evaluation.rules.every((r) => r.status !== 'cannot_assess')) {
      continue;
    }

    // Lookup existing decision for this canonical pair
    const decision = await ConflictDecision.findOne({
      pairId: evaluation.pairId
    }).lean();

    let decisionStatus = 'open';
    let publicExplanation = null;

    if (decision) {
      if (decision.inputFingerprint === evaluation.fingerprint) {
        decisionStatus = decision.status;
        publicExplanation = decision.publicExplanation;
      } else {
        // Relevant facts changed after decision was made!
        decisionStatus = 'changed_later';
        publicExplanation = 'Project facts have changed since previous decision; fresh review required.';
      }
    }

    // Only surface active matches, cannot_assess rules, or recorded decisions
    if (evaluation.hasActiveMatch || decisionStatus !== 'open') {
      candidates.push({
        pairId: evaluation.pairId,
        project1Id: evaluation.project1Id,
        project2Id: evaluation.project2Id,
        targetProjectId: targetProject._id.toString(),
        otherProject: {
          _id: other._id.toString(),
          title: other.title,
          departmentId: other.departmentId,
          publicationState: other.publicationState
        },
        fingerprint: evaluation.fingerprint,
        rules: evaluation.rules,
        decisionStatus,
        publicExplanation
      });
    }
  }

  return candidates;
}

/**
 * Get entire coordination queue for officials.
 * Deduplicates canonical pairs and applies department or status filters.
 */
async function getCoordinationQueue({ officialUser, departmentId, status, page = 1, limit = 20 }) {
  if (!officialUser || !['officer', 'coordinator'].includes(officialUser.role)) {
    throw new AppError('FORBIDDEN_QUEUE', 'Only authorized officials may access the coordination queue', 403);
  }

  const allProjects = await getAllPublishedProjects();
  const queue = [];
  const processedPairs = new Set();

  for (let i = 0; i < allProjects.length; i++) {
    for (let j = i + 1; j < allProjects.length; j++) {
      const projA = allProjects[i];
      const projB = allProjects[j];

      const { pairId } = canonicalizePair(projA, projB);
      if (processedPairs.has(pairId)) continue;
      processedPairs.add(pairId);

      // Department scope: officer sees conflicts involving their department
      if (officialUser.role === 'officer') {
        const involvesDept =
          projA.departmentId === officialUser.departmentId ||
          projB.departmentId === officialUser.departmentId;
        if (!involvesDept) continue;
      } else if (departmentId) {
        const involvesDept =
          projA.departmentId === departmentId || projB.departmentId === departmentId;
        if (!involvesDept) continue;
      }

      const evaluation = evaluateCoordinationRules(projA, projB);
      if (!evaluation.hasActiveMatch) continue;

      const decision = await ConflictDecision.findOne({ pairId }).lean();
      let decisionStatus = 'open';
      let publicExplanation = null;

      if (decision) {
        if (decision.inputFingerprint === evaluation.fingerprint) {
          decisionStatus = decision.status;
          publicExplanation = decision.publicExplanation;
        } else {
          decisionStatus = 'changed_later';
          publicExplanation = 'Relevant facts modified; review reopened.';
        }
      }

      if (status && decisionStatus !== status) continue;

      queue.push({
        pairId,
        project1: { _id: projA._id.toString(), title: projA.title, departmentId: projA.departmentId },
        project2: { _id: projB._id.toString(), title: projB.title, departmentId: projB.departmentId },
        fingerprint: evaluation.fingerprint,
        rules: evaluation.rules,
        decisionStatus,
        publicExplanation
      });
    }
  }

  const skip = (Math.max(1, page) - 1) * Math.min(50, limit);
  const paginated = queue.slice(skip, skip + Math.min(50, limit));

  return {
    total: queue.length,
    page: Number(page),
    limit: Number(limit),
    items: paginated
  };
}

/**
 * Record a conflict decision with optimistic version checks on BOTH projects.
 * Enforces transaction safety and idempotency.
 */
async function recordConflictDecision({
  pairId,
  ruleId = 'shared_segment_overlap',
  expectedProjectVersions,
  decision, // 'coordinated', 'dismissed', 'rescheduled'
  publicExplanation,
  scheduleEdits = null,
  officialUser,
  idempotencyKey = null
}) {
  if (!officialUser || !['officer', 'coordinator'].includes(officialUser.role)) {
    throw new AppError('FORBIDDEN_ACTION', 'Only authorized officials can record conflict decisions', 403);
  }

  // 1. Idempotency check
  const payloadForHash = {
    pairId,
    ruleId,
    expectedProjectVersions,
    decision,
    publicExplanation,
    scheduleEdits
  };
  const cachedOutcome = await checkIdempotency({
    actorId: officialUser._id,
    operation: 'conflict_decision',
    key: idempotencyKey,
    payload: payloadForHash
  });
  if (cachedOutcome) return cachedOutcome;

  // 2. Validate input and explanation
  if (!['coordinated', 'dismissed', 'rescheduled'].includes(decision)) {
    throw new AppError('INVALID_DECISION', `Invalid conflict decision: ${decision}`, 400);
  }

  if (['coordinated', 'dismissed'].includes(decision) && (!publicExplanation || !publicExplanation.trim())) {
    throw new AppError(
      'EXPLANATION_REQUIRED',
      `Public explanation is strictly required when marking a conflict as "${decision}"`,
      400
    );
  }

  // 3. Extract project IDs from canonical pairId (minId__maxId)
  const [projAId, projBId] = pairId.split('__');
  if (!projAId || !projBId) {
    throw new AppError('INVALID_PAIR_ID', 'Malformed canonical pairId', 400);
  }

  const projA = await findProjectById(projAId);
  const projB = await findProjectById(projBId);
  if (!projA || !projB) {
    throw new AppError('PROJECTS_NOT_FOUND', 'One or both projects in conflict pair not found', 404);
  }

  // 4. Department authorization check
  if (officialUser.role === 'officer') {
    const isOfficerDeptA = projA.departmentId === officialUser.departmentId;
    const isOfficerDeptB = projB.departmentId === officialUser.departmentId;
    if (!isOfficerDeptA && !isOfficerDeptB) {
      throw new AppError('FORBIDDEN_DEPARTMENT', 'You can only resolve conflicts involving your department', 403);
    }
  }

  // 5. Dual-project optimistic version checks
  if (!expectedProjectVersions || typeof expectedProjectVersions !== 'object') {
    throw new AppError('VERSIONS_REQUIRED', 'expectedProjectVersions object containing both project versions is required', 400);
  }

  const expectedVerA = expectedProjectVersions[projAId];
  const expectedVerB = expectedProjectVersions[projBId];

  const currentVerA = projA.version || 1;
  const currentVerB = projB.version || 1;

  if (expectedVerA !== undefined && Number(expectedVerA) !== currentVerA) {
    throw new AppError(
      'STALE_PROJECT_VERSION',
      `Project ${projAId} version mismatch (current: ${currentVerA}, expected: ${expectedVerA}). Review reopened.`,
      409
    );
  }

  if (expectedVerB !== undefined && Number(expectedVerB) !== currentVerB) {
    throw new AppError(
      'STALE_PROJECT_VERSION',
      `Project ${projBId} version mismatch (current: ${currentVerB}, expected: ${expectedVerB}). Review reopened.`,
      409
    );
  }

  // 6. Compute fresh fact fingerprint
  const currentFingerprint = computeFactFingerprint(projA, projB);

  // 7. Atomic transaction commit
  const result = await runInTransaction(async (session) => {
    // Conditional write to both projects (increment versions)
    projA.version = currentVerA + 1;
    projB.version = currentVerB + 1;

    // If rescheduled, update dates
    if (decision === 'rescheduled' && scheduleEdits) {
      if (scheduleEdits[projAId]) {
        Object.assign(projA, scheduleEdits[projAId]);
      }
      if (scheduleEdits[projBId]) {
        Object.assign(projB, scheduleEdits[projBId]);
      }
    }

    if (projA.save) await projA.save({ session });
    if (projB.save) await projB.save({ session });

    // Upsert ConflictDecision document
    let record = await ConflictDecision.findOne({ pairId });
    if (!record) {
      record = new ConflictDecision({
        pairId,
        projectIds: [projA._id, projB._id],
        ruleId,
        ruleVersion: '1.0',
        inputFingerprint: currentFingerprint,
        status: decision,
        publicExplanation: publicExplanation ? publicExplanation.trim() : null,
        actorId: officialUser._id
      });
    } else {
      record.ruleId = ruleId;
      record.inputFingerprint = currentFingerprint;
      record.status = decision;
      record.publicExplanation = publicExplanation ? publicExplanation.trim() : null;
      record.actorId = officialUser._id;
    }

    await record.save({ session });

    await logActivityEvent({
      entityType: 'conflict',
      entityId: pairId,
      actorId: officialUser._id,
      event: `conflict_decision_${decision}`,
      details: { pairId, decision, fingerprint: currentFingerprint },
      session
    });

    const outcome = {
      success: true,
      decision: {
        pairId,
        status: record.status,
        publicExplanation: record.publicExplanation,
        fingerprint: record.inputFingerprint,
        savedVersions: {
          [projAId]: projA.version,
          [projBId]: projB.version
        },
        updatedAt: record.updatedAt || new Date()
      }
    };

    await recordIdempotency({
      actorId: officialUser._id,
      operation: 'conflict_decision',
      key: idempotencyKey,
      payload: payloadForHash,
      outcome,
      session
    });

    return outcome;
  });

  return result;
}

module.exports = {
  getConflictsForProject,
  getCoordinationQueue,
  recordConflictDecision,
  setProjectListProvider
};
