import mongoose from 'mongoose';

const copytradingOptionSchema = new mongoose.Schema({
  trade_title: {
    type: String,
    required: true,
    trim: true
  },
  trade_max: {
    type: Number,
    required: true
  },
  trade_min: {
    type: Number,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  trade_description: {
    type: String,
    required: true,
    trim: true
  },
  trade_roi_min: {
    type: Number,
    required: true
  },
  trade_roi_max: {
    type: Number,
    required: true
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  trade_risk: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
    trim: true
  },
  trade_duration: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
copytradingOptionSchema.index({ user: 1 });
copytradingOptionSchema.index({ isRecommended: 1 });
copytradingOptionSchema.index({ trade_risk: 1 });
copytradingOptionSchema.index({ trade_roi_max: -1 });

export default mongoose.model('CopytradingOption', copytradingOptionSchema);