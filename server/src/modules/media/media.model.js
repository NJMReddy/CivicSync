/**
 * @file media.model.js
 * @description Mongoose schema and model for Media assets in CivicSync.
 * Conforms to PROJECT_PLAN.md Sections 8 and 13.
 */

const mongoose = require('../../stubs/mongoose.stub');

const MediaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    purpose: {
      type: String,
      enum: ['resident_evidence', 'official_evidence', 'update_evidence', 'before_after'],
      default: 'resident_evidence',
      required: true
    },
    targetType: {
      type: String,
      enum: ['report', 'project', 'project_update', null],
      default: null
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      unique: true
    },
    cloudinaryAssetId: {
      type: String
    },
    deliveryType: {
      type: String,
      enum: ['authenticated', 'upload'],
      default: 'authenticated', // Crucial: default is authenticated so resident evidence is protected
      required: true
    },
    format: {
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'webp'],
      required: true
    },
    bytes: {
      type: Number,
      required: true,
      max: [2 * 1024 * 1024, 'Image size exceeds maximum limit of 2 MB']
    },
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    },
    state: {
      type: String,
      enum: ['ready', 'attached', 'abandoned'],
      default: 'ready',
      required: true,
      index: true
    },
    viewpointId: {
      type: String,
      default: null
    },
    captureDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

MediaSchema.index({ owner: 1, state: 1 });
MediaSchema.index({ targetType: 1, targetId: 1 });
MediaSchema.index({ createdAt: 1, state: 1 });

const Media = mongoose.models.Media || mongoose.model('Media', MediaSchema);

module.exports = { Media, MediaSchema };
