import {
  applyMailTemplateVars,
} from './admin-test.email';
import {
  MAIL_LOGO_CID,
  escapeHtml,
  messageToHtmlParagraphs,
  resolveMailLocale,
} from './transactional-email.layout';

const SITE_URL = 'https://vote.musicmundial.com';

const COPY = {
  es: {
    thanks: '¡Gracias por ser parte de Music Mundial VOTING!',
    notice:
      'Recibes este correo porque tienes cuenta en Music Mundial VOTING. Si no esperabas este mensaje, puedes ignorarlo.',
    footer: 'Votos, rankings y competencia certificada.',
    defaultCta: 'Ir a votar',
    preheader: 'Nueva votación en Music Mundial VOTING. Entra y vota ahora.',
  },
  en: {
    thanks: 'Thanks for being part of Music Mundial VOTING!',
    notice:
      'You are receiving this email because you have a Music Mundial VOTING account. If you were not expecting this message, you can ignore it.',
    footer: 'Votes, rankings, and certified competition.',
    defaultCta: 'Go vote',
    preheader: 'A new poll on Music Mundial VOTING. Jump in and vote now.',
  },
} as const;

export const toAbsoluteMailUrl = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${SITE_URL}${path}`;
};

export const buildPollNotifyEmail = (input: {
  subject?: string;
  message?: string;
  locale?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  coverImageUrl?: string | null;
  subtitle?: string | null;
  vars?: Record<string, string | null | undefined>;
}) => {
  const locale = resolveMailLocale(input.locale);
  const copy = COPY[locale];
  const vars = input.vars || {};

  const subjectRaw = String(input.subject || '').trim() || `{{pollTitle}} · Music Mundial VOTING`;
  const messageRaw = String(input.message || '').trim();
  const subject = applyMailTemplateVars(subjectRaw, vars);
  const message = applyMailTemplateVars(messageRaw, vars);
  const subtitle = applyMailTemplateVars(String(input.subtitle || '').trim(), vars);
  const pollTitle = String(vars.pollTitle || '').trim();

  const title =
    subject.replace(/\s*·\s*Music Mundial VOTING$/i, '').trim() ||
    (pollTitle
      ? locale === 'en'
        ? `New poll: ${pollTitle}`
        : `Nueva votación: ${pollTitle}`
      : locale === 'en'
        ? 'New poll'
        : 'Nueva votación');

  const ctaUrl = toAbsoluteMailUrl(input.ctaUrl) || SITE_URL;
  const ctaLabel = String(input.ctaLabel || '').trim() || copy.defaultCta;
  const coverImageUrl = toAbsoluteMailUrl(input.coverImageUrl);
  const preheader = applyMailTemplateVars(
    subtitle || copy.preheader.replace('Nueva votación', title).replace('A new poll', title),
    vars,
  );

  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? escapeHtml(subtitle) : '';
  const safePreheader = escapeHtml(preheader);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeCover = coverImageUrl ? escapeHtml(coverImageUrl) : '';
  const safeCoverAlt = escapeHtml(
    pollTitle
      ? `${pollTitle} — vote.musicmundial.com`
      : 'Music Mundial VOTING — vote.musicmundial.com',
  );
  const bodyHtml = message
    ? messageToHtmlParagraphs(message).replace(
        /style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;white-space:pre-wrap;"/g,
        'style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#d4d4d8;white-space:pre-wrap;"',
      )
    : '';

  const text = [
    title,
    subtitle,
    '',
    message,
    '',
    ctaUrl,
    '',
    copy.thanks,
    '',
    copy.notice,
    '',
    'Music Mundial VOTING',
    SITE_URL,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#07070d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${safePreheader}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07070d;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px 40px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td align="left" style="padding:0 8px 14px 8px;font-size:11px;letter-spacing:2.5px;color:#a78bfa;font-weight:700;text-transform:uppercase;">
              Music Mundial VOTING
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#101018;border-radius:18px;overflow:hidden;border:1px solid #1f1f2e;">

          <tr>
            <td style="height:6px;line-height:6px;font-size:0;background:linear-gradient(90deg,#7c3aed 0%,#db2777 50%,#22d3ee 100%);">
              &nbsp;
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 24px 8px 24px;">
              <img src="cid:${MAIL_LOGO_CID}" width="176" height="91" alt="Music Mundial VOTING" style="display:block;border:0;width:176px;height:auto;max-width:176px;margin:0 auto;">
              <div style="margin-top:10px;font-size:11px;letter-spacing:3px;color:#c4b5fd;font-weight:700;text-transform:uppercase;">
                Music Mundial VOTING
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:12px 28px 18px 28px;">
              <h1 style="margin:0;font-size:24px;line-height:1.35;color:#ffffff;font-weight:800;">
                ${safeTitle}
              </h1>
              ${
                safeSubtitle
                  ? `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.4;color:#e9d5ff;font-weight:600;">
                ${safeSubtitle}
              </p>`
                  : ''
              }
            </td>
          </tr>

          ${
            safeCover
              ? `<tr>
            <td align="center" style="padding:0;">
              <a href="${safeCtaUrl}" target="_blank" style="display:block;text-decoration:none;">
                <img
                  src="${safeCover}"
                  alt="${safeCoverAlt}"
                  width="600"
                  style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;"
                >
              </a>
            </td>
          </tr>`
              : ''
          }

          <tr>
            <td style="padding:28px 32px 8px 32px;color:#d4d4d8;font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:26px 32px 10px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#d946ef" style="border-radius:999px;background-color:#d946ef;">
                    <a href="${safeCtaUrl}" target="_blank"
                       style="display:inline-block;padding:14px 42px;font-size:15px;font-weight:800;letter-spacing:0.6px;color:#ffffff;text-decoration:none;border-radius:999px;text-transform:uppercase;">
                      ${safeCtaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:8px 32px 26px 32px;font-size:14px;color:#a1a1aa;font-family:Arial,Helvetica,sans-serif;">
              ${escapeHtml(copy.thanks)}
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 24px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#16161f;border-radius:12px;border:1px solid #27272a;">
                <tr>
                  <td style="padding:14px 16px;font-size:12px;line-height:1.5;color:#71717a;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                    ${escapeHtml(copy.notice)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:28px 16px 6px 16px;font-size:13px;letter-spacing:2px;color:#ffffff;font-weight:800;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
              Music Mundial VOTING
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 16px 8px 16px;font-size:12px;color:#71717a;font-family:Arial,Helvetica,sans-serif;">
              ${escapeHtml(copy.footer)}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 16px 0 16px;font-size:13px;font-family:Arial,Helvetica,sans-serif;">
              <a href="${SITE_URL}" target="_blank" style="color:#e879f9;text-decoration:none;font-weight:600;">
                vote.musicmundial.com
              </a>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, locale, ctaUrl, ctaLabel, coverImageUrl };
};
