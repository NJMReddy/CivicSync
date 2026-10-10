/**
 * @file OfficialReportWorkspace.jsx
 * @description Official workspace for department officers and municipal coordinators.
 * Supports department-scoped queues, unassigned report routing, optimistic concurrency checks,
 * resolution/rejection explanations, and atomic action dispatch.
 */

import React, { useState, useEffect, useCallback } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' }
];

export default function OfficialReportWorkspace({
  currentUser = { role: 'officer', departmentId: 'dept_roads' },
  csrfToken = ''
}) {
  const [reports, setReports] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Action modal state
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionType, setActionType] = useState('review');
  const [narrative, setNarrative] = useState('');
  const [resolutionReason, setResolutionReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const isCoordinator = currentUser?.role === 'coordinator';

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      if (statusFilter) params.append('status', statusFilter);
      if (isCoordinator && unassignedOnly) params.append('unassigned', 'true');

      const res = await fetch(`/api/v1/admin/reports?${params.toString()}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to fetch report queue');
      }

      setReports(data.items || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, unassignedOnly, isCoordinator]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Open modal for selected report
  const handleOpenAction = (report) => {
    setSelectedReport(report);
    setActionType(report.status === 'submitted' ? 'review' : 'in_progress');
    setNarrative('');
    setResolutionReason('');
    setRejectionReason('');
    setAssigneeId(report.assigneeId || '');
    setTargetDepartmentId(report.routedDepartmentId || '');
    setActionError(null);
  };

  // Submit action mutation
  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;

    setActionSubmitting(true);
    setActionError(null);

    const idempotencyKey = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    const payload = {
      action: actionType,
      expectedVersion: selectedReport.version,
      assigneeId: actionType === 'assign' ? assigneeId : undefined,
      routedDepartmentId: ['route', 'reassign'].includes(actionType) ? targetDepartmentId : undefined,
      narrative: narrative.trim() || undefined,
      resolutionReason: actionType === 'resolve' ? resolutionReason.trim() : undefined,
      rejectionReason: actionType === 'reject' ? rejectionReason.trim() : undefined
    };

    try {
      const res = await fetch(`/api/v1/admin/reports/${selectedReport._id}/actions`, {
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
          throw new Error('Concurrency Conflict: ' + (data?.error?.message || 'Report was modified by another user. Please reload.'));
        }
        throw new Error(data?.error?.message || 'Action failed');
      }

      // Close modal and refresh queue
      setSelectedReport(null);
      loadQueue();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCoordinator ? 'Municipal Coordinator — Issue Oversight' : 'Department Issue Queue'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCoordinator
              ? 'Triage unassigned resident issues and oversee cross-department resolution.'
              : `Managing reports for Department: ${currentUser?.departmentId || 'Assigned'}`}
          </p>
        </div>
        <button
          onClick={loadQueue}
          disabled={loading}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded border border-gray-300"
        >
          ↻ Refresh Queue
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div>
          <label htmlFor="filter-status" className="block text-xs font-semibold text-gray-600 mb-1">
            Status Filter
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isCoordinator && (
          <div className="flex items-center pt-5">
            <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(e) => {
                  setUnassignedOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Unassigned Location-Only Reports</span>
            </label>
          </div>
        )}

        <div className="ml-auto text-xs text-gray-500 pt-5">
          Showing <strong>{reports.length}</strong> of <strong>{totalCount}</strong> reports
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Description Snippet</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Photos</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500 text-sm">
                  {loading ? 'Loading queue...' : 'No reports found matching criteria.'}
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-gray-900 text-xs">
                    {r.reference}
                  </td>
                  <td className="py-3 px-4 capitalize text-xs text-gray-700">
                    {r.category.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate" title={r.description}>
                    {r.description}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-700">
                    {r.routedDepartmentId ? (
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                        {r.routedDepartmentId}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className="font-semibold capitalize text-gray-800">
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {r.mediaCount > 0 ? `📷 ${r.mediaCount}` : 'None'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenAction(r)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-1.5 px-3 rounded transition"
                    >
                      Act / Respond
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Manage Report {selectedReport.reference}
                </h3>
                <span className="text-xs text-gray-500">
                  Current Version: v{selectedReport.version} | Status: {selectedReport.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                <strong>Action Error:</strong> {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Action *
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                >
                  <option value="review">Review Report</option>
                  {isCoordinator && <option value="route">Route to Department</option>}
                  <option value="assign">Assign to Officer</option>
                  <option value="in_progress">Mark Work In Progress</option>
                  <option value="respond">Post Official Narrative</option>
                  <option value="resolve">Resolve Issue (Explanation Required)</option>
                  <option value="reject">Reject Report (Explanation Required)</option>
                  {isCoordinator && <option value="reassign">Reassign Department</option>}
                </select>
              </div>

              {['route', 'reassign'].includes(actionType) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Target Department Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetDepartmentId}
                    onChange={(e) => setTargetDepartmentId(e.target.value)}
                    placeholder="e.g. dept_roads, dept_water"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              )}

              {actionType === 'assign' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assignee Officer ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    placeholder="User ObjectId of officer"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              )}

              {actionType === 'resolve' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Resolution Explanation * (Required by CivicSync Audit)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={resolutionReason}
                    onChange={(e) => setResolutionReason(e.target.value)}
                    placeholder="Explain the work completed, inspection verified, or repair made..."
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              )}

              {actionType === 'reject' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rejection Explanation * (Required by CivicSync Audit)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="State reason for rejection (e.g. duplicate, private property, false report)..."
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Official Public Statement / Narrative (Optional)
                </label>
                <textarea
                  rows={2}
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="General notes or timeline shared with the reporting resident..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-semibold py-2 px-4 rounded transition"
                >
                  {actionSubmitting ? 'Committing Action...' : 'Commit Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
