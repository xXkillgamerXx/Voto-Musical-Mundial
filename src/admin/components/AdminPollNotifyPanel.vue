<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getAdminMailJob,
  getAdminPushJob,
  previewAdminMail,
  sendAdminBulkEmail,
  sendAdminPush,
  sendAdminTestEmail,
} from '../../services/api/adminApi'

const props = defineProps({
  pollId: { type: String, default: '' },
  pollTitle: { type: String, default: '' },
  pollTitleEn: { type: String, default: '' },
  pollSlug: { type: String, default: '' },
  pollSlugEn: { type: String, default: '' },
  pollYear: { type: [String, Number], default: () => new Date().getFullYear() },
  pollBanner: { type: String, default: '' },
  pollDescription: { type: String, default: '' },
  pollDescriptionEn: { type: String, default: '' },
  autoOpen: { type: Boolean, default: false },
})

const SITE = 'https://vote.musicmundial.com'

const isOpen = ref(Boolean(props.autoOpen))
const errorMessage = ref('')
const successMessage = ref('')
const isSendingEmail = ref(false)
const isSendingPush = ref(false)
const isSendingTest = ref(false)
const isLoadingPreview = ref(false)
const previewHtml = ref('')
const previewSubject = ref('')
const activeJob = ref(null)
const jobKind = ref('mail')
const testTo = ref('')

let jobTimer = null
let previewTimer = null

const stripHtml = (value) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const absoluteUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  return `${SITE}${raw.startsWith('/') ? raw : `/${raw}`}`
}

const pollPath = computed(() => {
  const slug = String(props.pollSlug || '').trim()
  const year = Number(props.pollYear) || new Date().getFullYear()
  return slug ? `/votacion/${year}/${slug}` : '/votaciones'
})

const pollUrl = computed(() => `${SITE}${pollPath.value}`)
const coverImageUrl = computed(() => absoluteUrl(props.pollBanner))
const subtitleEs = computed(() => stripHtml(props.pollDescription))
const subtitleEn = computed(() => stripHtml(props.pollDescriptionEn) || subtitleEs.value)

const emailForm = ref({
  subject: '',
  message: '',
  subjectEn: '',
  messageEn: '',
  ctaLabel: 'Ir a votar',
  ctaLabelEn: 'Go vote',
  sendToAll: true,
})
const emailLocale = ref('es')

const pushForm = ref({
  title: '',
  titleEn: '',
  body: '',
  bodyEn: '',
  sendToAll: true,
})

const activeEmailSubject = computed({
  get: () =>
    emailLocale.value === 'en' ? emailForm.value.subjectEn : emailForm.value.subject,
  set: (value) => {
    if (emailLocale.value === 'en') emailForm.value.subjectEn = value
    else emailForm.value.subject = value
  },
})

const activeEmailMessage = computed({
  get: () =>
    emailLocale.value === 'en' ? emailForm.value.messageEn : emailForm.value.message,
  set: (value) => {
    if (emailLocale.value === 'en') emailForm.value.messageEn = value
    else emailForm.value.message = value
  },
})

const activeEmailCta = computed({
  get: () =>
    emailLocale.value === 'en' ? emailForm.value.ctaLabelEn : emailForm.value.ctaLabel,
  set: (value) => {
    if (emailLocale.value === 'en') emailForm.value.ctaLabelEn = value
    else emailForm.value.ctaLabel = value
  },
})

const jobPercent = computed(() => {
  const job = activeJob.value
  if (!job) return 0
  if (typeof job.percent === 'number') return Math.min(100, Math.max(0, job.percent))
  if (!job.total) return 0
  return Math.min(100, Math.round((Number(job.processed || 0) / Number(job.total)) * 100))
})

const isJobRunning = computed(() => {
  const status = activeJob.value?.status
  return status === 'queued' || status === 'running'
})

