/**
 * @file summary.routes.js
 * @description Express routes for project summary and factual fallback.
 */

const express = require('express');
const summaryController = require('./summary.controller');

const router = express.Router();

/**
 * GET /api/v1/projects/:id/summary
 * Retrieves factual summary or AI generation if gate met.
 */
router.get('/:id/summary', summaryController.getSummary);

module.exports = router;
