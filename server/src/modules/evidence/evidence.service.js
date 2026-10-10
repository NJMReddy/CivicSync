/**
 * @file evidence.service.js
 * @description Domain logic for pairing, labeling, and validating before–after project evidence.
 * Conforms to PROJECT_PLAN.md lines 596-599 and TASKS.md I9.
 */

const { AppError } = require('../../stubs/error.stub');

/**
 * Validate and structure before–after evidence pairs.
 * Enforces same project, viewpoint alignment, chronological stage assignment,
 * and honest fallback when an image is missing.
 */
function pairBeforeAfterEvidence({ projectId, mediaItems, viewpointId = null }) {
  if (!mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
    return {
      projectId: projectId ? projectId.toString() : null,
      pairs: [],
      hasCompletePair: false,
      galleryState: 'empty',
      message: 'No photographic evidence recorded for this project.'
    };
  }

  // Filter media belonging to this project (or eligible project evidence)
  const relevant = mediaItems.filter(
    (m) =>
      (!m.targetId || m.targetId.toString() === projectId.toString()) &&
      ['official_evidence', 'before_after', 'update_evidence'].includes(m.purpose)
  );

  if (relevant.length === 0) {
    return {
      projectId: projectId.toString(),
      pairs: [],
      hasCompletePair: false,
      galleryState: 'empty',
      message: 'No public official evidence available for comparison.'
    };
  }

  // Group by viewpointId (or default viewpoint 'vp_default')
  const byViewpoint = new Map();
  for (const item of relevant) {
    const vp = item.viewpointId || 'vp_default';
    if (!byViewpoint.has(vp)) {
      byViewpoint.set(vp, []);
    }
    byViewpoint.get(vp).push(item);
  }

  const pairs = [];

  for (const [vp, items] of byViewpoint.entries()) {
    // Sort chronologically by captureDate (or createdAt)
    items.sort((a, b) => {
      const dateA = new Date(a.captureDate || a.createdAt).getTime();
      const dateB = new Date(b.captureDate || b.createdAt).getTime();
      return dateA - dateB;
    });

    if (items.length >= 2) {
      // Oldest is 'before', newest is 'after'
      const beforeItem = items[0];
      const afterItem = items[items.length - 1];

      pairs.push({
        viewpointId: vp,
        status: 'paired',
        isComplete: true,
        isIllustrative: Boolean(beforeItem.isDemo || afterItem.isDemo),
        before: {
          mediaId: beforeItem._id.toString(),
          stage: 'before',
          date: beforeItem.captureDate || beforeItem.createdAt,
          dateType: beforeItem.captureDate ? 'capture' : 'upload',
          source: beforeItem.source || (beforeItem.isDemo ? 'Illustrative Demo Fixture' : 'Official Project Update'),
          format: beforeItem.format,
          contentUrl: `/api/v1/media/${beforeItem._id}/content`
        },
        after: {
          mediaId: afterItem._id.toString(),
          stage: 'after',
          date: afterItem.captureDate || afterItem.createdAt,
          dateType: afterItem.captureDate ? 'capture' : 'upload',
          source: afterItem.source || (afterItem.isDemo ? 'Illustrative Demo Fixture' : 'Official Project Completion'),
          format: afterItem.format,
          contentUrl: `/api/v1/media/${afterItem._id}/content`
        }
      });
    } else if (items.length === 1) {
      // Honest incomplete pair / gallery state
      const single = items[0];
      pairs.push({
        viewpointId: vp,
        status: 'incomplete',
        isComplete: false,
        isIllustrative: Boolean(single.isDemo),
        singleItem: {
          mediaId: single._id.toString(),
          stage: single.stage || 'progress_update',
          date: single.captureDate || single.createdAt,
          dateType: single.captureDate ? 'capture' : 'upload',
          source: single.source || 'Official Project Update',
          contentUrl: `/api/v1/media/${single._id}/content`
        },
        message: 'Awaiting verified comparison photograph from this viewpoint.'
      });
    }
  }

  const hasComplete = pairs.some((p) => p.isComplete);

  return {
    projectId: projectId.toString(),
    pairs,
    hasCompletePair: hasComplete,
    galleryState: hasComplete ? 'comparison_ready' : 'gallery_only'
  };
}

module.exports = {
  pairBeforeAfterEvidence
};
