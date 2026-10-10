/**
 * @file run-i8-i9-checks.js
 * @description Master test runner executing all required verification checks for Tasks I8, I9,
 * and the I10 Factual Fallback.
 */

const { runCoordinationTests } = require('./modules/coordination/__tests__/coordination.test');
const { runEvidenceTests } = require('./modules/evidence/__tests__/evidence.test');
const { runInsightsTests } = require('./modules/insights/__tests__/insights.test');
const { checkI10Gate, generateFactualSummary } = require('./modules/summary/summary.service');
const assert = require('assert');

async function main() {
  console.log('================================================================');
  console.log('CivicSync Verification Runner — Tasks I8, I9 & I10 Assessment');
  console.log('================================================================\n');

  const coordResults = await runCoordinationTests();
  console.log('');
  const evidenceResults = await runEvidenceTests();
  console.log('');
  const insightsResults = await runInsightsTests();

  // Test I10 Gate and Factual Fallback
  console.log('\n--- Assessing Optional Task I10 Gate & Factual Fallback ---');
  const i10Results = [];

  try {
    const gateStatus = checkI10Gate();
    console.log(`Task I10 Gate Status: ${gateStatus.status}`);
    console.log(`Gate Details: ${gateStatus.reason || 'Enabled'}`);
    assert.strictEqual(typeof gateStatus.isGateMet, 'boolean');
    i10Results.push({
      testName: 'Task I10 Gate explicitly assessed with clear status and reason',
      passed: true
    });
  } catch (err) {
    i10Results.push({
      testName: 'Task I10 Gate explicitly assessed',
      passed: false,
      error: err.message
    });
  }

  try {
    const mockProject = {
      _id: 'p_101',
      title: 'Koramangala Stormwater Drain Renovation',
      departmentId: 'dept_stormwater',
      plannedStartDate: '2026-05-01',
      targetCompletionDate: '2026-12-31',
      progressPercentage: 45,
      delayExplanation: 'Monsoon waterlogging prevented foundation curing.',
      publicationState: 'published'
    };
    const fallback = generateFactualSummary(mockProject);
    assert.strictEqual(fallback.isAiGenerated, false);
    assert.strictEqual(fallback.source, 'CivicSync Verified Factual Baseline');
    assert.ok(fallback.factsSnapshotHash);
    assert.ok(fallback.summaryText.includes('Koramangala Stormwater Drain'));
    assert.ok(fallback.summaryText.includes('Monsoon waterlogging prevented'));

    i10Results.push({
      testName: 'Factual summary fallback generated without AI provider and source-hashed',
      passed: true
    });
    console.log('PASS: Factual summary fallback generated without AI provider and source-hashed');
  } catch (err) {
    i10Results.push({
      testName: 'Factual summary fallback generated',
      passed: false,
      error: err.message
    });
    console.error('FAIL: Factual summary fallback generated', err);
  }

  const allResults = [...coordResults, ...evidenceResults, ...insightsResults, ...i10Results];
  const passedCount = allResults.filter((r) => r.passed).length;
  const failedCount = allResults.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${allResults.length} total checks`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
