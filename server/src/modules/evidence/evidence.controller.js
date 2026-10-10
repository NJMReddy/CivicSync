/**
 * @file evidence.controller.js
 * @description Controller for project before-after evidence comparison.
 */

const evidenceService = require('./evidence.service');
const { Media } = require('../media/media.model');
const { findProjectById } = require('../../stubs/project.stub');
const { AppError } = require('../../stubs/error.stub');

/**
 * GET /api/v1/projects/:id/evidence
 * Fetch before-after evidence pairs and gallery state for a project.
 */
async function getProjectEvidence(req, res, next) {
  try {
    const { id } = req.params;
    const project = await findProjectById(id);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found', 404);
    }

    if (project.publicationState === 'draft') {
      throw new AppError('FORBIDDEN_DRAFT', 'Draft project evidence is not public', 403);
    }

    // Query official project media records
    let mediaItems = [];
    if (Media && Media.find) {
      mediaItems = await Media.find({
        targetId: id,
        state: 'attached'
      }).lean();
    }

    // Include any embedded project media IDs if stored on project
    if (project.beforeAfterMedia && Array.isArray(project.beforeAfterMedia)) {
      mediaItems = [...mediaItems, ...project.beforeAfterMedia];
    }

    const evidenceDto = evidenceService.pairBeforeAfterEvidence({
      projectId: id,
      mediaItems
    });

    res.status(200).json({
      success: true,
      evidence: evidenceDto
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjectEvidence
};
