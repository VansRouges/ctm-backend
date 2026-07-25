// services/financial-summary.service.js
// Single source of truth for Available, Locked, Current Value, and ROI
import mongoose from 'mongoose';
import User from '../model/user.model.js';
import CopytradePurchase from '../model/copytrade-purchase.model.js';
import StockPurchase from '../model/stock-purchase.model.js';
import Stock from '../model/stock.model.js';
import Transaction from '../model/transaction.model.js';
import PortfolioService from './portfolio.service.js';
import logger from '../utils/logger.js';

class FinancialSummaryService {
  /**
   * ROI = ((currentValue + lifetimeWithdrawals) - totalInvestment) / totalInvestment * 100
   * totalInvestment = lifetime approved deposits (never reduced)
   */
  static calculateRoi(totalInvestment, currentValue, lifetimeWithdrawals) {
    if (!totalInvestment || totalInvestment <= 0) return 0;
    return Number(
      (
        ((currentValue + lifetimeWithdrawals - totalInvestment) / totalInvestment) *
        100
      ).toFixed(4)
    );
  }

  /**
   * Capital locked in active copytrades + active/pending-liquidation stocks
   */
  static async getLockedCapital(userId, session = null) {
    const copytradeQuery = CopytradePurchase.find({
      user: userId,
      trade_status: 'active'
    })
      .select('trade_current_value')
      .lean();
    if (session) copytradeQuery.session(session);
    const copytrades = await copytradeQuery;

    const copytradeLocked = copytrades.reduce(
      (sum, t) => sum + (Number(t.trade_current_value) || 0),
      0
    );

    const stockQuery = StockPurchase.find({
      user: userId,
      stock_status: { $in: ['active', 'pending_liquidation'] }
    })
      .select('symbol quantity initial_investment')
      .lean();
    if (session) stockQuery.session(session);
    const stocks = await stockQuery;

    let stockLocked = 0;
    if (stocks.length > 0) {
      const symbols = [...new Set(stocks.map((s) => s.symbol))];
      const stockDocsQuery = Stock.find({ symbol: { $in: symbols } }).select(
        'symbol price'
      );
      if (session) stockDocsQuery.session(session);
      const stockDocs = await stockDocsQuery;
      const priceMap = new Map(stockDocs.map((s) => [s.symbol, s.price]));

      for (const purchase of stocks) {
        const price = priceMap.get(purchase.symbol);
        if (price != null) {
          stockLocked += Number((price * purchase.quantity).toFixed(8));
        } else {
          stockLocked += Number(purchase.initial_investment) || 0;
        }
      }
    }

    return Number((copytradeLocked + stockLocked).toFixed(8));
  }

  /**
   * Lifetime approved withdrawal USD (source of truth from transactions)
   */
  static async getLifetimeWithdrawals(userId, session = null) {
    const matchUser =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const pipeline = [
      {
        $match: {
          user: matchUser,
          isWithdraw: true,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$usdValue', 0] } }
        }
      }
    ];

    const aggregate = Transaction.aggregate(pipeline);
    if (session) aggregate.session(session);
    const result = await aggregate;

    return Number((result[0]?.total || 0).toFixed(8));
  }

  /**
   * Live financial summary (does not persist)
   */
  static async computeSummary(userId, session = null) {
    const userQuery = User.findById(userId).select(
      'email totalInvestment accountBalance lifetimeWithdrawals currentValue roi'
    );
    if (session) userQuery.session(session);
    const userDoc = await userQuery;

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    const portfolio = await PortfolioService.getUserPortfolio(userId);
    const available = Number((portfolio.totalCurrentValue || 0).toFixed(8));
    const lockedValue = await this.getLockedCapital(userId, session);
    const currentValue = Number((available + lockedValue).toFixed(8));
    const lifetimeWithdrawals = await this.getLifetimeWithdrawals(userId, session);
    const totalInvestment = Number(userDoc.totalInvestment) || 0;
    const roi = this.calculateRoi(totalInvestment, currentValue, lifetimeWithdrawals);
    const netGainLoss = Number(
      (currentValue + lifetimeWithdrawals - totalInvestment).toFixed(8)
    );

    return {
      email: userDoc.email,
      totalInvestment,
      accountBalance: available,
      lockedValue,
      currentValue,
      lifetimeWithdrawals,
      roi,
      netGainLoss
    };
  }

  /**
   * Persist accountBalance (available), currentValue, lifetimeWithdrawals, roi
   */
  static async syncUserFinancialMetrics(userId, session = null) {
    const summary = await this.computeSummary(userId, session);

    await User.findByIdAndUpdate(
      userId,
      {
        accountBalance: summary.accountBalance,
        currentValue: summary.currentValue,
        lifetimeWithdrawals: summary.lifetimeWithdrawals,
        roi: summary.roi
      },
      { session }
    );

    logger.info('📊 Synced user financial metrics', {
      userId: String(userId),
      totalInvestment: summary.totalInvestment,
      accountBalance: summary.accountBalance,
      lockedValue: summary.lockedValue,
      currentValue: summary.currentValue,
      lifetimeWithdrawals: summary.lifetimeWithdrawals,
      roi: summary.roi,
      netGainLoss: summary.netGainLoss
    });

    return summary;
  }

  /**
   * Sync metrics for multiple users (e.g. after daily copytrade updates)
   */
  static async syncUsers(userIds) {
    const unique = [...new Set((userIds || []).map((id) => String(id)))];
    const results = { synced: 0, errors: 0 };

    for (const id of unique) {
      try {
        await this.syncUserFinancialMetrics(id);
        results.synced++;
      } catch (error) {
        results.errors++;
        logger.error('❌ Failed to sync user financial metrics', {
          userId: id,
          error: error.message
        });
      }
    }

    return results;
  }
}

export default FinancialSummaryService;
