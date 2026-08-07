<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAppDownloadConfig } from '../services/api/appDownloadApi'

const DEFAULT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=vote.musicmundial.com'

const { locale } = useI18n()
const playStoreUrl = ref(DEFAULT_PLAY_URL)
const showSection = ref(true)

const playBadgeSrc = computed(() =>
  String(locale.value || 'es').toLowerCase().startsWith('en')
    ? '/google-play-badge-en.png'
    : '/google-play-badge-es.png',
)

onMounted(async () => {
  try {
    const payload = await getAppDownloadConfig()
    if (!payload || typeof payload !== 'object') return

    if (payload.enabled === false || payload.visible === false) {
      showSection.value = false
      return
    }

    const url = String(payload.playStoreUrl || '').trim()
    if (url) playStoreUrl.value = url
    showSection.value = true
  } catch {
    showSection.value = true
    playStoreUrl.value = DEFAULT_PLAY_URL
  }
})
</script>

<template>
  <section
    v-show="showSection"
    id="descargar-app"
    class="download-app mx-auto max-w-352 scroll-mt-28 px-4 py-5 sm:px-6 sm:py-6 lg:py-7"
  >
    <div class="download-app__panel relative overflow-hidden rounded-[1.75rem] border border-white/10 sm:rounded-[2rem]">
      <!-- Fondo limpio (anillo neon a la derecha; texto a la izquierda) -->
      <img
        src="/app-download-bg.png"
        alt=""
        class="download-app__bg pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
        aria-hidden="true"
      />
      <div class="download-app__veil pointer-events-none absolute inset-0"></div>
      <div class="download-app__glow download-app__glow--a pointer-events-none absolute"></div>
      <div class="download-app__glow download-app__glow--b pointer-events-none absolute"></div>
      <div class="download-app__stars pointer-events-none absolute inset-0" aria-hidden="true"></div>

      <div
        class="relative grid items-center gap-6 px-5 py-7 sm:gap-8 sm:px-8 sm:py-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4 lg:px-10 lg:py-10"
      >
        <div class="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center">
          <div class="inline-flex items-center gap-2.5">
            <img
              src="/logo-votos.png"
              alt=""
              class="size-9 drop-shadow-[0_0_18px_rgba(251,191,36,0.55)] sm:size-10"
              aria-hidden="true"
            />
            <span
              class="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-100"
            >
              {{ $t('home.downloadApp.eyebrow') }}
            </span>
          </div>

          <h2
            class="mt-4 text-[1.85rem] font-black uppercase leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]"
          >
            <span class="block text-transparent bg-clip-text bg-linear-to-r from-fuchsia-200 via-white to-amber-100">
              {{ $t('home.downloadApp.titleLine1') }}
            </span>
            <span class="mt-1 block">{{ $t('home.downloadApp.titleLine2') }}</span>
          </h2>

          <p class="mt-3 max-w-md text-sm leading-6 text-slate-200/90 sm:text-base sm:leading-7">
            {{ $t('home.downloadApp.description') }}
          </p>

          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <span class="download-app__chip">
              <i class="fa-solid fa-bolt text-amber-300" aria-hidden="true"></i>
              {{ $t('home.downloadApp.feature1') }}
            </span>
            <span class="download-app__chip">
              <i class="fa-solid fa-gift text-fuchsia-300" aria-hidden="true"></i>
              {{ $t('home.downloadApp.feature2') }}
            </span>
            <span class="download-app__chip">
              <i class="fa-solid fa-users text-cyan-300" aria-hidden="true"></i>
              {{ $t('home.downloadApp.feature3') }}
            </span>
          </div>

          <a
            :href="playStoreUrl"
            target="_blank"
            rel="noreferrer"
            class="download-app__badge group mt-7 inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70"
            :aria-label="$t('home.downloadApp.ctaAria')"
          >
            <img
              :src="playBadgeSrc"
              :alt="$t('home.downloadApp.badgeAlt')"
              class="download-app__badge-img relative z-10 h-[4.5rem] w-auto sm:h-[5.5rem] lg:h-[6.25rem]"
              width="280"
              height="100"
            />
          </a>
        </div>

        <div class="download-app__phone-wrap relative mx-auto w-full max-w-[260px] sm:max-w-[300px] lg:max-w-none lg:justify-self-end">
          <div class="download-app__phone-ring pointer-events-none absolute inset-x-6 bottom-4 h-16 rounded-full blur-2xl"></div>
          <img
            src="/app-download-phone.png"
            :alt="$t('home.downloadApp.phoneAlt')"
            class="download-app__phone relative z-10 mx-auto w-full max-w-[220px] sm:max-w-[250px] lg:max-w-[290px]"
            width="560"
            height="1120"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.download-app__panel {
  background: #070612;
  box-shadow:
    0 24px 80px rgba(88, 28, 135, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.download-app__bg {
  transform-origin: 70% 55%;
  will-change: transform;
  animation: download-bg-drift 18s ease-in-out infinite alternate;
}

.download-app__veil {
  /* Izquierda oscura para leer el texto; derecha deja ver el anillo neon */
  background: linear-gradient(
    100deg,
    rgba(5, 4, 14, 0.92) 0%,
    rgba(5, 4, 14, 0.72) 38%,
    rgba(5, 4, 14, 0.28) 62%,
    rgba(5, 4, 14, 0.15) 100%
  );
}

.download-app__glow--a {
  right: -8%;
  top: -20%;
  width: 20rem;
  height: 20rem;
  border-radius: 9999px;
  background: rgba(236, 72, 153, 0.28);
  filter: blur(60px);
  animation: download-glow 5.5s ease-in-out infinite alternate;
}

.download-app__glow--b {
  left: 10%;
  bottom: -30%;
  width: 16rem;
  height: 16rem;
  border-radius: 9999px;
  background: rgba(168, 85, 247, 0.22);
  filter: blur(55px);
  animation: download-glow 7s ease-in-out infinite alternate-reverse;
}

.download-app__stars {
  background-image:
    radial-gradient(1.5px 1.5px at 12% 22%, rgba(255, 255, 255, 0.55), transparent),
    radial-gradient(1px 1px at 28% 68%, rgba(251, 191, 36, 0.7), transparent),
    radial-gradient(1.5px 1.5px at 72% 18%, rgba(244, 114, 182, 0.7), transparent),
    radial-gradient(1px 1px at 88% 62%, rgba(255, 255, 255, 0.45), transparent),
    radial-gradient(1px 1px at 54% 40%, rgba(165, 243, 252, 0.55), transparent);
  opacity: 0.7;
  animation: download-twinkle 4.5s ease-in-out infinite;
}

.download-app__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.35);
  padding: 0.45rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: rgba(248, 250, 252, 0.95);
  backdrop-filter: blur(8px);
}