const fillDefaults = () => {
  const title = String(props.pollTitle || '').trim() || 'Nueva votación'
  const titleEn = String(props.pollTitleEn || '').trim() || title

  if (!emailForm.value.subject.trim()) {
    emailForm.value.subject = `Nueva votación: {{pollTitle}} · Votos Mundial`
  }
  if (!emailForm.value.message.trim()) {
    emailForm.value.message = `Hola {{name}},\n\nYa puedes votar en {{pollTitle}}. Entra ahora y apoya a tus artistas favoritos.\n\n¡Gracias por ser parte de Votos Mundial!`
  }
  if (!emailForm.value.subjectEn.trim()) {
    emailForm.value.subjectEn = `New poll: {{pollTitle}} · Votos Mundial`
  }
  if (!emailForm.value.messageEn.trim()) {
    emailForm.value.messageEn = `Hi {{name}},\n\nYou can now vote in {{pollTitle}}. Open the app and support your favorite artists.\n\nThanks for being part of Votos Mundial!`
  }

  if (!pushForm.value.title.trim()) {
    pushForm.value.title = `Nueva votación: ${title}`
  }
  if (!pushForm.value.titleEn.trim()) {
    pushForm.value.titleEn = `New poll: ${titleEn}`
  }
  if (!pushForm.value.body.trim()) {
    pushForm.value.body = `Ya puedes votar en ${title}. ¡Entra y participa!`
  }
  if (!pushForm.value.bodyEn.trim()) {
    pushForm.value.bodyEn = `You can now vote in ${titleEn}. Join now!`
  }
}

const stopJobPolling = () => {
  if (jobTimer) {
    clearInterval(jobTimer)
    jobTimer = null
  }
}

const pollJob = async (jobId) => {
  try {
    const job =
      jobKind.value === 'push' ? await getAdminPushJob(jobId) : await getAdminMailJob(jobId)
    activeJob.value = job

    if (job.status === 'done' || job.status === 'failed') {
      stopJobPolling()
      isSendingEmail.value = false
      isSendingPush.value = false

      if (job.status === 'failed') {
        errorMessage.value = job.error || 'El envío falló.'
        successMessage.value = ''
        return
      }

      successMessage.value = `${jobKind.value === 'push' ? 'Push' : 'Correo'}: ${job.sent || 0}/${job.total || 0} enviados.`
    }
  } catch (error) {
    stopJobPolling()
    isSendingEmail.value = false
    isSendingPush.value = false
    errorMessage.value = error?.message || 'No se pudo consultar el progreso.'
  }
}

const startJobPolling = (jobId, kind) => {
  jobKind.value = kind
  stopJobPolling()
  pollJob(jobId)
  jobTimer = setInterval(() => pollJob(jobId), 1000)
}

const refreshPreview = async () => {
  isLoadingPreview.value = true
  try {
    const preview = await previewAdminMail({
      subject:
        emailLocale.value === 'en'
          ? emailForm.value.subjectEn.trim() || emailForm.value.subject.trim()
          : emailForm.value.subject.trim(),
      message:
        emailLocale.value === 'en'
          ? emailForm.value.messageEn.trim() || emailForm.value.message.trim()
          : emailForm.value.message.trim(),
      mode: 'poll',
      locale: emailLocale.value,
      ctaUrl: pollUrl.value,
      ctaLabel:
        emailLocale.value === 'en'
          ? emailForm.value.ctaLabelEn.trim() || 'Go vote'
          : emailForm.value.ctaLabel.trim() || 'Ir a votar',
      coverImageUrl: coverImageUrl.value || undefined,
      subtitle:
        emailLocale.value === 'en' ? subtitleEn.value || undefined : subtitleEs.value || undefined,
      name: emailLocale.value === 'en' ? 'User' : 'Usuario',
      vars: {
        name: emailLocale.value === 'en' ? 'User' : 'Usuario',
        pollTitle:
          emailLocale.value === 'en'
            ? props.pollTitleEn || props.pollTitle || 'Poll'
            : props.pollTitle || 'Votación',
      },
    })
    previewSubject.value = preview?.subject || emailForm.value.subject
    previewHtml.value = String(preview?.html || '').replace(
      /cid:vmm-logo/g,
      `${window.location.origin}/logo-votos.png`,
    )
  } catch (error) {
    previewHtml.value = ''
    errorMessage.value = error?.message || 'No se pudo generar la vista previa.'
  } finally {
    isLoadingPreview.value = false
  }
}

