/**
 * @file summary.controller.js
 * @description Controller for project summary and I10 gate checking.
 */

const summaryService = require('./summary.service');

/**
 * GET /api/v1/projects/:id/summary
 * Cached summary or labelled factual fallback.
 */
async function getSummary(req, res, next) {
  try {
    const { id } = req.params;
    const result = await summaryService.getProjectSummary(id);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary
};
