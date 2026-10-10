/**
 * @file ResidentReportDetail.jsx
 * @description Resident report detail and tracking view.
 * Displays durable reference, status timeline, official responses,
 * and authenticated private media viewer. Revalidates every 30s and on focus.
 */

import React, { useState, useEffect, useCallback } from 'react';

const STATUS_BADGES = {
  submitted: { label: 'Submitted', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  under_review: { label: 'Under Review', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  assigned: { label: 'Assigned to Dept', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  in_progress: { label: 'Work In Progress', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  resolved: { label: 'Resolved', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }
};

export default function ResidentReportDetail({ reportId, onBack = null }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/reports/${reportId}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to load report');
      }
      setReport(data.report);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  // Periodic revalidation (30 seconds) and window focus revalidation
  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 30000);

    const onFocus = () => fetchReport();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchReport]);

  if (loading && !report) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Loading issue report details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg max-w-2xl mx-auto">
        <h3 className="text-red-800 font-bold mb-2">Error Loading Report</h3>
        <p className="text-red-700 text-sm mb-4">{error}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 px-3 rounded"
          >
            ← Go Back
          </button>
        )}
      </div>
    );
  }

  if (!report) return null;

  const statusInfo = STATUS_BADGES[report.status] || {
    label: report.status,
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-3xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-blue-600 hover:underline mb-2 block font-medium"
            >
              ← Back to My Reports
            </button>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
            Reference Identifier
          </span>
          <h1 className="text-2xl font-mono font-bold text-gray-900 select-all">
            {report.reference}
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
          >
            Status: {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Core Report Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Category</span>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {report.category ? report.category.replace(/_/g, ' ') : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Submitted Date</span>
            <p className="text-sm text-gray-900">
              {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Location Details</span>
            <p className="text-sm text-gray-800">
              {report.location?.address || 'Coordinates only'}:{' '}
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                [{report.location?.coordinates?.[0]?.toFixed(5)}, {report.location?.coordinates?.[1]?.toFixed(5)}]
              </code>
            </p>
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Description</span>
            <div className="p-3 bg-gray-50 rounded border border-gray-100 text-sm text-gray-800 whitespace-pre-wrap">
              {report.description}
            </div>
          </div>
        </div>

        {/* Private Evidence Photos */}
        {report.mediaIds && report.mediaIds.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Submitted Photographic Evidence ({report.mediaIds.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {report.mediaIds.map((mediaId, idx) => (
                <div
                  key={mediaId}
                  className="rounded border border-gray-200 overflow-hidden bg-gray-100 aspect-video flex items-center justify-center relative group"
                >
                  <img
                    src={`/api/v1/media/${mediaId}/content`}
                    alt={`Evidence photograph ${idx + 1}`}
                    className="object-cover w-full h-full"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = `<span class="text-xs text-gray-500 p-2 text-center">Protected image (authorized view only)</span>`;
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              🔒 Delivered securely via Express protected media gateway (Cache-Control: private, no-store).
            </p>
          </div>
        )}

        {/* Official Response */}
        {report.officialResponse && (report.officialResponse.narrative || report.officialResponse.resolutionReason || report.officialResponse.rejectionReason) && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Official Response & Action</h3>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              {report.officialResponse.narrative && (
                <div>
                  <span className="text-xs font-semibold text-blue-900 uppercase block mb-0.5">Official Statement:</span>
                  <p className="text-sm text-blue-950">{report.officialResponse.narrative}</p>
                </div>
              )}
              {report.officialResponse.resolutionReason && (
                <div>
                  <span className="text-xs font-semibold text-green-900 uppercase block mb-0.5">Resolution Explanation:</span>
                  <p className="text-sm text-green-950 font-medium">{report.officialResponse.resolutionReason}</p>
                </div>
              )}
              {report.officialResponse.rejectionReason && (
                <div>
                  <span className="text-xs font-semibold text-red-900 uppercase block mb-0.5">Rejection Explanation:</span>
                  <p className="text-sm text-red-950 font-medium">{report.officialResponse.rejectionReason}</p>
                </div>
              )}
              {report.officialResponse.respondedAt && (
                <p className="text-xs text-blue-700 pt-1">
                  Responded on: {new Date(report.officialResponse.respondedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Status History Timeline */}
        {report.statusHistory && report.statusHistory.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Audit & Transition History</h3>
            <ol className="relative border-l border-gray-200 ml-3 space-y-4">
              {report.statusHistory.map((item, index) => (
                <li key={index} className="ml-4">
                  <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full -left-1.5 border border-white" />
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                      {item.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.changedAt).toLocaleString()}
                    </span>
                  </div>
                  {item.note && <p className="text-xs text-gray-600 mt-0.5">{item.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
