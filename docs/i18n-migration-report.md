# Reporte de migracion i18n

Fecha: 2026-06-25

## Resumen

- Proyecto detectado: Vue 3 + Vite + Firebase Hosting/Firestore/Storage.
- Backend Laravel/PHP: no encontrado. No existen `composer.json`, `artisan`, `routes/*.php`, `resources/views`, `lang/`, controladores PHP ni validaciones backend locales.
- Sistema i18n agregado: `vue-i18n` con locales `es` y `en`.
- Total detectado: 39 archivos con texto visible hardcodeado y 1,406 candidatos/grupos entre textos simples, placeholders, labels, botones, estados, errores, modales, aria labels y bloques legales.
- Textos migrados en esta primera pasada: 77 entradas reutilizables en navegacion, footer, auth y secciones base del home.
- Textos pendientes: textos largos y modulos profundos de paginas publicas, votaciones y admin listados abajo.

## Archivos preparados para i18n

- `src/i18n/index.js`: instancia `createI18n`, persistencia en `localStorage`, `setLocale()` y helper `translate()`.
- `src/i18n/locales/es.js`: catalogo inicial en espanol.
- `src/i18n/locales/en.js`: catalogo inicial en ingles.
- `src/main.js`: registro global de `i18n`.
- `src/components/layout/AppNavbar.vue`: `nav.*`, `common.*`, selector de idioma, `alt` y `aria-label`.
- `src/components/layout/AppFooter.vue`: `footer.*`, `nav.*`, `common.*`, enlaces y textos descriptivos.
- `src/components/auth/AuthModal.vue`: `auth.*`, errores Firebase/Auth, labels, placeholders, estados y botones.
- `src/components/BannerFeatures.vue`: `home.features.*`.
- `src/components/CommunitySection.vue`: `home.community.*`.
- `src/components/MissionsSection.vue`: `home.missions.*`, `common.status.*`, `common.labels.progress`.

## Duplicados reutilizados

- `Inicio`, `Votaciones`, `Artistas`, `Ranking Popularity`, `Salon de la fama`, `Noticias`: `nav.*`.
- `Panel admin`, `Mi perfil`, `Cerrar sesion`, `Registrarse`, `Iniciar sesion`: `nav.*`.
- `2,450 pts`: `common.points`.
- `Correo`, `Contrasena`, `Progreso`: `common.labels.*`.
- `Pendiente`, `En progreso`, `Listo`, `Completada`: `common.status.*`.
- `Awards globales`, nombre de marca y textos de footer: `common.*` y `footer.*`.

## Inventario por modulo

### Layout y autenticacion

| Archivo | Lineas revisadas | Textos / grupos | Claves propuestas |
|---|---:|---:|---|
| `src/components/layout/AppNavbar.vue` | 8-14, 25, 105, 113, 118, 149, 196-221, 235, 293-332 | 24 | `nav.*`, `common.appName*`, `common.tagline`, `common.points`, `common.language.*` |
| `src/components/layout/AppFooter.vue` | 2-14, 17-32, 45-56, 62, 76, 91-114, 121-122 | 22 | `footer.*`, `nav.*`, `common.appName`, `common.tagline` |
| `src/components/auth/AuthModal.vue` | 38-57, 140-188, 194-255, 278-288 | 32 | `auth.*`, `auth.errors.*`, `common.labels.*`, `common.actions.close` |
| `src/pages/RegisterPage.vue` | 9-31, 148-155, 274-356, 429-491, 552-807, 823-846 | 66 | `register.*`, `auth.errors.*`, `countries.*`, `common.labels.*` |
| `src/pages/TermsPage.vue` | 5-53 | 18 | `legal.terms.*` |

### Home y comunidad

| Archivo | Lineas revisadas | Textos / grupos | Claves propuestas |
|---|---:|---:|---|
| `src/components/HeroBanner.vue` | 15-75, 99, 107-110, 195-205, 263-350, 361, 373 | 38 | `home.hero.*`, `home.stats.*`, `artists.fallback.*` |
| `src/components/BannerFeatures.vue` | 2-6 | 8 | `home.features.*` |
| `src/components/MainCategories.vue` | 16-52, 133-134, 173-179 | 20 | `home.categories.*`, `common.actions.voteNow` |
| `src/components/ActivePolls.vue` | 9, 18-24, 40-44, 101-158, 192-252 | 30 | `home.activePolls.*`, `polls.status.*`, `common.actions.*` |
| `src/components/TopRanking.vue` | 73-76, 144-153, 220-245 | 18 | `home.topRanking.*`, `common.labels.followers` |
| `src/components/LiveActivity.vue` | 14-23, 50-68, 73, 126-139, 182-187, 251-321 | 35 | `home.liveActivity.*`, `time.relative.*` |
| `src/components/LatestNews.vue` | 12-36, 67, 146-147, 186-187, 252, 267-323 | 29 | `home.latestNews.*`, `news.*`, `errors.news.*` |
| `src/components/MissionsSection.vue` | 2-40, 48-57, 100-117 | 24 | `home.missions.*`, `common.status.*`, `common.labels.progress` |
| `src/components/CommunitySection.vue` | 2-17, 25-63 | 12 | `home.community.*` |
| `src/components/RewardsHub.vue` | 2-11, 18-94 | 25 | `rewards.*`, `common.points` |
| `src/components/DailyRewardModal.vue` | 56-80, 110-142 | 20 | `rewards.daily.*` |
| `src/components/PollComments.vue` | 8-19, 32-34, 50-117 | 18 | `comments.*`, `common.actions.delete` |

