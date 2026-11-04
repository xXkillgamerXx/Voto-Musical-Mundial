<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getNewsPage, getNewsPopular, postNewsContact } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'
import { coverErrorFallback, coverOf, type NewsCard } from '../lib/news'
import { applyNewsSeo } from '../lib/seo'

const props = defineProps<{ slug: string; locale: 'es' | 'en' }>()

type PageHero = {
  key: string
  tone: string
  lead: string
  accent: string
  blurb: string
  badge: string
}

const HEROES: Record<string, { es: PageHero; en: PageHero }> = {
  about: {
    es: {
      key: 'about',
      tone: 'about',
      lead: 'Quiénes',
      accent: 'somos',
      blurb: 'La redacción detrás de Music Mundial y nuestra misión editorial.',
      badge: 'Desde 2012',
    },
    en: {
      key: 'about',
      tone: 'about',
      lead: 'Who we',
      accent: 'are',
      blurb: 'The newsroom behind Music Mundial and our editorial mission.',
      badge: 'Since 2012',
    },
  },
  terms: {
    es: {
      key: 'terms',
      tone: 'terms',
      lead: 'Términos y',
      accent: 'condiciones',
      blurb: 'Las reglas de uso de Music Mundial y sus portales asociados.',
      badge: 'Legal',
    },
    en: {
      key: 'terms',
      tone: 'terms',
      lead: 'Terms and',
      accent: 'conditions',
      blurb: 'The rules for using Music Mundial and related portals.',
      badge: 'Legal',
    },
  },
  cookies: {
    es: {
      key: 'cookies',
      tone: 'cookies',
      lead: 'Cookies y',
      accent: 'preferencias',
      blurb: 'Cómo usamos cookies y tecnologías de medición en el sitio.',
      badge: 'Privacidad',
    },
    en: {
      key: 'cookies',
      tone: 'cookies',
      lead: 'Cookies and',
      accent: 'preferences',
      blurb: 'How we use cookies and measurement technologies on the site.',
      badge: 'Privacy',
    },
  },
  privacy: {
    es: {
      key: 'privacy',
      tone: 'privacy',
      lead: 'Política de',
      accent: 'privacidad',
      blurb: 'Cómo tratamos tus datos y qué derechos tienes como usuario.',
      badge: 'Datos',
    },
    en: {
      key: 'privacy',
      tone: 'privacy',
      lead: 'Privacy',
      accent: 'policy',
      blurb: 'How we handle your data and what rights you have as a user.',
      badge: 'Data',
    },
  },
  dmca: {
    es: {
      key: 'dmca',
      tone: 'dmca',
      lead: 'Aviso',
      accent: 'DMCA',
      blurb: 'Canal para reportar contenidos protegidos por derechos de autor.',
      badge: 'Copyright',
    },
    en: {
      key: 'dmca',
      tone: 'dmca',
      lead: 'DMCA',
      accent: 'notice',
      blurb: 'Channel to report copyright-protected content on the site.',
      badge: 'Copyright',
    },
  },
  contact: {
    es: {
      key: 'contact',
      tone: 'contact',
      lead: 'Hablemos',
      accent: 'contigo',
      blurb: 'Soporte, dudas y PR. Completa el formulario y te respondemos.',
      badge: '24–48h',
    },
    en: {
      key: 'contact',
      tone: 'contact',
      lead: 'Let’s',
      accent: 'talk',
      blurb: 'Support, questions and PR. Fill the form and we’ll reply.',
      badge: '24–48h',
    },
  },
}

const loading = ref(true)
const popularLoading = ref(true)
const errorMessage = ref('')
const page = ref<{ key?: string; title: string; content: string; href?: string } | null>(null)
const popular = ref<NewsCard[]>([])

const form = ref({ name: '', email: '', subject: '', message: '' })
const sending = ref(false)
const formOk = ref('')
const formError = ref('')

const CONTACT_FORM_RE = /(?:<p>\s*)?\[contact-form\](?:\s*<\/p>)?/i

const homeHref = computed(() => withLocale('/', props.locale))
const pageKey = computed(() => String(page.value?.key || '').trim())
const hasFormTag = computed(() => CONTACT_FORM_RE.test(String(page.value?.content || '')))
const showForm = computed(
  () => hasFormTag.value || pageKey.value === 'contact' || pageKey.value === 'dmca',
)
const bodyParts = computed(() => {
  const html = String(page.value?.content || '')
  if (!CONTACT_FORM_RE.test(html)) return { before: html, after: '' }
  const bits = html.split(CONTACT_FORM_RE)
  return { before: bits[0] || '', after: bits.slice(1).join('') }
})
const hero = computed(() => {
  const pack = HEROES[pageKey.value]
  if (!pack) return null
  return props.locale === 'en' ? pack.en : pack.es
})

