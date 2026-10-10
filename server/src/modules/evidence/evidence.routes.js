/**
 * @file evidence.routes.js
 * @description Express routes for project evidence comparison.
 */

const express = require('express');
const evidenceController = require('./evidence.controller');

const router = express.Router();

/**
 * GET /api/v1/projects/:id/evidence
 * Publicly read before-after pairs and evidence gallery for a published project.
 */
router.get('/:id/evidence', evidenceController.getProjectEvidence);

module.exports = router;
