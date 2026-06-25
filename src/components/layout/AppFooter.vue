<script setup>
const footerLinks = [
  { title: 'Inicio', href: '/' },
  { title: 'Votaciones', href: '/votaciones' },
  { title: 'Artistas', href: '/artistas' },
  { title: 'Ranking Popularity', href: '/ranking-popularity' },
  { title: 'Salón de la fama', href: '/salon-de-la-fama' },
  { title: 'Noticias', href: '/noticias' },
]

const legalLinks = [
  { title: 'Términos', href: '/terminos-y-condiciones' },
  { title: 'Reglas de voto', href: '/votaciones' },
  { title: 'Panel admin', href: '/admin' },
]

const socialLinks = [
  {
    title: 'Music Mundial en X',
    icon: 'fa-brands fa-x-twitter',
    href: 'https://x.com/MusicMundial',
  },
  {
    title: 'Comunidad Startly',
    icon: 'fa-solid fa-link',
    href: 'https://startlyapp.com/musicmundial',
  },
  {
    title: 'Feed Music Mundial',
    icon: 'fa-solid fa-rss',
    href: 'https://www.musicmundial.com/en/feed/',
  },
]

</script>

<template>
  <footer class="relative z-10 w-full overflow-hidden border-t border-violet-300/10 bg-[#050716]/95 px-4 pb-8 pt-16 shadow-2xl shadow-violet-950/25 sm:px-6 lg:pt-24">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(217,70,239,0.2),transparent_30%),radial-gradient(circle_at_85%_100%,rgba(34,211,238,0.12),transparent_32%)]"></div>
    <div class="relative mx-auto max-w-352 overflow-hidden p-2">
      <div class="relative grid gap-8 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <div>
          <a href="/" class="inline-flex items-center gap-3">
            <span class="grid h-12 w-16 place-items-center">
              <img src="/logo-votos.png" alt="Votos Música Mundial logo" class="h-full w-full object-contain" />
            </span>
            <span>
              <span class="block text-lg font-black uppercase leading-none">Votos Música Mundial</span>
              <span class="mt-1 block text-[10px] uppercase tracking-[0.28em] text-violet-200/70">
                Awards globales
              </span>
            </span>
          </a>

          <p class="mt-4 max-w-md text-sm leading-6 text-slate-400">
            Vota por tus artistas favoritos, reclama puntos diarios y ayuda a tu fandom a subir en el ranking global.
          </p>

        </div>

        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">Explorar</h3>
          <div class="mt-4 grid gap-3">
            <a
              v-for="link in footerLinks"
              :key="link.title"
              :href="link.href"
              class="text-sm font-bold text-slate-400 transition hover:text-white"
            >
              {{ link.title }}
            </a>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Comunidad oficial</h3>
          <div class="mt-4 flex gap-2">
            <a
              v-for="social in socialLinks"
              :key="social.title"
              :href="social.href"
              :aria-label="social.title"
              target="_blank"
              rel="noreferrer"
              class="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-black text-slate-200 transition hover:border-fuchsia-300/40 hover:bg-white/10 hover:text-white"
            >
              <i :class="social.icon" aria-hidden="true"></i>
            </a>
          </div>

          <p class="mt-4 text-sm leading-6 text-slate-400">
            Conecta con la comunidad, revisa novedades y sigue las actualizaciones oficiales.
          </p>
        </div>

        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.28em] text-amber-300">Información</h3>
          <div class="mt-4 grid gap-3">
            <a
              v-for="link in legalLinks"
              :key="link.title"
              :href="link.href"
              class="text-sm font-bold text-slate-400 transition hover:text-white"
            >
              {{ link.title }}
            </a>
          </div>

          <div class="mt-5 rounded-3xl border border-fuchsia-300/15 bg-fuchsia-400/10 p-4">
            <p class="text-xs font-black uppercase tracking-widest text-fuchsia-100">
              Fan powered
            </p>
            <p class="mt-2 text-xs leading-5 text-slate-400">
              Plataforma para votaciones, rankings, artistas, noticias y actividad de fandoms.
            </p>
          </div>
        </div>
      </div>

      <div class="relative mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Voto Música Mundial. Todos los derechos reservados.</p>
        <p>Hecho para fans, rankings y votaciones globales.</p>
      </div>
    </div>
  </footer>
</template>
