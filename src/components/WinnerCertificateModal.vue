<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  blobToFile,
  buildCertificateFilename,
  downloadBlob,
  renderWinnerCertificateBlob,
} from '../utils/winnerCertificateExport'
import {
  formatCertificateInstagramTag,
  getCertificateInstagramHandle,
} from '../utils/certificateBrand'

const props = defineProps({
  open: { type: Boolean, default: false },
  name: { type: String, default: '' },
  group: { type: String, default: '' },
  category: { type: String, default: '' },
  year: { type: [String, Number], default: '' },
  pollUrl: { type: String, default: '' },
})

const emit = defineEmits(['close'])
const { locale, t } = useI18n()
const busy = ref(false)

const yearText = computed(() => {
  const raw = String(props.year || '').trim()
  if (/^\d{4}$/.test(raw)) return raw
  return String(new Date().getFullYear())
})

const instagramTag = computed(() =>
  formatCertificateInstagramTag(getCertificateInstagramHandle()),
)

const certificateHref = computed(() => {
  const params = new URLSearchParams({
    name: props.name || '',
    group: props.group || '',
    category: props.category || '',
    year: yearText.value,
    lang: locale.value === 'en' ? 'en' : 'es',
    ig: getCertificateInstagramHandle(),
  })
  return `/certificate.html?${params.toString()}`
})

const certificateMeta = computed(() => ({
  name: props.name || '',
  group: props.group || '',
  category: props.category || '',
  year: yearText.value,
  lang: locale.value === 'en' ? 'en' : 'es',
  instagram: instagramTag.value,
}))

const shareText = computed(() => {
  const name = props.name || 'Music Mundial'
  const group = props.group ? ` (${props.group})` : ''
  const category = props.category ? ` · ${props.category}` : ''
  const year = yearText.value ? ` ${yearText.value}` : ''
  return `${name}${group}${category}${year}`
})

const close = () => emit('close')

const withCertificateImage = async (action) => {
  if (busy.value) return
  busy.value = true
  try {
    const blob = await renderWinnerCertificateBlob(certificateMeta.value)
    const filename = buildCertificateFilename(certificateMeta.value)
    await action(blob, filename)
  } finally {
    busy.value = false
  }
}

const downloadCertificate = async () => {
  try {
    await withCertificateImage(async (blob, filename) => {
      downloadBlob(blob, filename)
    })
  } catch {
    window.alert(t('polls.detail.certificateDownloadError'))
  }
}

const shareCertificate = async () => {
  try {
    await withCertificateImage(async (blob, filename) => {
      const file = blobToFile(blob, filename)
      const title = props.name || 'Music Mundial Certificate'

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: shareText.value,
        })
        return
      }

      downloadBlob(blob, filename)
    })
  } catch (error) {
    if (error?.name === 'AbortError') return
    window.alert(t('polls.detail.certificateShareError'))
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"
      @click.self="close"
    >
      <div
        class="relative flex max-h-[96vh] w-full max-w-[540px] flex-col overflow-hidden rounded-[24px] border border-fuchsia-300/25 bg-[#050213] shadow-2xl shadow-fuchsia-950/40"
      >
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-200">
              {{ $t('polls.detail.certificateEyebrow') }}
            </p>
            <h2 class="truncate text-lg font-black text-white">
              {{ $t('polls.detail.certificateTitle') }}
            </h2>
          </div>
          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            :aria-label="$t('polls.detail.close')"
            @click="close"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#050213] p-3 sm:p-4">
          <div
            class="relative overflow-hidden rounded-xl shadow-2xl shadow-black/40"
            style="width: min(100%, calc((96vh - 11rem) * 3 / 3.85)); aspect-ratio: 3 / 3.85"
          >
            <iframe
              :key="certificateHref"
              :src="certificateHref"
              title="Music Mundial Certificate"
              class="absolute inset-0 h-full w-full border-0 bg-transparent"
              loading="eager"
            />
          </div>
        </div>

        <div class="grid shrink-0 gap-3 border-t border-white/10 p-4 sm:grid-cols-2">
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60"
            :disabled="busy"
            @click="downloadCertificate"
          >
            <i class="fa-solid fa-download" aria-hidden="true"></i>
            {{ $t('polls.detail.certificateDownload') }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60"
            :disabled="busy"
            @click="shareCertificate"
          >
            <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
            {{ $t('polls.detail.certificateShare') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
