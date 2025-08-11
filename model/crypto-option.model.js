import mongoose from 'mongoose';

const cryptoOptionSchema = new mongoose.Schema({
  token_name: {
    type: String,
    required: true,
    trim: true
  },
  token_address: {
    type: String,
    required: true,
    trim: true
  },
  user_id: {
    type: String,
    required: true,
    trim: true
  },
  user_name: {
    type: String,
    required: true,
    trim: true
  },
  token_symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
cryptoOptionSchema.index({ user_id: 1 });
cryptoOptionSchema.index({ token_symbol: 1 });
cryptoOptionSchema.index({ token_address: 1 });

export default mongoose.model('CryptoOption', cryptoOptionSchema);