<script setup>
const communityLinks = [
  {
    titleKey: 'home.community.x.title',
    descriptionKey: 'home.community.x.description',
    href: 'https://x.com/MusicMundial',
    icon: 'fa-brands fa-x-twitter',
    labelKey: 'home.community.x.label',
    visual: 'from-slate-950 via-violet-950 to-black',
  },
  {
    titleKey: 'home.community.startly.title',
    descriptionKey: 'home.community.startly.description',
    href: 'https://startlyapp.com/musicmundial',
    icon: 'fa-solid fa-link',
    labelKey: 'home.community.startly.label',
    visual: 'from-fuchsia-950 via-purple-900 to-slate-950',
  },
]
</script>

<template>
  <section id="comunidad" class="mx-auto max-w-352 scroll-mt-28 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <i class="fa-solid fa-users text-fuchsia-300" aria-hidden="true"></i>
        {{ $t('home.community.title') }}
      </h2>
      <span class="text-xs font-black uppercase tracking-wide text-violet-300">
        Music Mundial
      </span>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <a
        v-for="item in communityLinks"
        :key="item.href"
        :href="item.href"
        target="_blank"
        rel="noreferrer"
        class="group relative overflow-hidden rounded-4xl border border-violet-300/15 bg-[#080a18]/90 p-5 shadow-2xl shadow-violet-950/20 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
      >
        <div class="pointer-events-none absolute inset-0 bg-linear-to-br opacity-80" :class="item.visual"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-20 left-10 size-64 rounded-full bg-cyan-400/10 blur-3xl"></div>

        <div class="relative flex items-center gap-5">
          <span class="grid size-18 shrink-0 place-items-center rounded-3xl border border-white/15 bg-white/10 text-3xl text-white shadow-xl shadow-black/25 backdrop-blur">
            <i :class="item.icon" aria-hidden="true"></i>
          </span>

          <span class="min-w-0">
            <span class="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-100">
              {{ $t(item.labelKey) }}
            </span>
            <span class="mt-3 block text-2xl font-black text-white">
              {{ $t(item.titleKey) }}
            </span>
            <span class="mt-2 block text-sm leading-6 text-slate-300">
              {{ $t(item.descriptionKey) }}
            </span>
            <span class="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-fuchsia-200 transition group-hover:text-white">
              {{ $t('home.community.open') }}
              <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </span>
          </span>
        </div>
      </a>
    </div>
  </section>
</template>
