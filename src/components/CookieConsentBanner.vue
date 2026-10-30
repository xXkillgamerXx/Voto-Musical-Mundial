<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_VERSION,
  readCookieConsent,
} from '../utils/cookieConsent'

const props = defineProps({
  locale: { type: String, default: 'es' },
})

const COPY = {
  es: {
    title: 'Cookies',
    body: 'Aceptar permite anuncios y estadísticas. Rechazar te deja seguir en el sitio sin esas cookies.',
    accept: 'Aceptar',
    acceptHint: 'Sí, con anuncios',
    reject: 'Rechazar',
    rejectHint: 'No, sin anuncios',
    configure: 'Elegir una por una',
    save: 'Guardar',
    preferencesTitle: 'Preferencias',
    preferencesText: 'Idioma y tema.',
    analyticsTitle: 'Estadísticas',
    analyticsText: 'Saber qué páginas se visitan.',
    adsTitle: 'Anuncios',
    adsText: 'Mostrar publicidad de Google.',
    notificationsTitle: 'Avisos',
    notificationsText: 'Regalos y artistas que sigues.',
  },
  en: {
    title: 'Cookies',
    body: 'Accept allows ads and stats. Reject lets you keep using the site without those cookies.',
    accept: 'Accept',
    acceptHint: 'Yes, with ads',
    reject: 'Reject',
    rejectHint: 'No, without ads',
    configure: 'Choose one by one',
    save: 'Save',
    preferencesTitle: 'Preferences',
    preferencesText: 'Language and theme.',
    analyticsTitle: 'Stats',
    analyticsText: 'See which pages are visited.',
    adsTitle: 'Ads',
    adsText: 'Show Google ads.',
    notificationsTitle: 'Alerts',
    notificationsText: 'Gifts and artists you follow.',
  },
}

const text = computed(() => COPY[props.locale === 'en' ? 'en' : 'es'])
const isVisible = ref(false)
const isCustomizing = ref(false)
const options = ref({
  preferences: true,
  analytics: false,
  ads: false,
  pushPrompt: true,
})

const buildConsent = (mode, overrides = {}) => {
  const acceptAll = mode === 'all'
  return {
    mode,
    necessary: true,
    preferences: acceptAll ? true : Boolean(overrides.preferences),
    analytics: acceptAll ? true : Boolean(overrides.analytics),
    ads: acceptAll ? true : Boolean(overrides.ads),
    adStorage: acceptAll ? true : Boolean(overrides.ads),
    adUserData: acceptAll ? true : Boolean(overrides.ads),
    adPersonalization: acceptAll ? true : Boolean(overrides.ads),
    pushPrompt: acceptAll ? true : Boolean(overrides.pushPrompt),
    acceptedAt: new Date().toISOString(),
    version: COOKIE_CONSENT_VERSION,
  }
}

const saveConsent = (mode, overrides = {}) => {
  const consent = buildConsent(mode, overrides)
  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }))
  isVisible.value = false
  isCustomizing.value = false
}

const acceptAll = () => saveConsent('all')
const rejectOptional = () => saveConsent('necessary')
const saveCustom = () => saveConsent('custom', options.value)

onMounted(() => {
  const saved = readCookieConsent()
  if (!saved || Number(saved.version) < COOKIE_CONSENT_VERSION) {
    window.setTimeout(() => {
      isVisible.value = true
    }, 280)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cookie-consent">
      <section v-if="isVisible" class="cookie-bar" role="dialog" aria-modal="false" :aria-label="text.title">
        <div class="cookie-copy">
          <p class="cookie-kicker">{{ text.title }}</p>
          <p class="cookie-body">{{ text.body }}</p>
        </div>

        <div v-if="isCustomizing" class="cookie-options">
          <label>
            <input v-model="options.preferences" type="checkbox" />
            <span><strong>{{ text.preferencesTitle }}</strong><small>{{ text.preferencesText }}</small></span>
          </label>
          <label>
            <input v-model="options.analytics" type="checkbox" />
            <span><strong>{{ text.analyticsTitle }}</strong><small>{{ text.analyticsText }}</small></span>
          </label>
          <label>
            <input v-model="options.ads" type="checkbox" />
            <span><strong>{{ text.adsTitle }}</strong><small>{{ text.adsText }}</small></span>
          </label>
          <label>
            <input v-model="options.pushPrompt" type="checkbox" />
            <span><strong>{{ text.notificationsTitle }}</strong><small>{{ text.notificationsText }}</small></span>
          </label>
          <button type="button" class="cookie-save" @click="saveCustom">{{ text.save }}</button>
        </div>

        <div class="cookie-actions">
          <button type="button" class="cookie-choice cookie-yes" @click="acceptAll">
            <span>{{ text.accept }}</span>
            <small>{{ text.acceptHint }}</small>
          </button>
          <button type="button" class="cookie-choice cookie-no" @click="rejectOptional">
            <span>{{ text.reject }}</span>
            <small>{{ text.rejectHint }}</small>
          </button>
          <button type="button" class="cookie-more" @click="isCustomizing = !isCustomizing">
            {{ text.configure }}
          </button>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cookie-bar {
  position: fixed;
  z-index: 200;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: grid;
  gap: 14px;
  max-width: 920px;
  margin: 0 auto;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 22px;
  background: rgba(12, 18, 32, 0.94);
  color: #e8eef8;
  box-shadow: 0 18px 50px rgba(4, 8, 20, 0.45);
  backdrop-filter: blur(16px);
  font-family: inherit;
}

.cookie-kicker {
  margin: 0;
  color: #8eb6ff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.cookie-body {
  margin: 6px 0 0;
  color: #d5deea;
  font-size: 0.98rem;
  line-height: 1.45;
}

.cookie-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cookie-choice,
.cookie-more,
.cookie-save {
  border: 0;
  border-radius: 14px;
  font: inherit;
  cursor: pointer;
}

.cookie-choice {
  min-height: 58px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 2px;
  padding: 8px 10px;
}

.cookie-choice span {
  font-size: 0.95rem;
  font-weight: 800;
}

.cookie-choice small {
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.82;
}

.cookie-yes {
  background: #225df5;
  color: #fff;
}

.cookie-yes:hover {
  background: #1b4fd4;
}

.cookie-no {
  background: #f4f7fb;
  color: #1c2838;
}

.cookie-no:hover {
  background: #fff;
}

.cookie-more,
.cookie-save {
  grid-column: 1 / -1;
  min-height: 40px;
  background: transparent;
  color: #b7c6dc;
  font-size: 0.84rem;
  font-weight: 700;
}

.cookie-save {
  border-radius: 12px;
  background: #225df5;
  color: #fff;
}

.cookie-options {
  display: grid;
  gap: 8px;
}

.cookie-options label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.cookie-options input {
  margin-top: 3px;
  accent-color: #225df5;
}

.cookie-options strong,
.cookie-options small {
  display: block;
}

.cookie-options strong {
  color: #fff;
  font-size: 0.88rem;
}

.cookie-options small {
  color: #aebaca;
  font-size: 0.78rem;
  line-height: 1.35;
}

.cookie-consent-enter-active,
.cookie-consent-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.cookie-consent-enter-from,
.cookie-consent-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (min-width: 760px) {
  .cookie-bar {
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 18px 18px 18px 22px;
  }

  .cookie-options,
  .cookie-more {
    grid-column: 1 / -1;
  }

  .cookie-actions {
    min-width: 340px;
  }
}
</style>