const schedulePreview = () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    if (isOpen.value) refreshPreview()
  }, 350)
}

const sendEmail = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!emailForm.value.subject.trim() || !emailForm.value.message.trim()) {
    errorMessage.value = 'Asunto y mensaje ES del correo son obligatorios.'
    return
  }
  if (!emailForm.value.subjectEn.trim() || !emailForm.value.messageEn.trim()) {
    errorMessage.value = 'Subject y message EN del correo son obligatorios.'
    return
  }

  if (
    !window.confirm(
      '¿Enviar este correo personalizado a todos los usuarios con email?',
    )
  ) {
    return
  }

  isSendingEmail.value = true
  activeJob.value = {
    status: 'queued',
    subject: emailForm.value.subject,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    percent: 0,
  }

  try {
    const started = await sendAdminBulkEmail({
      subject: emailForm.value.subject.trim(),
      message: emailForm.value.message.trim(),
      subjectEn: emailForm.value.subjectEn.trim(),
      messageEn: emailForm.value.messageEn.trim(),
      sendToAll: true,
      template: 'poll',
      ctaUrl: pollUrl.value,
      ctaLabel: emailForm.value.ctaLabel.trim() || 'Ir a votar',
      ctaLabelEn: emailForm.value.ctaLabelEn.trim() || 'Go vote',
      pollTitle: props.pollTitle || '',
      pollTitleEn: props.pollTitleEn || props.pollTitle || '',
      coverImageUrl: coverImageUrl.value || undefined,
      subtitle: subtitleEs.value || undefined,
      subtitleEn: subtitleEn.value || undefined,
    })
    if (!started?.jobId) throw new Error('No se pudo iniciar el envío de correo.')
    activeJob.value = {
      ...activeJob.value,
      id: started.jobId,
      total: started.total || 0,
      status: started.status || 'queued',
    }
    startJobPolling(started.jobId, 'mail')
  } catch (error) {
    stopJobPolling()
    isSendingEmail.value = false
    activeJob.value = null
    errorMessage.value = error?.message || 'No se pudo enviar el correo.'
  }
}

const sendTest = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (!testTo.value.trim()) {
    errorMessage.value = 'Escribe un correo de prueba.'
    return
  }
  isSendingTest.value = true
  try {
    await sendAdminTestEmail({
      to: testTo.value.trim(),
      subject:
        emailLocale.value === 'en'
          ? emailForm.value.subjectEn.trim()
          : emailForm.value.subject.trim(),
      message:
        emailLocale.value === 'en'
          ? emailForm.value.messageEn.trim()
          : emailForm.value.message.trim(),
      mode: 'poll',
      locale: emailLocale.value,
      ctaUrl: pollUrl.value,
      ctaLabel:
        emailLocale.value === 'en'
          ? emailForm.value.ctaLabelEn.trim() || 'Go vote'
          : emailForm.value.ctaLabel.trim() || 'Ir a votar',
      coverImageUrl: coverImageUrl.value || undefined,
      subtitle:
        emailLocale.value === 'en' ? subtitleEn.value || undefined : subtitleEs.value || undefined,
      vars: {
        name: emailLocale.value === 'en' ? 'User' : 'Usuario',
        pollTitle:
          emailLocale.value === 'en'
            ? props.pollTitleEn || props.pollTitle || ''
            : props.pollTitle || '',
      },
    })
    successMessage.value = `Prueba enviada a ${testTo.value.trim()}. Revisa Mailtrap.`
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo enviar la prueba.'
  } finally {
    isSendingTest.value = false
  }
}

