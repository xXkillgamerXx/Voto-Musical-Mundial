<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getAdminMailJob,
  getAdminMailStatus,
  getAdminMailUsers,
  getAdminVerificationMailTemplate,
  previewAdminMail,
  saveAdminVerificationMailTemplate,
  sendAdminBulkEmail,
  sendAdminTestEmail,
  sendAdminVerificationTestEmail,
} from '../../services/api/adminApi'

const mailTab = ref('broadcast')
const mailTabs = [
  { value: 'broadcast', label: 'Comunicado' },
  { value: 'verification', label: 'Código de verificación' },
]

const status = ref(null)
const users = ref([])
const totalWithEmail = ref(0)
const selectedUserIds = ref([])
const search = ref('')
const sendToAll = ref(false)
const isLoadingStatus = ref(true)
const isLoadingUsers = ref(true)
const isSendingTest = ref(false)
const isSendingBulk = ref(false)
const isSavingVerification = ref(false)
const isLoadingPreview = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const lastResult = ref(null)
const activeJob = ref(null)
const previewHtml = ref('')
const previewSubject = ref('')
const showPreview = ref(true)
const verificationLocale = ref('es')
const broadcastLocale = ref('es')

const form = ref({
  to: '',
  subject: 'Comunicado · Votos Mundial',
  message:
    'Hola,\n\nTenemos novedades en Votos Mundial. Entra a la plataforma para ver las votaciones activas y apoyar a tus artistas.\n\n¡Gracias por formar parte de la comunidad!',
  subjectEn: 'Announcement · Votos Mundial',
  messageEn:
    'Hi,\n\nWe have news on Votos Mundial. Open the platform to see active polls and support your artists.\n\nThanks for being part of the community!',
})

const activeBroadcastSubject = computed({
  get: () =>
    broadcastLocale.value === 'en' ? form.value.subjectEn : form.value.subject,
  set: (value) => {
    if (broadcastLocale.value === 'en') form.value.subjectEn = value
    else form.value.subject = value
  },
})

const activeBroadcastMessage = computed({
  get: () =>
    broadcastLocale.value === 'en' ? form.value.messageEn : form.value.message,
  set: (value) => {
    if (broadcastLocale.value === 'en') form.value.messageEn = value
    else form.value.message = value
  },
})

const verificationForm = ref({
  es: {
    subject: '',
    preheader: '',
    title: '',
    intro: '',
    expiryBody: '',
    expiryBadge: '',
    security: '',
  },
  en: {
    subject: '',
    preheader: '',
    title: '',
    intro: '',
    expiryBody: '',
    expiryBadge: '',
    security: '',
  },
  sampleName: 'Usuario',
  sampleCode: '847291',
  to: '',
})

const activeVerificationCopy = computed(() => verificationForm.value[verificationLocale.value])

let jobTimer = null
let previewTimer = null

const selectedCount = computed(() => selectedUserIds.value.length)

const jobPercent = computed(() => {
  const job = activeJob.value
  if (!job) return 0
  if (typeof job.percent === 'number') return Math.min(100, Math.max(0, job.percent))
  if (!job.total) return 0
  return Math.min(100, Math.round((Number(job.processed || 0) / Number(job.total)) * 100))
})

const isJobRunning = computed(() => {
  const statusValue = activeJob.value?.status
  return statusValue === 'queued' || statusValue === 'running'
})

const stopJobPolling = () => {
  if (jobTimer) {
    clearInterval(jobTimer)
    jobTimer = null
  }
}

const applyFinishedJob = (job) => {
  lastResult.value = {
    sent: job.sent || 0,
    failed: job.failed || 0,
    total: job.total || 0,
    errors: job.errors || [],
  }

  if (job.status === 'failed') {
    errorMessage.value = job.error || 'No se pudo completar el envío.'
    successMessage.value = ''
    return
  }

  successMessage.value = `Correo enviado: ${job.sent || 0}/${job.total || 0} correctos. Revisa Mailtrap.`
}

const pollJob = async (jobId) => {
  try {
    const job = await getAdminMailJob(jobId)
    activeJob.value = job

    if (job.status === 'done' || job.status === 'failed') {
      stopJobPolling()
      isSendingBulk.value = false
      applyFinishedJob(job)
    }
  } catch (error) {
    stopJobPolling()
    isSendingBulk.value = false
    errorMessage.value = error?.message || 'No se pudo consultar el progreso del correo.'
  }
}

