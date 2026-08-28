import {
  buildTransactionalEmail,
  escapeHtml,
  MAIL_LOGO_CID,
  resolveMailLocale,
} from './transactional-email.layout';
import {
  DEFAULT_EMAIL_VERIFICATION_COPY,
  EmailVerificationLocaleCopy,
  formatVerificationIntro,
} from './email-verification.config';

export const EMAIL_VERIFICATION_LOGO_CID = MAIL_LOGO_CID;

export { resolveMailLocale } from './transactional-email.layout';

export const buildEmailVerificationEmail = (input: {
  name: string;
  code: string;
  locale?: string | null;
  copy?: Partial<EmailVerificationLocaleCopy> | null;
}) => {
  const locale = resolveMailLocale(input.locale);
  const defaults = DEFAULT_EMAIL_VERIFICATION_COPY[locale];
  const copy: EmailVerificationLocaleCopy = {
    subject: String(input.copy?.subject || '').trim() || defaults.subject,
    preheader: String(input.copy?.preheader || '').trim() || defaults.preheader,
    title: String(input.copy?.title || '').trim() || defaults.title,
    intro: String(input.copy?.intro || '').trim() || defaults.intro,
    expiryBody: String(input.copy?.expiryBody || '').trim() || defaults.expiryBody,
    expiryBadge: String(input.copy?.expiryBadge || '').trim() || defaults.expiryBadge,
    security: String(input.copy?.security || '').trim() || defaults.security,
  };

  const safeName = escapeHtml(input.name.trim());
  const safeCode = escapeHtml(String(input.code || '').trim() || '123456');
  const introText = formatVerificationIntro(copy.intro, safeName);
  const subject = copy.subject;
  const text = [
    introText,
    '',
    safeCode,
    '',
    copy.expiryBody,
    '',
    copy.security,
    '',
    'Votos Mundial',
    'https://vote.musicmundial.com',
  ].join('\n');

  const html = buildTransactionalEmail({
    locale,
    preheader: copy.preheader,
    title: copy.title,
    introHtml: `<p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                      ${escapeHtml(introText)}
                    </p>
                    <p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;">
                      ${escapeHtml(copy.expiryBody)}
                    </p>`,
    bodyHtml: `<div style="margin:28px 0 8px;text-align:center;">
                      <div style="display:inline-block;padding:18px 28px;border-radius:18px;border:1px solid rgba(34,211,238,0.35);background:rgba(34,211,238,0.08);font-family:Consolas,Monaco,monospace;font-size:36px;font-weight:800;letter-spacing:0.28em;color:#67e8f9;">
                        ${safeCode}
                      </div>
                    </div>`,
    badge: copy.expiryBadge,
    notice: copy.security,
  });

  return { subject, text, html, locale, copy };
};
