/**
 * @file insights.routes.js
 * @description Express routes for community insights.
 */

const express = require('express');
const insightsController = require('./insights.controller');

const router = express.Router();

/**
 * GET /api/v1/insights
 * Public endpoint for heatmap cell aggregates and category statistics.
 */
router.get('/', insightsController.getInsights);

module.exports = router;
