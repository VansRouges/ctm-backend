import mongoose from 'mongoose';

const userSupportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    trim: true,
    default: 'medium',
    enum: ['low', 'medium', 'high'],
  },
  status: {
    type: String,
    trim: true,
    default: 'open',
    enum: ['open', 'in_progress', 'resolved', 'closed']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
userSupportSchema.index({ user: 1 });
userSupportSchema.index({ status: 1 });
userSupportSchema.index({ priority: 1 });
userSupportSchema.index({ email: 1 });

export default mongoose.model('UserSupport', userSupportSchema);