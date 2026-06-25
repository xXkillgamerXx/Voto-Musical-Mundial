<template>
  <section class="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
    <div class="overflow-hidden rounded-4xl border border-violet-300/20 bg-white/5 p-1 text-white shadow-2xl shadow-fuchsia-950/30">
      <div class="rounded-[calc(2rem-4px)] bg-[#080a18]/95 p-6 sm:p-8">
        <a href="/" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
          {{ $t('terms.backHome') }}
        </a>

        <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">{{ $t('terms.eyebrow') }}</p>
        <h1 class="mt-2 text-3xl font-black leading-tight sm:text-5xl">{{ $t('terms.title') }}</h1>
        <p class="mt-4 text-sm leading-6 text-slate-300">
          {{ $t('terms.intro') }}
        </p>

        <div class="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <div>
            <h2 class="text-lg font-black text-white">{{ $t('terms.platformUseTitle') }}</h2>
            <p class="mt-2">
              {{ $t('terms.platformUseText') }}
            </p>
          </div>

          <div>
            <h2 class="text-lg font-black text-white">{{ $t('terms.accountsTitle') }}</h2>
            <p class="mt-2">
              {{ $t('terms.accountsText') }}
            </p>
          </div>

          <div>
            <h2 class="text-lg font-black text-white">{{ $t('terms.rewardsTitle') }}</h2>
            <p class="mt-2">
              {{ $t('terms.rewardsText') }}
            </p>
          </div>

          <div>
            <h2 class="text-lg font-black text-white">{{ $t('terms.dataTitle') }}</h2>
            <p class="mt-2">
              {{ $t('terms.dataText') }}
            </p>
          </div>

          <div>
            <h2 class="text-lg font-black text-white">{{ $t('terms.changesTitle') }}</h2>
            <p class="mt-2">
              {{ $t('terms.changesText') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
