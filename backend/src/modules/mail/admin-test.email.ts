import {
  buildTransactionalEmail,
  messageToHtmlParagraphs,
  resolveMailLocale,
} from './transactional-email.layout';

const COPY = {
  es: {
    defaultSubject: 'Prueba de correo · Music Mundial VOTING',
    preheader: 'Correo de prueba enviado desde el panel de administración.',
    defaultTitle: 'Correo de prueba',
    defaultMessage:
      'Este es un correo de prueba enviado desde el panel de administración de Music Mundial VOTING.\n\nSi lo ves en Mailtrap con el diseño correcto, SMTP funciona bien.',
    cta: 'Ir a Music Mundial VOTING',
    notice:
      'Este mensaje fue generado manualmente desde el admin. Si no esperabas este correo, puedes ignorarlo con tranquilidad.',
    broadcastSubject: 'Comunicado · Music Mundial VOTING',
    broadcastPreheader: 'Mensaje del equipo de Music Mundial VOTING.',
    broadcastTitle: 'Comunicado',
    broadcastNotice:
      'Recibes este correo porque tienes cuenta en Music Mundial VOTING. Si no esperabas este mensaje, puedes ignorarlo.',
    pollCta: 'Ir a votar',
  },
  en: {
    defaultSubject: 'Test email · Music Mundial VOTING',
    preheader: 'Test email sent from the admin panel.',
    defaultTitle: 'Test email',
    defaultMessage:
      'This is a test email sent from the Music Mundial VOTING admin panel.\n\nIf you see it in Mailtrap with the correct design, SMTP is working.',
    cta: 'Go to Music Mundial VOTING',
    notice:
      'This message was sent manually from the admin panel. If you were not expecting it, you can safely ignore it.',
    broadcastSubject: 'Announcement · Music Mundial VOTING',
    broadcastPreheader: 'A message from the Music Mundial VOTING team.',
    broadcastTitle: 'Announcement',
    broadcastNotice:
      'You are receiving this email because you have a Music Mundial VOTING account. If you were not expecting it, you can safely ignore it.',
    pollCta: 'Go vote',
  },
} as const;

const SITE_URL = 'https://vote.musicmundial.com';

export const applyMailTemplateVars = (
  template: string,
  vars: Record<string, string | null | undefined>,
) =>
  String(template || '')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
      const value = String(vars[key] ?? '').trim();
      return value;
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();

export const buildAdminTestEmail = (input: {
  subject?: string;
  message?: string;
  locale?: string | null;
  mode?: 'test' | 'broadcast';
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  vars?: Record<string, string | null | undefined>;
}) => {
  const locale = resolveMailLocale(input.locale);
  const copy = COPY[locale];
  const isBroadcast = input.mode === 'broadcast';
  const vars = input.vars || {};

  const subjectRaw =
    String(input.subject || '').trim() ||
    (isBroadcast ? copy.broadcastSubject : copy.defaultSubject);
  const messageRaw = String(input.message || '').trim() || copy.defaultMessage;

  const subject = applyMailTemplateVars(subjectRaw, vars);
  const message = applyMailTemplateVars(messageRaw, vars);
  const title =
    subject.replace(/ · Music Mundial VOTING$/i, '').replace(/ · Music Mundial Voting$/i, '').trim() ||
    (isBroadcast ? copy.broadcastTitle : copy.defaultTitle);
  const notice = isBroadcast ? copy.broadcastNotice : copy.notice;
  const preheader = isBroadcast ? copy.broadcastPreheader : copy.preheader;

  const ctaUrl = String(input.ctaUrl || '').trim() || SITE_URL;
  const ctaLabel =
    String(input.ctaLabel || '').trim() ||
    (ctaUrl !== SITE_URL ? copy.pollCta : copy.cta);

  const text = [
    title,
    '',
    message,
    '',
    ctaUrl,
    '',
    notice,
    '',
    'Music Mundial VOTING',
  ].join('\n');

  const html = buildTransactionalEmail({
    locale,
    preheader: applyMailTemplateVars(preheader, vars),
    title,
    bodyHtml: messageToHtmlParagraphs(message),
    cta: { label: ctaLabel, url: ctaUrl },
    notice,
  });

  return { subject, text, html, locale, ctaUrl, ctaLabel };
};
