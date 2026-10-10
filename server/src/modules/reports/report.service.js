/**
 * @file report.service.js
 * @description Core business logic for Resident Issue Reporting and Official Response Workflow.
 * Implements transaction boundaries, optimistic version locking, department isolation,
 * idempotency, and durable reference generation. Conforms to TASKS.md I7 and PROJECT_PLAN.md.
 */

const crypto = require('crypto');
const { Report } = require('./report.model');
const { claimMediaForReport } = require('../media/media.service');
const { runInTransaction } = require('../../stubs/db.stub');
const { checkIdempotency, recordIdempotency } = require('../../stubs/idempotency.stub');
const { logActivityEvent } = require('../../stubs/activity.stub');
const { findProjectById } = require('../../stubs/project.stub');
const { AppError } = require('../../stubs/error.stub');

/**
 * Compute approximate 250m grid cell for privacy-safe aggregate insights.
 * Latitude ~111km/deg => 250m ~ 0.00225 deg.
 */
function computeApproximateCell(coordinates) {
  const [lon, lat] = coordinates;
  const latCell = (Math.round(lat / 0.0025) * 0.0025).toFixed(4);
  const lonCell = (Math.round(lon / 0.0025) * 0.0025).toFixed(4);
  return `cell_${latCell}_${lonCell}`;
}

/**
 * Generate durable, human-readable report reference.
 * Only returned after persistence succeeds.
 */
function generateDurableReference() {
  const year = new Date().getFullYear();
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `RPT-${year}-${randomHex}`;
}

/**
 * Submit a resident report with transactional consistency.
 */
async function createReport({
  residentId,
  projectId = null,
  category,
  description,
  coordinates,
  address = '',
  mediaIds = [],
  idempotencyKey = null
}) {
  if (!residentId) {
    throw new AppError('UNAUTHENTICATED', 'Resident authentication required', 401);
  }

  // 1. Check idempotency
  const payloadForHash = { residentId: residentId.toString(), projectId, category, description, coordinates, mediaIds };
  const cachedOutcome = await checkIdempotency({
    actorId: residentId,
    operation: 'report_submission',
    key: idempotencyKey,
    payload: payloadForHash
  });
  if (cachedOutcome) {
    return cachedOutcome;
  }

  // 2. Validate input fields
  if (!category) {
    throw new AppError('VALIDATION_ERROR', 'Report category is required', 400);
  }
  if (!description || description.trim().length < 10) {
    throw new AppError('VALIDATION_ERROR', 'Description must be at least 10 characters long', 400);
  }
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new AppError('VALIDATION_ERROR', 'Coordinates must be valid [longitude, latitude]', 400);
  }

  // 3. Project routing check
  let routedDepartmentId = null;
  if (projectId) {
    const project = await findProjectById(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', `Project ${projectId} not found or not published`, 404);
    }
    routedDepartmentId = project.departmentId;
  }

  const approximateCell = computeApproximateCell(coordinates);
  const durableReference = generateDurableReference();

  // 4. Atomic transaction boundary
  const result = await runInTransaction(async (session) => {
    // Generate new Report document
    const report = new Report({
      reference: durableReference,
      residentId,
      projectId: projectId || null,
      category,
      description: description.trim(),
      location: {
        type: 'Point',
        coordinates,
        address: address.trim()
      },
      approximateCell,
      routedDepartmentId,
      assigneeId: null,
      status: 'submitted',
      mediaIds: [],
      statusHistory: [
        {
          status: 'submitted',
          changedBy: residentId,
          changedAt: new Date(),
          note: 'Report submitted by resident',
          routedDepartmentId
        }
      ],
      version: 1
    });

    // Save report to obtain stable _id
    await report.save({ session });

    // Atomically claim eligible media inside the transaction
    if (mediaIds && mediaIds.length > 0) {
      const claimedIds = await claimMediaForReport({
        mediaIds,
        reportId: report._id,
        residentId,
        session
      });
      report.mediaIds = claimedIds;
      await report.save({ session });
    }

    // Log activity event
    await logActivityEvent({
      entityType: 'report',
      entityId: report._id,
      actorId: residentId,
      event: 'report_submitted',
      details: { reference: durableReference, category, routedDepartmentId },
      session
    });

    const responseOutcome = {
      success: true,
      report: {
        _id: report._id.toString(),
        reference: report.reference,
        status: report.status,
        category: report.category,
        description: report.description,
        routedDepartmentId: report.routedDepartmentId,
        mediaIds: report.mediaIds.map((id) => id.toString()),
        version: report.version,
        createdAt: report.createdAt
      }
    };

    // Record idempotency outcome inside the transaction
    await recordIdempotency({
      actorId: residentId,
      operation: 'report_submission',
      key: idempotencyKey,
      payload: payloadForHash,
      outcome: responseOutcome,
      session
    });

    return responseOutcome;
  });

  return result;
}

/**
 * Retrieve reports submitted by the requesting resident.
 */