const sendPush = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!pushForm.value.title.trim() || !pushForm.value.body.trim()) {
    errorMessage.value = 'Título y mensaje push (ES) son obligatorios.'
    return
  }

  if (!window.confirm('¿Enviar push a todos los tokens registrados?')) return

  isSendingPush.value = true
  activeJob.value = {
    status: 'queued',
    title: pushForm.value.title,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    percent: 0,
  }

  try {
    const started = await sendAdminPush({
      title: pushForm.value.title.trim(),
      titleEn: pushForm.value.titleEn.trim(),
      body: pushForm.value.body.trim(),
      bodyEn: pushForm.value.bodyEn.trim(),
      url: pollPath.value,
      sendToAll: true,
    })
    if (!started?.jobId) throw new Error('No se pudo iniciar el push.')
    activeJob.value = {
      ...activeJob.value,
      id: started.jobId,
      total: started.total || 0,
      status: started.status || 'queued',
    }
    startJobPolling(started.jobId, 'push')
  } catch (error) {
    stopJobPolling()
    isSendingPush.value = false
    activeJob.value = null
    errorMessage.value = error?.message || 'No se pudo enviar el push.'
  }
}

watch(
  () => [props.pollTitle, props.pollTitleEn, props.pollSlug],
  () => {
    fillDefaults()
    schedulePreview()
  },
)

watch(
  () => [
    emailForm.value.subject,
    emailForm.value.message,
    emailForm.value.subjectEn,
    emailForm.value.messageEn,
    emailForm.value.ctaLabel,
    emailForm.value.ctaLabelEn,
    emailLocale.value,
    isOpen.value,
  ],
  () => schedulePreview(),
)

const toggleOpen = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) refreshPreview()
}

onMounted(() => {
  fillDefaults()
  if (isOpen.value) refreshPreview()
})

onUnmounted(() => {
  stopJobPolling()
  if (previewTimer) clearTimeout(previewTimer)
})
</script>

