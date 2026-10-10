/**
 * @file insights.service.js
 * @description Core aggregation logic for Community Insights and complaint heatmaps.
 * Conforms strictly to PROJECT_PLAN.md Section 9 and TEST_PLAN.md Section 3:
 * - Population: Reviewed reports in ['assigned', 'in_progress', 'resolved']
 * - Excludes 'submitted', 'under_review', and rejected duplicates ('rejected')
 * - Aggregates to approximate ~250m cells
 * - Excludes resident identities, raw private descriptions, and private photos
 * - Heatmap cells and summary totals use identical filters and populations
 */

const { Report } = require('../reports/report.model');

const REVIEWED_STATUSES = ['assigned', 'in_progress', 'resolved'];

/**
 * Approximate center point extraction from cell ID: e.g. "cell_12.9725_77.5950"
 */
function cellToCoordinates(cellId) {
  if (!cellId || !cellId.startsWith('cell_')) return [0, 0];
  const parts = cellId.replace('cell_', '').split('_');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    return [lon, lat]; // GeoJSON [lon, lat]
  }
  return [0, 0];
}

/**
 * Generate reviewed reports aggregate insights.
 */
async function getCommunityInsights({ category, status, dateFrom, dateTo, reportsDataSource = null }) {
  // Determine allowed statuses based on filter
  let activeStatuses = [...REVIEWED_STATUSES];
  if (status) {
    if (!REVIEWED_STATUSES.includes(status)) {
      // If requested status is outside reviewed population (e.g. 'rejected' or 'submitted')
      // return 0 matching items to preserve transparency rules
      return {
        totalReviewed: 0,
        cells: [],
        categoryBreakdown: {},
        statusBreakdown: {},
        reviewedPopulationNote: 'Community insights include reviewed reports in assigned, in_progress, or resolved status only.'
      };
    }
    activeStatuses = [status];
  }

  let reports = [];

  if (reportsDataSource) {
    // Injected dataSource for testing or standalone execution
    reports = reportsDataSource.filter((r) => activeStatuses.includes(r.status));
  } else if (Report && Report.find) {
    const query = { status: { $in: activeStatuses } };
    if (category) query.category = category;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    reports = await Report.find(query).lean();
  }

  // Apply in-memory category / date filters if using dataSource
  if (category && reportsDataSource) {
    reports = reports.filter((r) => r.category === category);
  }
  if (dateFrom && reportsDataSource) {
    reports = reports.filter((r) => new Date(r.createdAt) >= new Date(dateFrom));
  }
  if (dateTo && reportsDataSource) {
    reports = reports.filter((r) => new Date(r.createdAt) <= new Date(dateTo));
  }

  const cellMap = new Map();
  const categoryBreakdown = {};
  const statusBreakdown = { assigned: 0, in_progress: 0, resolved: 0 };

  for (const r of reports) {
    // Count totals
    categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
    if (statusBreakdown[r.status] !== undefined) {
      statusBreakdown[r.status]++;
    }

    // Aggregate by ~250m cell ID (privacy-safe, NO exact coordinates/descriptions exposed!)
    const cellId = r.approximateCell || 'cell_general';
    if (!cellMap.has(cellId)) {
      cellMap.set(cellId, {
        cellId,
        centerCoordinates: cellToCoordinates(cellId),
        reportCount: 0,
        categories: {}
      });
    }

    const cellObj = cellMap.get(cellId);
    cellObj.reportCount++;
    cellObj.categories[r.category] = (cellObj.categories[r.category] || 0) + 1;
  }

  const cells = Array.from(cellMap.values()).sort((a, b) => b.reportCount - a.reportCount);

  return {
    totalReviewed: reports.length,
    cellCount: cells.length,
    cells,
    categoryBreakdown,
    statusBreakdown,
    privacyProtection: {
      isAggregated: true,
      gridResolutionMeters: 250,
      exactCoordinatesRedacted: true,
      residentIdentityRedacted: true,
      rawDescriptionsRedacted: true
    }
  };
}

module.exports = {
  getCommunityInsights,
  REVIEWED_STATUSES
};
