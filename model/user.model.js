import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Google OAuth fields
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Password for manual registration (optional for OAuth users)
  password: {
    type: String,
    select: false
  },
  username: {
    type: String,
    trim: true,
    sparse: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    trim: true
  },
  authProvider: {
    type: String,
    enum: ['manual', 'google'],
    default: 'manual'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  roi: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin']
  },
  kycStatus: {
    type: Boolean,
    default: false
  },
  currentValue: {
    type: Number,
    default: 0
  },
  accountStatus: {
    type: Boolean,
    default: false
  },
  
  // FINANCIAL FIELDS - UPDATED
  totalInvestment: {
    type: Number,
    default: 0,
    min: 0,
    // Total value of all approved deposits (historical tracking)
  },
  accountBalance: {
    type: Number,
    default: 0,
    min: 0,
    // Current available balance for withdrawals
    // Will be initialized from totalInvestment for existing users
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ googleId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ authProvider: 1 });
userSchema.index({ isActive: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// IMPORTANT: Pre-save hook to ensure accountBalance is initialized
// This handles existing users who don't have accountBalance
userSchema.pre('save', function(next) {
  // If accountBalance doesn't exist (undefined), initialize it from totalInvestment
  if (this.accountBalance === undefined) {
    this.accountBalance = this.totalInvestment || 0;
  }
  next();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true
});

export default mongoose.model('User', userSchema);