/**
 * @file summary.service.js
 * @description Summary service handling I10 Gate evaluation and grounded factual fallback.
 * Conforms to PROJECT_PLAN.md Section 9 and TASKS.md I10.
 */

const crypto = require('crypto');
const { findProjectById } = require('../../stubs/project.stub');
const { AppError } = require('../../stubs/error.stub');

/**
 * Check whether the Task I10 AI summary integration gate is met.
 */
function checkI10Gate() {
  const isHostedVerified = process.env.RENDER_HOSTED_VERIFIED === 'true';
  const hasFreeCredential = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'mock_ai_key'
  );

  if (!isHostedVerified) {
    return {
      isGateMet: false,
      reason: 'Gate requirement: Complete hosted reporting and coordination loops must pass on public deployment first.',
      status: 'Unavailable (optional)'
    };
  }

  if (!hasFreeCredential) {
    return {
      isGateMet: false,
      reason: 'Gate requirement: Free AI provider credential is not configured.',
      status: 'Unavailable (optional)'
    };
  }

  return {
    isGateMet: true,
    status: 'Enabled'
  };
}

/**
 * Generate source-hashed, strictly factual summary from public project facts.
 * Never invents dates, amounts, or delay reasons.
 */
function generateFactualSummary(project) {
  if (!project) return null;

  const publicFacts = {
    id: project._id ? project._id.toString() : 'unknown',
    title: project.title || 'Untitled Project',
    purpose: project.purpose || 'Public infrastructure works',
    department: project.departmentId || 'Unassigned Department',
    contractor: project.contractorId || 'Official Municipal Works',
    plannedStart: project.plannedStartDate ? new Date(project.plannedStartDate).toLocaleDateString() : 'Unknown',
    deadline: project.revisedCompletionDate
      ? new Date(project.revisedCompletionDate).toLocaleDateString() + ' (Revised)'
      : project.targetCompletionDate
      ? new Date(project.targetCompletionDate).toLocaleDateString()
      : 'Unknown',
    status: project.executionState || project.status || 'Active',
    delayExplanation: project.delayExplanation || null,
    milestoneCount: Array.isArray(project.milestones) ? project.milestones.length : 0,
    progressPercentage: project.progressPercentage !== undefined ? `${project.progressPercentage}%` : 'Not assessed'
  };

  const factsSnapshotHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(publicFacts))
    .digest('hex');

  // Build grounded text
  let text = `Project "${publicFacts.title}" is managed by ${publicFacts.department}. `;
  text += `Planned start was ${publicFacts.plannedStart} with target completion on ${publicFacts.deadline}. `;
  text += `Current progress is recorded at ${publicFacts.progressPercentage}. `;

  if (publicFacts.delayExplanation) {
    text += `Official delay reason recorded: "${publicFacts.delayExplanation}". `;
  }

  return {
    isAiGenerated: false,
    source: 'CivicSync Verified Factual Baseline',
    factsSnapshotHash,
    summaryText: text.trim(),
    publicFacts,
    generatedAt: new Date()
  };
}

/**
 * Get project summary (delivers factual fallback when AI gate is not met).
 */
async function getProjectSummary(projectId) {
  const project = await findProjectById(projectId);
  if (!project) {
    throw new AppError('PROJECT_NOT_FOUND', 'Project not found', 404);
  }

  if (project.publicationState === 'draft') {
    throw new AppError('FORBIDDEN_DRAFT', 'Draft project summaries are not public', 403);
  }

  const gate = checkI10Gate();
  const fallback = generateFactualSummary(project);

  return {
    gate,
    summary: fallback
  };
}

module.exports = {
  checkI10Gate,
  generateFactualSummary,
  getProjectSummary
};
