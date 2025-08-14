import mongoose from 'mongoose';

// Represents a purchased copytrade plan (snapshot at purchase time)
const copytradePurchaseSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
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
  trade_risk: { 
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
  trade_duration: { 
      type: Number, 
      required: true 
  },
  initial_investment: { 
      type: Number, 
      required: true, 
      min: 0 
  },
  trade_current_value: { 
      type: Number, 
      required: true, 
      min: 0 
  },
  trade_profit_loss: { 
      type: Number, 
      required: true, 
      default: 0 
  },
  isProfit: { 
      type: Boolean, 
      default: false 
  },
  trade_status: { 
      type: String, 
      trim: true, 
      default: 'active', 
      enum: ['active', 'completed', 'cancelled'], 
      index: true 
  },
  trade_win_rate: { 
      type: Number 
  },
  trade_token: { 
      type: String, 
      required: true, 
      trim: true 
  },
  trade_token_address: { 
      type: String, 
      required: true, 
      trim: true 
  },
  trade_approval_date: { 
      type: String, 
      trim: true 
  },
  trade_end_date: { 
      type: String, 
      trim: true 
  }
}, { 
    timestamps: true 
});

copytradePurchaseSchema.index({ trade_status: 1 });
copytradePurchaseSchema.index({ isProfit: 1 });
copytradePurchaseSchema.index({ user: 1, trade_status: 1 });

copytradePurchaseSchema.pre('save', function(next) {
  if (this.isModified('trade_current_value') || this.isModified('initial_investment')) {
    this.trade_profit_loss = Number((this.trade_current_value - this.initial_investment).toFixed(8));
    this.isProfit = this.trade_profit_loss >= 0;
  }
  next();
});

export default mongoose.model('CopytradePurchase', copytradePurchaseSchema);
