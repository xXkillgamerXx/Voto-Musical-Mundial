export type NewsLocale = 'es' | 'en';

export type SitePageDef = {
  key: string;
  esSlug: string;
  enSlug: string;
  esTitle: string;
  enTitle: string;
  esHtml: string;
  enHtml: string;
};

export const SITE_PAGE_META_KEY = '_vmm_page_key';

export const SITE_PAGES: SitePageDef[] = [
  {
    key: 'about',
    esSlug: 'sobre-nosotros',
    enSlug: 'about-us',
    esTitle: 'Sobre nosotros',
    enTitle: 'About us',
    esHtml: `<h2>Titular del Sitio Web</h2>
<p><strong>Razón Social:</strong> Starflare Group S.A.S</p>
<p><strong>NIT:</strong> 902024591</p>
<p><strong>Denominación comercial:</strong> Music Mundial – Music Mundial News</p>
<p><strong>Domicilio fiscal:</strong> CL 9E NRO 6A-90 PISO 3 PRADOS DEL ESTE, Cúcuta, Norte de Santander, Colombia.</p>
<p><strong>Contacto:</strong> <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a></p>
<p>Music Mundial es un sitio web internacional de noticias de entretenimiento fundado en 2012, creado para ofrecer una cobertura precisa, atractiva y de alta calidad de la industria musical global, el cine y los principales eventos culturales que dan forma a la cultura pop. Desde sus inicios, Music Mundial nació con la misión de informar a las audiencias de todo el mundo y construir un espacio confiable donde los lectores puedan acceder a diversas perspectivas sobre el entretenimiento.</p>
<p>Con más de una década de presencia continua en línea, nuestra plataforma ha consolidado una audiencia fiel que valora la credibilidad y la responsabilidad. Music Mundial publica tanto en español como en inglés, ofreciendo contenido accesible y relevante adaptado a públicos internacionales. Nuestro equipo editorial está conformado por escritores, traductores y analistas culturales con experiencia en música, cine y periodismo de entretenimiento.</p>
<p>Nuestro proceso editorial prioriza la claridad, la transparencia y la precisión. Toda la información es cuidadosamente validada a través de fuentes oficiales, referencias de la industria y revisión editorial. Seguimos comprometidos con el periodismo ético, la independencia y la excelencia informativa.</p>
<p>[contact-form]</p>`,
    enHtml: `<h2>Website &amp; APPs Owner</h2>
<p><strong>Legal Name:</strong> Starflare Group S.A.S</p>
<p><strong>Tax ID (NIT):</strong> 902024591</p>
<p><strong>Trade Name:</strong> Music Mundial – Music Mundial News</p>
<p><strong>Registered Address:</strong> CL 9E NRO 6A-90 PISO 3 PRADOS DEL ESTE, Cúcuta, Norte de Santander, Colombia.</p>
<p><strong>Contact:</strong> <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a></p>
<p>Music Mundial is an international entertainment news site founded in 2012 to deliver accurate, engaging coverage of global music, film and pop culture. We publish in Spanish and English for readers worldwide.</p>
<p>Our editorial process prioritizes clarity, transparency and accuracy. We remain committed to ethical journalism, independence and trustworthy reporting.</p>
<p>[contact-form]</p>`,
  },
  {
    key: 'terms',
    esSlug: 'terminos-y-condiciones',
    enSlug: 'terms-and-conditions',
    esTitle: 'Términos y condiciones',
    enTitle: 'Terms and Conditions',
    esHtml: `<p>¡Bienvenido a Music Mundial!</p>
<p>Estos términos y condiciones establecen las reglas y regulaciones legalmente vinculantes para el uso de los sitios web operados por Starflare Group S.A.S., incluyendo https://www.musicmundial.com/ y sus portales asociados.</p>
<p>El acceso, navegación, registro y uso de este Sitio es totalmente gratuito, condicionado a la aceptación expresa e íntegra de los términos expuestos a continuación.</p>
<h2>Titular del Sitio Web y Datos de Contacto Oficial</h2>
<p>Razón Social: Starflare Group S.A.S. NIT: 902024591. Domicilio fiscal: CL 9E NRO 6A-90 PISO 3 PRADOS DEL ESTE, Cúcuta, Norte de Santander, Colombia. Denominación comercial: Music Mundial. Contacto oficial: <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a></p>
<h2>1. Propiedad Intelectual y Derechos de Autor (Copyright)</h2>
<p>Todo el contenido albergado en este sitio web —incluyendo textos, gráficos, logotipos, iconos, imágenes, clips de audio, descargas digitales, compilaciones de datos y código fuente— es propiedad exclusiva de Starflare Group S.A.S. o de sus proveedores de contenido, y está protegido por las leyes nacionales e internacionales de propiedad intelectual.</p>
<h2>2. Registro de Usuario, Cuentas y Responsabilidad</h2>
<p>El usuario que decida registrarse es responsable de mantener la confidencialidad de sus datos de acceso. Todo contenido publicado por el usuario otorga a Starflare Group S.A.S. una licencia mundial, no exclusiva y gratuita para su visualización y gestión dentro del sitio. El usuario se compromete a un uso lícito de la plataforma.</p>
<h2>3. Exención de Garantías y Limitación de Responsabilidad</h2>
<p>El uso de este sitio web se realiza bajo el propio riesgo del usuario. El contenido se proporciona «tal cual» y «según disponibilidad». Starflare Group S.A.S. no asume responsabilidad por daños derivados del uso de la información o fallas técnicas.</p>
<h2>4. Enlaces a Sitios Web de Terceros</h2>
<p>Nuestros portales pueden incluir enlaces hacia sitios externos. Starflare Group S.A.S. no ejerce control sobre dichos sitios ni asume responsabilidad por sus políticas o contenidos.</p>
<h2>5. Modificaciones de los Términos</h2>
<p>Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. El uso continuado de la plataforma constituirá la aceptación de los nuevos términos.</p>
<h2>6. Legislación Aplicable y Jurisdicción</h2>
<p>Cualquier controversia se regirá por las leyes de la República de Colombia. Las partes se someten a la jurisdicción de los jueces y tribunales competentes de Cúcuta, Norte de Santander.</p>`,
    enHtml: `<p>Welcome to Music Mundial!</p>
<p>These terms set the binding rules for using websites operated by Starflare Group S.A.S., including https://www.musicmundial.com/ and related portals.</p>
<p>Access and use of this Site are free and conditioned on acceptance of these terms.</p>
<h2>Website Owner</h2>
<p>Starflare Group S.A.S. · NIT 902024591 · Cúcuta, Colombia · <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a></p>
<h2>1. Intellectual Property</h2>
<p>All site content is owned by Starflare Group S.A.S. or its providers and protected by applicable copyright laws.</p>
<h2>2. Accounts</h2>
<p>Registered users are responsible for account security and lawful use of the platform.</p>
<h2>3. Disclaimers</h2>
<p>The site is provided “as is”. Starflare Group S.A.S. is not liable for damages arising from use of the service.</p>
<h2>4. Governing Law</h2>
<p>These terms are governed by the laws of Colombia. Disputes are submitted to the courts of Cúcuta, Norte de Santander.</p>`,
  },
  {
    key: 'cookies',
    esSlug: 'cookies',
    enSlug: 'cookies',
    esTitle: 'Cookies',
    enTitle: 'Cookies',
    esHtml: `<h2>Política de Cookies y Tecnologías de Rastreo</h2>
<p>Este sitio web utiliza Cookies y tecnologías de almacenamiento local similares para garantizar la operatividad técnica, recordar preferencias de usuario, recopilar métricas analíticas anónimas y gestionar contenidos publicitarios personalizados a través de redes asociadas (como Google AdSense).</p>
<p>Puedes aceptar, rechazar o configurar cookies desde el aviso de consentimiento del sitio. Si rechazas cookies no esenciales, algunas funciones de medición o publicidad personalizada pueden quedar limitadas.</p>
<p>Para más detalle sobre el tratamiento de datos, consulta nuestra <a href="/es/politica-de-privacidad">Política de privacidad</a>.</p>`,
    enHtml: `<h2>Cookies and tracking technologies</h2>
<p>This website uses cookies and similar local storage technologies for technical operation, remembering preferences, anonymous analytics and personalized ads through partners such as Google AdSense.</p>
<p>You can accept, reject or configure cookies from the site consent banner. Rejecting non-essential cookies may limit analytics or personalized ads.</p>
<p>For more details, see our <a href="/privacy-policy">Privacy Policy</a>.</p>`,
  },
  {
    key: 'privacy',
    esSlug: 'politica-de-privacidad',
    enSlug: 'privacy-policy',
    esTitle: 'Política de privacidad',
    enTitle: 'Privacy Policy',
    esHtml: `<p>En Music Mundial (Starflare Group S.A.S.) respetamos tu privacidad y tratamos los datos personales conforme a la normativa aplicable en Colombia.</p>
<h2>Datos que podemos tratar</h2>
<ul>
<li>Datos de cuenta (nombre, correo, usuario) si te registras.</li>
<li>Datos técnicos de navegación y cookies (IP aproximada, dispositivo, páginas vistas).</li>
<li>Contenido que publiques en comentarios o foro.</li>
<li>Mensajes que nos envíes por contacto o DMCA.</li>
</ul>
<h2>Finalidades</h2>
<p>Operar el sitio, autenticar usuarios, moderar comunidades, medir audiencia, mostrar publicidad (si aceptas) y responder solicitudes de soporte o derechos de autor.</p>
<h2>Conservación y seguridad</h2>
<p>Conservamos los datos el tiempo necesario para las finalidades descritas y aplicamos medidas razonables de seguridad. No vendemos datos personales.</p>
<h2>Contacto</h2>
<p>Para ejercer derechos o consultas de privacidad: <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a>.</p>`,
    enHtml: `<p>At Music Mundial (Starflare Group S.A.S.) we respect your privacy and process personal data under applicable Colombian law.</p>
<h2>Data we may process</h2>
<ul>
<li>Account data if you register.</li>
<li>Technical browsing and cookie data.</li>
<li>Content you post in comments or the forum.</li>
<li>Messages you send for support or DMCA.</li>
</ul>
<h2>Purposes</h2>
<p>Operate the site, authenticate users, moderate communities, measure audience, show ads (if accepted) and respond to support or copyright requests.</p>
<h2>Contact</h2>
<p>Privacy requests: <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a>.</p>`,
  },
  {
    key: 'dmca',
    esSlug: 'dmca',
    enSlug: 'dmca',
    esTitle: 'DMCA',
    enTitle: 'DMCA',
    esHtml: `<p>Sabemos la importancia que es para usted el cuidar sus derechos de autor. A menudo nuestros redactores utilizan fotografías, o quizás letras de canciones que puede que no estés de acuerdo en compartir.</p>
<p>Por favor, si usted tiene alguna duda, quiere que removamos algo de nuestra página web o es el dueño de una fotografía, no dude en escribirnos con el asunto <strong>DMCA</strong> a <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a> o usar nuestra página de <a href="/es/contactanos">contacto</a>.</p>
<p>Agradecemos su paciencia y entendimiento; queremos que todo vaya de la mano de la ley.</p>
<p>[contact-form]</p>`,
    enHtml: `<p>We understand how important copyright protection is. Our editors sometimes use photos or lyrics that rights holders may prefer not to share.</p>
<p>If you need content removed or own a photo used on our site, email us with subject <strong>DMCA</strong> at <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a> or use our <a href="/contact-us">contact</a> page.</p>
<p>Thank you for your patience — we want everything to comply with the law.</p>
<p>[contact-form]</p>`,
  },
  {
    key: 'contact',
    esSlug: 'contactanos',
    enSlug: 'contact-us',
    esTitle: 'Contáctanos',
    enTitle: 'Contact Us',
    esHtml: `<p>Bienvenidos a la sección de contacto de Music Mundial. Aquí puedes escribirnos por email para aclarar dudas sobre el sitio.</p>
<p>Solo estamos aceptando solicitudes de <strong>Soporte</strong>, dudas y <strong>PR</strong> (relaciones públicas). No estamos aceptando nuevas ofertas de compañías de anuncios.</p>
<p>Escríbenos a <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a>.</p>
<p>[contact-form]</p>`,
    enHtml: `<p>Welcome to Music Mundial’s contact page. Email us with questions about the site.</p>
<p>We currently accept <strong>Support</strong>, general questions and <strong>PR</strong> requests. We are not accepting new advertising company offers.</p>
<p>Write to <a href="mailto:hola@musicmundial.com">hola@musicmundial.com</a>.</p>
<p>[contact-form]</p>`,
  },
];

export const CONTACT_FORM_TAG = '[contact-form]';

export const sitePageBySlug = (locale: NewsLocale, slug: string) => {
  const key = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
  return SITE_PAGES.find((page) => (locale === 'en' ? page.enSlug : page.esSlug) === key) || null;
};

export const sitePageByKey = (key: string) => SITE_PAGES.find((page) => page.key === key) || null;

export const sitePageHref = (locale: NewsLocale, key: string) => {
  const page = sitePageByKey(key);
  if (!page) return locale === 'es' ? '/es' : '/';
  const slug = locale === 'en' ? page.enSlug : page.esSlug;
  return locale === 'es' ? `/es/${slug}` : `/${slug}`;
};

export const allSitePageSlugs = () => {
  const slugs = new Set<string>();
  for (const page of SITE_PAGES) {
    slugs.add(page.esSlug);
    slugs.add(page.enSlug);
  }
  return slugs;
};
