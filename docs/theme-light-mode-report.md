# Reporte de tema claro / oscuro

Fecha: 2026-06-25

## Resumen

- Sistema centralizado agregado en `src/theme/index.js`.
- Tema activo aplicado en `html[data-theme="dark|light"]`.
- Persistencia con `localStorage` usando la clave `vmm-theme`.
- Cambio dinamico sin recargar pagina mediante `ThemeToggle`.
- Tema por defecto: preferencia del navegador; fallback `dark`.
- Build verificado con `npm run build`.

## Archivos principales preparados

- `src/theme/index.js`: estado global, `setTheme()`, `toggleTheme()`, `applyTheme()`.
- `src/components/theme/ThemeToggle.vue`: boton accesible para alternar light/dark.
- `src/App.vue`: shell semantico (`app-shell`, `app-background`, `app-top-divider`) y toggle flotante en paginas sin navbar.
- `src/components/layout/AppNavbar.vue`: toggle integrado en desktop y menu movil.
- `src/i18n/locales/es.js`: textos de tema en espanol.
- `src/i18n/locales/en.js`: textos de tema en ingles.
- `src/style.css`: tokens CSS, variables light/dark y capa global de compatibilidad para Tailwind oscuro.

## Tokens creados

- Base: `--theme-bg`, `--theme-bg-soft`, `--theme-text`, `--theme-text-strong`, `--theme-text-muted`, `--theme-text-subtle`.
- Superficies: `--theme-surface`, `--theme-surface-raised`, `--theme-surface-muted`, `--theme-surface-hover`.
- Bordes y formularios: `--theme-border`, `--theme-border-strong`, `--theme-input-bg`, `--theme-input-focus`.
- Estados: `--theme-danger-*`, `--theme-success-*`, `--theme-warning-*`.
- Marca y efectos: `--theme-brand-*`, `--theme-overlay`, `--theme-shadow`, `--theme-app-gradient`.

## Componentes compatibles con ambos temas

Compatibilidad directa o por capa global de variables/overrides:

- Layout: `App.vue`, `AppNavbar.vue`, `AppFooter.vue`.
- Auth/modal: `AuthModal.vue`.
- Home: `HeroBanner.vue`, `BannerFeatures.vue`, `MainCategories.vue`, `ActivePolls.vue`, `TopRanking.vue`, `LiveActivity.vue`, `LatestNews.vue`, `MissionsSection.vue`, `CommunitySection.vue`, `RewardsHub.vue`, `DailyRewardModal.vue`, `PollComments.vue`, `PopularPolls.vue`.
- Paginas publicas: `PollsPage.vue`, `ListPollPage.vue`, `VersusPollPage.vue`, `VersusEmbed.vue`, `ArtistsPage.vue`, `ArtistProfilePage.vue`, `RankingPopularityPage.vue`, `NewsPage.vue`, `HallOfFamePage.vue`, `UserProfilePage.vue`, `RegisterPage.vue`, `TermsPage.vue`.
- Admin: `AdminDashboardPage.vue`, `AdminDashboardView.vue`, `AdminArtistsView.vue`, `AdminArtistFormView.vue`, `AdminPollsView.vue`, `AdminPollFormView.vue`, `AdminPollCategoriesView.vue`, `AdminPollContestantsView.vue`, `AdminPollWinnersView.vue`, `AdminPollRoundView.vue`, `AdminPollMonitorView.vue`, `AdminUsersView.vue`.
- Terceros: `vue-tel-input` cubierto con selectores globales para input, dropdown y opciones.

## Colores hardcodeados encontrados

El escaneo recursivo encontro patrones oscuros repetidos en 40 archivos Vue. Los mas frecuentes:

- Superficies: `bg-[#03040d]`, `bg-[#050713]`, `bg-[#050716]`, `bg-[#080a18]`, `bg-[#090b19]`, `bg-[#130f25]`, `bg-slate-950/*`, `bg-slate-900/*`.
- Transparencias oscuras: `bg-white/3`, `bg-white/5`, `bg-white/8`, `bg-white/10`, `bg-black/20`, `bg-black/35`, `bg-black/80`.
- Texto: `text-white`, `text-slate-100`, `text-slate-200`, `text-slate-300`, `text-slate-400`, `text-slate-500`.
- Bordes: `border-white/10`, `border-white/15`, `border-white/20`, `divide-white/10`.
- Formularios: `bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/8`.
- Estados: `bg-red-500/10`, `bg-emerald-500/10`, `bg-amber-300/10`, `bg-fuchsia-400/10`.
- Sombras: `shadow-black/*`, `shadow-fuchsia-950/*`, `shadow-violet-950/*`.
- Gradientes arbitrarios: `bg-[radial-gradient(...)]`, `bg-[linear-gradient(...)]`.

Archivos con mayor densidad de patrones hardcodeados:

- `src/admin/components/AdminPollMonitorView.vue`
- `src/admin/components/AdminPollRoundView.vue`
- `src/pages/ListPollPage.vue`
- `src/pages/RankingPopularityPage.vue`
- `src/pages/RegisterPage.vue`
- `src/pages/PollsPage.vue`
- `src/admin/components/AdminPollFormView.vue`
- `src/admin/components/AdminArtistFormView.vue`
- `src/admin/components/AdminPollCategoriesView.vue`
- `src/pages/ArtistProfilePage.vue`

## Como se corrigieron

- Se reemplazo el shell principal por clases semanticas basadas en variables.
- Se agrego una capa `html[data-theme="light"]` que reinterpreta los patrones Tailwind dark-only mas comunes.
- Se ajustaron textos, bordes, fondos, inputs, selects, placeholders, modales, overlays, tablas, estados, sombras y dropdowns de terceros.
- Los botones con gradientes de marca conservan texto blanco para mantener contraste.
- Los estados de error/exito/advertencia ahora usan tokens especificos en light mode.

## Componentes que aun necesitan ajustes finos

La app ya soporta light mode globalmente, pero estos modulos deberian tokenizarse manualmente en una segunda pasada para eliminar deuda visual:

- `AdminPollMonitorView.vue` y `AdminPollRoundView.vue`: flujos admin grandes con modales, inputs de votos, estados y tablas.
- `ListPollPage.vue`: resultados, certificado, ganador final y overlays de banners.
- `RegisterPage.vue`: formulario largo y estilos scoped de `vue-tel-input`.
- `RankingPopularityPage.vue`: graficas/cards densas con muchos gradientes.
- `ArtistProfilePage.vue`: cards de perfil, logros y votaciones.
- `HeroBanner.vue` y `ActivePolls.vue`: overlays sobre imagenes pueden requerir revision visual con contenido real.

## Riesgos visuales/accesibilidad

- Algunas imagenes con overlays oscuros pueden verse mas claras en light mode; conviene revisar banners reales de votaciones/artistas.
- Los gradientes arbitrarios se suavizan globalmente en light mode; si un componente usa un gradiente como contenido principal, puede requerir token propio.
- La capa global usa `!important` para neutralizar utilidades Tailwind hardcodeadas. Es efectiva para cobertura completa, pero la mejor evolucion es reemplazar gradualmente esas clases por tokens semanticos.
- Los colores editoriales que vienen de Firestore o contenido externo no se pueden controlar totalmente desde CSS si llegan como HTML/estilos embebidos.
