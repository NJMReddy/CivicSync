/**
 * @file BeforeAfterGallery.jsx
 * @description Accessible Before–After evidence comparison component.
 * Supports side-by-side and interactive slider views, keyboard/touch controls,
 * explicit viewpoint and date labeling, and honest single-image / empty gallery fallback.
 */

import React, { useState, useEffect } from 'react';

export default function BeforeAfterGallery({ projectId }) {
  const [evidenceData, setEvidenceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePairIndex, setActivePairIndex] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 to 100)
  const [viewMode, setViewMode] = useState('slider'); // 'slider' | 'side_by_side'

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/evidence`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEvidenceData(data.evidence);
        } else {
          setError(data.error?.message || 'Failed to load project evidence');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Keyboard navigation for slider
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      setSliderPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      setSliderPosition((prev) => Math.min(100, prev + 5));
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm animate-pulse">
        Loading verified photographic evidence...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 text-sm rounded border border-red-200">
        {error}
      </div>
    );
  }

  if (!evidenceData || !evidenceData.pairs || evidenceData.pairs.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200 text-gray-600">
        <span className="text-2xl block mb-2" aria-hidden="true">📷</span>
        <h3 className="text-base font-bold text-gray-800">No Photographic Evidence Yet</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          No before-and-after photographs have been published for this project. Evidence will appear here as progress updates are committed.
        </p>
      </div>
    );
  }

  const currentPair = evidenceData.pairs[activePairIndex];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Before & After Verification Evidence
          </h2>
          <p className="text-xs text-gray-500">
            Viewpoint: <span className="font-mono font-semibold">{currentPair.viewpointId}</span>
            {currentPair.isIllustrative && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                Illustrative Demo Fixture
              </span>
            )}
          </p>
        </div>

        {currentPair.isComplete && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('slider')}
              className={`text-xs px-3 py-1.5 rounded font-medium border ${
                viewMode === 'slider'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
            >
              Interactive Slider
            </button>
            <button
              onClick={() => setViewMode('side_by_side')}
              className={`text-xs px-3 py-1.5 rounded font-medium border ${
                viewMode === 'side_by_side'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
            >
              Side-by-Side
            </button>
          </div>
        )}
      </div>

      {/* Multiple viewpoints selector if applicable */}
      {evidenceData.pairs.length > 1 && (
        <div className="flex space-x-2 overflow-x-auto pb-1">
          {evidenceData.pairs.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setActivePairIndex(idx)}
              className={`text-xs px-3 py-1 rounded whitespace-nowrap ${
                activePairIndex === idx
                  ? 'bg-blue-100 text-blue-800 font-bold'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Angle {idx + 1} ({p.viewpointId})
            </button>
          ))}
        </div>
      )}

      {/* Main Display */}
      {!currentPair.isComplete ? (
        // Honest Incomplete State
        <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            {currentPair.message}
          </p>
          {currentPair.singleItem && (
            <div className="max-w-md mx-auto rounded overflow-hidden shadow-sm border border-gray-200">
              <img
                src={currentPair.singleItem.contentUrl}
                alt="Available project evidence"
                className="w-full h-48 object-cover"
              />
              <div className="p-2 bg-white text-xs text-gray-600 text-left">
                <span className="font-bold">Recorded:</span>{' '}
                {new Date(currentPair.singleItem.date).toLocaleDateString()} |{' '}
                <span className="font-bold">Source:</span> {currentPair.singleItem.source}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'side_by_side' ? (
        // Side-by-Side Mode
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Before */}
          <div className="rounded border border-gray-200 overflow-hidden bg-gray-50">
            <div className="relative aspect-video">
              <img
                src={currentPair.before.contentUrl}
                alt="Condition before construction"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-0.5 rounded">
                BEFORE
              </span>
            </div>
            <div className="p-3 text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-semibold text-gray-800">Date:</span>{' '}
                {new Date(currentPair.before.date).toLocaleDateString()} ({currentPair.before.dateType})
              </div>
              <div>
                <span className="font-semibold text-gray-800">Source:</span>{' '}
                {currentPair.before.source}
              </div>
            </div>
          </div>

          {/* After */}
          <div className="rounded border border-gray-200 overflow-hidden bg-gray-50">
            <div className="relative aspect-video">
              <img
                src={currentPair.after.contentUrl}
                alt="Condition after construction"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">
                AFTER
              </span>
            </div>
            <div className="p-3 text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-semibold text-gray-800">Date:</span>{' '}
                {new Date(currentPair.after.date).toLocaleDateString()} ({currentPair.after.dateType})
              </div>
              <div>
                <span className="font-semibold text-gray-800">Source:</span>{' '}
                {currentPair.after.source}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Interactive Slider Mode
        <div className="space-y-3">
          <div
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-label="Interactive before and after comparison slider. Use left and right arrow keys to adjust."
            className="relative aspect-video rounded-lg overflow-hidden border border-gray-300 select-none cursor-ew-resize focus:ring-2 focus:ring-blue-500"
          >
            {/* Background Image: After */}
            <img
              src={currentPair.after.contentUrl}
              alt="After condition"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute top-3 right-3 bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded shadow">
              AFTER ({new Date(currentPair.after.date).toLocaleDateString()})
            </span>

            {/* Foreground Image: Before (Clipped by slider position) */}
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <img
                src={currentPair.before.contentUrl}
                alt="Before condition"
                className="absolute inset-y-0 left-0 max-w-none h-full object-cover"
                style={{ width: '100%', minWidth: '100%' }}
              />
              <span className="absolute top-3 left-3 bg-black bg-opacity-75 text-white text-xs font-bold px-2.5 py-1 rounded shadow">
                BEFORE ({new Date(currentPair.before.date).toLocaleDateString()})
              </span>
            </div>

            {/* Slider Divider Bar */}
            <div
              className="absolute inset-y-0 w-1 bg-white shadow"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -left-3.5 w-8 h-8 rounded-full bg-white shadow-md border border-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold">
                ↔
              </div>
            </div>
          </div>

          {/* Accessible Range Input */}
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Before</span>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
              aria-label="Slider position"
            />
            <span className="font-semibold text-gray-700">After</span>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Tip: Drag the slider or use ◄ and ► arrow keys to compare viewpoints.
          </p>
        </div>
      )}
    </div>
  );
}
