/**
 * Lightweight verification of admin financial update validation rules
 * (no DB). Run: node scripts/verify-admin-financial-update.js
 */
import BalanceService from '../services/balance.service.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectError(fn, code) {
  try {
    await fn();
    throw new Error(`Expected error ${code} but none thrown`);
  } catch (error) {
    assert(error.message === code, `Expected ${code}, got ${error.message}`);
  }
}

// Monkey-patch compute/sync/adjust to avoid DB while testing validation branches
const originalCompute = (await import('../services/financial-summary.service.js'))
  .default.computeSummary;
const FinancialSummaryService = (await import('../services/financial-summary.service.js'))
  .default;
const PortfolioService = (await import('../services/portfolio.service.js')).default;

FinancialSummaryService.computeSummary = async () => ({
  email: 'test@example.com',
  totalInvestment: 1000,
  accountBalance: 500,
  lockedValue: 200,
  currentValue: 700,
  lifetimeWithdrawals: 0,
  roi: 0,
  netGainLoss: -300
});

FinancialSummaryService.syncUserFinancialMetrics = async () => ({
  email: 'test@example.com',
  totalInvestment: 1000,
  accountBalance: 800,
  lockedValue: 200,
  currentValue: 1000,
  lifetimeWithdrawals: 0,
  roi: 0,
  netGainLoss: 0
});

let lastAdjustArgs = null;
PortfolioService.adjustAvailableToTarget = async (userId, target, current) => {
  lastAdjustArgs = { userId, target, current };
  return { delta: target - current, adjustments: [] };
};

async function run() {
  await expectError(
    () => BalanceService.adminUpdateFinancialMetrics('u1', {}),
    'NO_FINANCIAL_FIELDS'
  );

  await expectError(
    () =>
      BalanceService.adminUpdateFinancialMetrics('u1', {
        accountBalance: -1
      }),
    'INVALID_FINANCIAL_VALUE'
  );

  await expectError(
    () =>
      BalanceService.adminUpdateFinancialMetrics('u1', {
        accountBalance: 100,
        currentValue: 50
      }),
    'CURRENT_VALUE_BELOW_BALANCE'
  );

  await expectError(
    () =>
      BalanceService.adminUpdateFinancialMetrics('u1', {
        accountBalance: 100,
        currentValue: 500
      }),
    'CURRENT_VALUE_LOCKED_MISMATCH'
  );

  await expectError(
    () =>
      BalanceService.adminUpdateFinancialMetrics('u1', {
        currentValue: 100
      }),
    'CURRENT_VALUE_BELOW_LOCKED'
  );

  lastAdjustArgs = null;
  const balanceOnly = await BalanceService.adminUpdateFinancialMetrics('u1', {
    accountBalance: 800
  });
  assert(lastAdjustArgs?.target === 800, 'accountBalance-only should target 800 available');
  assert(balanceOnly.after.accountBalance === 800, 'after.accountBalance');

  lastAdjustArgs = null;
  await BalanceService.adminUpdateFinancialMetrics('u1', {
    currentValue: 1000
  });
  assert(
    lastAdjustArgs?.target === 800,
    `currentValue-only should target available=1000-200=800, got ${lastAdjustArgs?.target}`
  );

  lastAdjustArgs = null;
  await BalanceService.adminUpdateFinancialMetrics('u1', {
    accountBalance: 800,
    currentValue: 1000
  });
  assert(lastAdjustArgs?.target === 800, 'both matching locked should target 800');

  console.log('✅ Admin financial update validation checks passed');
  // restore (not required for one-shot script)
  FinancialSummaryService.computeSummary = originalCompute;
}

run().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
