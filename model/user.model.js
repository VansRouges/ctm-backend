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
    // Derived: ((currentValue + lifetimeWithdrawals) - totalInvestment) / totalInvestment * 100
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
  accountStatus: {
    type: Boolean,
    default: false
  },
  
  // FINANCIAL FIELDS
  totalInvestment: {
    type: Number,
    default: 0,
    min: 0
    // Lifetime approved deposits — never reduced by withdrawals or trades
  },
  accountBalance: {
    type: Number,
    default: 0,
    min: 0
    // Available / liquid portfolio mark-to-market (excludes capital locked in trades)
  },
  currentValue: {
    type: Number,
    default: 0,
    min: 0
    // Total equity = accountBalance (available) + locked capital in active trades/stocks
  },
  lifetimeWithdrawals: {
    type: Number,
    default: 0,
    min: 0
    // Sum of approved withdrawal USD (cached; recomputed on sync)
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