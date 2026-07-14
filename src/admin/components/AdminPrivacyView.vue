<script setup>
import { computed, onMounted, ref } from 'vue'
import RichTextEditor from '../../components/RichTextEditor.vue'
import { getAdminPrivacy, updateAdminPrivacy } from '../../services/api/adminApi'
import { hasRichTextContent, richTextToHtml } from '../../utils/richText'

const activeLocale = ref('es')
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const updatedAt = ref(null)

const form = ref({
  es: { title: '', intro: '', bodyHtml: '' },
  en: { title: '', intro: '', bodyHtml: '' },
})

const localeTabs = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

const previewHtml = computed(() => richTextToHtml(form.value[activeLocale.value].bodyHtml))
const hasPreview = computed(() => hasRichTextContent(form.value[activeLocale.value].bodyHtml))

const loadPrivacy = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const payload = await getAdminPrivacy()
    form.value = {
      es: {
        title: payload?.es?.title || '',
        intro: payload?.es?.intro || '',
        bodyHtml: payload?.es?.bodyHtml || '',
      },
      en: {
        title: payload?.en?.title || '',
        intro: payload?.en?.intro || '',
        bodyHtml: payload?.en?.bodyHtml || '',
      },
    }
    updatedAt.value = payload?.updatedAt || null
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar la política de privacidad.'
  } finally {
    isLoading.value = false
  }
}

const savePrivacy = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (!hasRichTextContent(form.value.es.bodyHtml) || !hasRichTextContent(form.value.en.bodyHtml)) {
      errorMessage.value = 'Completa el contenido enriquecido en español e inglés.'
      return
    }

    const payload = await updateAdminPrivacy({
      es: {
        title: form.value.es.title.trim(),
        intro: form.value.es.intro.trim(),
        bodyHtml: form.value.es.bodyHtml,
      },
      en: {
        title: form.value.en.title.trim(),
        intro: form.value.en.intro.trim(),
        bodyHtml: form.value.en.bodyHtml,
      },
    })

    form.value = {
      es: {
        title: payload?.es?.title || form.value.es.title,
        intro: payload?.es?.intro || form.value.es.intro,
        bodyHtml: payload?.es?.bodyHtml || form.value.es.bodyHtml,
      },
      en: {
        title: payload?.en?.title || form.value.en.title,
        intro: payload?.en?.intro || form.value.en.intro,
        bodyHtml: payload?.en?.bodyHtml || form.value.en.bodyHtml,
      },
    }
    updatedAt.value = payload?.updatedAt || null
    successMessage.value = 'Política de privacidad guardada.'
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar la política de privacidad.'
  } finally {
    isSaving.value = false
  }
}

onMounted(loadPrivacy)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
            Legal
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            Política de privacidad
          </h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Edita la política en español e inglés con texto enriquecido.
            Se muestra en
            <a
              href="/politica-de-privacidad"
              class="font-black text-cyan-300 underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener"
            >/politica-de-privacidad</a>.
          </p>
          <p
            v-if="updatedAt"
            class="mt-2 text-xs font-bold text-slate-500"
          >
            Última actualización: {{ new Date(updatedAt).toLocaleString('es') }}
          </p>
        </div>
        <button
          type="button"
          class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
          @click="loadPrivacy"
        >
          Recargar
        </button>
      </div>
    </article>

    <article class="rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div
        v-if="isLoading"
        class="py-10 text-center text-sm font-bold text-slate-400"
      >
        Cargando política...
      </div>

      <template v-else>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in localeTabs"
            :key="tab.value"
            type="button"
            class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
            :class="
              activeLocale === tab.value
                ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="activeLocale = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <form class="mt-5 grid gap-6 xl:grid-cols-[1fr_0.9fr]" @submit.prevent="savePrivacy">
          <div class="space-y-4">
            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Título
              </span>
              <input
                v-model="form[activeLocale].title"
                type="text"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                :placeholder="activeLocale === 'es' ? 'Política de privacidad' : 'Privacy policy'"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Intro / resumen
              </span>
              <textarea
                v-model="form[activeLocale].intro"
                rows="3"
                class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                :placeholder="activeLocale === 'es' ? 'Resumen breve en español' : 'Short English summary'"
              ></textarea>
            </label>

            <div class="privacy-editor grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Contenido (texto enriquecido)
              </span>
              <RichTextEditor
                v-model="form[activeLocale].bodyHtml"
                :placeholder="activeLocale === 'es' ? 'Escribe la política en español...' : 'Write the privacy policy in English...'"
              />
            </div>
          </div>

          <div class="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
            <p class="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Vista previa {{ activeLocale === 'es' ? 'ES' : 'EN' }}
            </p>
            <h3 class="mt-3 text-2xl font-black text-white">
              {{ form[activeLocale].title || '—' }}
            </h3>
            <p class="mt-3 text-sm leading-6 text-slate-400">
              {{ form[activeLocale].intro || 'Sin intro todavía.' }}
            </p>
            <div
              v-if="hasPreview"
              class="poll-rich-text mt-5 text-sm leading-7 text-slate-300"
              v-html="previewHtml"
            ></div>
            <p
              v-else
              class="mt-5 text-sm font-bold text-slate-500"
            >
              Aún no hay contenido enriquecido para este idioma.
            </p>
          </div>

          <div class="xl:col-span-2">
            <p
              v-if="errorMessage"
              class="mb-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
            >
              {{ errorMessage }}
            </p>
            <p
              v-if="successMessage"
              class="mb-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
            >
              {{ successMessage }}
            </p>

            <div class="flex flex-wrap gap-2">
              <button
                type="submit"
                class="min-h-11 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isSaving"
              >
                {{ isSaving ? 'Guardando...' : 'Guardar política' }}
              </button>
            </div>
          </div>
        </form>
      </template>
    </article>
  </section>
</template>

<style scoped>
.privacy-editor :deep(.ql-container.ql-snow),
.privacy-editor :deep(.ql-editor) {
  min-height: 18rem;
}
</style>
