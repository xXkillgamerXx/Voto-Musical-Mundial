<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPublicTerms } from '../services/api/termsApi'
import { hasRichTextContent, richTextToHtml } from '../utils/richText'
import { routePath } from '../utils/localizedRoutes'

const { t, locale } = useI18n()

const isLoading = ref(true)
const loadError = ref(false)
const terms = ref(null)

const resolvedLang = computed(() =>
  String(locale.value || 'es').toLowerCase().startsWith('en') ? 'en' : 'es',
)

const title = computed(() => terms.value?.title || t('terms.title'))
const intro = computed(() => terms.value?.intro || t('terms.intro'))
const bodyHtml = computed(() => richTextToHtml(terms.value?.bodyHtml || ''))
const hasBody = computed(() => hasRichTextContent(terms.value?.bodyHtml))
const useFallbackSections = computed(() => !isLoading.value && (!hasBody.value || loadError.value))

const loadTerms = async () => {
  isLoading.value = true
  loadError.value = false

  try {
    const payload = await getPublicTerms(resolvedLang.value)
    terms.value = {
      title: payload?.title || '',
      intro: payload?.intro || '',
      bodyHtml: payload?.bodyHtml || '',
    }
  } catch {
    loadError.value = true
    terms.value = null
  } finally {
    isLoading.value = false
  }
}

watch(resolvedLang, () => {
  loadTerms()
})

onMounted(loadTerms)
</script>

<template>
  <section class="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
    <div class="overflow-hidden rounded-4xl border border-violet-300/20 bg-white/5 p-1 text-white shadow-2xl shadow-fuchsia-950/30">
      <div class="rounded-[calc(2rem-4px)] bg-[#080a18]/95 p-6 sm:p-8">
        <a :href="routePath('home', locale)" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
          {{ $t('terms.backHome') }}
        </a>

        <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">{{ $t('terms.eyebrow') }}</p>

        <div
          v-if="isLoading"
          class="mt-6 text-sm font-bold text-slate-400"
        >
          {{ resolvedLang === 'en' ? 'Loading terms...' : 'Cargando términos...' }}
        </div>

        <template v-else>
          <h1 class="mt-2 text-3xl font-black leading-tight sm:text-5xl">{{ title }}</h1>
          <p class="mt-4 text-sm leading-6 text-slate-300">
            {{ intro }}
          </p>

          <div
            v-if="hasBody && !useFallbackSections"
            class="poll-rich-text mt-8 text-sm leading-7 text-slate-300"
            v-html="bodyHtml"
          ></div>

          <div
            v-else
            class="mt-8 space-y-6 text-sm leading-7 text-slate-300"
          >
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
        </template>
      </div>
    </div>
  </section>
</template>