.download-app__badge {
  position: relative;
  border-radius: 1rem;
  transition: transform 0.25s ease;
}

.download-app__badge::before {
  content: '';
  position: absolute;
  inset: -10px -14px;
  border-radius: 1.35rem;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.55), transparent 70%);
  filter: blur(16px);
  opacity: 0.85;
  animation: download-cta-pulse 2.4s ease-in-out infinite;
}

.download-app__badge-img {
  filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.55));
  transition: transform 0.25s ease;
}

.download-app__badge:hover {
  transform: translateY(-3px) scale(1.04);
}

.download-app__badge:hover .download-app__badge-img {
  filter: drop-shadow(0 22px 36px rgba(236, 72, 153, 0.35));
}

.download-app__phone {
  filter: drop-shadow(0 28px 40px rgba(0, 0, 0, 0.55));
  animation: download-phone-float 5s ease-in-out infinite;
  transform-origin: center bottom;
}

.download-app__phone-ring {
  background: radial-gradient(circle, rgba(236, 72, 153, 0.55), rgba(124, 58, 237, 0.15) 55%, transparent 70%);
  animation: download-ring 5s ease-in-out infinite;
}

@keyframes download-phone-float {
  0%,
  100% {
    transform: translateY(0) rotate(-1.5deg);
  }
  50% {
    transform: translateY(-12px) rotate(1deg);
  }
}

@keyframes download-ring {
  0%,
  100% {
    opacity: 0.55;
    transform: scaleX(1);
  }
  50% {
    opacity: 0.9;
    transform: scaleX(1.08);
  }
}

@keyframes download-cta-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.85;
  }
}

@keyframes download-bg-drift {
  from {
    transform: scale(1.06) translate3d(0, 0, 0);
  }
  to {
    transform: scale(1.12) translate3d(-2.5%, 1.5%, 0);
  }
}

@keyframes download-glow {
  from {
    opacity: 0.45;
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    opacity: 0.9;
    transform: translate3d(-12px, 10px, 0) scale(1.08);
  }
}

@keyframes download-twinkle {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .download-app__bg,
  .download-app__phone,
  .download-app__phone-ring,
  .download-app__badge::before,
  .download-app__glow--a,
  .download-app__glow--b,
  .download-app__stars {
    animation: none;
  }
}
</style>
