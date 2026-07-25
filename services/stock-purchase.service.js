// services/stock-purchase.service.js
import StockPurchase from '../model/stock-purchase.model.js';
import Stock from '../model/stock.model.js';
import User from '../model/user.model.js';
import Portfolio from '../model/portfolio.model.js';
import PortfolioService from './portfolio.service.js';
import BalanceService from './balance.service.js';
import { getTokenPrice } from '../utils/priceService.js';
import logger from '../utils/logger.js';

class StockPurchaseService {
  /**
   * Attach live mark-to-market fields from Stock collection
   */
  static async withMarkToMarket(purchases) {
    const list = Array.isArray(purchases) ? purchases : [purchases];
    const symbols = [...new Set(list.map((p) => p.symbol))];
    const stocks = await Stock.find({ symbol: { $in: symbols } }).select('symbol price name exchange');
    const priceMap = new Map(stocks.map((s) => [s.symbol, s]));

    return list.map((purchase) => {
      const doc = purchase.toObject ? purchase.toObject() : { ...purchase };
      const live = priceMap.get(doc.symbol);
      const currentPrice = live?.price ?? null;

      if (doc.stock_status === 'completed' && doc.admin_final_value != null) {
        doc.current_price = currentPrice;
        doc.current_value = doc.admin_final_value;
        doc.profit_loss = Number((doc.admin_final_value - doc.initial_investment).toFixed(8));
        doc.isProfit = doc.admin_is_profit ?? doc.profit_loss >= 0;
        return doc;
      }

      if (currentPrice == null || !['active', 'pending_liquidation'].includes(doc.stock_status)) {
        doc.current_price = currentPrice;
        doc.current_value = null;
        doc.profit_loss = null;
        doc.isProfit = null;
        return doc;
      }

      const currentValue = Number((currentPrice * doc.quantity).toFixed(8));
      const profitLoss = Number((currentValue - doc.initial_investment).toFixed(8));
      doc.current_price = currentPrice;
      doc.current_value = currentValue;
      doc.profit_loss = profitLoss;
      doc.isProfit = profitLoss >= 0;
      return doc;
    });
  }

