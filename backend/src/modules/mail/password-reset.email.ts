const escapeHtml = (value: string) =>
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

export const PASSWORD_RESET_LOGO_CID = 'vmm-logo';

export type MailLocale = 'es' | 'en';

export const resolveMailLocale = (value?: string | null): MailLocale =>
  String(value || '')
    .trim()
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'es';

const COPY = {
  es: {
    greeting: (name: string) => (name ? `Hola ${name}` : 'Hola'),
    subject: 'Recupera tu contraseña · Music Mundial Voting',
    preheader: 'El enlace caduca en 1 hora. Si no fuiste tú, ignora este correo.',
    title: 'Recupera tu contraseña',
    intro: (greeting: string) =>
      `${greeting}, recibimos una solicitud para restablecer la contraseña de tu cuenta.`,
    expiryBody:
      'Pulsa el botón para elegir una nueva. El enlace caduca en <strong style="color:#fde68a;">1 hora</strong>.',
    cta: 'Crear nueva contraseña',
    expiryBadge: 'Válido por 60 minutos',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    security:
      'Si no pediste este cambio, no tienes que hacer nada. Tu cuenta sigue segura y puedes ignorar este correo.',
    footer: 'Votos, rankings y competencia certificada.',
    textIntro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Music Mundial Voting.',
    textLink: 'Abre este enlace para crear una nueva. Caduca en 1 hora:',
    textSecurity: 'Si no pediste este cambio, ignora este correo. Tu cuenta sigue segura.',
  },
  en: {
    greeting: (name: string) => (name ? `Hi ${name}` : 'Hi'),
    subject: 'Reset your password · Music Mundial Voting',
    preheader: "This link expires in 1 hour. If this wasn't you, ignore this email.",
    title: 'Reset your password',
    intro: (greeting: string) =>
      `${greeting}, we received a request to reset the password for your account.`,
    expiryBody:
      'Tap the button to choose a new one. The link expires in <strong style="color:#fde68a;">1 hour</strong>.',
    cta: 'Create new password',
    expiryBadge: 'Valid for 60 minutes',
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    security:
      "If you didn't ask for this change, you don't need to do anything. Your account is still safe and you can ignore this email.",
    footer: 'Votes, rankings, and certified competition.',
    textIntro: 'We received a request to reset the password for your Music Mundial Voting account.',
    textLink: 'Open this link to create a new one. It expires in 1 hour:',
    textSecurity: "If you didn't ask for this change, ignore this email. Your account is still safe.",
  },
} as const;

export const buildPasswordResetEmail = (input: {
  name: string;
  resetUrl: string;
  locale?: string | null;
}) => {
  const locale = resolveMailLocale(input.locale);
  const copy = COPY[locale];
  const safeName = escapeHtml(input.name.trim());
  const safeUrl = escapeHtml(input.resetUrl);
  const greeting = copy.greeting(safeName);
  const subject = copy.subject;
  const text = [
    `${greeting},`,
    '',
    copy.textIntro,
    copy.textLink,
    input.resetUrl,
    '',
    copy.textSecurity,
    '',
    'Music Mundial Voting',
    'https://vote.musicmundial.com',
  ].join('\n');

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#03040d;background-image:linear-gradient(180deg,#050719 0%,#03040d 100%);">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(copy.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#03040d" style="background-color:#03040d;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;">
          <tr>
            <td style="padding:0 8px 18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#c4b5fd;">
              Music Mundial Voting
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
                    <img src="cid:${PASSWORD_RESET_LOGO_CID}" width="88" height="88" alt="Music Mundial Voting" style="display:block;border:0;width:88px;height:88px;margin:0 auto;">
                    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#f0abfc;">
                      Certified Competition
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 36px 0;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
                    <h1 style="margin:0;font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;">
                      ${escapeHtml(copy.title)}
                    </h1>
                    <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                      ${copy.intro(greeting)}
                    </p>
                    <p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;">
                      ${copy.expiryBody}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:28px 36px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#d946ef" style="border-radius:16px;background-color:#d946ef;box-shadow:0 12px 30px rgba(217,70,239,0.35);">
                          <a href="${safeUrl}" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                            ${escapeHtml(copy.cta)}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 36px 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;display:inline-block;padding:8px 14px;border-radius:999px;background-color:rgba(251,191,36,0.12);border:1px solid rgba(252,211,77,0.28);font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fde68a;">
                      ${escapeHtml(copy.expiryBadge)}
                    </p>
                  </td>
                </tr>
                <tr>
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
                      ${escapeHtml(copy.fallback)}
                    </p>
                    <p style="margin:8px 0 0;word-break:break-all;font-size:12px;line-height:1.6;">
                      <a href="${safeUrl}" style="color:#67e8f9;text-decoration:underline;">${safeUrl}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 36px 36px;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101426" style="background-color:#101426;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
                      <tr>
                        <td style="padding:16px 18px;font-size:13px;line-height:1.6;color:#94a3b8;">
                          ${escapeHtml(copy.security)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 12px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#e2e8f0;">
                Music Mundial Voting
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                ${escapeHtml(copy.footer)}
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

  return { subject, text, html, locale };
};
