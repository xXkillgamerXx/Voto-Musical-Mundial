<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPublicPrivacy } from '../services/api/privacyApi'
import { hasRichTextContent, richTextToHtml } from '../utils/richText'

const { t, locale } = useI18n()

const isLoading = ref(true)
const loadError = ref(false)
const privacy = ref(null)

const resolvedLang = computed(() =>
  String(locale.value || 'es').toLowerCase().startsWith('en') ? 'en' : 'es',
)

const title = computed(() => privacy.value?.title || t('privacy.title'))
const intro = computed(() => privacy.value?.intro || t('privacy.intro'))
const bodyHtml = computed(() => richTextToHtml(privacy.value?.bodyHtml || ''))
const hasBody = computed(() => hasRichTextContent(privacy.value?.bodyHtml))
const useFallbackSections = computed(() => !isLoading.value && (!hasBody.value || loadError.value))

const loadPrivacy = async () => {
  isLoading.value = true
  loadError.value = false

  try {
    const payload = await getPublicPrivacy(resolvedLang.value)
    privacy.value = {
      title: payload?.title || '',
      intro: payload?.intro || '',
      bodyHtml: payload?.bodyHtml || '',
    }
  } catch {
    loadError.value = true
    privacy.value = null
  } finally {
    isLoading.value = false
  }
}

watch(resolvedLang, () => {
  loadPrivacy()
})

onMounted(loadPrivacy)
</script>

<template>
  <section class="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
    <div class="overflow-hidden rounded-4xl border border-violet-300/20 bg-white/5 p-1 text-white shadow-2xl shadow-fuchsia-950/30">
      <div class="rounded-[calc(2rem-4px)] bg-[#080a18]/95 p-6 sm:p-8">
        <a href="/" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
          {{ $t('privacy.backHome') }}
        </a>

        <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">{{ $t('privacy.eyebrow') }}</p>

        <div
          v-if="isLoading"
          class="mt-6 text-sm font-bold text-slate-400"
        >
          {{ resolvedLang === 'en' ? 'Loading privacy policy...' : 'Cargando política de privacidad...' }}
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
              <h2 class="text-lg font-black text-white">{{ $t('privacy.dataTitle') }}</h2>
              <p class="mt-2">
                {{ $t('privacy.dataText') }}
              </p>
            </div>

            <div>
              <h2 class="text-lg font-black text-white">{{ $t('privacy.useTitle') }}</h2>
              <p class="mt-2">
                {{ $t('privacy.useText') }}
              </p>
            </div>

            <div>
              <h2 class="text-lg font-black text-white">{{ $t('privacy.securityTitle') }}</h2>
              <p class="mt-2">
                {{ $t('privacy.securityText') }}
              </p>
            </div>

            <div>
              <h2 class="text-lg font-black text-white">{{ $t('privacy.sharingTitle') }}</h2>
              <p class="mt-2">
                {{ $t('privacy.sharingText') }}
              </p>
            </div>

            <div>
              <h2 class="text-lg font-black text-white">{{ $t('privacy.rightsTitle') }}</h2>
              <p class="mt-2">
                {{ $t('privacy.rightsText') }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