const startJobPolling = (jobId) => {
  stopJobPolling()
  pollJob(jobId)
  jobTimer = setInterval(() => {
    pollJob(jobId)
  }, 1000)
}

const loadStatus = async () => {
  isLoadingStatus.value = true
  errorMessage.value = ''

  try {
    status.value = await getAdminMailStatus()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar el estado SMTP.'
  } finally {
    isLoadingStatus.value = false
  }
}

const loadUsers = async () => {
  isLoadingUsers.value = true
  errorMessage.value = ''

  try {
    const response = await getAdminMailUsers(search.value, 100)
    users.value = response?.users || []
    totalWithEmail.value = Number(response?.totalWithEmail || 0)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar usuarios con correo.'
  } finally {
    isLoadingUsers.value = false
  }
}

const loadVerificationTemplate = async () => {
  try {
    const template = await getAdminVerificationMailTemplate()
    verificationForm.value.es = { ...verificationForm.value.es, ...(template?.es || {}) }
    verificationForm.value.en = { ...verificationForm.value.en, ...(template?.en || {}) }
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar la plantilla de verificación.'
  }
}

const toggleUser = (userId) => {
  const value = String(userId)
  if (selectedUserIds.value.includes(value)) {
    selectedUserIds.value = selectedUserIds.value.filter((id) => id !== value)
    return
  }
  selectedUserIds.value = [...selectedUserIds.value, value]
}

const applyPreviewHtml = (html, subjectFallback) => {
  previewSubject.value = subjectFallback
  previewHtml.value = String(html || '').replace(
    /cid:vmm-logo/g,
    `${window.location.origin}/logo-votos.png`,
  )
}

const refreshPreview = async () => {
  isLoadingPreview.value = true

  try {
    if (mailTab.value === 'verification') {
      const preview = await previewAdminMail({
        mode: 'verification',
        locale: verificationLocale.value,
        name: verificationForm.value.sampleName,
        code: verificationForm.value.sampleCode,
        copy: activeVerificationCopy.value,
      })
      applyPreviewHtml(preview?.html, preview?.subject || activeVerificationCopy.value.subject)
      return
    }

    const preview = await previewAdminMail({
      subject:
        broadcastLocale.value === 'en'
          ? form.value.subjectEn.trim() || form.value.subject.trim()
          : form.value.subject.trim(),
      message:
        broadcastLocale.value === 'en'
          ? form.value.messageEn.trim() || form.value.message.trim()
          : form.value.message.trim(),
      mode: sendToAll.value || selectedUserIds.value.length ? 'broadcast' : 'test',
      locale: broadcastLocale.value,
      name: broadcastLocale.value === 'en' ? 'User' : 'Usuario',
    })
    applyPreviewHtml(preview?.html, preview?.subject || form.value.subject)
  } catch (error) {
    previewHtml.value = ''
    if (!errorMessage.value) {
      errorMessage.value = error?.message || 'No se pudo generar la vista previa.'
    }
  } finally {
    isLoadingPreview.value = false
  }
}

const schedulePreview = () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    refreshPreview()
  }, 350)
}

const sendTest = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  lastResult.value = null

  if (!form.value.to.trim()) {
    errorMessage.value = 'Escribe el correo de destino para la prueba.'
    return
  }

  isSendingTest.value = true

  try {
    lastResult.value = await sendAdminTestEmail({
      to: form.value.to.trim(),
      subject:
        broadcastLocale.value === 'en'
          ? form.value.subjectEn.trim() || form.value.subject.trim()
          : form.value.subject.trim(),
      message:
        broadcastLocale.value === 'en'
          ? form.value.messageEn.trim() || form.value.message.trim()
          : form.value.message.trim(),
      mode: 'broadcast',
      locale: broadcastLocale.value,
    })
    successMessage.value = `Correo de prueba enviado a ${lastResult.value.to}. Revisa la bandeja de Mailtrap.`
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo enviar el correo.'
  } finally {
    isSendingTest.value = false
  }
}

const sendVerificationTest = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  lastResult.value = null

  if (!verificationForm.value.to.trim()) {
    errorMessage.value = 'Escribe el correo de destino para la prueba del código.'
    return
  }

  isSendingTest.value = true

  try {
    lastResult.value = await sendAdminVerificationTestEmail({
      to: verificationForm.value.to.trim(),
      locale: verificationLocale.value,
      name: verificationForm.value.sampleName,
      code: verificationForm.value.sampleCode,
      copy: activeVerificationCopy.value,
    })
    successMessage.value = `Correo de código enviado a ${lastResult.value.to}. Revisa Mailtrap.`
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo enviar el correo de verificación.'
  } finally {
    isSendingTest.value = false
  }
}

