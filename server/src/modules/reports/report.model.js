/**
 * @file report.model.js
 * @description Mongoose schema and model for Reports in CivicSync.
 * Conforms strictly to PROJECT_PLAN.md Sections 8, 9, 11 and TASKS.md I7.
 */

const mongoose = require('../../stubs/mongoose.stub');

const StatusHistoryItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ''
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    routedDepartmentId: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { _id: false }
);

const OfficialResponseSchema = new mongoose.Schema(
  {
    narrative: {
      type: String,
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },
    resolutionReason: {
      type: String,
      default: null
    }
  },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.Mixed, // string or ObjectId
      default: null,
      index: true
    },
    category: {
      type: String,
      enum: [
        'stalled_work',
        'poor_quality',
        'safety_hazard',
        'incorrect_information',
        'excessive_disruption',
        'other'
      ],
      required: [true, 'Report category is required']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude] GeoJSON standard
        required: true,
        validate: {
          validator: function (val) {
            return (
              Array.isArray(val) &&
              val.length === 2 &&
              val[0] >= -180 &&
              val[0] <= 180 &&
              val[1] >= -90 &&
              val[1] <= 90
            );
          },
          message: 'Coordinates must be valid [longitude, latitude] in degrees'
        }
      },
      address: {
        type: String,
        default: ''
      }
    },
    approximateCell: {
      type: String,
      required: true,
      index: true
    },
    routedDepartmentId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected'],
      default: 'submitted',
      required: true,
      index: true
    },
    publicSummary: {
      type: String,
      default: null
    },
    officialResponse: {
      type: OfficialResponseSchema,
      default: () => ({})
    },
    mediaIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
      }
    ],
    statusHistory: [StatusHistoryItemSchema],
    version: {
      type: Number,
      default: 1,
      required: true
    }
  },
  {
    timestamps: true
  }
);

ReportSchema.index({ residentId: 1, createdAt: -1 });
ReportSchema.index({ routedDepartmentId: 1, status: 1 });
ReportSchema.index({ location: '2dsphere' });

const Report = mongoose.models.Report || mongoose.model('Report', ReportSchema);

module.exports = {
  Report,
  ReportSchema
};
