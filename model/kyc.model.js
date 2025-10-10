import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One KYC per user
    index: true
  },
  
  // Personal Information
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    }
  },

  // Document Information
  documents: {
    validId: {
      fileName: {
        type: String,
        required: true
      },
      fileUrl: {
        type: String,
        required: true
      },
      fileSize: {
        type: Number,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    passport: {
      fileName: {
        type: String,
        required: true
      },
      fileUrl: {
        type: String,
        required: true
      },
      fileSize: {
        type: Number,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  },

  // KYC Status and Review
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'],
    default: 'pending',
    index: true
  },
  
  // Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Submission tracking
  submittedAt: {
    type: Date,
    default: Date.now
  },
  resubmissionCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 3 // Maximum 3 resubmissions allowed
  },

  // Metadata
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for efficient queries
kycSchema.index({ status: 1, submittedAt: -1 });
kycSchema.index({ userId: 1, status: 1 });
kycSchema.index({ reviewedBy: 1, reviewedAt: -1 });

// Virtual for age calculation
kycSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for full address
kycSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const { street, city, state, country, postalCode } = this.address;
  return `${street}, ${city}, ${state}, ${country} ${postalCode}`;
});

// Virtual for document count
kycSchema.virtual('documentCount').get(function() {
  let count = 0;
  if (this.documents?.validId?.fileUrl) count++;
  if (this.documents?.passport?.fileUrl) count++;
  return count;
});

// Virtual for time since submission
kycSchema.virtual('daysSinceSubmission').get(function() {
  if (!this.submittedAt) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware for validation
kycSchema.pre('save', function(next) {
  // Ensure user is at least 18 years old
  if (this.age !== null && this.age < 18) {
    const error = new Error('User must be at least 18 years old to complete KYC');
    error.status = 400;
    return next(error);
  }

  // Update timestamps based on status changes
  if (this.isModified('status')) {
    if (this.status === 'under_review' && !this.reviewedAt) {
      // Auto-set to under review when admin starts reviewing
    } else if (['approved', 'rejected'].includes(this.status)) {
      if (!this.reviewedAt) {
        this.reviewedAt = new Date();
      }
    } else if (this.status === 'resubmission_required') {
      this.resubmissionCount += 1;
    }
  }

  next();
});

// Instance methods
kycSchema.methods.canResubmit = function() {
  return this.resubmissionCount < 3 && ['rejected', 'resubmission_required'].includes(this.status);
};

kycSchema.methods.markAsReviewed = function(adminId, notes = '', newStatus = 'under_review') {
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.status = newStatus;
  return this.save();
};

kycSchema.methods.approve = function(adminId, notes = '') {
  return this.markAsReviewed(adminId, notes, 'approved');
};

kycSchema.methods.reject = function(adminId, reason, notes = '') {
  this.rejectionReason = reason;
  return this.markAsReviewed(adminId, notes, 'rejected');
};

// Static methods
kycSchema.statics.getPendingKYCs = function() {
  return this.find({ status: 'pending' })
    .populate('userId', 'email firstName lastName')
    .sort({ submittedAt: 1 }); // Oldest first
};

kycSchema.statics.getKYCsByStatus = function(status) {
  return this.find({ status })
    .populate('userId', 'email firstName lastName')
    .populate('reviewedBy', 'email username')
    .sort({ submittedAt: -1 });
};

kycSchema.statics.getUserKYC = function(userId) {
  return this.findOne({ userId })
    .populate('userId', 'email firstName lastName')
    .populate('reviewedBy', 'email username');
};

// Enable virtuals in JSON
kycSchema.set('toJSON', { virtuals: true });
kycSchema.set('toObject', { virtuals: true });

const KYC = mongoose.model('KYC', kycSchema);

export default KYC;