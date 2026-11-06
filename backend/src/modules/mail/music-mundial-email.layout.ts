import { escapeHtml, MailLocale } from './transactional-email.layout';

// Hosted HTTPS logos (Gmail blocks data:/base64 images and often breaks CID attachments).
const HEADER_SRC =
  process.env.MM_EMAIL_LOGO_HEADER_URL?.trim() ||
  'https://www.musicmundial.com/email/logo-header.png';
const FOOTER_SRC =
  process.env.MM_EMAIL_LOGO_FOOTER_URL?.trim() ||
  'https://www.musicmundial.com/email/logo-footer.png';

export type MusicMundialEmailContent = {
  locale?: MailLocale;
  preheader: string;
  eyebrow?: string;
  titleHtml: string;
  greetingHtml?: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  badge?: string;
  fallback?: { label: string; url: string };
  notice?: string;
  footerNote?: string;
};

/** Light Music Mundial layout (same visual language as emails/welcome-music-mundial.html). */
export const buildMusicMundialEmail = (content: MusicMundialEmailContent) => {
  const locale = content.locale || 'en';
  const safePreheader = escapeHtml(content.preheader);
  const eyebrow = content.eyebrow ? escapeHtml(content.eyebrow) : '';
  const greetingHtml = content.greetingHtml || '';
  const bodyHtml = content.bodyHtml || '';
  const cta = content.cta;
  const safeCtaUrl = cta ? escapeHtml(cta.url) : '';
  const safeCtaLabel = cta ? escapeHtml(cta.label) : '';
  const badge = content.badge ? escapeHtml(content.badge) : '';
  const fallback = content.fallback;
  const safeFallbackUrl = fallback ? escapeHtml(fallback.url) : '';
  const safeFallbackLabel = fallback ? escapeHtml(fallback.label) : '';
  const notice = content.notice ? escapeHtml(content.notice) : '';
  const footerNote =
    content.footerNote ||
    (locale === 'es'
      ? 'Recibes este correo porque hay una cuenta asociada a esta dirección.'
      : "You're receiving this email because an account is linked to this address.");

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Music Mundial</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background: #eef1f6; }
    a { color: #225df5; }
    @media only screen and (max-width: 620px) {
      .mm-card { width: 100% !important; }
      .mm-pad { padding-left: 22px !important; padding-right: 22px !important; }
      .mm-title { font-size: 34px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef1f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${safePreheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f6;">
    <tr>
      <td align="center" style="padding:28px 12px 40px;">
        <table role="presentation" class="mm-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e4e9f0;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background-color:#0c2348;background-image:linear-gradient(105deg, #071433 0%, #0c275c 58%, #12356a 100%);padding:0;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="mm-pad" valign="middle" style="padding:28px 8px 40px 28px;">
                    <img src="${HEADER_SRC}" width="248" height="37" alt="Music Mundial" style="display:block;border:0;width:248px;height:auto;">
                  </td>
                  <td align="right" valign="middle" style="padding:0 14px 0 0;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:124px;line-height:0.8;font-weight:800;color:rgba(186,214,255,0.32);letter-spacing:-0.08em;">M</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mm-pad" style="padding:32px 36px 8px;font-family:Arial,Helvetica,sans-serif;">
              ${
                eyebrow
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#225df5;border-radius:999px;padding:7px 14px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1;font-weight:800;letter-spacing:0.12em;color:#ffffff;">${eyebrow}</span>
                  </td>
                </tr>
              </table>`
                  : ''
              }
              <h1 class="mm-title" style="margin:${eyebrow ? '18px' : '0'} 0 0;font-family:Arial,Helvetica,sans-serif;font-size:40px;line-height:1.08;font-weight:800;letter-spacing:-0.03em;color:#121b2c;">
                ${content.titleHtml}
              </h1>
              ${greetingHtml}
              ${bodyHtml}
              ${
                cta
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
                <tr>
                  <td align="center" bgcolor="#225df5" style="background:#225df5;border-radius:999px;">
                    <a href="${safeCtaUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;">
                      ${safeCtaLabel}&nbsp;&nbsp;&rarr;
                    </a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
              ${
                badge
                  ? `<p style="margin:14px 0 0;display:inline-block;padding:7px 12px;border-radius:999px;background:#eef4ff;border:1px solid #d7e4ff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#225df5;">
                ${badge}
              </p>`
                  : ''
              }
              ${
                fallback
                  ? `<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#657083;">
                ${safeFallbackLabel}
              </p>
              <p style="margin:8px 0 0;word-break:break-all;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;">
                <a href="${safeFallbackUrl}" style="color:#225df5;text-decoration:underline;">${safeFallbackUrl}</a>
              </p>`
                  : ''
              }
              ${
                notice
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;background:#f4f7fb;border-radius:14px;">
                <tr>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#657083;">
                    ${notice}
                  </td>
                </tr>
              </table>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="1" style="height:1px;line-height:1px;font-size:0;background:#e6ebf2;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
              <img src="${FOOTER_SRC}" width="196" height="29" alt="Music Mundial" style="display:block;margin:0 auto;border:0;width:196px;height:auto;">
              <p style="margin:8px 0 0;font-size:13px;line-height:1.4;color:#657083;">
                Music, entertainment &amp; community
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.5;">
                <a href="https://www.musicmundial.com/" style="color:#225df5;text-decoration:none;font-weight:600;">Website</a>
                <span style="color:#94a3b8;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>
                <a href="https://www.musicmundial.com/vote/" style="color:#225df5;text-decoration:none;font-weight:600;">Vote</a>
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
                ${escapeHtml(footerNote)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
