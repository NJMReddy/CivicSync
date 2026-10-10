/**
 * @file report.controller.js
 * @description Controller endpoints for resident reports and official report workflows.
 */

const reportService = require('./report.service');
const { AppError } = require('../../stubs/error.stub');

/**
 * Submit a new resident report.
 * POST /api/v1/reports
 */
async function submitReport(req, res, next) {
  try {
    const { projectId, category, description, coordinates, address, mediaIds } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || null;

    const result = await reportService.createReport({
      residentId: req.user._id,
      projectId,
      category,
      description,
      coordinates,
      address,
      mediaIds: mediaIds || [],
      idempotencyKey
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get reports submitted by currently authenticated resident.
 * GET /api/v1/reports/mine
 */
async function getMyReports(req, res, next) {
  try {
    const reports = await reportService.getResidentReports(req.user._id);
    res.status(200).json({
      success: true,
      reports
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get report details by ID with server-side authorization.
 * GET /api/v1/reports/:id
 */
async function getReportById(req, res, next) {
  try {
    const { id } = req.params;
    const report = await reportService.getReportById({
      reportId: id,
      requestingUser: req.user
    });

    res.status(200).json({
      success: true,
      report
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get official report queue.
 * GET /api/v1/admin/reports
 */
async function getOfficialQueue(req, res, next) {
  try {
    const { departmentId, status, unassigned, page, limit } = req.query;

    const result = await reportService.getOfficialReportQueue({
      officialUser: req.user,
      departmentId,
      status,
      unassigned,
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
 * Perform an official report action (review, assign, in_progress, respond, resolve, reject, reassign).
 * POST /api/v1/admin/reports/:id/actions
 */
async function executeAction(req, res, next) {
  try {
    const { id } = req.params;
    const {
      action,
      expectedVersion,
      assigneeId,
      routedDepartmentId,
      narrative,
      rejectionReason,
      resolutionReason
    } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || null;

    const result = await reportService.executeReportAction({
      reportId: id,
      action,
      expectedVersion,
      assigneeId,
      routedDepartmentId,
      narrative,
      rejectionReason,
      resolutionReason,
      officialUser: req.user,
      idempotencyKey
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitReport,
  getMyReports,
  getReportById,
  getOfficialQueue,
  executeAction
};
