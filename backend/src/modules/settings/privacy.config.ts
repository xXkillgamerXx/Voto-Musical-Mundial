export const PRIVACY_REDIS_KEY = 'app:settings:privacy';

export type PrivacyLocaleContent = {
  title: string;
  intro: string;
  bodyHtml: string;
};

export type PrivacySettings = {
  es: PrivacyLocaleContent;
  en: PrivacyLocaleContent;
  updatedAt: string | null;
};

const sectionHtml = (title: string, text: string) =>
  `<h2>${title}</h2><p>${text}</p>`;

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  es: {
    title: 'Política de privacidad',
    intro:
      'Esta política explica qué datos recogemos en Music Mundial VOTING, para qué los usamos y cómo puedes ejercer tus derechos.',
    bodyHtml: [
      sectionHtml(
        '1. Datos que recopilamos',
        'Podemos recopilar datos de registro (nombre, correo, username, país), actividad en la plataforma (votos, puntos, misiones), información técnica básica del dispositivo o navegador, y datos que nos proporciones al contactarnos.',
      ),
      sectionHtml(
        '2. Cómo usamos tus datos',
        'Usamos tus datos para crear y gestionar tu cuenta, permitir votaciones y recompensas, mejorar la seguridad de la plataforma, detectar abuso o fraude, y enviarte notificaciones relacionadas con el servicio cuando corresponda.',
      ),
      sectionHtml(
        '3. Conservación y seguridad',
        'Conservamos tus datos mientras tu cuenta esté activa o el tiempo necesario para operar el servicio y cumplir obligaciones legales. Aplicamos medidas razonables para proteger la información frente a acceso no autorizado.',
      ),
      sectionHtml(
        '4. Compartición',
        'No vendemos tus datos personales. Podemos compartir información con proveedores que nos ayudan a operar el servicio (por ejemplo, infraestructura o notificaciones), siempre bajo controles adecuados, o cuando la ley lo exija.',
      ),
      sectionHtml(
        '5. Tus derechos y cambios',
        'Puedes solicitar acceso, corrección o eliminación de tus datos contactándonos a través de los canales oficiales. Podemos actualizar esta política; la versión vigente se publica en esta página.',
      ),
    ].join(''),
  },
  en: {
    title: 'Privacy policy',
    intro:
      'This policy explains what data we collect on Music Mundial VOTING, how we use it, and how you can exercise your rights.',
    bodyHtml: [
      sectionHtml(
        '1. Data we collect',
        'We may collect registration data (name, email, username, country), platform activity (votes, points, missions), basic technical information from your device or browser, and information you provide when contacting us.',
      ),
      sectionHtml(
        '2. How we use your data',
        'We use your data to create and manage your account, enable voting and rewards, improve platform security, detect abuse or fraud, and send service-related notifications when appropriate.',
      ),
      sectionHtml(
        '3. Retention and security',
        'We keep your data while your account is active or as long as needed to operate the service and meet legal obligations. We apply reasonable measures to protect information against unauthorized access.',
      ),
      sectionHtml(
        '4. Sharing',
        'We do not sell your personal data. We may share information with providers that help us operate the service (for example infrastructure or notifications), under appropriate controls, or when required by law.',
      ),
      sectionHtml(
        '5. Your rights and changes',
        'You may request access, correction, or deletion of your data through official channels. We may update this policy; the current version is published on this page.',
      ),
    ].join(''),
  },
  updatedAt: null,
};

export const sanitizePrivacyHtml = (value: string) =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|meta|style)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

const normalizeLocale = (value: any, fallback: PrivacyLocaleContent): PrivacyLocaleContent => ({
  title: String(value?.title || fallback.title).trim() || fallback.title,
  intro: String(value?.intro || fallback.intro).trim() || fallback.intro,
  bodyHtml: sanitizePrivacyHtml(String(value?.bodyHtml || fallback.bodyHtml)),
});

export const normalizePrivacySettings = (value: any): PrivacySettings => ({
  es: normalizeLocale(value?.es, DEFAULT_PRIVACY_SETTINGS.es),
  en: normalizeLocale(value?.en, DEFAULT_PRIVACY_SETTINGS.en),
  updatedAt: value?.updatedAt ? String(value.updatedAt) : null,
});
