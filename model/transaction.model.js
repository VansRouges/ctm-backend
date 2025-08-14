import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  token_name: {
    type: String,
    required: true,
    trim: true
  },
  isWithdraw: {
    type: Boolean,
    default: false
  },
  isDeposit: {
    type: Boolean,
    default: false
  },
  amount: {
    type: Number,
    required: true
  },
  token_withdraw_address: {
    type: String,
    trim: true
  },
  token_deposit_address: {
    type: String,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    trim: true,
    default: 'pending'
  },
  // Locked financial snapshot fields (set only once on first approval)
  tokenPriceAtApproval: {
    type: Number,
    min: 0
  },
  usdValue: {
    type: Number,
    min: 0
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
transactionSchema.index({ user: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ isWithdraw: 1 });
transactionSchema.index({ isDeposit: 1 });
transactionSchema.index({ user: 1, isWithdraw: 1 });
transactionSchema.index({ user: 1, isDeposit: 1 });

export default mongoose.model('Transaction', transactionSchema);