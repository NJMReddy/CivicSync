/**
 * @file evidence.test.js
 * @description Test suite for Task I9 Before–After Evidence comparison.
 * Verifies pairing rules, viewpoint grouping, chronological stage assignment,
 * demo labeling, and honest fallback states.
 */

const assert = require('assert');
const { pairBeforeAfterEvidence } = require('../evidence.service');

async function runEvidenceTests() {
  const results = [];
  function record(testName, passed, error = null) {
    results.push({ testName, passed, error: error ? error.message : null });
    if (!passed) {
      console.error(`FAIL: ${testName}`, error);
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  console.log('--- Running I9 Before–After Evidence Checks ---');

  const projectId = 'proj_metro_bridge_01';

  // 1. Two images with same viewpoint pair correctly in chronological order
  try {
    const mediaItems = [
      {
        _id: 'med_after',
        targetId: projectId,
        purpose: 'official_evidence',
        viewpointId: 'vp_north_pylon',
        captureDate: '2026-10-01T10:00:00Z',
        format: 'jpg',
        source: 'Official Completion Inspection'
      },
      {
        _id: 'med_before',
        targetId: projectId,
        purpose: 'official_evidence',
        viewpointId: 'vp_north_pylon',
        captureDate: '2026-06-01T10:00:00Z', // earlier
        format: 'jpg',
        source: 'Initial Site Survey'
      }
    ];

    const res = pairBeforeAfterEvidence({ projectId, mediaItems });
    assert.strictEqual(res.hasCompletePair, true);
    assert.strictEqual(res.galleryState, 'comparison_ready');
    assert.strictEqual(res.pairs.length, 1);

    const pair = res.pairs[0];
    assert.strictEqual(pair.viewpointId, 'vp_north_pylon');
    assert.strictEqual(pair.before.mediaId, 'med_before');
    assert.strictEqual(pair.after.mediaId, 'med_after');
    assert.strictEqual(pair.isIllustrative, false);

    record('Two photos with matching viewpoint pair chronologically as before and after', true);
  } catch (err) {
    record('Two photos with matching viewpoint pair chronologically as before and after', false, err);
  }

  // 2. Single photo produces honest incomplete/gallery state without fabricating comparison
  try {
    const singleMedia = [
      {
        _id: 'med_single',
        targetId: projectId,
        purpose: 'official_evidence',
        viewpointId: 'vp_south_approach',
        captureDate: '2026-07-01T10:00:00Z',
        format: 'jpg'
      }
    ];

    const res = pairBeforeAfterEvidence({ projectId, mediaItems: singleMedia });
    assert.strictEqual(res.hasCompletePair, false);
    assert.strictEqual(res.galleryState, 'gallery_only');
    assert.strictEqual(res.pairs[0].isComplete, false);
    assert.strictEqual(res.pairs[0].singleItem.mediaId, 'med_single');
    assert.ok(res.pairs[0].message);

    record('Single photo yields honest incomplete state without fabricating comparison', true);
  } catch (err) {
    record('Single photo yields honest incomplete state without fabricating comparison', false, err);
  }

  // 3. Illustrative demo fixture is clearly flagged
  try {
    const demoItems = [
      {
        _id: 'med_demo_before',
        targetId: projectId,
        purpose: 'before_after',
        viewpointId: 'vp_demo',
        captureDate: '2026-01-01',
        isDemo: true,
        source: 'Illustrative Benchmark'
      },
      {
        _id: 'med_demo_after',
        targetId: projectId,
        purpose: 'before_after',
        viewpointId: 'vp_demo',
        captureDate: '2026-02-01',
        isDemo: true,
        source: 'Illustrative Benchmark'
      }
    ];

    const res = pairBeforeAfterEvidence({ projectId, mediaItems: demoItems });
    assert.strictEqual(res.pairs[0].isIllustrative, true);
    record('Illustrative demo photographs are explicitly labeled', true);
  } catch (err) {
    record('Illustrative demo photographs are explicitly labeled', false, err);
  }

  // 4. Empty media yields honest empty gallery
  try {
    const res = pairBeforeAfterEvidence({ projectId, mediaItems: [] });
    assert.strictEqual(res.hasCompletePair, false);
    assert.strictEqual(res.galleryState, 'empty');
    assert.strictEqual(res.pairs.length, 0);
    record('Zero media items returns honest empty gallery state', true);
  } catch (err) {
    record('Zero media items returns honest empty gallery state', false, err);
  }

  return results;
}

if (require.main === module) {
  runEvidenceTests()
    .then((results) => {
      const allPassed = results.every((r) => r.passed);
      console.log(`\nEvidence Tests Finished. All Passed: ${allPassed}`);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runEvidenceTests };
