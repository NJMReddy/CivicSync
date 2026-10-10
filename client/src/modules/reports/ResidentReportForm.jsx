/**
 * @file ResidentReportForm.jsx
 * @description Citizen Issue Reporting Form component.
 * Supports project-linked and location-only reports, multi-image upload up to 3 images (2MB max),
 * client idempotency key generation, CSRF inclusion, and durable reference confirmation.
 */

import React, { useState } from 'react';

const CATEGORIES = [
  { value: 'stalled_work', label: 'Stalled or Abandoned Work' },
  { value: 'poor_quality', label: 'Poor Quality / Defective Construction' },
  { value: 'safety_hazard', label: 'Safety Hazard / Exposed Pit' },
  { value: 'incorrect_information', label: 'Incorrect Information' },
  { value: 'excessive_disruption', label: 'Excessive Traffic / Noise Disruption' },
  { value: 'other', label: 'Other Issue' }
];

export default function ResidentReportForm({
  projectId = null,
  projectTitle = null,
  csrfToken = '',
  onSuccess = null
}) {
  const [category, setCategory] = useState('stalled_work');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState(['', '']); // [lon, lat]
  const [geoLoading, setGeoLoading] = useState(false);

  // Media state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);
  const [committedReport, setCommittedReport] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => {
    return 'idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  });

  // Use browser geolocation
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please enter coordinates manually.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates([
          Number(pos.coords.longitude.toFixed(6)),
          Number(pos.coords.latitude.toFixed(6))
        ]);
        setGeoLoading(false);
      },
      (err) => {
        alert('Could not retrieve geolocation: ' + err.message + '. Please enter manually.');
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Upload individual file to POST /api/v1/media
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    if (uploadedMediaIds.length + files.length > 3) {
      setUploadError('You may attach a maximum of 3 images per report.');
      return;
    }

    setUploadError(null);
    setUploadProgress('Validating and uploading images...');

    const newMediaIds = [...uploadedMediaIds];

    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds the 2 MB limit.`);
        setUploadProgress(null);
        return;
      }

      const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validMimes.includes(file.type)) {
        setUploadError(`File "${file.name}" is not a supported format (JPEG, PNG, WebP only).`);
        setUploadProgress(null);
        return;
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('purpose', 'resident_evidence');

      try {
        const res = await fetch('/api/v1/media', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken
          },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || 'Media upload failed');
        }

        newMediaIds.push(data.media._id);
        setSelectedFiles((prev) => [...prev, file.name]);
      } catch (err) {
        setUploadError(`Upload failed for "${file.name}": ${err.message}`);
        setUploadProgress(null);
        return;
      }
    }

    setUploadedMediaIds(newMediaIds);
    setUploadProgress(null);
  };

  // Handle report submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionError(null);

    const lon = parseFloat(coordinates[0]);
    const lat = parseFloat(coordinates[1]);

    if (isNaN(lon) || isNaN(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      setSubmissionError('Please provide valid longitude (-180 to 180) and latitude (-90 to 90).');
      return;
    }

    if (description.trim().length < 10) {
      setSubmissionError('Description must be at least 10 characters long.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      projectId: projectId || null,
      category,
      description: description.trim(),
      coordinates: [lon, lat],
      address: address.trim(),
      mediaIds: uploadedMediaIds
    };

    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Report submission failed');
      }

      setCommittedReport(data.report);
      if (onSuccess) onSuccess(data.report);
    } catch (err) {
      setSubmissionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (committedReport) {
    return (
      <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-6 max-w-xl mx-auto shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-2xl text-emerald-600 font-bold" aria-hidden="true">&#10003;</span>
          <h2 className="text-xl font-bold text-emerald-900">Report Successfully Submitted</h2>
        </div>
        <p className="text-emerald-800 text-sm mb-4">
          Your issue has been recorded and assigned an official tracking reference:
        </p>
        <div className="bg-white border border-emerald-200 rounded p-4 mb-4 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">
            Durable Report Reference
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-800 select-all">
            {committedReport.reference}
          </span>
        </div>
        <p className="text-xs text-emerald-700 mb-6">
          Keep this reference number to check status updates from officials. Evidence photos are stored securely and kept private according to CivicSync privacy regulations.
        </p>
        <button
          type="button"
          onClick={() => {
            setCommittedReport(null);
            setDescription('');
            setUploadedMediaIds([]);
            setSelectedFiles([]);
            setIdempotencyKey('idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
          }}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded text-sm transition"
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-xl mx-auto space-y-5"
      noValidate
    >
      <div>
        <h2 className="text-xl font-bold text-gray-900">Report an Issue</h2>
        {projectTitle ? (
          <p className="text-sm text-gray-600 mt-1">
            Linked Project: <span className="font-semibold text-gray-800">{projectTitle}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-1">
            Location-only issue report (will be routed to Municipal Coordinator).
          </p>
        )}
      </div>

      {submissionError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          <strong>Error:</strong> {submissionError}
        </div>
      )}

      {/* Category */}
      <div>
        <label htmlFor="report-category" className="block text-sm font-semibold text-gray-700 mb-1">
          Issue Category *
        </label>
        <select
          id="report-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="report-description" className="block text-sm font-semibold text-gray-700 mb-1">
          Detailed Description * <span className="text-xs text-gray-500 font-normal">(min 10 characters)</span>
        </label>
        <textarea
          id="report-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue, hazards, or delay observed..."
          maxLength={2000}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{description.trim().length} / 2000 characters</span>
          {description.trim().length < 10 && <span className="text-amber-600">Minimum 10 characters required</span>}
        </div>
      </div>

      {/* Location / Address */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Location Coordinates *
        </label>
        <div className="flex space-x-2">
          <input
            type="number"
            step="any"
            placeholder="Longitude (e.g. 77.5945)"
            value={coordinates[0]}
            onChange={(e) => setCoordinates([e.target.value, coordinates[1]])}
            className="w-1/2 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
          <input
            type="number"
            step="any"
            placeholder="Latitude (e.g. 12.9716)"
            value={coordinates[1]}
            onChange={(e) => setCoordinates([coordinates[0], e.target.value])}
            className="w-1/2 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={geoLoading}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center"
          >
            {geoLoading ? 'Detecting GPS...' : '📍 Use Current GPS Location'}
          </button>
        </div>
        <input
          type="text"
          placeholder="Landmark or street address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-2"
        />
      </div>

      {/* Photo evidence upload */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <label className="block text-sm font-semibold text-gray-700">
          Photographic Evidence <span className="text-xs text-gray-500 font-normal">(Max 3 images, 2 MB each, JPEG/PNG/WebP)</span>
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploadedMediaIds.length >= 3 || uploadProgress !== null}
          onChange={handleFileUpload}
          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />
        {uploadProgress && <p className="text-xs text-blue-600">{uploadProgress}</p>}
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

        {selectedFiles.length > 0 && (
          <ul className="text-xs text-gray-600 space-y-1 mt-2">
            {selectedFiles.map((fname, i) => (
              <li key={i} className="flex items-center space-x-2">
                <span className="text-green-600 font-bold">&#10003;</span>
                <span>{fname} (Uploaded securely)</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-400">
          * Resident photographs are private and never published publicly without official review.
        </p>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting || uploadProgress !== null}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 px-4 rounded text-sm transition"
      >
        {isSubmitting ? 'Submitting & Securing Reference...' : 'Submit Issue Report'}
      </button>
    </form>
  );
}
