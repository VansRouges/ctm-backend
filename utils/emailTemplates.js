/**
 * Professional transactional email templates for CopyTrading Markets
 */

const brand = {
  name: 'CopyTrading Markets',
  supportEmail: 'support@copytradingmarkets.com',
  siteUrl: process.env.FRONTEND_URL || 'https://www.copytradingmarkets.com',
  dashboardUrl: `${process.env.FRONTEND_URL || 'https://www.copytradingmarkets.com'}/dashboard`,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount ?? '-');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(date = new Date()) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) + ' WAT';
}

function layout({ title, preheader, greetingName, bodyHtml, ctaLabel, ctaUrl }) {
  const name = escapeHtml(greetingName || 'Valued Client');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:Arial,Helvetica,sans-serif;color:#e8e8e8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b0c;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#141416;border:1px solid #2a2a2e;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#1a1608 0%,#141416 100%);border-bottom:1px solid #2a2a2e;">
              <div style="font-size:20px;font-weight:700;letter-spacing:0.04em;color:#d4af37;">${brand.name}</div>
              <div style="margin-top:6px;font-size:13px;color:#9a9a9a;">${escapeHtml(title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#f0f0f0;">Dear ${name},</p>
              ${bodyHtml}
              ${ctaLabel && ctaUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px;">
                <tr>
                  <td style="background:#d4af37;border-radius:8px;">
                    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;color:#111;text-decoration:none;font-weight:700;font-size:14px;">
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>` : ''}
              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#bdbdbd;">
                If you did not make this request, please contact us immediately at
                <a href="mailto:${brand.supportEmail}" style="color:#d4af37;text-decoration:none;">${brand.supportEmail}</a>.
              </p>
              <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#f0f0f0;">
                Kind regards,<br />
                <strong style="color:#d4af37;">The ${brand.name} Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#101012;border-top:1px solid #2a2a2e;font-size:12px;color:#777;line-height:1.5;">
              This is an automated message from ${brand.name}. Please do not reply directly to this email.<br />
              &copy; ${new Date().getFullYear()} ${brand.name}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#9a9a9a;font-size:13px;width:40%;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#f0f0f0;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
  </tr>`;
}

function detailsTable(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
    ${rows.map(([label, value]) => detailRow(label, value)).join('')}
  </table>`;
}

export function depositSubmittedEmail({ firstName, amount, tokenName, referenceId, createdAt }) {
  const subject = `Deposit request received — ${tokenName}`;
  const html = layout({
    title: 'Deposit Request Received',
    preheader: `We received your ${tokenName} deposit request.`,
    greetingName: firstName,
    ctaLabel: 'View transaction history',
    ctaUrl: `${brand.dashboardUrl}/history`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#cfcfcf;">
        We have received your deposit request and it is now <strong style="color:#d4af37;">pending review</strong>.
        You will be notified once it has been processed.
      </p>
      ${detailsTable([
        ['Asset', tokenName],
        ['Amount', `${amount} ${tokenName}`],
        ['Status', 'Pending'],
        ['Reference', referenceId],
        ['Submitted', formatDate(createdAt)],
      ])}
    `,
  });
  const text = `Dear ${firstName || 'Valued Client'},

We have received your deposit request and it is now pending review.

Asset: ${tokenName}
Amount: ${amount} ${tokenName}
Status: Pending
Reference: ${referenceId}
Submitted: ${formatDate(createdAt)}

View your history: ${brand.dashboardUrl}/history

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export function withdrawalSubmittedEmail({ firstName, amount, tokenName, referenceId, createdAt }) {
  const subject = `Withdrawal request received — ${tokenName}`;
  const html = layout({
    title: 'Withdrawal Request Received',
    preheader: `We received your ${tokenName} withdrawal request.`,
    greetingName: firstName,
    ctaLabel: 'View transaction history',
    ctaUrl: `${brand.dashboardUrl}/history`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#cfcfcf;">
        We have received your withdrawal request and it is now <strong style="color:#d4af37;">pending approval</strong>.
        Funds will only be released after review by our operations team.
      </p>
      ${detailsTable([
        ['Asset', tokenName],
        ['Amount', `${amount} ${tokenName}`],
        ['Status', 'Pending'],
        ['Reference', referenceId],
        ['Submitted', formatDate(createdAt)],
      ])}
    `,
  });
  const text = `Dear ${firstName || 'Valued Client'},

We have received your withdrawal request and it is now pending approval.

Asset: ${tokenName}
Amount: ${amount} ${tokenName}
Status: Pending
Reference: ${referenceId}
Submitted: ${formatDate(createdAt)}

View your history: ${brand.dashboardUrl}/history

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export function stockPurchaseSubmittedEmail({
  firstName,
  symbol,
  name,
  quantity,
  purchasePrice,
  initialInvestment,
  referenceId,
  createdAt,
}) {
  const subject = `Stock purchase confirmed — ${symbol}`;
  const html = layout({
    title: 'Stock Purchase Confirmed',
    preheader: `Your purchase of ${quantity} ${symbol} is now active.`,
    greetingName: firstName,
    ctaLabel: 'View portfolio',
    ctaUrl: `${brand.dashboardUrl}/portfolio`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#cfcfcf;">
        Your stock purchase has been <strong style="color:#d4af37;">confirmed and activated</strong>.
        You can track live mark-to-market value in your portfolio. Liquidation still requires admin review.
      </p>
      ${detailsTable([
        ['Symbol', symbol],
        ['Company', name],
        ['Quantity', String(quantity)],
        ['Purchase price', formatMoney(purchasePrice)],
        ['Investment', formatMoney(initialInvestment)],
        ['Status', 'Active'],
        ['Reference', referenceId],
        ['Confirmed', formatDate(createdAt)],
      ])}
    `,
  });
  const text = `Dear ${firstName || 'Valued Client'},

Your stock purchase has been confirmed and activated.

Symbol: ${symbol}
Company: ${name}
Quantity: ${quantity}
Purchase price: ${formatMoney(purchasePrice)}
Investment: ${formatMoney(initialInvestment)}
Status: Active
Reference: ${referenceId}
Confirmed: ${formatDate(createdAt)}

View portfolio: ${brand.dashboardUrl}/portfolio

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export function copytradePurchaseSubmittedEmail({
  firstName,
  tradeTitle,
  initialInvestment,
  duration,
  risk,
  referenceId,
  createdAt,
}) {
  const subject = `Copy trade activated — ${tradeTitle}`;
  const html = layout({
    title: 'Copy Trade Activated',
    preheader: `Your copy trade for ${tradeTitle} is now active.`,
    greetingName: firstName,
    ctaLabel: 'View copy trades',
    ctaUrl: `${brand.dashboardUrl}/portfolio`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#cfcfcf;">
        Your copy trade purchase has been <strong style="color:#d4af37;">confirmed and activated</strong>.
        Value updates run daily during the trade duration, and the trade will complete automatically at the end date.
      </p>
      ${detailsTable([
        ['Strategy', tradeTitle],
        ['Investment', formatMoney(initialInvestment)],
        ['Duration', `${duration} day${Number(duration) === 1 ? '' : 's'}`],
        ['Risk level', String(risk || '-')],
        ['Status', 'Active'],
        ['Reference', referenceId],
        ['Activated', formatDate(createdAt)],
      ])}
    `,
  });
  const text = `Dear ${firstName || 'Valued Client'},

Your copy trade purchase has been confirmed and activated.

Strategy: ${tradeTitle}
Investment: ${formatMoney(initialInvestment)}
Duration: ${duration} day(s)
Risk level: ${risk || '-'}
Status: Active
Reference: ${referenceId}
Activated: ${formatDate(createdAt)}

View portfolio: ${brand.dashboardUrl}/portfolio

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export function copytradeCompletedEmail({
  firstName,
  tradeTitle,
  initialInvestment,
  finalValue,
  profitLoss,
  isProfit,
  roiPercent,
  referenceId,
  completedAt,
}) {
  const outcome = isProfit ? 'profit' : 'loss';
  const subject = `Copy trade completed — ${tradeTitle}`;
  const html = layout({
    title: 'Copy Trade Completed',
    preheader: `Your ${tradeTitle} copy trade has ended. Proceeds credited as USDT.`,
    greetingName: firstName,
    ctaLabel: 'View portfolio',
    ctaUrl: `${brand.dashboardUrl}/portfolio`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#cfcfcf;">
        Your copy trade has reached the end of its scheduled duration and has been
        <strong style="color:#d4af37;">automatically completed</strong>.
        The final value has been credited to your account as <strong>USDT</strong>.
      </p>
      ${detailsTable([
        ['Strategy', tradeTitle],
        ['Initial investment', formatMoney(initialInvestment)],
        ['Final value', formatMoney(finalValue)],
        ['Profit / Loss', `${formatMoney(profitLoss)} (${outcome})`],
        ['ROI', `${roiPercent}%`],
        ['Status', 'Completed'],
        ['Reference', referenceId],
        ['Completed', formatDate(completedAt)],
      ])}
      <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#9a9a9a;">
        You can review the updated balance and holdings in your portfolio dashboard.
      </p>
    `,
  });
  const text = `Dear ${firstName || 'Valued Client'},

Your copy trade has reached the end of its scheduled duration and has been automatically completed. The final value has been credited to your account as USDT.

Strategy: ${tradeTitle}
Initial investment: ${formatMoney(initialInvestment)}
Final value: ${formatMoney(finalValue)}
Profit / Loss: ${formatMoney(profitLoss)} (${outcome})
ROI: ${roiPercent}%
Status: Completed
Reference: ${referenceId}
Completed: ${formatDate(completedAt)}

View portfolio: ${brand.dashboardUrl}/portfolio

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export { brand, formatMoney, formatDate };

export function kycApprovedEmail({ firstName }) {
  const subject = 'KYC Approved — Full Access Enabled';
  const html = layout({
    title: 'KYC Approved',
    preheader: 'Your identity verification was approved.',
    greetingName: firstName,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d0d0d0;">
        Your KYC application has been approved. You can now deposit, withdraw, and trade on the platform.
      </p>
    `,
    ctaLabel: 'Go to Dashboard',
    ctaUrl: brand.dashboardUrl,
  });
  const text = `Dear ${firstName || 'Valued Client'},

Your KYC application has been approved. You can now deposit, withdraw, and trade on the platform.

Dashboard: ${brand.dashboardUrl}

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export function kycRejectedEmail({ firstName, rejectionReason }) {
  const subject = 'KYC Application Rejected';
  const reason = rejectionReason || 'Please review your documents and resubmit.';
  const html = layout({
    title: 'KYC Rejected',
    preheader: 'Your KYC application needs attention.',
    greetingName: firstName,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d0d0d0;">
        Unfortunately we could not approve your KYC application.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d0d0d0;">
        <strong style="color:#f0f0f0;">Reason:</strong> ${escapeHtml(reason)}
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#d0d0d0;">
        Please correct the issues and resubmit your documents.
      </p>
    `,
    ctaLabel: 'Resubmit KYC',
    ctaUrl: `${brand.dashboardUrl}/kyc`,
  });
  const text = `Dear ${firstName || 'Valued Client'},

Unfortunately we could not approve your KYC application.

Reason: ${reason}

Please correct the issues and resubmit: ${brand.dashboardUrl}/kyc

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}

export function kycResubmissionEmail({ firstName, notes }) {
  const subject = 'KYC Resubmission Required';
  const detail = notes || 'Please update your documents and resubmit.';
  const html = layout({
    title: 'KYC Resubmission Required',
    preheader: 'Additional information is needed for your KYC.',
    greetingName: firstName,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d0d0d0;">
        We need you to resubmit your KYC application with corrections.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#d0d0d0;">
        <strong style="color:#f0f0f0;">Notes:</strong> ${escapeHtml(detail)}
      </p>
    `,
    ctaLabel: 'Update KYC',
    ctaUrl: `${brand.dashboardUrl}/kyc`,
  });
  const text = `Dear ${firstName || 'Valued Client'},

We need you to resubmit your KYC application with corrections.

Notes: ${detail}

Update KYC: ${brand.dashboardUrl}/kyc

Kind regards,
The ${brand.name} Team`;
  return { subject, html, text };
}