  static async createPurchase({ user, symbol, quantity }, session = null) {
    const stock = await Stock.findOne({ symbol: symbol.toUpperCase() }).session(session);
    if (!stock) {
      const error = new Error('STOCK_NOT_FOUND');
      error.data = { symbol };
      throw error;
    }

    if (!quantity || quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    const userDoc = await User.findById(user)
      .select('email accountBalance totalInvestment')
      .session(session);

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    if (userDoc.accountBalance === undefined) {
      userDoc.accountBalance = userDoc.totalInvestment || 0;
    }

    const purchasePrice = Number(stock.price);
    const initialInvestment = Number((purchasePrice * quantity).toFixed(8));
    const available = userDoc.accountBalance || 0;

    if (available < initialInvestment) {
      const error = new Error('INSUFFICIENT_FUNDS');
      error.data = {
        required: initialInvestment,
        available,
        deficit: Number((initialInvestment - available).toFixed(8))
      };
      throw error;
    }

    const purchase = new StockPurchase({
      user,
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      quantity,
      purchase_price: purchasePrice,
      initial_investment: initialInvestment,
      stock_status: 'pending'
    });

    const saved = await purchase.save({ session });

    logger.info('📝 Stock purchase created (pending approval)', {
      purchaseId: saved._id,
      userId: user,
      symbol: saved.symbol,
      quantity,
      initialInvestment
    });

    return { purchase: saved };
  }

  /**
   * Approve pending stock purchase — deduct portfolio USD value (highest token first)
   */
  static async approvePurchase(purchase, adminUsername, session = null) {
    if (purchase.stock_status !== 'pending') {
      const error = new Error('INVALID_STATUS');
      error.data = { currentStatus: purchase.stock_status };
      throw error;
    }

    const userId = purchase.user;
    let remainingToDeduct = purchase.initial_investment;

    const portfolioEntries = await Portfolio.find({ user: userId }).session(session);
    if (portfolioEntries.length === 0) {
      const error = new Error('NO_PORTFOLIO_ENTRIES');
      error.data = { userId };
      throw error;
    }

    const entriesWithValues = await Promise.all(
      portfolioEntries.map(async (entry) => {
        try {
          const livePrice = await getTokenPrice(entry.token_name);
          const currentValue = Number((entry.amount * livePrice).toFixed(8));
          return { entry, livePrice, currentValue };
        } catch {
          return { entry, livePrice: null, currentValue: 0 };
        }
      })
    );

    entriesWithValues.sort((a, b) => b.currentValue - a.currentValue);
    const totalAvailable = entriesWithValues.reduce((sum, e) => sum + e.currentValue, 0);

    if (totalAvailable < remainingToDeduct) {
      const error = new Error('INSUFFICIENT_PORTFOLIO');
      error.data = {
        required: remainingToDeduct,
        available: totalAvailable,
        deficit: Number((remainingToDeduct - totalAvailable).toFixed(8))
      };
      throw error;
    }

    const deductions = [];
    for (const { entry, livePrice, currentValue } of entriesWithValues) {
      if (remainingToDeduct <= 0 || !livePrice || currentValue <= 0) continue;

      if (currentValue <= remainingToDeduct) {
        await PortfolioService.deductFromPortfolio(userId, entry.token_name, entry.amount, session);
        deductions.push({
          tokenName: entry.token_name,
          tokenAmount: entry.amount,
          usdValue: currentValue
        });
        remainingToDeduct = Number((remainingToDeduct - currentValue).toFixed(8));
      } else {
        const tokenAmountToDeduct = Number((remainingToDeduct / livePrice).toFixed(8));
        await PortfolioService.deductFromPortfolio(userId, entry.token_name, tokenAmountToDeduct, session);
        deductions.push({
          tokenName: entry.token_name,
          tokenAmount: tokenAmountToDeduct,
          usdValue: remainingToDeduct
        });
        remainingToDeduct = 0;
      }
    }

    const newAccountBalance = await PortfolioService.recalculateAccountBalance(userId, session);

    purchase.stock_status = 'active';
    purchase.approved_by = adminUsername;
    purchase.approved_at = new Date();
    await purchase.save({ session });

    logger.info('✅ Stock purchase approved', {
      purchaseId: purchase._id,
      userId,
      deductions,
      newAccountBalance,
      adminUsername
    });

    return { purchase, deductions, newAccountBalance };
  }

  static async requestLiquidation(purchase, userId) {
    if (purchase.user.toString() !== userId.toString()) {
      throw new Error('FORBIDDEN');
    }
    if (purchase.stock_status !== 'active') {
      const error = new Error('INVALID_STATUS');
      error.data = { currentStatus: purchase.stock_status };
      throw error;
    }

    purchase.stock_status = 'pending_liquidation';
    purchase.liquidation_requested_at = new Date();
    await purchase.save();

    return { purchase };
  }

  /**
   * Admin settles liquidation with controlled final payout → USDT
   */
  static async settleLiquidation(purchase, { finalValue, isProfit }, adminUsername, session = null) {
    if (purchase.stock_status !== 'pending_liquidation') {
      const error = new Error('INVALID_STATUS');
      error.data = { currentStatus: purchase.stock_status };
      throw error;
    }

    if (finalValue == null || Number(finalValue) < 0) {
      throw new Error('INVALID_FINAL_VALUE');
    }

    const settledValue = Number(Number(finalValue).toFixed(8));
    const profitFlag =
      typeof isProfit === 'boolean'
        ? isProfit
        : settledValue >= purchase.initial_investment;

    const balanceUpdate = await BalanceService.settleTradeReturn(
      purchase.user,
      settledValue,
      session
    );

    await PortfolioService.recalculateAccountBalance(purchase.user, session);

    purchase.stock_status = 'completed';
    purchase.admin_final_value = settledValue;
    purchase.admin_is_profit = profitFlag;
    purchase.liquidated_at = new Date();
    purchase.settled_by = adminUsername;
    await purchase.save({ session });

    logger.info('🏁 Stock liquidation settled', {
      purchaseId: purchase._id,
      finalValue: settledValue,
      isProfit: profitFlag,
      adminUsername
    });

    return { purchase, balanceUpdate };
  }

  static async rejectPurchase(purchase, adminUsername, reason = null) {
    if (!['pending', 'pending_liquidation'].includes(purchase.stock_status)) {
      const error = new Error('INVALID_STATUS');
      error.data = { currentStatus: purchase.stock_status };
      throw error;
    }

    // Rejecting liquidation returns holding to active; rejecting buy cancels
    if (purchase.stock_status === 'pending_liquidation') {
      purchase.stock_status = 'active';
      purchase.liquidation_requested_at = undefined;
      purchase.rejection_reason = reason || 'Liquidation rejected by admin';
    } else {
      purchase.stock_status = 'cancelled';
      purchase.rejection_reason = reason || 'Purchase rejected by admin';
    }

    purchase.settled_by = adminUsername;
    await purchase.save();

    return { purchase };
  }
}

export default StockPurchaseService;