const saveVerification = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  isSavingVerification.value = true

  try {
    await saveAdminVerificationMailTemplate({
      es: verificationForm.value.es,
      en: verificationForm.value.en,
    })
    successMessage.value = 'Plantilla del código de verificación guardada. Ya se usa en registros reales.'
    await refreshPreview()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar la plantilla.'
  } finally {
    isSavingVerification.value = false
  }
}

const sendBulk = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  lastResult.value = null

  if (!form.value.subject.trim() || !form.value.message.trim()) {
    errorMessage.value = 'Asunto y mensaje en español son obligatorios.'
    return
  }

  if (!form.value.subjectEn.trim() || !form.value.messageEn.trim()) {
    errorMessage.value = 'Asunto y mensaje en inglés son obligatorios.'
    return
  }

  if (!sendToAll.value && !selectedUserIds.value.length) {
    errorMessage.value = 'Selecciona usuarios o marca enviar a todos.'
    return
  }

  const totalTarget = sendToAll.value ? totalWithEmail.value : selectedUserIds.value.length
  const confirmed = window.confirm(
    sendToAll.value
      ? `¿Enviar este correo a TODOS los usuarios con email (~${totalTarget})?`
      : `¿Enviar este correo a ${selectedUserIds.value.length} usuario(s) seleccionado(s)?`,
  )
  if (!confirmed) return

  isSendingBulk.value = true
  activeJob.value = {
    status: 'queued',
    subject: form.value.subject,
    total: totalTarget,
    processed: 0,
    sent: 0,
    failed: 0,
    percent: 0,
  }

  try {
    const started = await sendAdminBulkEmail({
      subject: form.value.subject.trim(),
      message: form.value.message.trim(),
      subjectEn: form.value.subjectEn.trim(),
      messageEn: form.value.messageEn.trim(),
      userIds: selectedUserIds.value,
      sendToAll: sendToAll.value,
    })

    if (!started?.jobId) {
      throw new Error('No se pudo iniciar el envío.')
    }

    activeJob.value = {
      ...activeJob.value,
      id: started.jobId,
      total: started.total || totalTarget,
      status: started.status || 'queued',
    }
    startJobPolling(started.jobId)
  } catch (error) {
    stopJobPolling()
    isSendingBulk.value = false
    activeJob.value = null
    errorMessage.value = error?.message || 'No se pudo enviar el correo masivo.'
  }
}

watch(mailTab, () => {
  schedulePreview()
})

watch(
  () => [
    form.value.subject,
    form.value.message,
    form.value.subjectEn,
    form.value.messageEn,
    broadcastLocale.value,
    sendToAll.value,
    selectedUserIds.value.length,
    verificationLocale.value,
    verificationForm.value.sampleName,
    verificationForm.value.sampleCode,
    verificationForm.value.es,
    verificationForm.value.en,
  ],
  () => {
    schedulePreview()
  },
  { deep: true },
)

onMounted(async () => {
  await Promise.all([loadStatus(), loadUsers(), loadVerificationTemplate()])
  await refreshPreview()
})

onUnmounted(() => {
  stopJobPolling()
  if (previewTimer) clearTimeout(previewTimer)
})
</script>

