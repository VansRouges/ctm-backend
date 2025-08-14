import mongoose from 'mongoose';

const adminEmailSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    trim: true,
    default: 'pending'
  },
  email_id: {
    type: String,
    required: true,
    trim: true,
    unique: true
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
adminEmailSchema.index({ email_id: 1 });
adminEmailSchema.index({ status: 1 });
adminEmailSchema.index({ from: 1 });
adminEmailSchema.index({ to: 1 });

export default mongoose.model('AdminEmail', adminEmailSchema);