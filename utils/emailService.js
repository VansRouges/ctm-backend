import logger from './logger.js';
import User from '../model/user.model.js';
import {
  depositSubmittedEmail,
  withdrawalSubmittedEmail,
  stockPurchaseSubmittedEmail,
  copytradePurchaseSubmittedEmail,
  copytradeCompletedEmail,
} from './emailTemplates.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

function getFromAddress() {
  return (
    process.env.EMAIL_FROM ||
    'CopyTrading Markets <noreply@copytradingmarkets.com>'
  );
}

/**
 * Low-level send via Resend HTTP API.
 * Fails soft — never throws to callers by default (transactional side-effect).
 */
export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn('📧 RESEND_API_KEY not set — skipping email send', { to, subject });
    return { skipped: true, reason: 'RESEND_API_KEY missing' };
  }

  if (!to) {
    logger.warn('📧 No recipient email — skipping send', { subject });
    return { skipped: true, reason: 'missing recipient' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      logger.error('📧 Resend API error', {
        status: response.status,
        to,
        subject,
        body,
      });
      return { success: false, error: body };
    }

    logger.info('📧 Email sent', { to, subject, id: body.id });
    return { success: true, id: body.id };
  } catch (error) {
    logger.error('📧 Failed to send email', {
      to,
      subject,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

async function getUserContact(userId) {
  if (!userId) return null;
  const user = await User.findById(userId)
    .select('email firstName lastName fullName')
    .lean();
  if (!user?.email) return null;
  return {
    email: user.email,
    firstName: user.firstName || user.fullName?.split?.(' ')?.[0] || 'Valued Client',
  };
}

export async function notifyDepositSubmitted(userId, deposit) {
  try {
    const contact = await getUserContact(userId);
    if (!contact) return;

    const content = depositSubmittedEmail({
      firstName: contact.firstName,
      amount: deposit.amount,
      tokenName: deposit.token_name,
      referenceId: deposit._id.toString(),
      createdAt: deposit.createdAt || new Date(),
    });

    return sendEmail({ to: contact.email, ...content });
  } catch (error) {
    logger.error('📧 notifyDepositSubmitted failed', { error: error.message, userId });
  }
}

export async function notifyWithdrawalSubmitted(userId, withdraw) {
  try {
    const contact = await getUserContact(userId);
    if (!contact) return;

    const content = withdrawalSubmittedEmail({
      firstName: contact.firstName,
      amount: withdraw.amount,
      tokenName: withdraw.token_name,
      referenceId: withdraw._id.toString(),
      createdAt: withdraw.createdAt || new Date(),
    });

    return sendEmail({ to: contact.email, ...content });
  } catch (error) {
    logger.error('📧 notifyWithdrawalSubmitted failed', { error: error.message, userId });
  }
}

export async function notifyStockPurchaseSubmitted(userId, purchase) {
  try {
    const contact = await getUserContact(userId);
    if (!contact) return;

    const content = stockPurchaseSubmittedEmail({
      firstName: contact.firstName,
      symbol: purchase.symbol,
      name: purchase.name,
      quantity: purchase.quantity,
      purchasePrice: purchase.purchase_price,
      initialInvestment: purchase.initial_investment,
      referenceId: purchase._id.toString(),
      createdAt: purchase.createdAt || new Date(),
    });

    return sendEmail({ to: contact.email, ...content });
  } catch (error) {
    logger.error('📧 notifyStockPurchaseSubmitted failed', { error: error.message, userId });
  }
}

export async function notifyCopytradePurchaseSubmitted(userId, purchase) {
  try {
    const contact = await getUserContact(userId);
    if (!contact) return;

    const content = copytradePurchaseSubmittedEmail({
      firstName: contact.firstName,
      tradeTitle: purchase.trade_title,
      initialInvestment: purchase.initial_investment,
      duration: purchase.trade_duration,
      risk: purchase.trade_risk,
      referenceId: purchase._id.toString(),
      createdAt: purchase.createdAt || new Date(),
    });

    return sendEmail({ to: contact.email, ...content });
  } catch (error) {
    logger.error('📧 notifyCopytradePurchaseSubmitted failed', { error: error.message, userId });
  }
}

export async function notifyCopytradeCompleted(userId, purchase, { finalValue, roiPercent }) {
  try {
    const contact = await getUserContact(userId);
    if (!contact) return;

    const content = copytradeCompletedEmail({
      firstName: contact.firstName,
      tradeTitle: purchase.trade_title,
      initialInvestment: purchase.initial_investment,
      finalValue,
      profitLoss: purchase.trade_profit_loss,
      isProfit: purchase.isProfit,
      roiPercent,
      referenceId: purchase._id.toString(),
      completedAt: purchase.trade_end_date || new Date(),
    });

    return sendEmail({ to: contact.email, ...content });
  } catch (error) {
    logger.error('📧 notifyCopytradeCompleted failed', { error: error.message, userId });
  }
}
