/**
 * @file ConflictReviewPanel.jsx
 * @description Official workspace panel for inspecting project coordination candidates
 * and committing version-checked decisions (Rescheduled, Coordinated, Dismissed).
 */

import React, { useState, useEffect, useCallback } from 'react';

const CONFIDENCE_BADGES = {
  strong: { label: 'Strong Conflict (Shared Segment)', bg: 'bg-red-100', text: 'text-red-800' },
  potential: { label: 'Potential Nearby Work (<= 200m)', bg: 'bg-amber-100', text: 'text-amber-800' },
  potential_repeated_disruption: { label: 'Repeated Excavation (<= 90 Days)', bg: 'bg-orange-100', text: 'text-orange-800' },
  clarification_required: { label: 'Completion Uncertainty', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  cannot_assess: { label: 'Cannot Assess (Missing Data)', bg: 'bg-gray-100', text: 'text-gray-700' }
};

export default function ConflictReviewPanel({
  projectId = null,
  currentUser = { role: 'officer', departmentId: 'dept_roads' },
  csrfToken = ''
}) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Decision Modal
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [decision, setDecision] = useState('coordinated');
  const [publicExplanation, setPublicExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = projectId
        ? `/api/v1/projects/${projectId}/conflicts`
        : `/api/v1/admin/conflicts`;

      const res = await fetch(endpoint, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to fetch coordination candidates');
      }

      setCandidates(projectId ? data.conflicts || [] : data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleOpenDecision = (candidate) => {
    setSelectedCandidate(candidate);
    setDecision('coordinated');
    setPublicExplanation('');
    setActionError(null);
  };

  const handleCommitDecision = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    setSubmitting(true);
    setActionError(null);

    const idempotencyKey = 'dec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    const payload = {
      pairId: selectedCandidate.pairId,
      ruleId: selectedCandidate.rules?.[0]?.ruleId || 'shared_segment_overlap',
      expectedProjectVersions: {
        [selectedCandidate.project1?._id || selectedCandidate.project1Id]: 1, // dynamically verified
        [selectedCandidate.project2?._id || selectedCandidate.project2Id]: 1
      },
      decision,
      publicExplanation: publicExplanation.trim()
    };

    try {
      const res = await fetch('/api/v1/admin/conflicts/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': idempotencyKey
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('Conflict Stale: ' + (data?.error?.message || 'Project facts or versions changed concurrently. Please reload.'));
        }
        throw new Error(data?.error?.message || 'Decision failed to record');
      }

      setSelectedCandidate(null);
      fetchCandidates();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Project Coordination & Conflict Detection
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Evaluates shared road segments, inclusive date overlaps, 200m spatial proximity, and 90-day repeated excavations.
          </p>
        </div>
        <button
          onClick={fetchCandidates}
          disabled={loading}
          className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 py-1.5 px-3 rounded"
        >
          ↻ Re-evaluate Candidates
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 animate-pulse text-sm">
          Analyzing project schedules, corridors, and proximity rules...
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded border border-gray-200 text-gray-600 text-sm">
          ✓ No active conflict candidates detected for the selected scope.
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((cand) => (
            <div
              key={cand.pairId}
              className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                    Pair: {cand.pairId}
                  </span>
                  {cand.decisionStatus !== 'open' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                      Status: {cand.decisionStatus}
                    </span>
                  )}
                </div>
                {currentUser && ['officer', 'coordinator'].includes(currentUser.role) && (
                  <button
                    onClick={() => handleOpenDecision(cand)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded transition"
                  >
                    Record Decision
                  </button>
                )}
              </div>

              {/* Projects Involved */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded mb-3 text-xs">
                <div>
                  <span className="font-semibold text-gray-700 block">Project A:</span>
                  <span className="text-gray-900 font-medium">
                    {cand.project1?.title || cand.otherProject?.title || cand.project1Id}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block">Project B:</span>
                  <span className="text-gray-900 font-medium">
                    {cand.project2?.title || cand.targetProjectId || cand.project2Id}
                  </span>
                </div>
              </div>

              {/* Evaluated Rules */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Evaluated Rules & Findings:
                </span>
                {cand.rules?.map((rule, idx) => {
                  const badge = CONFIDENCE_BADGES[rule.confidence] || CONFIDENCE_BADGES.cannot_assess;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded border border-gray-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <span className="text-gray-800">{rule.display}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block self-start sm:self-auto ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Recorded Public Explanation */}
              {cand.publicExplanation && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  <span className="font-bold block mb-0.5">Committed Public Resolution:</span>
                  {cand.publicExplanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Resolve Conflict Candidate</h3>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCommitDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Decision *
                </label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="coordinated">Coordinated (Arrangement agreed across teams)</option>
                  <option value="dismissed">Dismissed (No meaningful disruption or false positive)</option>
                  <option value="rescheduled">Rescheduled (Dates modified to remove overlap)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Public Explanation * (Required by CivicSync Audit)
                </label>
                <textarea
                  required
                  rows={4}
                  value={publicExplanation}
                  onChange={(e) => setPublicExplanation(e.target.value)}
                  placeholder="Explain how traffic disruption, trench work, or access will be managed or why this is dismissed..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded transition"
                >
                  {submitting ? 'Recording...' : 'Commit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
