/**
 * @file project.stub.js
 * @description Named stub for project verification and department lookup (Task I4 dependency).
 */

const projectRegistry = new Map();

/**
 * Register a mock project for testing or simulation.
 */
function registerMockProject(id, projectData) {
  projectRegistry.set(id.toString(), {
    _id: id.toString(),
    title: projectData.title || 'Road Repair Work',
    departmentId: projectData.departmentId || 'dept_roads',
    publicationState: projectData.publicationState || 'published',
    ...projectData
  });
}

/**
 * Find project by ID.
 */
async function findProjectById(projectId, session = null) {
  if (!projectId) return null;
  return projectRegistry.get(projectId.toString()) || null;
}

function clearProjectRegistry() {
  projectRegistry.clear();
}

module.exports = {
  findProjectById,
  registerMockProject,
  clearProjectRegistry
};
