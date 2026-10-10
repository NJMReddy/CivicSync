/**
 * @file CommunityInsightsDashboard.jsx
 * @description Privacy-safe Community Insights dashboard for reviewed citizen issues.
 * Displays aggregate metrics and ~250m cell concentration heatmap, ensuring
 * resident identities, raw descriptions, and private locations are protected.
 */

import React, { useState, useEffect, useCallback } from 'react';

const CATEGORY_LABELS = {
  stalled_work: 'Stalled Work',
  poor_quality: 'Defective Construction',
  safety_hazard: 'Safety Hazards',
  incorrect_information: 'Incorrect Info',
  excessive_disruption: 'Excessive Disruption',
  other: 'Other Civic Issues'
};

export default function CommunityInsightsDashboard() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronized filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(''); // within reviewed subset: assigned, in_progress, resolved

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);

      const res = await fetch(`/api/v1/insights?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to load community insights');
      }

      setInsights(data.insights);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Community Issues & Public Insights
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Aggregated transparency report of verified civic issues. Aggregations use approximate 250m grid cells to protect citizen privacy.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div>
          <label htmlFor="insight-cat" className="block text-xs font-semibold text-gray-600 mb-1">
            Category Filter
          </label>
          <select
            id="insight-cat"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="insight-stat" className="block text-xs font-semibold text-gray-600 mb-1">
            Reviewed Status
          </label>
          <select
            id="insight-stat"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Reviewed Statuses</option>
            <option value="assigned">Assigned to Department</option>
            <option value="in_progress">Work In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-gray-500 pt-5">
          🔒 Exact resident locations and identities are redacted.
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 animate-pulse text-sm">
          Aggregating verified reports across municipal cells...
        </div>
      ) : !insights ? null : (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-xs font-semibold uppercase text-blue-700 block">Total Reviewed Reports</span>
              <span className="text-3xl font-bold text-blue-900">{insights.totalReviewed}</span>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <span className="text-xs font-semibold uppercase text-indigo-700 block">Assigned / In Triage</span>
              <span className="text-3xl font-bold text-indigo-900">{insights.statusBreakdown?.assigned || 0}</span>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <span className="text-xs font-semibold uppercase text-purple-700 block">Active In Progress</span>
              <span className="text-3xl font-bold text-purple-900">{insights.statusBreakdown?.in_progress || 0}</span>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-xs font-semibold uppercase text-emerald-700 block">Resolved with Proof</span>
              <span className="text-3xl font-bold text-emerald-900">{insights.statusBreakdown?.resolved || 0}</span>
            </div>
          </div>

          {/* Aggregated Cells Heatmap / Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Approximate Area Clusters (~250-Metre Bounded Cells)
                </h3>
                <span className="text-xs text-gray-500">
                  Reflects reviewed community report density, not neighborhood quality or causality.
                </span>
              </div>
              <span className="text-xs font-bold text-gray-600">
                {insights.cells?.length || 0} Clusters Found
              </span>
            </div>

            {insights.cells && insights.cells.length > 0 ? (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {insights.cells.map((cell) => (
                  <div
                    key={cell.cellId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          Grid Cell: {cell.cellId}
                        </span>
                        <span className="text-xs text-gray-400">
                          Center: [{cell.centerCoordinates?.[0]?.toFixed(4)}, {cell.centerCoordinates?.[1]?.toFixed(4)}]
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        {Object.entries(cell.categories || {}).map(([cat, count]) => (
                          <span
                            key={cat}
                            className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100"
                          >
                            {CATEGORY_LABELS[cat] || cat}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right self-start sm:self-auto">
                      <span className="text-sm font-bold text-gray-900 block">
                        {cell.reportCount} Report{cell.reportCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-400">Reviewed Density</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">
                No reviewed reports match the selected filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