<template>
  <article class="rounded-3xl border border-cyan-300/20 bg-[#090b19] p-5 shadow-2xl shadow-cyan-950/20 sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
          Notificar votación
        </p>
        <h3 class="mt-2 text-xl font-black text-white">
          Correo personalizado + push
        </h3>
        <p class="mt-1 text-sm text-slate-400">
          Link:
          <span class="font-bold text-slate-200">{{ pollUrl }}</span>
        </p>
      </div>
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 transition hover:bg-white/10"
        @click="toggleOpen"
      >
        {{ isOpen ? 'Ocultar' : 'Ver y lanzar' }}
      </button>
    </div>

    <div v-if="isOpen" class="mt-5 space-y-6">
      <p
        v-if="errorMessage"
        class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
      >
        {{ successMessage }}
      </p>

      <div class="grid gap-6 xl:grid-cols-2">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-sm font-black uppercase tracking-widest text-fuchsia-300">Correo</h4>
            <div class="flex gap-2">
              <button
                type="button"
                class="min-h-9 rounded-2xl px-3 text-[11px] font-black uppercase tracking-wide transition"
                :class="
                  emailLocale === 'es'
                    ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-300'
                "
                @click="emailLocale = 'es'"
              >
                ES
              </button>
              <button
                type="button"
                class="min-h-9 rounded-2xl px-3 text-[11px] font-black uppercase tracking-wide transition"
                :class="
                  emailLocale === 'en'
                    ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-300'
                "
                @click="emailLocale = 'en'"
              >
                EN
              </button>
            </div>
          </div>
          <p class="text-xs text-slate-500">
            Variables:
            <code v-pre class="text-fuchsia-200">{{name}}</code>,
            <code v-pre class="text-fuchsia-200">{{pollTitle}}</code>
          </p>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ emailLocale === 'en' ? 'Subject (EN)' : 'Asunto (ES)' }}
            </span>
            <input
              v-model="activeEmailSubject"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ emailLocale === 'en' ? 'Message (EN)' : 'Mensaje (ES)' }}
            </span>
            <textarea
              v-model="activeEmailMessage"
              rows="7"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/40"
            ></textarea>
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ emailLocale === 'en' ? 'CTA button (EN)' : 'Botón CTA (ES)' }}
            </span>
            <input
              v-model="activeEmailCta"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>

          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              class="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60"
              :disabled="isSendingEmail || !pollSlug"
              @click="sendEmail"
            >
              {{ isSendingEmail ? 'Enviando correo...' : 'Enviar correo a todos' }}
            </button>
          </div>

          <div class="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
            <p class="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Prueba 1 correo</p>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                v-model="testTo"
                type="email"
                placeholder="prueba@mailtrap.io"
                class="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
              />
              <button
                type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 disabled:opacity-60"
                :disabled="isSendingTest || !pollSlug"
                @click="sendTest"
              >
                {{ isSendingTest ? 'Enviando...' : 'Probar' }}
              </button>
            </div>
          </div>

          <div class="space-y-4 border-t border-white/10 pt-5">
            <h4 class="text-sm font-black uppercase tracking-widest text-amber-300">Push</h4>
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Título ES</span>
              <input
                v-model="pushForm.title"
                class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-amber-300/40"
              />
            </label>
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Mensaje ES</span>
              <textarea
                v-model="pushForm.body"
                rows="3"
                class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/40"
              ></textarea>
            </label>
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Title EN</span>
              <input
                v-model="pushForm.titleEn"
                class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-amber-300/40"
              />
            </label>
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Body EN</span>
              <textarea
                v-model="pushForm.bodyEn"
                rows="3"
                class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/40"
              ></textarea>
            </label>
            <button
              type="button"
              class="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-linear-to-r from-amber-400 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60"
              :disabled="isSendingPush || !pollSlug"
              @click="sendPush"
            >
              {{ isSendingPush ? 'Enviando push...' : 'Enviar push a todos' }}
            </button>
          </div>
        </div>

        <div>
          <div class="mb-3 flex items-center justify-between gap-2">
            <h4 class="text-sm font-black uppercase tracking-widest text-slate-300">
              Así se verá el correo
            </h4>
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-200"
              :disabled="isLoadingPreview"
              @click="refreshPreview"
            >
              {{ isLoadingPreview ? '...' : 'Actualizar' }}
            </button>
          </div>
          <p class="mb-3 text-xs text-slate-500">Asunto: {{ previewSubject }}</p>
          <div class="overflow-hidden rounded-2xl border border-white/10 bg-[#03040d]">
            <iframe
              v-if="previewHtml"
              title="Preview correo votación"
              class="h-[40rem] w-full bg-[#03040d]"
              :srcdoc="previewHtml"
            ></iframe>
            <div
              v-else
              class="flex h-64 items-center justify-center text-sm font-bold text-slate-400"
            >
              {{ isLoadingPreview ? 'Generando...' : 'Sin preview' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="activeJob"
        class="fixed inset-x-0 bottom-0 z-70 border-t border-amber-300/30 bg-[#080a18]/95 px-4 py-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:px-6"
      >
        <div class="mx-auto max-w-5xl">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-200">
                {{ jobKind === 'push' ? 'Push' : 'Correo' }} de votación
              </p>
              <p class="mt-1 text-sm font-bold text-slate-300">
                {{ activeJob.processed || 0 }} / {{ activeJob.total || 0 }}
                · {{ activeJob.sent || 0 }} ok
                · {{ activeJob.failed || 0 }} fallidos
                · {{ jobPercent }}%
              </p>
            </div>
            <span
              class="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide"
              :class="
                isJobRunning
                  ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
                  : activeJob.status === 'failed'
                    ? 'border-red-300/40 bg-red-500/15 text-red-100'
                    : 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
              "
            >
              {{ isJobRunning ? 'Enviando' : activeJob.status === 'failed' ? 'Fallido' : 'Terminado' }}
            </span>
          </div>
          <div class="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-amber-300 via-fuchsia-400 to-cyan-400 transition-[width] duration-500"
              :style="{ width: `${jobPercent}%` }"
            ></div>
          </div>
        </div>
      </div>
    </Teleport>
  </article>
</template>