async function getResidentReports(residentId) {
  const reports = await Report.find({ residentId })
    .sort({ createdAt: -1 })
    .lean();

  return reports.map((r) => ({
    _id: r._id.toString(),
    reference: r.reference,
    category: r.category,
    description: r.description,
    status: r.status,
    routedDepartmentId: r.routedDepartmentId,
    location: r.location,
    mediaIds: (r.mediaIds || []).map((id) => id.toString()),
    officialResponse: r.officialResponse || {},
    statusHistory: r.statusHistory || [],
    version: r.version,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
}

/**
 * Retrieve a single report by ID with server-side authorization enforcement.
 */
async function getReportById({ reportId, requestingUser }) {
  const report = await Report.findById(reportId).lean();
  if (!report) {
    throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
  }

  // Authorization enforcement
  const isOwner = report.residentId.toString() === requestingUser._id.toString();
  const isCoordinator = requestingUser.role === 'coordinator';
  const isDepartmentOfficer =
    requestingUser.role === 'officer' &&
    report.routedDepartmentId &&
    requestingUser.departmentId &&
    report.routedDepartmentId.toString() === requestingUser.departmentId.toString();

  if (!isOwner && !isCoordinator && !isDepartmentOfficer) {
    throw new AppError('FORBIDDEN_REPORT_ACCESS', 'You do not have permission to view this private report', 403);
  }

  return {
    _id: report._id.toString(),
    reference: report.reference,
    residentId: isOwner || isCoordinator ? report.residentId.toString() : undefined,
    projectId: report.projectId,
    category: report.category,
    description: report.description,
    location: report.location,
    approximateCell: report.approximateCell,
    routedDepartmentId: report.routedDepartmentId,
    assigneeId: report.assigneeId ? report.assigneeId.toString() : null,
    status: report.status,
    publicSummary: report.publicSummary,
    officialResponse: report.officialResponse || {},
    mediaIds: (report.mediaIds || []).map((id) => id.toString()),
    statusHistory: report.statusHistory || [],
    version: report.version,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

/**
 * Retrieve official report queue with department isolation.
 */
async function getOfficialReportQueue({ officialUser, departmentId, status, unassigned, page = 1, limit = 20 }) {
  const filter = {};

  if (officialUser.role === 'officer') {
    // Officer can only view their own department's reports
    filter.routedDepartmentId = officialUser.departmentId;
  } else if (officialUser.role === 'coordinator') {
    if (unassigned === 'true' || unassigned === true) {
      filter.routedDepartmentId = null;
    } else if (departmentId) {
      filter.routedDepartmentId = departmentId;
    }
  }

  if (status) {
    filter.status = status;
  }

  const skip = (Math.max(1, page) - 1) * Math.min(50, limit);
  const total = await Report.countDocuments(filter);
  const items = await Report.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.min(50, limit))
    .lean();

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    items: items.map((r) => ({
      _id: r._id.toString(),
      reference: r.reference,
      category: r.category,
      description: r.description,
      status: r.status,
      routedDepartmentId: r.routedDepartmentId,
      assigneeId: r.assigneeId ? r.assigneeId.toString() : null,
      location: r.location,
      mediaCount: (r.mediaIds || []).length,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  };
}

/**
 * Execute an official report action (review, assign, in_progress, respond, resolve, reject, reassign)
 * with transactional consistency and optimistic version check.
 */
async function executeReportAction({
  reportId,
  action,
  expectedVersion,
  assigneeId = null,
  routedDepartmentId = null,
  narrative = null,
  rejectionReason = null,
  resolutionReason = null,
  officialUser,
  idempotencyKey = null
}) {
  if (!officialUser || !['officer', 'coordinator'].includes(officialUser.role)) {
    throw new AppError('FORBIDDEN_ACTION', 'Only authorized officials can perform report actions', 403);
  }

  // 1. Idempotency check
  const payloadForHash = {
    reportId: reportId.toString(),
    action,
    expectedVersion,
    assigneeId,
    routedDepartmentId,
    narrative,
    rejectionReason,
    resolutionReason
  };
  const cachedOutcome = await checkIdempotency({
    actorId: officialUser._id,
    operation: 'report_action',
    key: idempotencyKey,
    payload: payloadForHash
  });
  if (cachedOutcome) {
    return cachedOutcome;
  }

  // 2. Fetch existing report
  const report = await Report.findById(reportId);
  if (!report) {
    throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
  }

  // 3. Department boundary checks
  if (officialUser.role === 'officer') {
    if (
      !report.routedDepartmentId ||
      !officialUser.departmentId ||
      report.routedDepartmentId.toString() !== officialUser.departmentId.toString()
    ) {
      throw new AppError('FORBIDDEN_DEPARTMENT', 'You cannot act on a report routed to another department', 403);
    }
    if (routedDepartmentId && routedDepartmentId.toString() !== officialUser.departmentId.toString()) {
      throw new AppError(
        'FORBIDDEN_CROSS_DEPARTMENT',
        'Officer cannot reassign reports across departments without coordinator authority',
        403
      );
    }
  }

  // 4. Optimistic concurrency check
  if (expectedVersion === undefined || expectedVersion === null) {
    throw new AppError('VERSION_REQUIRED', 'expectedVersion is required for state mutations', 400);
  }
  if (report.version !== Number(expectedVersion)) {
    throw new AppError(
      'STALE_REPORT_VERSION',
      `Report has been modified by another official. Current version is ${report.version}, expected ${expectedVersion}. Please reload.`,
      409
    );
  }

  // 5. State machine validation & required reasons
  let targetStatus = report.status;
  let actionNote = '';

  switch (action) {
    case 'review':
      if (report.status !== 'submitted') {
        throw new AppError('INVALID_TRANSITION', `Cannot review report in status ${report.status}`, 409);
      }
      targetStatus = 'under_review';
      actionNote = 'Report reviewed by official';
      break;

    case 'route':
      if (officialUser.role !== 'coordinator') {
        throw new AppError('FORBIDDEN_ACTION', 'Only coordinators can route unassigned reports', 403);
      }
      if (!routedDepartmentId) {
        throw new AppError('DEPARTMENT_REQUIRED', 'Department ID is required to route report', 400);
      }
      report.routedDepartmentId = routedDepartmentId;
      targetStatus = report.status === 'submitted' ? 'under_review' : report.status;
      actionNote = `Report routed to department ${routedDepartmentId}`;
      break;

    case 'assign':
      if (!assigneeId) {
        throw new AppError('ASSIGNEE_REQUIRED', 'assigneeId is required for assignment', 400);
      }
      report.assigneeId = assigneeId;
      targetStatus = 'assigned';
      actionNote = `Report assigned to official ${assigneeId}`;
      break;

    case 'in_progress':
      targetStatus = 'in_progress';
      actionNote = 'Work in progress on reported issue';
      break;

    case 'respond':
      if (!narrative || narrative.trim().length === 0) {
        throw new AppError('RESPONSE_REQUIRED', 'Response narrative is required', 400);
      }
      actionNote = 'Official response recorded';
      break;

    case 'resolve':
      if (!resolutionReason || resolutionReason.trim().length === 0) {
        throw new AppError('RESOLUTION_REASON_REQUIRED', 'Explanation is strictly required when resolving a report', 400);
      }
      targetStatus = 'resolved';
      report.officialResponse.resolutionReason = resolutionReason.trim();
      actionNote = `Report resolved: ${resolutionReason.trim()}`;
      break;

    case 'reject':
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        throw new AppError('REJECTION_REASON_REQUIRED', 'Explanation is strictly required when rejecting a report', 400);
      }
      targetStatus = 'rejected';
      report.officialResponse.rejectionReason = rejectionReason.trim();
      actionNote = `Report rejected: ${rejectionReason.trim()}`;
      break;

    case 'reassign':
      if (officialUser.role !== 'coordinator') {
        throw new AppError('FORBIDDEN_ACTION', 'Only coordinators can reassign reports across departments', 403);
      }
      if (!routedDepartmentId) {
        throw new AppError('DEPARTMENT_REQUIRED', 'New department ID is required for reassignment', 400);
      }
      report.routedDepartmentId = routedDepartmentId;
      report.assigneeId = null;
      actionNote = `Report reassigned to department ${routedDepartmentId}`;
      break;

    default:
      throw new AppError('INVALID_ACTION', `Unknown action: ${action}`, 400);
  }

  // 6. Transactional update
  const result = await runInTransaction(async (session) => {
    report.status = targetStatus;
    report.version = report.version + 1;

    if (narrative) {
      report.officialResponse.narrative = narrative.trim();
    }
    report.officialResponse.respondedAt = new Date();
    report.officialResponse.respondedBy = officialUser._id;

    report.statusHistory.push({
      status: targetStatus,
      changedBy: officialUser._id,
      changedAt: new Date(),
      note: actionNote,
      assignedTo: report.assigneeId,
      routedDepartmentId: report.routedDepartmentId
    });

    await report.save({ session });

    await logActivityEvent({
      entityType: 'report',
      entityId: report._id,
      actorId: officialUser._id,
      event: `report_action_${action}`,
      details: { status: targetStatus, version: report.version, note: actionNote },
      session
    });

    const outcome = {
      success: true,
      report: {
        _id: report._id.toString(),
        reference: report.reference,
        status: report.status,
        version: report.version,
        assigneeId: report.assigneeId ? report.assigneeId.toString() : null,
        routedDepartmentId: report.routedDepartmentId,
        officialResponse: report.officialResponse,
        statusHistory: report.statusHistory,
        updatedAt: report.updatedAt
      }
    };

    await recordIdempotency({
      actorId: officialUser._id,
      operation: 'report_action',
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
  createReport,
  getResidentReports,
  getReportById,
  getOfficialReportQueue,
  executeReportAction,
  computeApproximateCell,
  generateDurableReference
};
