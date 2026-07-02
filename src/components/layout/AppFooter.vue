<script setup>
const footerLinks = [
  { titleKey: 'nav.home', href: '/' },
  { titleKey: 'nav.polls', href: '/votaciones' },
  { titleKey: 'nav.artists', href: '/artistas' },
  { titleKey: 'nav.subscriptions', href: '/votos-plus' },
  { titleKey: 'nav.rankingPopularity', href: '/ranking-popularity' },
  { titleKey: 'nav.hallOfFame', href: '/salon-de-la-fama' },
  { titleKey: 'nav.news', href: '/noticias' },
]

const legalLinks = [
  { titleKey: 'footer.terms', href: '/terminos-y-condiciones' },
  { titleKey: 'footer.voteRules', href: '/votaciones' },
  { titleKey: 'nav.adminPanel', href: '/admin' },
]

const socialLinks = [
  {
    titleKey: 'footer.musicMundialX',
    icon: 'fa-brands fa-x-twitter',
    href: 'https://x.com/MusicMundial',
  },
  {
    titleKey: 'footer.startlyCommunity',
    icon: 'fa-solid fa-link',
    href: 'https://startlyapp.com/musicmundial',
  },
  {
    titleKey: 'footer.musicMundialFeed',
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
              <img src="/logo-votos.png" :alt="$t('common.appName') + ' logo'" class="h-full w-full object-contain" />
            </span>
            <span>
              <span class="block text-lg font-black uppercase leading-none">{{ $t('common.appName') }}</span>
              <span class="mt-1 block text-[10px] uppercase tracking-[0.28em] text-violet-200/70">
                {{ $t('common.tagline') }}
              </span>
            </span>
          </a>

          <p class="mt-4 max-w-md text-sm leading-6 text-slate-400">
            {{ $t('footer.description') }}
          </p>

        </div>

        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">{{ $t('footer.explore') }}</h3>
          <div class="mt-4 grid gap-3">
            <a
              v-for="link in footerLinks"
              :key="link.titleKey"
              :href="link.href"
              class="text-sm font-bold text-slate-400 transition hover:text-white"
            >
              {{ $t(link.titleKey) }}
            </a>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">{{ $t('footer.officialCommunity') }}</h3>
          <div class="mt-4 flex gap-2">
            <a
              v-for="social in socialLinks"
              :key="social.titleKey"
              :href="social.href"
              :aria-label="$t(social.titleKey)"
              target="_blank"
              rel="noreferrer"
              class="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-black text-slate-200 transition hover:border-fuchsia-300/40 hover:bg-white/10 hover:text-white"
            >
              <i :class="social.icon" aria-hidden="true"></i>
            </a>
          </div>

          <p class="mt-4 text-sm leading-6 text-slate-400">
            {{ $t('footer.communityDescription') }}
          </p>
        </div>

        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.28em] text-amber-300">{{ $t('footer.info') }}</h3>
          <div class="mt-4 grid gap-3">
            <a
              v-for="link in legalLinks"
              :key="link.titleKey"
              :href="link.href"
              class="text-sm font-bold text-slate-400 transition hover:text-white"
            >
              {{ $t(link.titleKey) }}
            </a>
          </div>
        </div>
      </div>

      <div class="relative mt-8 border-t border-white/10 pt-5 text-xs text-slate-500">
        <p>{{ $t('footer.copyright') }}</p>
      </div>
    </div>
  </footer>
</template>