const load = async () => {
  loading.value = true
  popularLoading.value = true
  errorMessage.value = ''
  page.value = null
  popular.value = []
  formOk.value = ''
  formError.value = ''
  form.value.subject = ''
  const popularPromise = getNewsPopular({ limit: 5, locale: props.locale }).catch(() => ({ items: [] }))
  try {
    page.value = await getNewsPage(props.slug, props.locale)
    if (page.value?.title) {
      const path = withLocale(`/${props.slug}`, props.locale)
      const pack = HEROES[String(page.value.key || '')]
      const blurb = pack ? (props.locale === 'en' ? pack.en.blurb : pack.es.blurb) : page.value.title
      applyNewsSeo({
        type: 'website',
        locale: props.locale,
        title: `${page.value.title} — Music Mundial`,
        description: blurb,
        path,
        hreflangEn: path,
        hreflangEs: path,
      })
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t(props.locale, 'pageMissing')
  } finally {
    loading.value = false
  }
  try {
    const payload = await popularPromise
    popular.value = Array.isArray(payload?.items) ? payload.items : []
  } finally {
    popularLoading.value = false
  }
}

const submitContact = async () => {
  formOk.value = ''
  formError.value = ''
  sending.value = true
  try {
    await postNewsContact({ ...form.value })
    formOk.value = t(props.locale, 'contactOk')
    form.value = { name: '', email: '', subject: '', message: '' }
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t(props.locale, 'contactFail')
  } finally {
    sending.value = false
  }
}

watch(() => [props.slug, props.locale], load)
onMounted(load)
</script>

<template>
  <main class="article-page static-page">
    <section
      v-if="hero"
      class="category-hero dark-section static-hero"
      :class="`static-hero-${hero.tone}`"
    >
      <div class="static-hero-bg" aria-hidden="true">
        <span class="glow"></span>
        <div class="equalizer">
          <i v-for="n in 18" :key="n" :style="{ '--h': `${18 + ((n * 17) % 62)}%`, '--d': `${(n % 6) * 0.12}s` }"></i>
        </div>
      </div>
      <div class="container">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="crumbs-now">{{ page?.title || hero.accent }}</span>
        </nav>
        <div class="cats-head kpop-head">
          <div>
            <div class="cats-eyebrow">{{ t(locale, 'explore') }}</div>
            <h1>{{ hero.lead }} <span>{{ hero.accent }}</span></h1>
            <p>{{ hero.blurb }}</p>
          </div>
          <span class="cats-link">{{ hero.badge }}</span>
        </div>
      </div>
    </section>

    <div class="container article-layout category-body">
      <div class="article-wrap">
        <p v-if="loading" class="article-status">{{ t(locale, 'loadingPage') }}</p>
        <p v-else-if="errorMessage" class="article-status">
          {{ errorMessage }}
          <a :href="homeHref">{{ t(locale, 'backHome') }}</a>
        </p>
        <article v-else-if="page" class="article static-article">
          <div class="article-body static-body" v-html="bodyParts.before"></div>

          <form v-if="showForm" class="static-contact" @submit.prevent="submitContact">
            <div class="static-contact-head">
              <h2>{{ t(locale, 'contactSend') }}</h2>
              <p>{{ locale === 'es' ? 'Soporte, PR o DMCA. Te respondemos por correo.' : 'Support, PR or DMCA. We’ll reply by email.' }}</p>
            </div>
            <div class="static-contact-grid">
              <label>
                <span>{{ t(locale, 'contactName') }}</span>
                <input v-model="form.name" type="text" required maxlength="120" autocomplete="name" placeholder="Jane Doe" />
              </label>
              <label>
                <span>{{ t(locale, 'contactEmail') }}</span>
                <input v-model="form.email" type="email" required maxlength="180" autocomplete="email" placeholder="you@example.com" />
              </label>
            </div>
            <label>
              <span>{{ t(locale, 'contactSubject') }}</span>
              <input
                v-model="form.subject"
                type="text"
                required
                maxlength="180"
                :placeholder="locale === 'es' ? 'Asunto del mensaje' : 'Message subject'"
              />
            </label>
            <label>
              <span>{{ t(locale, 'contactMessage') }}</span>
              <textarea v-model="form.message" rows="7" required maxlength="5000" :placeholder="locale === 'es' ? 'Escribe tu mensaje…' : 'Write your message…'"></textarea>
            </label>
            <p v-if="formOk" class="static-contact-ok">{{ formOk }}</p>
            <p v-if="formError" class="static-contact-error">{{ formError }}</p>
            <button class="static-contact-submit" type="submit" :disabled="sending">
              {{ sending ? t(locale, 'contactSending') : t(locale, 'contactSend') }}
            </button>
          </form>

          <div v-if="bodyParts.after" class="article-body static-body" v-html="bodyParts.after"></div>
        </article>
      </div>

      <aside v-if="popular.length || popularLoading" class="most-read">
        <div class="cats-eyebrow">{{ t(locale, 'mostRead') }}</div>
        <a
          v-for="(item, index) in popular"
          :key="item.id"
          class="most-read-card"
          :href="item.href"
        >
          <div class="most-read-photo">
            <img :src="coverOf(item, '/images/jungkook-hero.jpg', 'card')" :alt="item.title" loading="lazy" decoding="async" @error="coverErrorFallback" />
            <span class="most-read-num">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="most-read-tags">
              <span class="chip">{{ item.category }}</span>
            </span>
          </div>
          <h3>{{ item.title }}</h3>
        </a>
        <div
          v-for="n in popularLoading && !popular.length ? 5 : 0"
          :key="'pop-skel-' + n"
          class="most-read-card most-read-skel"
        >
          <div class="most-read-photo skel"></div>
          <span class="skel skel-line"></span>
        </div>
      </aside>
    </div>
  </main>
</template>
