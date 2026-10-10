/**
 * @file coordination.routes.js
 * @description Express routes for coordination domain.
 */

const express = require('express');
const coordinationController = require('./coordination.controller');
const {
  authenticateUser,
  requireRole,
  requireCsrf
} = require('../../stubs/auth.middleware.stub');

// Public route for project conflicts
const publicConflictsRouter = express.Router();
publicConflictsRouter.get('/:id/conflicts', coordinationController.getProjectConflicts);

// Official admin coordination router
const adminConflictsRouter = express.Router();

adminConflictsRouter.get(
  '/',
  authenticateUser,
  requireRole('officer', 'coordinator'),
  coordinationController.getCoordinationQueue
);

adminConflictsRouter.post(
  '/actions',
  authenticateUser,
  requireRole('officer', 'coordinator'),
  requireCsrf,
  coordinationController.recordDecision
);

module.exports = {
  publicConflictsRouter,
  adminConflictsRouter
};