### Paginas publicas

| Archivo | Lineas revisadas | Textos / grupos | Claves propuestas |
|---|---:|---:|---|
| `src/pages/PollsPage.vue` | 14-20, 33, 72, 93-124, 161-178, 207-277, 327-348 | 31 | `polls.list.*`, `polls.status.*`, `errors.polls.*` |
| `src/pages/ListPollPage.vue` | 109-120, 195-216, 275-293, 331-403, 427-458, 479-896, 943-1047 | 79 | `polls.detail.*`, `polls.rounds.*`, `polls.share.*`, `polls.results.*` |
| `src/pages/VersusPollPage.vue` | 17-20, 53-57, 84-117, 169-201, 232-364 | 35 | `polls.versus.*`, `polls.share.*` |
| `src/pages/VersusEmbed.vue` | 58-129 | 16 | `polls.embed.*` |
| `src/pages/ArtistsPage.vue` | 72, 84-91, 104-117, 133, 151-200 | 22 | `artists.list.*`, `artists.search.*`, `common.empty.*` |
| `src/pages/ArtistProfilePage.vue` | 81-93, 110, 128, 246-247, 308, 337, 423-590 | 48 | `artists.profile.*`, `artists.stats.*`, `artists.achievements.*` |
| `src/pages/RankingPopularityPage.vue` | 64, 201, 263-320, 449-545, 470-645 | 44 | `ranking.*`, `ranking.metrics.*`, `ranking.chart.*` |
| `src/pages/NewsPage.vue` | 39, 91, 131-132, 250, 268-289, 341-386 | 31 | `news.*`, `news.search.*`, `news.pagination.*` |
| `src/pages/HallOfFamePage.vue` | 20, 110, 133-140, 156-220 | 24 | `hallOfFame.*`, `common.status.finished` |
| `src/pages/UserProfilePage.vue` | 31, 74-83, 117-154, 182-256 | 27 | `profile.*`, `profile.empty.*`, `common.actions.*` |

### Admin

| Archivo | Lineas revisadas | Textos / grupos | Claves propuestas |
|---|---:|---:|---|
| `src/admin/pages/AdminDashboardPage.vue` | 37-94, 110-117, 164-187, 199-286 | 45 | `admin.nav.*`, `admin.auth.*`, `admin.layout.*` |
| `src/admin/components/AdminDashboardView.vue` | 2-55, 93-152 | 30 | `admin.dashboard.*` |
| `src/admin/components/AdminArtistsView.vue` | 40-61, 73-97, 119-211 | 35 | `admin.artists.*`, `errors.load.*`, `errors.delete.*` |
| `src/admin/components/AdminArtistFormView.vue` | 41, 101-121, 155-215, 229-432 | 56 | `admin.artists.form.*`, `admin.upload.*`, `errors.save.*` |
| `src/admin/components/AdminPollsView.vue` | 41-61, 78-114, 122-194 | 34 | `admin.polls.*`, `errors.polls.*` |
| `src/admin/components/AdminPollFormView.vue` | 41, 98-113, 167-230, 247-430 | 52 | `admin.polls.form.*`, `admin.upload.*` |
| `src/admin/components/AdminPollCategoriesView.vue` | 22-56, 72, 104-167, 197-391 | 58 | `admin.categories.*`, `admin.visuals.*`, `errors.validation.*` |
| `src/admin/components/AdminPollContestantsView.vue` | 63-110, 147-258 | 37 | `admin.contestants.*` |
| `src/admin/components/AdminPollWinnersView.vue` | 81-110, 130-204 | 25 | `admin.winners.*` |
| `src/admin/components/AdminPollRoundView.vue` | 141-154, 240-419, 441-790, 803-963 | 96 | `admin.rounds.*`, `admin.modals.*`, `admin.duels.*` |
| `src/admin/components/AdminPollMonitorView.vue` | 175-190, 249-599, 629-1212 | 118 | `admin.monitor.*`, `admin.votes.*`, `admin.modals.*` |
| `src/admin/components/AdminUsersView.vue` | 29-37, 47-144 | 24 | `admin.users.*` |

## Pendientes de traduccion

- Migrar los textos restantes de paginas grandes: registro, terminos, hero, rankings, noticias, perfiles, votaciones y panel admin.
- Convertir strings generados en scripts (`errorMessage.value`, `confirm()`, labels calculados, estados de Firestore) a `translate('clave')`.
- Revisar feeds externos y datos guardados en Firestore: nombres de artistas, categorias y noticias pueden venir ya traducidos o no traducirse porque son contenido editorial/dinamico.
- Agregar pruebas visuales/manuales para verificar que textos largos en ingles no rompan cards, modales ni tablas admin.

## Posibles problemas

- `vue-i18n@11` requiere Node 22; el proyecto usa Node 20. Se fijo `vue-i18n@10` para compatibilidad local.
- Algunos textos no tienen acentos en el codigo original (`Iniciar sesion`, `Votos Musica Mundial`). Se mantuvieron claves separadas cuando el texto exacto ya existia en UI.
- El backend no existe en el repo; si se agrega Laravel despues, crear `lang/es/*.php` y `lang/en/*.php` y reemplazar mensajes con `__('clave')`.
- Los atributos accesibles (`aria-label`, `alt`, placeholders) deben seguir revisandose en cada archivo pendiente.
