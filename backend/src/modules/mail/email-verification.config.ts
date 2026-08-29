export const EMAIL_VERIFICATION_COPY_REDIS_KEY = 'app:settings:email_verification_copy';

export type EmailVerificationLocaleCopy = {
  subject: string;
  preheader: string;
  title: string;
  /** Use {{name}} for the user display name. */
  intro: string;
  expiryBody: string;
  expiryBadge: string;
  security: string;
};

export type EmailVerificationCopySettings = {
  es: EmailVerificationLocaleCopy;
  en: EmailVerificationLocaleCopy;
  updatedAt: string | null;
};

export const DEFAULT_EMAIL_VERIFICATION_COPY: EmailVerificationCopySettings = {
  es: {
    subject: 'Tu código de verificación · Music Mundial VOTING',
    preheader: 'Usa este código para activar tu cuenta. Caduca en 15 minutos.',
    title: 'Verifica tu correo',
    intro: 'Hola{{name}}, para activar tu cuenta en Music Mundial VOTING introduce este código:',
    expiryBody: 'El código caduca en 15 minutos.',
    expiryBadge: 'Válido por 15 minutos',
    security:
      'Si no creaste esta cuenta, ignora este correo. Nadie podrá usarla sin el código.',
  },
  en: {
    subject: 'Your verification code · Music Mundial VOTING',
    preheader: 'Use this code to activate your account. It expires in 15 minutes.',
    title: 'Verify your email',
    intro: 'Hi{{name}}, to activate your Music Mundial VOTING account enter this code:',
    expiryBody: 'This code expires in 15 minutes.',
    expiryBadge: 'Valid for 15 minutes',
    security:
      "If you didn't create this account, ignore this email. Nobody can use it without the code.",
  },
  updatedAt: null,
};

const pickString = (value: unknown, fallback: string) => {
  const next = String(value ?? '').trim();
  return next || fallback;
};

export const normalizeEmailVerificationCopy = (
  input?: Partial<EmailVerificationCopySettings> | null,
): EmailVerificationCopySettings => {
  const defaults = DEFAULT_EMAIL_VERIFICATION_COPY;
  const normalizeLocale = (
    locale: 'es' | 'en',
    value?: Partial<EmailVerificationLocaleCopy> | null,
  ): EmailVerificationLocaleCopy => {
    const base = defaults[locale];
    return {
      subject: pickString(value?.subject, base.subject),
      preheader: pickString(value?.preheader, base.preheader),
      title: pickString(value?.title, base.title),
      intro: pickString(value?.intro, base.intro),
      expiryBody: pickString(value?.expiryBody, base.expiryBody),
      expiryBadge: pickString(value?.expiryBadge, base.expiryBadge),
      security: pickString(value?.security, base.security),
    };
  };

  return {
    es: normalizeLocale('es', input?.es),
    en: normalizeLocale('en', input?.en),
    updatedAt: input?.updatedAt ? String(input.updatedAt) : null,
  };
};

export const formatVerificationIntro = (template: string, name: string) => {
  const trimmed = String(name || '').trim();
  const namePart = trimmed ? ` ${trimmed}` : '';
  return String(template || '')
    .replace(/\{\{\s*name\s*\}\}/gi, namePart)
    .replace(/\s+/g, ' ')
    .trim();
};
