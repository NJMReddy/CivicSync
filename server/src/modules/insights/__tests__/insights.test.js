/**
 * @file insights.test.js
 * @description Test suite for Task I9 Community Insights and Heatmap aggregation.
 * Verifies reviewed population filtering, exclusion of unreviewed/rejected reports,
 * ~250m cell clustering, privacy projections, and filter consistency.
 */

const assert = require('assert');
const { getCommunityInsights, REVIEWED_STATUSES } = require('../insights.service');

async function runInsightsTests() {
  const results = [];
  function record(testName, passed, error = null) {
    results.push({ testName, passed, error: error ? error.message : null });
    if (!passed) {
      console.error(`FAIL: ${testName}`, error);
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  console.log('--- Running I9 Community Insights Checks ---');

  // Sample heterogeneous report population
  const sampleReports = [
    // Reviewed population
    {
      _id: 'rep_1',
      residentId: 'user_res_1',
      category: 'safety_hazard',
      status: 'assigned',
      approximateCell: 'cell_12.9725_77.5950',
      description: 'Private resident description text...',
      location: { coordinates: [77.5948, 12.9721], address: 'Private street 1' }
    },
    {
      _id: 'rep_2',
      residentId: 'user_res_2',
      category: 'safety_hazard',
      status: 'in_progress',
      approximateCell: 'cell_12.9725_77.5950', // same cell
      description: 'Private resident description text...',
      location: { coordinates: [77.5949, 12.9722], address: 'Private street 2' }
    },
    {
      _id: 'rep_3',
      residentId: 'user_res_3',
      category: 'stalled_work',
      status: 'resolved',
      approximateCell: 'cell_12.9800_77.6000', // different cell
      description: 'Private resident description text...',
      location: { coordinates: [77.6002, 12.9804], address: 'Private street 3' }
    },
    // Excluded population (Unreviewed & Rejected)
    {
      _id: 'rep_unreviewed_1',
      residentId: 'user_res_4',
      category: 'stalled_work',
      status: 'submitted', // newly submitted; not reviewed!
      approximateCell: 'cell_12.9800_77.6000'
    },
    {
      _id: 'rep_unreviewed_2',
      residentId: 'user_res_5',
      category: 'poor_quality',
      status: 'under_review', // still under review!
      approximateCell: 'cell_12.9800_77.6000'
    },
    {
      _id: 'rep_rejected',
      residentId: 'user_res_6',
      category: 'other',
      status: 'rejected', // rejected duplicate!
      approximateCell: 'cell_12.9725_77.5950'
    }
  ];

  // 1. Population filter includes ONLY reviewed reports (assigned, in_progress, resolved)
  try {
    const res = await getCommunityInsights({ reportsDataSource: sampleReports });
    assert.strictEqual(res.totalReviewed, 3, 'Must include exactly the 3 reviewed reports');
    assert.strictEqual(res.statusBreakdown.assigned, 1);
    assert.strictEqual(res.statusBreakdown.in_progress, 1);
    assert.strictEqual(res.statusBreakdown.resolved, 1);

    // Verify submitted, under_review, and rejected are excluded
    assert.strictEqual(res.statusBreakdown.submitted, undefined);
    assert.strictEqual(res.statusBreakdown.rejected, undefined);

    record('Population includes only reviewed reports (assigned, in_progress, resolved) and excludes submitted/rejected', true);
  } catch (err) {
    record('Population includes only reviewed reports (assigned, in_progress, resolved) and excludes submitted/rejected', false, err);
  }

  // 2. Aggregate ~250m cell clustering and totals consistency
  try {
    const res = await getCommunityInsights({ reportsDataSource: sampleReports });
    assert.strictEqual(res.cells.length, 2, 'Must cluster into exactly 2 distinct grid cells');

    const cell1 = res.cells.find((c) => c.cellId === 'cell_12.9725_77.5950');
    const cell2 = res.cells.find((c) => c.cellId === 'cell_12.9800_77.6000');

    assert.ok(cell1);
    assert.strictEqual(cell1.reportCount, 2);
    assert.strictEqual(cell1.categories['safety_hazard'], 2);

    assert.ok(cell2);
    assert.strictEqual(cell2.reportCount, 1);
    assert.strictEqual(cell2.categories['stalled_work'], 1);

    // Sum of cell counts equals totalReviewed
    const totalFromCells = res.cells.reduce((sum, c) => sum + c.reportCount, 0);
    assert.strictEqual(totalFromCells, res.totalReviewed);

    record('~250m cell clustering verified and cell counts agree with total reviewed summary', true);
  } catch (err) {
    record('~250m cell clustering verified and cell counts agree with total reviewed summary', false, err);
  }

  // 3. Privacy projection: Resident identity, raw descriptions, and exact locations are absent
  try {
    const res = await getCommunityInsights({ reportsDataSource: sampleReports });
    for (const cell of res.cells) {
      assert.strictEqual(cell.residentId, undefined);
      assert.strictEqual(cell.description, undefined);
      assert.strictEqual(cell.location, undefined);
      assert.strictEqual(cell.photos, undefined);
    }
    assert.strictEqual(res.privacyProtection.exactCoordinatesRedacted, true);
    assert.strictEqual(res.privacyProtection.residentIdentityRedacted, true);

    record('Privacy projection verified: raw descriptions and resident identities completely redacted', true);
  } catch (err) {
    record('Privacy projection verified: raw descriptions and resident identities completely redacted', false, err);
  }

  // 4. Category filter applies consistently to both totals and cells
  try {
    const filteredRes = await getCommunityInsights({
      category: 'safety_hazard',
      reportsDataSource: sampleReports
    });

    assert.strictEqual(filteredRes.totalReviewed, 2);
    assert.strictEqual(filteredRes.cells.length, 1);
    assert.strictEqual(filteredRes.cells[0].cellId, 'cell_12.9725_77.5950');
    assert.strictEqual(filteredRes.cells[0].reportCount, 2);

    record('Category filter applies synchronously to both aggregate counts and cell map', true);
  } catch (err) {
    record('Category filter applies synchronously to both aggregate counts and cell map', false, err);
  }

  return results;
}

if (require.main === module) {
  runInsightsTests()
    .then((results) => {
      const allPassed = results.every((r) => r.passed);
      console.log(`\nInsights Tests Finished. All Passed: ${allPassed}`);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runInsightsTests };
