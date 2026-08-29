export const TERMS_REDIS_KEY = 'app:settings:terms';

export type TermsLocaleContent = {
  title: string;
  intro: string;
  bodyHtml: string;
};

export type TermsSettings = {
  es: TermsLocaleContent;
  en: TermsLocaleContent;
  updatedAt: string | null;
};

const sectionHtml = (title: string, text: string) =>
  `<h2>${title}</h2><p>${text}</p>`;

export const DEFAULT_TERMS_SETTINGS: TermsSettings = {
  es: {
    title: 'Términos y condiciones',
    intro:
      'Al usar Music Mundial VOTING aceptas estas reglas básicas para mantener una comunidad segura, justa y transparente.',
    bodyHtml: [
      sectionHtml(
        '1. Uso de la plataforma',
        'Debes usar la plataforma de forma responsable. No está permitido manipular votaciones, automatizar acciones, crear cuentas falsas o afectar la experiencia de otros usuarios.',
      ),
      sectionHtml(
        '2. Cuentas de usuario',
        'Eres responsable de mantener segura tu cuenta, correo y contraseña. Podemos limitar o suspender cuentas si detectamos abuso, fraude o actividad sospechosa.',
      ),
      sectionHtml(
        '3. Votos, puntos y recompensas',
        'Los votos, puntos, misiones, rachas y recompensas pueden ajustarse si se detectan errores, abuso, duplicación o actividad automática.',
      ),
      sectionHtml(
        '4. Datos personales',
        'Usamos tus datos de registro para iniciar sesión, guardar tu progreso, validar tu cuenta y mejorar la experiencia dentro de la plataforma.',
      ),
      sectionHtml(
        '5. Cambios',
        'Podemos actualizar estos términos cuando sea necesario. Si continúas usando la plataforma, aceptas la versión vigente.',
      ),
    ].join(''),
  },
  en: {
    title: 'Terms and conditions',
    intro:
      'By using Music Mundial VOTING you accept these basic rules to keep the community safe, fair, and transparent.',
    bodyHtml: [
      sectionHtml(
        '1. Platform use',
        'You must use the platform responsibly. Manipulating polls, automating actions, creating fake accounts, or affecting other users’ experience is not allowed.',
      ),
      sectionHtml(
        '2. User accounts',
        'You are responsible for keeping your account, email, and password secure. We may limit or suspend accounts if we detect abuse, fraud, or suspicious activity.',
      ),
      sectionHtml(
        '3. Votes, points, and rewards',
        'Votes, points, missions, streaks, and rewards may be adjusted if errors, abuse, duplication, or automated activity are detected.',
      ),
      sectionHtml(
        '4. Personal data',
        'We use your registration data to sign you in, save your progress, validate your account, and improve your platform experience.',
      ),
      sectionHtml(
        '5. Changes',
        'We may update these terms when necessary. If you continue using the platform, you accept the current version.',
      ),
    ].join(''),
  },
  updatedAt: null,
};

export const sanitizeTermsHtml = (value: string) =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|meta|style)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

const normalizeLocale = (value: any, fallback: TermsLocaleContent): TermsLocaleContent => ({
  title: String(value?.title || fallback.title).trim() || fallback.title,
  intro: String(value?.intro || fallback.intro).trim() || fallback.intro,
  bodyHtml: sanitizeTermsHtml(String(value?.bodyHtml || fallback.bodyHtml)),
});

export const normalizeTermsSettings = (value: any): TermsSettings => ({
  es: normalizeLocale(value?.es, DEFAULT_TERMS_SETTINGS.es),
  en: normalizeLocale(value?.en, DEFAULT_TERMS_SETTINGS.en),
  updatedAt: value?.updatedAt ? String(value.updatedAt) : null,
});
