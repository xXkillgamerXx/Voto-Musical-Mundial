import {
  buildTransactionalEmail,
  escapeHtml,
  MAIL_LOGO_CID,
  resolveMailLocale,
} from './transactional-email.layout';

export const ACCOUNT_DELETION_LOGO_CID = MAIL_LOGO_CID;

const COPY = {
  es: {
    greeting: (name: string) => (name ? `Hola ${name}` : 'Hola'),
    subject: 'Confirma la eliminación de tu cuenta · Music Mundial',
    preheader: 'El enlace caduca en 48 horas. Si no fuiste tú, ignora este correo.',
    title: 'Eliminar cuenta y datos',
    intro: (greeting: string) =>
      `${greeting}, recibimos una solicitud para eliminar permanentemente tu cuenta de Music Mundial.`,
    body: 'Si confirmas, borraremos tu perfil, puntos, tokens push y datos personales asociados. Esta acción no se puede deshacer.',
    expiryBody:
      'Pulsa el botón para confirmar. El enlace caduca en <strong style="color:#fde68a;">48 horas</strong>.',
    cta: 'Confirmar eliminación',
    expiryBadge: 'Válido por 48 horas',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    security:
      'Si no pediste eliminar la cuenta, ignora este correo. Tu cuenta seguirá activa.',
    textIntro: 'Recibimos una solicitud para eliminar tu cuenta de Music Mundial.',
    textLink: 'Abre este enlace para confirmar. Caduca en 48 horas:',
    textSecurity: 'Si no pediste esto, ignora el correo. Tu cuenta sigue activa.',
  },
  en: {
    greeting: (name: string) => (name ? `Hi ${name}` : 'Hi'),
    subject: 'Confirm account deletion · Music Mundial',
    preheader: "This link expires in 48 hours. If this wasn't you, ignore this email.",
    title: 'Delete account and data',
    intro: (greeting: string) =>
      `${greeting}, we received a request to permanently delete your Music Mundial account.`,
    body: 'If you confirm, we will delete your profile, points, push tokens, and associated personal data. This cannot be undone.',
    expiryBody:
      'Tap the button to confirm. The link expires in <strong style="color:#fde68a;">48 hours</strong>.',
    cta: 'Confirm deletion',
    expiryBadge: 'Valid for 48 hours',
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    security:
      "If you didn't ask to delete the account, ignore this email. Your account will stay active.",
    textIntro: 'We received a request to delete your Music Mundial account.',
    textLink: 'Open this link to confirm. It expires in 48 hours:',
    textSecurity: "If you didn't ask for this, ignore the email. Your account stays active.",
  },
} as const;

export const buildAccountDeletionEmail = (input: {
  name: string;
  confirmUrl: string;
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
    copy.body,
    copy.textLink,
    input.confirmUrl,
    '',
    copy.textSecurity,
    '',
    'Music Mundial',
    'https://www.musicmundial.com/',
  ].join('\n');

  const html = buildTransactionalEmail({
    locale,
    preheader: copy.preheader,
    title: copy.title,
    introHtml: `<p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                      ${escapeHtml(copy.intro(greeting))}
                    </p>
                    <p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;">
                      ${escapeHtml(copy.body)}
                    </p>
                    <p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:#94a3b8;">
                      ${copy.expiryBody}
                    </p>`,
    cta: { label: copy.cta, url: input.confirmUrl },
    badge: copy.expiryBadge,
    fallback: { label: copy.fallback, url: input.confirmUrl },
    notice: copy.security,
  });

  return { subject, text, html, locale };
};
