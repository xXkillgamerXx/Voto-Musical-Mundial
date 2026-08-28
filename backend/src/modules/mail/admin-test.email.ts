import {
  buildTransactionalEmail,
  messageToHtmlParagraphs,
  resolveMailLocale,
} from './transactional-email.layout';

const COPY = {
  es: {
    defaultSubject: 'Prueba de correo · Votos Mundial',
    preheader: 'Correo de prueba enviado desde el panel de administración.',
    defaultTitle: 'Correo de prueba',
    defaultMessage:
      'Este es un correo de prueba enviado desde el panel de administración de Votos Mundial.\n\nSi lo ves en Mailtrap con el diseño correcto, SMTP funciona bien.',
    cta: 'Ir a Votos Mundial',
    notice:
      'Este mensaje fue generado manualmente desde el admin. Si no esperabas este correo, puedes ignorarlo con tranquilidad.',
    broadcastSubject: 'Comunicado · Votos Mundial',
    broadcastPreheader: 'Mensaje del equipo de Votos Mundial.',
    broadcastTitle: 'Comunicado',
    broadcastNotice:
      'Recibes este correo porque tienes cuenta en Votos Mundial. Si no esperabas este mensaje, puedes ignorarlo.',
  },
  en: {
    defaultSubject: 'Test email · Votos Mundial',
    preheader: 'Test email sent from the admin panel.',
    defaultTitle: 'Test email',
    defaultMessage:
      'This is a test email sent from the Votos Mundial admin panel.\n\nIf you see it in Mailtrap with the correct design, SMTP is working.',
    cta: 'Go to Votos Mundial',
    notice:
      'This message was sent manually from the admin panel. If you were not expecting it, you can safely ignore it.',
    broadcastSubject: 'Announcement · Votos Mundial',
    broadcastPreheader: 'A message from the Votos Mundial team.',
    broadcastTitle: 'Announcement',
    broadcastNotice:
      'You are receiving this email because you have a Votos Mundial account. If you were not expecting it, you can safely ignore it.',
  },
} as const;

export const buildAdminTestEmail = (input: {
  subject?: string;
  message?: string;
  locale?: string | null;
  mode?: 'test' | 'broadcast';
}) => {
  const locale = resolveMailLocale(input.locale);
  const copy = COPY[locale];
  const isBroadcast = input.mode === 'broadcast';
  const subject =
    String(input.subject || '').trim() ||
    (isBroadcast ? copy.broadcastSubject : copy.defaultSubject);
  const message = String(input.message || '').trim() || copy.defaultMessage;
  const title =
    subject.replace(/ · Votos Mundial$/i, '').replace(/ · Music Mundial Voting$/i, '').trim() ||
    (isBroadcast ? copy.broadcastTitle : copy.defaultTitle);
  const notice = isBroadcast ? copy.broadcastNotice : copy.notice;
  const preheader = isBroadcast ? copy.broadcastPreheader : copy.preheader;

  const text = [
    title,
    '',
    message,
    '',
    'https://vote.musicmundial.com',
    '',
    notice,
    '',
    'Votos Mundial',
  ].join('\n');

  const html = buildTransactionalEmail({
    locale,
    preheader,
    title,
    bodyHtml: messageToHtmlParagraphs(message),
    cta: { label: copy.cta, url: 'https://vote.musicmundial.com' },
    notice,
  });

  return { subject, text, html, locale };
};
