/**
 * @file report.routes.js
 * @description Express routes for Report domain in CivicSync.
 * Supports resident reporting endpoints (/api/v1/reports) and
 * official admin report workflow endpoints (/api/v1/admin/reports).
 */

const express = require('express');
const reportController = require('./report.controller');
const {
  authenticateUser,
  requireRole,
  requireCsrf
} = require('../../stubs/auth.middleware.stub');

// Resident router mounted under /api/v1/reports
const residentRouter = express.Router();

/**
 * POST /api/v1/reports
 * Submit a report with optional project ID or coordinates.
 */
residentRouter.post(
  '/',
  authenticateUser,
  requireRole('resident'),
  requireCsrf,
  reportController.submitReport
);

/**
 * GET /api/v1/reports/mine
 * List reports filed by the current resident.
 * Crucial: Registered before /:id to prevent route collision.
 */
residentRouter.get(
  '/mine',
  authenticateUser,
  requireRole('resident'),
  reportController.getMyReports
);

/**
 * GET /api/v1/reports/:id
 * Retrieve single report. Requires resident owner, routed officer, or coordinator.
 */
residentRouter.get(
  '/:id',
  authenticateUser,
  reportController.getReportById
);

// Official router mounted under /api/v1/admin/reports
const adminRouter = express.Router();

/**
 * GET /api/v1/admin/reports
 * Officer (department scoped) or coordinator (unassigned / all) queue.
 */
adminRouter.get(
  '/',
  authenticateUser,
  requireRole('officer', 'coordinator'),
  reportController.getOfficialQueue
);

/**
 * POST /api/v1/admin/reports/:id/actions
 * Transition report status, assign, respond, resolve, or reject.
 */
adminRouter.post(
  '/:id/actions',
  authenticateUser,
  requireRole('officer', 'coordinator'),
  requireCsrf,
  reportController.executeAction
);

module.exports = {
  residentRouter,
  adminRouter
};
