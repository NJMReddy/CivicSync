/**
 * @file coordination.model.js
 * @description Mongoose schema and model for ConflictDecisions in CivicSync.
 * Conforms to PROJECT_PLAN.md Section 8 and Section 10.
 */

const mongoose = require('../../stubs/mongoose.stub');

const ConflictDecisionSchema = new mongoose.Schema(
  {
    pairId: {
      type: String,
      required: true,
      index: true
    },
    projectIds: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      validate: [
        (arr) => Array.isArray(arr) && arr.length === 2,
        'ConflictDecision must reference exactly two canonical project IDs'
      ]
    },
    ruleId: {
      type: String,
      required: true
    },
    ruleVersion: {
      type: String,
      default: '1.0'
    },
    inputFingerprint: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['open', 'rescheduled', 'coordinated', 'dismissed', 'changed_later'],
      default: 'open',
      required: true,
      index: true
    },
    publicExplanation: {
      type: String,
      required: function () {
        return ['coordinated', 'dismissed'].includes(this.status);
      }
    },
    actorId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

ConflictDecisionSchema.index({ pairId: 1, ruleId: 1 });
ConflictDecisionSchema.index({ inputFingerprint: 1 });

const ConflictDecision =
  mongoose.models.ConflictDecision || mongoose.model('ConflictDecision', ConflictDecisionSchema);

module.exports = {
  ConflictDecision,
  ConflictDecisionSchema
};
