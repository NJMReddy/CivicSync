/**
 * @file reports.test.js
 * @description Test suite for Task I7: Resident Issue Reporting & Official Response Workflow.
 * Verifies durable reference generation, department routing, official state transitions,
 * required resolution/rejection explanations, optimistic version checks, idempotency,
 * and privacy boundaries.
 */

const assert = require('assert');
const {
  createReport,
  getResidentReports,
  getReportById,
  getOfficialReportQueue,
  executeReportAction,
  computeApproximateCell,
  generateDurableReference
} = require('../report.service');
const { Report } = require('../report.model');
const { registerMockProject, clearProjectRegistry } = require('../../../stubs/project.stub');
const { clearIdempotencyStore } = require('../../../stubs/idempotency.stub');
const { clearActivityLogs } = require('../../../stubs/activity.stub');
const { AppError } = require('../../../stubs/error.stub');

async function runReportTests() {
  const results = [];
  function record(testName, passed, error = null) {
    results.push({ testName, passed, error: error ? error.message : null });
    if (!passed) {
      console.error(`FAIL: ${testName}`, error);
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  console.log('--- Running I7 Resident Reporting and Official Workflow Checks ---');

  // In-memory mock store for Reports
  const inMemoryReports = new Map();
  Report.findById = async (id) => inMemoryReports.get(id.toString()) || null;
  Report.find = (filter) => {
    let arr = Array.from(inMemoryReports.values());
    if (filter.residentId) {
      arr = arr.filter((r) => r.residentId.toString() === filter.residentId.toString());
    }
    if (filter.routedDepartmentId !== undefined) {
      arr = arr.filter((r) => r.routedDepartmentId === filter.routedDepartmentId);
    }
    if (filter.status) {
      arr = arr.filter((r) => r.status === filter.status);
    }
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => arr.map((r) => JSON.parse(JSON.stringify(r)))
          })
        }),
        lean: async () => arr.map((r) => JSON.parse(JSON.stringify(r)))
      })
    };
  };
  Report.countDocuments = async (filter) => {
    let count = 0;
    for (const r of inMemoryReports.values()) {
      if (filter.routedDepartmentId !== undefined && r.routedDepartmentId !== filter.routedDepartmentId) continue;
      if (filter.status && r.status !== filter.status) continue;
      count++;
    }
    return count;
  };
  Report.prototype.save = async function () {
    this._id = this._id || `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    inMemoryReports.set(this._id.toString(), this);
    return this;
  };

  clearIdempotencyStore();
  clearActivityLogs();
  clearProjectRegistry();

  registerMockProject('proj_bridge_01', {
    title: 'Flyover Construction Phase 2',
    departmentId: 'dept_bridges'
  });

  // 1. Durable reference format check
  try {
    const ref = generateDurableReference();
    assert.match(ref, /^RPT-\d{4}-[A-F0-9]{8}$/);
    record('Durable report reference format matches RPT-YYYY-XXXXXXXX', true);
  } catch (err) {
    record('Durable report reference format matches RPT-YYYY-XXXXXXXX', false, err);
  }

  // 2. Approximate grid cell calculation
  try {
    const cell = computeApproximateCell([77.5945, 12.9716]);
    assert.strictEqual(typeof cell, 'string');
    assert.ok(cell.startsWith('cell_'));
    record('250m approximate cell computed for privacy-safe aggregate insights', true);
  } catch (err) {
    record('250m approximate cell computed for privacy-safe aggregate insights', false, err);
  }

  // 3. Resident submission with project link routes to department
  let projectReportId = null;
  let projectReportRef = null;
  try {
    const submission = await createReport({
      residentId: 'resident_alice',
      projectId: 'proj_bridge_01',
      category: 'stalled_work',
      description: 'Work stopped 3 weeks ago, excavation left uncovered.',
      coordinates: [77.5945, 12.9716],
      address: 'Outer Ring Road junction',
      mediaIds: [],
      idempotencyKey: 'idem_proj_001'
    });

    assert.ok(submission.success);
    assert.ok(submission.report._id);
    assert.ok(submission.report.reference);
    assert.strictEqual(submission.report.routedDepartmentId, 'dept_bridges');
    assert.strictEqual(submission.report.status, 'submitted');
    assert.strictEqual(submission.report.version, 1);

    projectReportId = submission.report._id;
    projectReportRef = submission.report.reference;
    record('Project-linked report successfully routes to owning department', true);
  } catch (err) {
    record('Project-linked report successfully routes to owning department', false, err);
  }

  // 4. Resident submission location-only routes to unassigned coordinator queue
  let unassignedReportId = null;
  try {
    const locSubmission = await createReport({
      residentId: 'resident_bob',
      projectId: null,
      category: 'safety_hazard',
      description: 'Dangerous pothole near the school crossroad.',
      coordinates: [77.601, 12.98],
      address: '1st Main Road',
      mediaIds: [],
      idempotencyKey: 'idem_loc_001'
    });

    assert.ok(locSubmission.success);
    assert.strictEqual(locSubmission.report.routedDepartmentId, null);
    assert.strictEqual(locSubmission.report.status, 'submitted');
    unassignedReportId = locSubmission.report._id;
    record('Location-only report routes to unassigned coordinator queue (routedDepartmentId=null)', true);
  } catch (err) {
    record('Location-only report routes to unassigned coordinator queue (routedDepartmentId=null)', false, err);
  }

  // 5. Idempotency test: duplicate key with same payload returns cached result
  try {
    const duplicateSubmission = await createReport({
      residentId: 'resident_alice',
      projectId: 'proj_bridge_01',
      category: 'stalled_work',
      description: 'Work stopped 3 weeks ago, excavation left uncovered.',
      coordinates: [77.5945, 12.9716],
      address: 'Outer Ring Road junction',
      mediaIds: [],
      idempotencyKey: 'idem_proj_001'
    });

    assert.strictEqual(duplicateSubmission.report._id, projectReportId);
    assert.strictEqual(duplicateSubmission.report.reference, projectReportRef);
    record('Idempotent retry with identical key returns cached reference without duplicating report', true);
  } catch (err) {
    record('Idempotent retry with identical key returns cached reference without duplicating report', false, err);
  }

  // 6. Idempotency test: duplicate key with different payload returns 409 Conflict
  try {
    await assert.rejects(
      async () =>
        createReport({
          residentId: 'resident_alice',
          projectId: 'proj_bridge_01',
          category: 'poor_quality', // changed
          description: 'Completely different description now',
          coordinates: [77.5945, 12.9716],
          mediaIds: [],
          idempotencyKey: 'idem_proj_001'
        }),
      (err) => err instanceof AppError && err.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH' && err.statusCode === 409
    );
    record('Reused idempotency key with conflicting payload rejected with 409 Conflict', true);
  } catch (err) {
    record('Reused idempotency key with conflicting payload rejected with 409 Conflict', false, err);
  }

  // 7. Privacy boundary: Resident Bob cannot read Resident Alice's report
  try {
    await assert.rejects(
      async () =>
        getReportById({
          reportId: projectReportId,
          requestingUser: { _id: 'resident_bob', role: 'resident', active: true }
        }),
      (err) => err instanceof AppError && err.code === 'FORBIDDEN_REPORT_ACCESS' && err.statusCode === 403
    );
    record('Resident A cannot read Resident B private report (403 Forbidden)', true);
  } catch (err) {
    record('Resident A cannot read Resident B private report (403 Forbidden)', false, err);
  }

  // 8. Officer department isolation: Roads officer cannot mutate Bridges report
  try {
    const wrongOfficer = {
      _id: 'officer_roads_1',
      role: 'officer',
      departmentId: 'dept_roads',
      active: true
    };

    await assert.rejects(
      async () =>
        executeReportAction({
          reportId: projectReportId,
          action: 'review',
          expectedVersion: 1,
          officialUser: wrongOfficer
        }),
      (err) => err instanceof AppError && err.code === 'FORBIDDEN_DEPARTMENT' && err.statusCode === 403
    );
    record('Cross-department officer mutation rejected server-side (403 Forbidden)', true);
  } catch (err) {
    record('Cross-department officer mutation rejected server-side (403 Forbidden)', false, err);
  }

  // 9. Authorized department officer reviews report
  try {
    const bridgesOfficer = {
      _id: 'officer_bridges_1',
      role: 'officer',
      departmentId: 'dept_bridges',
      active: true
    };

    const reviewRes = await executeReportAction({
      reportId: projectReportId,
      action: 'review',
      expectedVersion: 1,
      officialUser: bridgesOfficer
    });

    assert.ok(reviewRes.success);
    assert.strictEqual(reviewRes.report.status, 'under_review');
    assert.strictEqual(reviewRes.report.version, 2);
    record('Authorized officer transitions report from submitted to under_review', true);
  } catch (err) {
    record('Authorized officer transitions report from submitted to under_review', false, err);
  }

  // 10. Optimistic concurrency: Stale version 1 rejected after report updated to version 2
  try {
    const bridgesOfficer = {
      _id: 'officer_bridges_1',
      role: 'officer',
      departmentId: 'dept_bridges',
      active: true
    };

    await assert.rejects(
      async () =>
        executeReportAction({
          reportId: projectReportId,
          action: 'in_progress',
          expectedVersion: 1, // Stale! Current version is 2
          officialUser: bridgesOfficer
        }),
      (err) => err instanceof AppError && err.code === 'STALE_REPORT_VERSION' && err.statusCode === 409
    );
    record('Stale expectedVersion rejected with 409 Conflict', true);
  } catch (err) {
    record('Stale expectedVersion rejected with 409 Conflict', false, err);
  }

  // 11. Resolution requires explanation (empty resolutionReason rejected with 400)
  try {
    const bridgesOfficer = {
      _id: 'officer_bridges_1',
      role: 'officer',
      departmentId: 'dept_bridges',
      active: true
    };

    await assert.rejects(
      async () =>
        executeReportAction({
          reportId: projectReportId,
          action: 'resolve',
          expectedVersion: 2,
          resolutionReason: '   ', // blank
          officialUser: bridgesOfficer
        }),
      (err) => err instanceof AppError && err.code === 'RESOLUTION_REASON_REQUIRED' && err.statusCode === 400
    );
    record('Resolving report requires non-empty resolutionReason', true);
  } catch (err) {
    record('Resolving report requires non-empty resolutionReason', false, err);
  }

  // 12. Valid resolution with explanation commits and appends to status history
  try {
    const bridgesOfficer = {
      _id: 'officer_bridges_1',
      role: 'officer',
      departmentId: 'dept_bridges',
      active: true
    };

    const resolveRes = await executeReportAction({
      reportId: projectReportId,
      action: 'resolve',
      expectedVersion: 2,
      resolutionReason: 'Excavation backfilled and protective barricading restored.',
      narrative: 'Site engineer inspected work on Oct 10.',
      officialUser: bridgesOfficer
    });

    assert.ok(resolveRes.success);
    assert.strictEqual(resolveRes.report.status, 'resolved');
    assert.strictEqual(resolveRes.report.version, 3);
    assert.strictEqual(
      resolveRes.report.officialResponse.resolutionReason,
      'Excavation backfilled and protective barricading restored.'
    );
    assert.strictEqual(resolveRes.report.statusHistory.length, 3); // submitted, under_review, resolved
    record('Official resolution persists explanation, updates status, and appends to status history', true);
  } catch (err) {
    record('Official resolution persists explanation, updates status, and appends to status history', false, err);
  }

  // 13. Coordinator routes unassigned report
  try {
    const coordinator = {
      _id: 'coordinator_admin',
      role: 'coordinator',
      active: true
    };

    const routeRes = await executeReportAction({
      reportId: unassignedReportId,
      action: 'route',
      expectedVersion: 1,
      routedDepartmentId: 'dept_roads',
      officialUser: coordinator
    });

    assert.ok(routeRes.success);
    assert.strictEqual(routeRes.report.routedDepartmentId, 'dept_roads');
    assert.strictEqual(routeRes.report.version, 2);
    record('Coordinator successfully routes unassigned report to department', true);
  } catch (err) {
    record('Coordinator successfully routes unassigned report to department', false, err);
  }

  return results;
}

if (require.main === module) {
  runReportTests()
    .then((results) => {
      const allPassed = results.every((r) => r.passed);
      console.log(`\nReport Tests Finished. All Passed: ${allPassed}`);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runReportTests };
