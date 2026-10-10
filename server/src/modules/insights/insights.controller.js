/**
 * @file insights.controller.js
 * @description Controller for public community insights and heatmap aggregation.
 */

const insightsService = require('./insights.service');

/**
 * GET /api/v1/insights
 * Public aggregate report concentration and totals from reviewed reports.
 */
async function getInsights(req, res, next) {
  try {
    const { category, status, dateFrom, dateTo } = req.query;

    const data = await insightsService.getCommunityInsights({
      category,
      status,
      dateFrom,
      dateTo
    });

    res.status(200).json({
      success: true,
      insights: data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInsights
};
