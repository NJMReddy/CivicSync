/**
 * @file coordination.rules.js
 * @description Pure domain logic for CivicSync conflict detection.
 * Conforms strictly to PROJECT_PLAN.md Section 10 and TEST_PLAN.md Section 6:
 * - Inclusive date intervals (same-day handovers are overlaps)
 * - 200 m spatial threshold (Haversine point distance)
 * - 90-day repeated excavation threshold (90 days inclusive; 91 days is not)
 * - Missing-data behavior (cannot assess without suppressing other rules)
 * - Canonical project pair ordering (A–B and B–A are identical)
 * - Fact fingerprinting (budget changes do not reopen conflict review)
 */

const crypto = require('crypto');

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate Great-Circle distance between two points in meters using Haversine formula.
 * @param {[number, number]} coordA [lonA, latA]
 * @param {[number, number]} coordB [lonB, latB]
 */
function haversineDistanceMeters(coordA, coordB) {
  if (!coordA || !coordB || coordA.length !== 2 || coordB.length !== 2) {
    return null;
  }
  const [lon1, lat1] = coordA;
  const [lon2, lat2] = coordB;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if two date intervals overlap inclusively.
 * Same-day handovers are considered overlapping.
 */
function datesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return null;
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA <= eB && sB <= eA;
}

/**
 * Compute difference in calendar days between two dates.
 */
function diffDays(dateA, dateB) {
  const tA = new Date(dateA).getTime();
  const tB = new Date(dateB).getTime();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs(tB - tA) / MS_PER_DAY);
}

/**
 * Canonicalize project pair order to ensure A–B and B–A are treated identically.
 */
function canonicalizePair(projA, projB) {
  const idA = projA._id.toString();
  const idB = projB._id.toString();
  if (idA < idB) {
    return { proj1: projA, proj2: projB, pairId: `${idA}__${idB}` };
  } else {
    return { proj1: projB, proj2: projA, pairId: `${idB}__${idA}` };
  }
}

/**
 * Compute fact fingerprint for relevant project facts only.
 * Schedule, segment, coordinate, excavation flag, and lifecycle state changes reopen review.
 * Budget changes are explicitly EXCLUDED so budget adjustments do not reopen review.
 */
