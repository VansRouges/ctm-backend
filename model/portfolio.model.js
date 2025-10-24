// model/portfolio.model.js
// Tracks individual token holdings for each user
import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token_name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true, // Store as uppercase for consistency (BTC, USDT, XRP)
    index: true
  },
  // Current amount of this token the user holds
  amount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // Average price at which this token was acquired (for tracking)
  averageAcquisitionPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  // Total USD value invested in this token (sum of all deposits)
  totalInvestedUsd: {
    type: Number,
    min: 0,
    default: 0
  },
  // Last updated timestamp
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index: Each user can have only ONE portfolio entry per token
portfolioSchema.index({ user: 1, token_name: 1 }, { unique: true });

// Index for querying user's entire portfolio
portfolioSchema.index({ user: 1 });

// Virtual: Calculate current USD value based on live price
// (This will be calculated dynamically, not stored)
portfolioSchema.methods.getCurrentValue = async function(livePrice) {
  return Number((this.amount * livePrice).toFixed(8));
};

// Virtual: Calculate profit/loss
portfolioSchema.methods.getProfitLoss = async function(livePrice) {
  const currentValue = await this.getCurrentValue(livePrice);
  const profitLoss = currentValue - this.totalInvestedUsd;
  const profitLossPercentage = this.totalInvestedUsd > 0 
    ? (profitLoss / this.totalInvestedUsd) * 100 
    : 0;
  
  return {
    profitLoss: Number(profitLoss.toFixed(8)),
    profitLossPercentage: Number(profitLossPercentage.toFixed(2))
  };
};

export default mongoose.model('Portfolio', portfolioSchema);