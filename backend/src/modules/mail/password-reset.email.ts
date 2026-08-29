import {
  buildTransactionalEmail,
  escapeHtml,
  MAIL_LOGO_CID,
  resolveMailLocale,
} from './transactional-email.layout';

export const PASSWORD_RESET_LOGO_CID = MAIL_LOGO_CID;

export type MailLocale = 'es' | 'en';

export { resolveMailLocale } from './transactional-email.layout';

const COPY = {
  es: {
    greeting: (name: string) => (name ? `Hola ${name}` : 'Hola'),
    subject: 'Recupera tu contraseña · Music Mundial VOTING',
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
    textIntro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Music Mundial VOTING.',
    textLink: 'Abre este enlace para crear una nueva. Caduca en 1 hora:',
    textSecurity: 'Si no pediste este cambio, ignora este correo. Tu cuenta sigue segura.',
  },
  en: {
    greeting: (name: string) => (name ? `Hi ${name}` : 'Hi'),
    subject: 'Reset your password · Music Mundial VOTING',
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
    textIntro: 'We received a request to reset the password for your Music Mundial VOTING account.',
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
    'Music Mundial VOTING',
    'https://vote.musicmundial.com',
  ].join('\n');

  const html = buildTransactionalEmail({
    locale,
    preheader: copy.preheader,
    title: copy.title,
    introHtml: `<p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                      ${escapeHtml(copy.intro(greeting))}
                    </p>
                    <p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;">
                      ${copy.expiryBody}
                    </p>`,
    cta: { label: copy.cta, url: input.resetUrl },
    badge: copy.expiryBadge,
    fallback: { label: copy.fallback, url: input.resetUrl },
    notice: copy.security,
  });

  return { subject, text, html, locale };
};