function computeFactFingerprint(projA, projB) {
  const { proj1, proj2 } = canonicalizePair(projA, projB);

  const extractRelevantFacts = (p) => ({
    id: p._id.toString(),
    plannedStart: p.plannedStartDate ? new Date(p.plannedStartDate).toISOString().split('T')[0] : null,
    plannedEnd: p.targetCompletionDate ? new Date(p.targetCompletionDate).toISOString().split('T')[0] : null,
    revisedEnd: p.revisedCompletionDate ? new Date(p.revisedCompletionDate).toISOString().split('T')[0] : null,
    actualStart: p.actualStartDate ? new Date(p.actualStartDate).toISOString().split('T')[0] : null,
    actualEnd: p.actualCompletionDate ? new Date(p.actualCompletionDate).toISOString().split('T')[0] : null,
    roadSegments: Array.isArray(p.roadSegmentIds) ? [...p.roadSegmentIds].sort() : [],
    coordinates: p.location?.coordinates || null,
    hasExcavation: Boolean(p.workFlags?.excavation || p.hasExcavation || p.type === 'excavation'),
    publicationState: p.publicationState || 'published'
  });

  const payload = JSON.stringify({
    proj1: extractRelevantFacts(proj1),
    proj2: extractRelevantFacts(proj2)
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Get effective operational interval for a project.
 * Actual dates take precedence; otherwise revised date, otherwise planned date.
 */
function getEffectiveInterval(proj) {
  const start = proj.actualStartDate || proj.plannedStartDate || null;
  const end = proj.actualCompletionDate || proj.revisedCompletionDate || proj.targetCompletionDate || null;
  return { start, end };
}

/**
 * Evaluate all coordination rules for a pair of projects.
 * Returns an array of evaluated rule outcomes.
 */
function evaluateCoordinationRules(projA, projB, evaluationDate = new Date()) {
  const { proj1, proj2, pairId } = canonicalizePair(projA, projB);
  const fingerprint = computeFactFingerprint(proj1, proj2);
  const intervalA = getEffectiveInterval(proj1);
  const intervalB = getEffectiveInterval(proj2);

  const rulesOutcomes = [];

  // ==========================================
  // Rule 1: Shared-segment overlap (Strong)
  // ==========================================
  const segmentsA = Array.isArray(proj1.roadSegmentIds) ? proj1.roadSegmentIds : [];
  const segmentsB = Array.isArray(proj2.roadSegmentIds) ? proj2.roadSegmentIds : [];
  const missingSegments = segmentsA.length === 0 || segmentsB.length === 0;

  if (missingSegments) {
    rulesOutcomes.push({
      ruleId: 'shared_segment_overlap',
      status: 'cannot_assess',
      confidence: 'cannot_assess',
      display: 'Cannot assess shared segment rule: road segment identifiers missing on one or both projects'
    });
  } else {
    const sharedSegments = segmentsA.filter((s) => segmentsB.includes(s));
    if (sharedSegments.length > 0) {
      if (!intervalA.start || !intervalA.end || !intervalB.start || !intervalB.end) {
        rulesOutcomes.push({
          ruleId: 'shared_segment_overlap',
          status: 'cannot_assess',
          confidence: 'cannot_assess',
          display: 'Cannot assess shared segment overlap: schedule dates missing'
        });
      } else {
        const overlaps = datesOverlap(intervalA.start, intervalA.end, intervalB.start, intervalB.end);
        if (overlaps) {
          rulesOutcomes.push({
            ruleId: 'shared_segment_overlap',
            status: 'match',
            confidence: 'strong',
            sharedSegments,
            display: `Strong coordination candidate: shared road segment (${sharedSegments.join(', ')}) with overlapping work interval`
          });
        }
      }
    }
  }

  // ==========================================
  // Rule 2: Nearby concurrent work (200m potential)
  // ==========================================
  const coordsA = proj1.location?.coordinates;
  const coordsB = proj2.location?.coordinates;

  if (!coordsA || !coordsB) {
    rulesOutcomes.push({
      ruleId: 'nearby_concurrent_work',
      status: 'cannot_assess',
      confidence: 'cannot_assess',
      display: 'Cannot assess nearby work candidate: coordinates missing on one or both projects'
    });
  } else {
    const distanceMeters = haversineDistanceMeters(coordsA, coordsB);
    if (distanceMeters !== null && distanceMeters <= 200.0) {
      if (!intervalA.start || !intervalA.end || !intervalB.start || !intervalB.end) {
        rulesOutcomes.push({
          ruleId: 'nearby_concurrent_work',
          status: 'cannot_assess',
          confidence: 'cannot_assess',
          display: 'Cannot assess nearby concurrent work: schedule dates missing'
        });
      } else {
        const overlaps = datesOverlap(intervalA.start, intervalA.end, intervalB.start, intervalB.end);
        if (overlaps) {
          rulesOutcomes.push({
            ruleId: 'nearby_concurrent_work',
            status: 'match',
            confidence: 'potential',
            distanceMeters: Math.round(distanceMeters),
            display: `Potential nearby-work candidate: points within ${Math.round(distanceMeters)}m (<= 200m) with concurrent schedule`
          });
        }
      }
    }
  }

  // ==========================================
  // Rule 3: Repeated excavation (90-day window)
  // ==========================================
  const isExcA = Boolean(proj1.workFlags?.excavation || proj1.type === 'excavation');
  const isExcB = Boolean(proj2.workFlags?.excavation || proj2.type === 'excavation');

  if (isExcA && isExcB && !missingSegments) {
    const sharedSegments = segmentsA.filter((s) => segmentsB.includes(s));
    if (sharedSegments.length > 0 && intervalA.end && intervalB.start) {
      const endA = new Date(intervalA.end).getTime();
      const startB = new Date(intervalB.start).getTime();
      const endB = new Date(intervalB.end).getTime();
      const startA = new Date(intervalA.start).getTime();

      // Project 1 finishes before Project 2 starts
      if (startB >= endA) {
        const days = diffDays(intervalA.end, intervalB.start);
        if (days <= 90) {
          rulesOutcomes.push({
            ruleId: 'repeated_excavation',
            status: 'match',
            confidence: 'potential_repeated_disruption',
            intervalDays: days,
            display: `Potential repeated disruption: subsequent excavation starts ${days} days (<= 90 days) after prior work on shared segment`
          });
        }
      } else if (startA >= endB) {
        // Project 2 finishes before Project 1 starts
        const days = diffDays(intervalB.end, intervalA.start);
        if (days <= 90) {
          rulesOutcomes.push({
            ruleId: 'repeated_excavation',
            status: 'match',
            confidence: 'potential_repeated_disruption',
            intervalDays: days,
            display: `Potential repeated disruption: subsequent excavation starts ${days} days (<= 90 days) after prior work on shared segment`
          });
        }
      }
    }
  }

  // ==========================================
  // Rule 4: Completion uncertainty
  // ==========================================
  const now = new Date(evaluationDate).getTime();
  const checkUncertainty = (earlier, later, earlierInterval, laterInterval) => {
    if (
      earlierInterval.end &&
      new Date(earlierInterval.end).getTime() < now &&
      !earlier.actualCompletionDate &&
      earlier.publicationState === 'published'
    ) {
      // Overdue work affecting same segment or within 200m
      const sharesSeg =
        Array.isArray(earlier.roadSegmentIds) &&
        Array.isArray(later.roadSegmentIds) &&
        earlier.roadSegmentIds.some((s) => later.roadSegmentIds.includes(s));

      const isNearby =
        earlier.location?.coordinates &&
        later.location?.coordinates &&
        haversineDistanceMeters(earlier.location.coordinates, later.location.coordinates) <= 200;

      if (sharesSeg || isNearby) {
        rulesOutcomes.push({
          ruleId: 'completion_uncertainty',
          status: 'match',
          confidence: 'clarification_required',
          display: `Clarification required: earlier work on project "${earlier.title || earlier._id}" is ongoing past forecast completion while project "${later.title || later._id}" affects the same corridor`
        });
      }
    }
  };

  checkUncertainty(proj1, proj2, intervalA, intervalB);
  checkUncertainty(proj2, proj1, intervalB, intervalA);

  return {
    pairId,
    project1Id: proj1._id.toString(),
    project2Id: proj2._id.toString(),
    fingerprint,
    rules: rulesOutcomes,
    hasActiveMatch: rulesOutcomes.some((r) => r.status === 'match')
  };
}

module.exports = {
  haversineDistanceMeters,
  datesOverlap,
  diffDays,
  canonicalizePair,
  computeFactFingerprint,
  evaluateCoordinationRules
};
