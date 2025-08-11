import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  change: {
    type: Number,
    required: true
  },
  changesPercentage: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    required: true
  },
  dayLow: {
    type: Number
  },
  dayHigh: {
    type: Number
  },
  yearHigh: {
    type: Number
  },
  yearLow: {
    type: Number
  },
  marketCap: {
    type: Number
  },
  priceAvg50: {
    type: Number
  },
  priceAvg200: {
    type: Number
  },
  exchange: {
    type: String,
    required: true
  },
  avgVolume: {
    type: Number
  },
  open: {
    type: Number
  },
  previousClose: {
    type: Number
  },
  eps: {
    type: Number
  },
  pe: {
    type: Number
  },
  earningsAnnouncement: {
    type: Date
  },
  sharesOutstanding: {
    type: Number
  },
  timestamp: {
    type: Number
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
stockSchema.index({ symbol: 1, exchange: 1 });
stockSchema.index({ name: 'text', symbol: 'text' }); // For text search
stockSchema.index({ price: -1 }); // For price sorting
stockSchema.index({ volume: -1 }); // For volume sorting
stockSchema.index({ changesPercentage: -1 }); // For change percentage sorting

export default mongoose.model('Stock', stockSchema);