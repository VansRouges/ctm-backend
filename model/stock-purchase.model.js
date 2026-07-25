import mongoose from 'mongoose';

const stockPurchaseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  exchange: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.00000001
  },
  purchase_price: {
    type: Number,
    required: true,
    min: 0
  },
  initial_investment: {
    type: Number,
    required: true,
    min: 0
  },
  stock_status: {
    type: String,
    enum: ['pending', 'active', 'pending_liquidation', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  approved_by: {
    type: String,
    trim: true
  },
  approved_at: {
    type: Date
  },
  liquidation_requested_at: {
    type: Date
  },
  admin_final_value: {
    type: Number,
    min: 0
  },
  admin_is_profit: {
    type: Boolean
  },
  liquidated_at: {
    type: Date
  },
  settled_by: {
    type: String,
    trim: true
  },
  rejection_reason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

stockPurchaseSchema.index({ user: 1, stock_status: 1 });
stockPurchaseSchema.index({ stock_status: 1 });

export default mongoose.model('StockPurchase', stockPurchaseSchema);
