export const MAIL_LOGO_CID = 'vmm-logo';

export type MailLocale = 'es' | 'en';

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char] || char;
  });

export const resolveMailLocale = (value?: string | null): MailLocale =>
  String(value || '')
    .trim()
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'es';

export const messageToHtmlParagraphs = (message: string) =>
  message
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;white-space:pre-wrap;">${escapeHtml(block)}</p>`,
    )
    .join('');

const FOOTER = {
  es: 'Votos, rankings y competencia certificada.',
  en: 'Votes, rankings, and certified competition.',
} as const;

export type TransactionalEmailContent = {
  locale?: MailLocale;
  preheader: string;
  title: string;
  introHtml?: string;
  bodyHtml?: string;
  cta?: { label: string; url: string };
  badge?: string;
  fallback?: { label: string; url: string };
  notice?: string;
};

export const buildTransactionalEmail = (content: TransactionalEmailContent) => {
  const locale = content.locale || 'es';
  const safeTitle = escapeHtml(content.title);
  const safePreheader = escapeHtml(content.preheader);
  const introHtml = content.introHtml || '';
  const bodyHtml = content.bodyHtml || '';
  const cta = content.cta;
  const safeCtaUrl = cta ? escapeHtml(cta.url) : '';
  const safeCtaLabel = cta ? escapeHtml(cta.label) : '';
  const badge = content.badge ? escapeHtml(content.badge) : '';
  const fallback = content.fallback;
  const safeFallbackUrl = fallback ? escapeHtml(fallback.url) : '';
  const safeFallbackLabel = fallback ? escapeHtml(fallback.label) : '';
  const notice = content.notice ? escapeHtml(content.notice) : '';

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#03040d;background-image:linear-gradient(180deg,#050719 0%,#03040d 100%);">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${safePreheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#03040d" style="background-color:#03040d;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;">
          <tr>
            <td style="padding:0 8px 18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#c4b5fd;">
              Music Mundial VOTING
            </td>
          </tr>
          <tr>
            <td style="border-radius:28px;overflow:hidden;border:1px solid rgba(196,181,253,0.22);background-color:#080a18;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="6" width="34%" bgcolor="#e879f9" style="font-size:0;line-height:0;">&nbsp;</td>
                  <td height="6" width="33%" bgcolor="#a855f7" style="font-size:0;line-height:0;">&nbsp;</td>
                  <td height="6" width="33%" bgcolor="#22d3ee" style="font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a18" style="background-color:#080a18;">
                <tr>
                  <td align="center" style="padding:36px 32px 8px;">
                    <img src="cid:${MAIL_LOGO_CID}" width="176" height="91" alt="Music Mundial VOTING" style="display:block;border:0;width:176px;height:auto;max-width:176px;margin:0 auto;">
                    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#f0abfc;">
                      Music Mundial VOTING
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 36px 0;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
                    <h1 style="margin:0;font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;">
                      ${safeTitle}
                    </h1>
                    ${introHtml}
                    ${bodyHtml}
                  </td>
                </tr>
                ${
                  cta
                    ? `<tr>
                  <td align="center" style="padding:28px 36px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#d946ef" style="border-radius:16px;background-color:#d946ef;box-shadow:0 12px 30px rgba(217,70,239,0.35);">
                          <a href="${safeCtaUrl}" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                            ${safeCtaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  badge
                    ? `<tr>
                  <td align="center" style="padding:8px 36px 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;display:inline-block;padding:8px 14px;border-radius:999px;background-color:rgba(251,191,36,0.12);border:1px solid rgba(252,211,77,0.28);font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fde68a;">
                      ${badge}
                    </p>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  fallback
                    ? `<tr>
                  <td style="padding:28px 36px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td height="1" bgcolor="#1e293b" style="font-size:0;line-height:0;border-top:1px solid #1e293b;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 36px 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                      ${safeFallbackLabel}
                    </p>
                    <p style="margin:8px 0 0;word-break:break-all;font-size:12px;line-height:1.6;">
                      <a href="${safeFallbackUrl}" style="color:#67e8f9;text-decoration:underline;">${safeFallbackUrl}</a>
                    </p>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  notice
                    ? `<tr>
                  <td style="padding:22px 36px ${fallback ? '0' : '36px'};font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101426" style="background-color:#101426;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
                      <tr>
                        <td style="padding:16px 18px;font-size:13px;line-height:1.6;color:#94a3b8;">
                          ${notice}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  fallback && notice
                    ? `<tr>
                  <td style="padding:0 36px 36px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>`
                    : !notice && (fallback || cta || bodyHtml || introHtml)
                      ? `<tr>
                  <td style="padding:0 36px 36px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>`
                      : ''
                }
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 12px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#e2e8f0;">
                Music Mundial VOTING
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                ${escapeHtml(FOOTER[locale])}
              </p>
              <p style="margin:12px 0 0;font-size:12px;">
                <a href="https://vote.musicmundial.com" style="color:#e879f9;text-decoration:none;font-weight:700;">vote.musicmundial.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
};
