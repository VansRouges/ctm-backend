import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Remove clerkId entirely since you're not using it anymore
  // clerkId: {
  //   type: String,
  //   sparse: true,
  //   unique: true
  // },
  
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
    select: false // Don't include in queries by default
  },
  username: {
    type: String,
    trim: true,
    sparse: true // Allows multiple null values but unique non-null values
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  // OAuth and verification fields
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
    enum: ['user', 'admin'] // Add role restrictions if needed
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
  totalInvestment: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // This adds createdAt and updatedAt automatically
});

// Remove the clerkId index
// userSchema.index({ clerkId: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ authProvider: 1 });
userSchema.index({ isActive: 1 });

// Add virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true
});

export default mongoose.model('User', userSchema);