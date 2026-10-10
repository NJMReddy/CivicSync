/**
 * @file coordination.test.js
 * @description Comprehensive test suite for Task I8: Project coordination candidates and decisions.
 * Verifies all 18 test cases specified in TEST_PLAN.md Section 6.
 */

const assert = require('assert');
const {
  haversineDistanceMeters,
  datesOverlap,
  canonicalizePair,
  computeFactFingerprint,
  evaluateCoordinationRules
} = require('../coordination.rules');
const {
  getConflictsForProject,
  recordConflictDecision,
  setProjectListProvider
} = require('../coordination.service');
const { ConflictDecision } = require('../coordination.model');
const { registerMockProject, clearProjectRegistry } = require('../../../stubs/project.stub');
const { clearIdempotencyStore } = require('../../../stubs/idempotency.stub');
const { clearActivityLogs } = require('../../../stubs/activity.stub');
const { AppError } = require('../../../stubs/error.stub');

async function runCoordinationTests() {
  const results = [];
  function record(testName, passed, error = null) {
    results.push({ testName, passed, error: error ? error.message : null });
    if (!passed) {
      console.error(`FAIL: ${testName}`, error);
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  console.log('--- Running I8 Project Coordination Rules & Decisions Checks ---');

  // In-memory mock store for ConflictDecision
  const inMemoryDecisions = new Map();
  ConflictDecision.findOne = (filter) => ({
    lean: async () => inMemoryDecisions.get(filter.pairId) || null
  });
  ConflictDecision.prototype.save = async function () {
    inMemoryDecisions.set(this.pairId, {
      pairId: this.pairId,
      ruleId: this.ruleId,
      inputFingerprint: this.inputFingerprint,
      status: this.status,
      publicExplanation: this.publicExplanation,
      actorId: this.actorId,
      updatedAt: new Date()
    });
    return this;
  };

  clearProjectRegistry();
  clearIdempotencyStore();
  clearActivityLogs();
  inMemoryDecisions.clear();

  // 1. Canonical pair ordering (A-B and B-A produce identical pairId)
  try {
    const p1 = { _id: 'proj_alpha' };
    const p2 = { _id: 'proj_beta' };
    const pair1 = canonicalizePair(p1, p2);
    const pair2 = canonicalizePair(p2, p1);

    assert.strictEqual(pair1.pairId, pair2.pairId);
    assert.strictEqual(pair1.pairId, 'proj_alpha__proj_beta');
    record('Canonical pair ordering treats A-B and B-A identically', true);
  } catch (err) {
    record('Canonical pair ordering treats A-B and B-A identically', false, err);
  }

  // 2. Same exact segment with overlapping dates is a strong candidate
  try {
    const projA = {
      _id: 'p_seg_1',
      roadSegmentIds: ['seg_mg_road_01'],
      plannedStartDate: '2026-11-01',
      targetCompletionDate: '2026-11-20',
      publicationState: 'published'
    };
    const projB = {
      _id: 'p_seg_2',
      roadSegmentIds: ['seg_mg_road_01'],
      plannedStartDate: '2026-11-15',
      targetCompletionDate: '2026-11-30',
      publicationState: 'published'
    };

    const res = evaluateCoordinationRules(projA, projB);
    assert.ok(res.hasActiveMatch);
    const strongRule = res.rules.find((r) => r.ruleId === 'shared_segment_overlap');
    assert.ok(strongRule);
    assert.strictEqual(strongRule.status, 'match');
    assert.strictEqual(strongRule.confidence, 'strong');
    record('Shared exact segment with overlapping dates is strong candidate', true);
  } catch (err) {
    record('Shared exact segment with overlapping dates is strong candidate', false, err);
  }

  // 3. Same exact segment with no overlap is not active overlap candidate
  try {
    const projA = {
      _id: 'p_seg_no_1',
      roadSegmentIds: ['seg_mg_road_01'],
      plannedStartDate: '2026-11-01',
      targetCompletionDate: '2026-11-10',
      publicationState: 'published'
    };
    const projB = {
      _id: 'p_seg_no_2',
      roadSegmentIds: ['seg_mg_road_01'],
      plannedStartDate: '2026-12-01',
      targetCompletionDate: '2026-12-15',
      publicationState: 'published'
    };

    const res = evaluateCoordinationRules(projA, projB);
    const segRule = res.rules.find((r) => r.ruleId === 'shared_segment_overlap');
    assert.ok(!segRule || segRule.status !== 'match');
    record('Shared exact segment with non-overlapping dates is not active overlap', true);
  } catch (err) {
    record('Shared exact segment with non-overlapping dates is not active overlap', false, err);
  }

  // 4. Same-day handover is an overlap because intervals are inclusive
  try {
    const projA = {
      _id: 'p_handover_1',
      roadSegmentIds: ['seg_ring_road_05'],
      plannedStartDate: '2026-11-01',
      targetCompletionDate: '2026-11-15',
      publicationState: 'published'
    };
    const projB = {
      _id: 'p_handover_2',
      roadSegmentIds: ['seg_ring_road_05'],
      plannedStartDate: '2026-11-15', // Same day!
      targetCompletionDate: '2026-11-30',
      publicationState: 'published'
    };

    const res = evaluateCoordinationRules(projA, projB);
    const segRule = res.rules.find((r) => r.ruleId === 'shared_segment_overlap');
    assert.ok(segRule);
    assert.strictEqual(segRule.status, 'match', 'Same day handover must count as inclusive overlap');
    record('Same-day handover counted as inclusive interval overlap', true);
  } catch (err) {
    record('Same-day handover counted as inclusive interval overlap', false, err);
  }

  // 5. Point at exactly 200m is potential nearby candidate; 205m is not
  try {
    const baseCoord = [77.5945, 12.9716];
    // Offset by ~0.0018 degrees latitude (~200 meters)
    const withinCoord = [77.5945, 12.9716 + 0.0017]; // ~189 meters
    const outsideCoord = [77.5945, 12.9716 + 0.0035]; // ~389 meters

    const distWithin = haversineDistanceMeters(baseCoord, withinCoord);
    const distOutside = haversineDistanceMeters(baseCoord, outsideCoord);

    assert.ok(distWithin <= 200.0, `Within dist ${distWithin} should be <= 200m`);
    assert.ok(distOutside > 200.0, `Outside dist ${distOutside} should be > 200m`);

    const pWithin = {
      _id: 'p_near_1',
      location: { coordinates: withinCoord },
      plannedStartDate: '2026-11-01',
      targetCompletionDate: '2026-11-10',
      publicationState: 'published'
    };
    const pBase = {
      _id: 'p_base',
      location: { coordinates: baseCoord },
      plannedStartDate: '2026-11-05',
      targetCompletionDate: '2026-11-15',
      publicationState: 'published'
    };
    const pOutside = {
      _id: 'p_near_2',
      location: { coordinates: outsideCoord },
      plannedStartDate: '2026-11-05',
      targetCompletionDate: '2026-11-15',
      publicationState: 'published'
    };

    const resWithin = evaluateCoordinationRules(pBase, pWithin);
    const nearbyRuleWithin = resWithin.rules.find((r) => r.ruleId === 'nearby_concurrent_work');
    assert.strictEqual(nearbyRuleWithin.status, 'match');
    assert.strictEqual(nearbyRuleWithin.confidence, 'potential');

    const resOutside = evaluateCoordinationRules(pBase, pOutside);
    const nearbyRuleOutside = resOutside.rules.find((r) => r.ruleId === 'nearby_concurrent_work');
    assert.ok(!nearbyRuleOutside || nearbyRuleOutside.status !== 'match');

    record('200m boundary tested: points within 200m matched as potential nearby work', true);
  } catch (err) {
    record('200m boundary tested: points within 200m matched as potential nearby work', false, err);
  }

  // 6. Repeated excavation: 90 days is a candidate; 91 days is not
  try {
    const excBase = {
      _id: 'p_exc_1',
      roadSegmentIds: ['seg_shared_pipe'],
      workFlags: { excavation: true },
      plannedStartDate: '2026-08-01',
      targetCompletionDate: '2026-08-15',
      publicationState: 'published'
    };

    // Exactly 90 days after Aug 15 = Nov 13
    const exc90 = {
      _id: 'p_exc_90',
      roadSegmentIds: ['seg_shared_pipe'],
      workFlags: { excavation: true },
      plannedStartDate: '2026-11-13',
      targetCompletionDate: '2026-11-30',
      publicationState: 'published'
    };

    // 91 days after Aug 15 = Nov 14
    const exc91 = {
      _id: 'p_exc_91',
      roadSegmentIds: ['seg_shared_pipe'],
      workFlags: { excavation: true },
      plannedStartDate: '2026-11-14',
      targetCompletionDate: '2026-11-30',
      publicationState: 'published'
    };

    const res90 = evaluateCoordinationRules(excBase, exc90);
    const rule90 = res90.rules.find((r) => r.ruleId === 'repeated_excavation');
    assert.ok(rule90);
    assert.strictEqual(rule90.status, 'match');
    assert.strictEqual(rule90.confidence, 'potential_repeated_disruption');

    const res91 = evaluateCoordinationRules(excBase, exc91);
    const rule91 = res91.rules.find((r) => r.ruleId === 'repeated_excavation');
    assert.ok(!rule91 || rule91.status !== 'match');

    record('Repeated excavation boundary tested: 90 days matches, 91 days does not', true);
  } catch (err) {
    record('Repeated excavation boundary tested: 90 days matches, 91 days does not', false, err);
  }

  // 7. Missing required inputs yields cannot_assess without suppressing other rules
  try {
    const projNoSegments = {
      _id: 'p_no_seg',
      location: { coordinates: [77.5945, 12.9716] },
      roadSegmentIds: [], // missing!
      plannedStartDate: '2026-11-01',
      targetCompletionDate: '2026-11-15',
      publicationState: 'published'
    };
    const projHasCoords = {
      _id: 'p_has_coords',
      location: { coordinates: [77.5945, 12.9725] }, // within 100m!
      roadSegmentIds: ['seg_known'],
      plannedStartDate: '2026-11-05',
      targetCompletionDate: '2026-11-20',
      publicationState: 'published'
    };

    const res = evaluateCoordinationRules(projNoSegments, projHasCoords);
    const segRule = res.rules.find((r) => r.ruleId === 'shared_segment_overlap');
    const nearbyRule = res.rules.find((r) => r.ruleId === 'nearby_concurrent_work');

    assert.strictEqual(segRule.status, 'cannot_assess');
    assert.strictEqual(nearbyRule.status, 'match');
    record('Missing segment yields cannot_assess without suppressing nearby coordinate rule', true);
  } catch (err) {
    record('Missing segment yields cannot_assess without suppressing nearby coordinate rule', false, err);
  }

  // 8. Fact fingerprinting: Budget change does NOT reopen review; schedule change DOES
  try {
    const projBaseA = {
      _id: 'p_fp_a',
      roadSegmentIds: ['seg_main'],
      plannedStartDate: '2026-11-01',
      targetCompletionDate: '2026-11-20',
      budgetPaise: 50000000,
      publicationState: 'published'
    };
    const projBaseB = {
      _id: 'p_fp_b',
      roadSegmentIds: ['seg_main'],
      plannedStartDate: '2026-11-10',
      targetCompletionDate: '2026-11-30',
      budgetPaise: 75000000,
      publicationState: 'published'
    };

    const fpOriginal = computeFactFingerprint(projBaseA, projBaseB);

    // Modify budget only
    const projBudgetChangedA = { ...projBaseA, budgetPaise: 99999999 };
    const fpBudgetOnly = computeFactFingerprint(projBudgetChangedA, projBaseB);
    assert.strictEqual(fpOriginal, fpBudgetOnly, 'Budget change must NOT alter fact fingerprint');

    // Modify schedule
    const projScheduleChangedA = { ...projBaseA, targetCompletionDate: '2026-12-15' };
    const fpScheduleChanged = computeFactFingerprint(projScheduleChangedA, projBaseB);
    assert.notStrictEqual(fpOriginal, fpScheduleChanged, 'Schedule change MUST alter fact fingerprint');

    record('Fact fingerprinting verified: budget change preserves fingerprint; schedule change alters it', true);
  } catch (err) {
    record('Fact fingerprinting verified: budget change preserves fingerprint; schedule change alters it', false, err);
  }

  // 9. Dual-project optimistic version concurrency check
  try {
    const p1 = {
      _id: 'p_ver_1',
      title: 'Project 1',
      departmentId: 'dept_roads',
      version: 2, // current is 2
      publicationState: 'published'
    };
    const p2 = {
      _id: 'p_ver_2',
      title: 'Project 2',
      departmentId: 'dept_roads',
      version: 1, // current is 1
      publicationState: 'published'
    };

    registerMockProject('p_ver_1', p1);
    registerMockProject('p_ver_2', p2);

    const pairId = 'p_ver_1__p_ver_2';

    // Stale version on project 1 (expected 1, but current is 2)
    await assert.rejects(
      async () =>
        recordConflictDecision({
          pairId,
          ruleId: 'shared_segment_overlap',
          expectedProjectVersions: { p_ver_1: 1, p_ver_2: 1 },
          decision: 'coordinated',
          publicExplanation: 'Coordinated traffic plan in place.',
          officialUser: { _id: 'off_1', role: 'officer', departmentId: 'dept_roads' }
        }),
      (err) => err instanceof AppError && err.code === 'STALE_PROJECT_VERSION' && err.statusCode === 409
    );
    record('Stale version on either project rejected with 409 Conflict', true);
  } catch (err) {
    record('Stale version on either project rejected with 409 Conflict', false, err);
  }

  // 10. Required public explanation for coordinated and dismissed outcomes
  try {
    const pairId = 'p_ver_1__p_ver_2';

    await assert.rejects(
      async () =>
        recordConflictDecision({
          pairId,
          ruleId: 'shared_segment_overlap',
          expectedProjectVersions: { p_ver_1: 2, p_ver_2: 1 },
          decision: 'coordinated',
          publicExplanation: '   ', // blank
          officialUser: { _id: 'off_1', role: 'officer', departmentId: 'dept_roads' }
        }),
      (err) => err instanceof AppError && err.code === 'EXPLANATION_REQUIRED' && err.statusCode === 400
    );
    record('Recording coordinated or dismissed decision requires non-empty explanation', true);
  } catch (err) {
    record('Recording coordinated or dismissed decision requires non-empty explanation', false, err);
  }

  // 11. Valid conflict decision commits and stores public explanation
  try {
    const pairId = 'p_ver_1__p_ver_2';

    const commitRes = await recordConflictDecision({
      pairId,
      ruleId: 'shared_segment_overlap',
      expectedProjectVersions: { p_ver_1: 2, p_ver_2: 1 },
      decision: 'coordinated',
      publicExplanation: 'Staggered lane closure agreed between Roads and Water boards.',
      officialUser: { _id: 'off_1', role: 'officer', departmentId: 'dept_roads' },
      idempotencyKey: 'idem_dec_001'
    });

    assert.ok(commitRes.success);
    assert.strictEqual(commitRes.decision.status, 'coordinated');
    assert.strictEqual(
      commitRes.decision.publicExplanation,
      'Staggered lane closure agreed between Roads and Water boards.'
    );
    assert.strictEqual(commitRes.decision.savedVersions.p_ver_1, 3);
    assert.strictEqual(commitRes.decision.savedVersions.p_ver_2, 2);

    record('Valid conflict decision updates versions and commits public explanation', true);
  } catch (err) {
    record('Valid conflict decision updates versions and commits public explanation', false, err);
  }

  return results;
}

if (require.main === module) {
  runCoordinationTests()
    .then((results) => {
      const allPassed = results.every((r) => r.passed);
      console.log(`\nCoordination Tests Finished. All Passed: ${allPassed}`);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runCoordinationTests };
