import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Using MongoDB's ObjectId instead of cuid()
  clerkId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
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

// Add indexes for better query performance
userSchema.index({ clerkId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Add virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true
});

export default mongoose.model('User', userSchema);