<template>
  <section class="space-y-6 pb-36">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Correo
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            Enviar y editar correos
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            Remitente:
            <span class="font-bold text-slate-200">noreply@musicmundial.com</span>
          </p>
        </div>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <a
            href="https://mailtrap.io/signin"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center justify-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-black text-fuchsia-200 transition hover:bg-fuchsia-500/20"
          >
            Abrir Mailtrap →
          </a>
          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            :disabled="isLoadingStatus"
            @click="loadStatus"
          >
            <i class="fa-solid fa-rotate-right mr-2" aria-hidden="true"></i>
            Actualizar SMTP
          </button>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <button
          v-for="tab in mailTabs"
          :key="tab.value"
          type="button"
          class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
          :class="
            mailTab === tab.value
              ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
              : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          "
          @click="mailTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-if="isLoadingStatus"
        class="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400"
      >
        Comprobando SMTP...
      </div>

      <div
        v-else-if="status"
        class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">SMTP</p>
          <p
            class="mt-2 text-lg font-black"
            :class="status.configured ? 'text-emerald-300' : 'text-red-300'"
          >
            {{ status.configured ? 'Configurado' : 'Sin configurar' }}
          </p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Conexión</p>
          <p
            class="mt-2 text-lg font-black"
            :class="status.verified ? 'text-emerald-300' : 'text-amber-300'"
          >
            {{ status.verified ? 'Verificada' : 'No verificada' }}
          </p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Usuarios con email</p>
          <p class="mt-2 text-lg font-black text-white">{{ totalWithEmail }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Servidor</p>
          <p class="mt-2 text-sm font-black text-white">
            {{ status.host || '—' }}<span v-if="status.port">:{{ status.port }}</span>
          </p>
        </div>
      </div>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
      >
        {{ successMessage }}
      </p>
    </article>

    <div
      class="grid gap-6"
      :class="showPreview ? 'xl:grid-cols-[1fr_1fr]' : ''"
    >
      <article
        v-if="mailTab === 'broadcast'"
        class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-lg font-black text-white">Mensaje</h3>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
              :class="
                broadcastLocale === 'es'
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300'
              "
              @click="broadcastLocale = 'es'"
            >
              ES
            </button>
            <button
              type="button"
              class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
              :class="
                broadcastLocale === 'en'
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300'
              "
              @click="broadcastLocale = 'en'"
            >
              EN
            </button>
          </div>
        </div>

        <div class="mt-4 space-y-4">
          <div>
            <label class="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {{ broadcastLocale === 'en' ? 'Subject (EN)' : 'Asunto (ES)' }}
            </label>
            <input
              v-model="activeBroadcastSubject"
              type="text"
              maxlength="200"
              class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            />
          </div>

          <div>
            <label class="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {{ broadcastLocale === 'en' ? 'Message (EN)' : 'Mensaje (ES)' }}
            </label>
            <textarea
              v-model="activeBroadcastMessage"
              rows="8"
              maxlength="5000"
              class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            ></textarea>
          </div>

          <p class="text-xs text-slate-500">
            Al enviar a todos, cada usuario recibe ES o EN según su idioma (por defecto español).
          </p>
          <label class="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100">
            <input v-model="sendToAll" type="checkbox" class="size-4 accent-amber-300" />
            Enviar a todos los usuarios con correo ({{ totalWithEmail }})
          </label>

          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              class="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
              :disabled="isSendingBulk || !status?.configured"
              @click="sendBulk"
            >
              {{ isSendingBulk ? 'Enviando...' : 'Enviar a seleccionados / todos' }}
            </button>
            <button
              type="button"
              class="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              @click="showPreview = !showPreview"
            >
              {{ showPreview ? 'Ocultar diseño' : 'Ver diseño' }}
            </button>
          </div>

          <div class="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
            <p class="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Prueba rápida (1 destinatario)
            </p>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                v-model="form.to"
                type="email"
                placeholder="prueba@mailtrap.io"
                class="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
              />
              <button
                type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                :disabled="isSendingTest || !status?.configured"
                @click="sendTest"
              >
                {{ isSendingTest ? 'Enviando...' : 'Enviar prueba' }}
              </button>
            </div>
          </div>
        </div>
      </article>

      <article
        v-else
        class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-black text-white">Correo del código</h3>
            <p class="mt-1 text-sm text-slate-400">
              Edita lo que ven al registrarse. Usa
              <code class="text-fuchsia-200">{'{{name}}'}</code>
              para el nombre.
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
              :class="
                verificationLocale === 'es'
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300'
              "
              @click="verificationLocale = 'es'"
            >
              ES
            </button>
            <button
              type="button"
              class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
              :class="
                verificationLocale === 'en'
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300'
              "
              @click="verificationLocale = 'en'"
            >
              EN
            </button>
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Asunto</span>
            <input
              v-model="activeVerificationCopy.subject"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Título</span>
            <input
              v-model="activeVerificationCopy.title"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Intro</span>
            <textarea
              v-model="activeVerificationCopy.intro"
              rows="3"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/40"
            ></textarea>
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Caducidad</span>
            <input
              v-model="activeVerificationCopy.expiryBody"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Badge</span>
            <input
              v-model="activeVerificationCopy.expiryBadge"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Aviso de seguridad</span>
            <textarea
              v-model="activeVerificationCopy.security"
              rows="3"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/40"
            ></textarea>
          </label>
          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Preheader</span>
            <input
              v-model="activeVerificationCopy.preheader"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
            />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Nombre demo</span>
              <input
                v-model="verificationForm.sampleName"
                class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Código demo</span>
              <input
                v-model="verificationForm.sampleCode"
                class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              class="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
              :disabled="isSavingVerification"
              @click="saveVerification"
            >
              {{ isSavingVerification ? 'Guardando...' : 'Guardar plantilla' }}
            </button>
            <button
              type="button"
              class="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              @click="showPreview = !showPreview"
            >
              {{ showPreview ? 'Ocultar diseño' : 'Ver diseño' }}
            </button>
          </div>

          <div class="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
            <p class="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Enviar prueba del código
            </p>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                v-model="verificationForm.to"
                type="email"
                placeholder="prueba@mailtrap.io"
                class="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-fuchsia-300/40"
              />
              <button
                type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                :disabled="isSendingTest || !status?.configured"
                @click="sendVerificationTest"
              >
                {{ isSendingTest ? 'Enviando...' : 'Enviar prueba' }}
              </button>
            </div>
          </div>
        </div>
      </article>

      <article
        v-if="showPreview"
        class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-black text-white">Así se verá el correo</h3>
            <p class="mt-1 text-sm text-slate-400">
              Asunto: {{ previewSubject }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            :disabled="isLoadingPreview"
            @click="refreshPreview"
          >
            {{ isLoadingPreview ? 'Actualizando...' : 'Actualizar' }}
          </button>
        </div>

        <div class="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#03040d]">
          <iframe
            v-if="previewHtml"
            title="Vista previa del correo"
            class="h-[42rem] w-full bg-[#03040d]"
            :srcdoc="previewHtml"
          ></iframe>
          <div
            v-else
            class="flex h-64 items-center justify-center text-sm font-bold text-slate-400"
          >
            {{ isLoadingPreview ? 'Generando diseño...' : 'Sin vista previa' }}
          </div>
        </div>
      </article>
    </div>

    <article
      v-if="mailTab === 'broadcast'"
      class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-lg font-black text-white">Usuarios con correo</h3>
          <p class="mt-1 text-sm text-slate-400">
            Seleccionados: {{ selectedCount }} · Total: {{ totalWithEmail }}
          </p>
        </div>
        <form class="flex gap-2" @submit.prevent="loadUsers">
          <input
            v-model="search"
            class="min-h-10 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
            placeholder="Buscar usuario o email"
          />
          <button
            type="submit"
            class="rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
          >
            Buscar
          </button>
        </form>
      </div>

      <div
        v-if="isLoadingUsers"
        class="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300"
      >
        Cargando usuarios...
      </div>

      <div v-else class="mt-5 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        <div
          v-for="user in users"
          :key="user.id"
          class="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:grid-cols-[auto_1fr] sm:items-center"
        >
          <input
            type="checkbox"
            class="size-5 accent-fuchsia-400"
            :disabled="sendToAll"
            :checked="selectedUserIds.includes(String(user.id))"
            @change="toggleUser(user.id)"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-black text-white">{{ user.name }}</p>
            <p class="truncate text-xs text-slate-400">{{ user.email }}</p>
          </div>
        </div>

        <div
          v-if="!users.length"
          class="rounded-2xl border border-white/10 px-4 py-6 text-sm font-bold text-slate-400"
        >
          No hay usuarios con correo para mostrar.
        </div>
      </div>
    </article>

    <Teleport to="body">
      <div
        v-if="activeJob"
        class="fixed inset-x-0 bottom-0 z-70 border-t border-amber-300/30 bg-[#080a18]/95 px-4 py-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:px-6"
      >
        <div class="mx-auto max-w-5xl">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-200">
                Envío de correo en curso
              </p>
              <p class="mt-1 truncate text-sm font-black text-white">
                {{ activeJob.subject || 'Correo' }}
              </p>
              <p class="mt-1 text-sm font-bold text-slate-300">
                {{ activeJob.processed || 0 }} / {{ activeJob.total || 0 }} correos
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
              {{
                isJobRunning
                  ? 'Enviando'
                  : activeJob.status === 'failed'
                    ? 'Fallido'
                    : 'Terminado'
              }}
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
  </section>
</template>
