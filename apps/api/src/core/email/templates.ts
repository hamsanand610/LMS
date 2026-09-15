/**
 * Phase 1 transactional templates rendered in code. The notifications module (Phase 2) moves
 * templates into the database with client overrides; the variables below stay the same.
 */
export interface TemplateBrand {
  brandName: string;
  footerText: string;
  supportEmail: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function layout(brand: TemplateBrand, title: string, bodyHtml: string): string {
  const footer = [
    brand.footerText,
    brand.supportEmail ? `Need help? Contact ${brand.supportEmail}` : '',
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2430">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #d9dfe6;border-radius:8px">
<tr><td style="padding:24px 28px;border-bottom:1px solid #eaeef3;font-size:18px;font-weight:600">${escapeHtml(brand.brandName)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55"><h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eaeef3;font-size:12px;color:#5b6775">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#0b6e4f;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(label)}</a></p><p style="font-size:13px;color:#5b6775">If the button does not work, open this link: <br>${escapeHtml(url)}</p>`;
}

/**
 * The institute's own wording for one email, resolved from the template store (DP-A33). When it is
 * absent the function's own default is used, so a send never depends on a row existing.
 */
export interface TemplateWording {
  subject: string;
  body: string;
}

/** Turns a plain-text message into the paragraphs the layout expects. */
function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function invitationEmail(
  brand: TemplateBrand,
  input: { name: string; url: string; expiresInHours: number; roleNames: string[] },
  wording?: TemplateWording,
) {
  const roles = input.roleNames.length ? ` as ${input.roleNames.join(', ')}` : '';
  const message =
    wording?.body ??
    `Hello ${input.name},\n\nYou have been invited to ${brand.brandName}${roles}. Set your password to activate your account.`;
  const text = `${message}\n\n${input.url}\n\nThe link expires in ${input.expiresInHours} hours.\n`;
  const html = layout(
    brand,
    `You are invited to ${brand.brandName}`,
    `${paragraphs(message)}${button(input.url, 'Activate my account')}<p style="font-size:13px;color:#5b6775">The link expires in ${input.expiresInHours} hours.</p>`,
  );
  return { subject: wording?.subject ?? `Your invitation to ${brand.brandName}`, text, html };
}

export function passwordResetEmail(
  brand: TemplateBrand,
  input: { name: string; url: string; expiresInMinutes: number },
  wording?: TemplateWording,
) {
  const message =
    wording?.body ?? `Hello ${input.name},\n\nUse the button below to set a new password.`;
  const text = `${message}\n\n${input.url}\n\nThe link expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.\n`;
  const html = layout(
    brand,
    'Reset your password',
    `${paragraphs(message)}${button(input.url, 'Set a new password')}<p style="font-size:13px;color:#5b6775">The link expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
  );
  return { subject: wording?.subject ?? `Reset your ${brand.brandName} password`, text, html };
}

export function passwordChangedEmail(
  brand: TemplateBrand,
  input: { name: string },
  wording?: TemplateWording,
) {
  const message =
    wording?.body ??
    `Hello ${input.name},\n\nYour ${brand.brandName} password was changed and all other sessions were signed out. If this was not you, reset your password immediately.`;
  return {
    subject: wording?.subject ?? `Your ${brand.brandName} password was changed`,
    text: `${message}\n`,
    html: layout(brand, 'Your password was changed', paragraphs(message)),
  };
}

/**
 * Generic delivery for an in-app notification that the recipient also wants by email
 * (announcements, batch news, grading results). The body is plain text written by staff, so the
 * institute's wording supplies only the greeting around it.
 */
export function notificationEmail(
  brand: TemplateBrand,
  input: { name: string; title: string; body: string; link: string | null },
  wording?: TemplateWording,
) {
  const absolute = input.link && /^https?:\/\//.test(input.link) ? input.link : null;
  const greeting = wording?.body ?? `Hello ${input.name},`;
  const text = `${greeting}\n\n${input.title}\n\n${input.body}\n${absolute ? `\n${absolute}\n` : ''}`;
  const html = layout(
    brand,
    input.title,
    `${paragraphs(greeting)}${paragraphs(input.body)}${absolute ? button(absolute, 'Open in the portal') : ''}`,
  );
  return { subject: wording?.subject ?? `${input.title} · ${brand.brandName}`, text, html };
}
