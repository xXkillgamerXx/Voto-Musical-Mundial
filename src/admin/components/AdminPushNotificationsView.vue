<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getAdminPushJob, getAdminPushUsers, sendAdminPush } from '../../services/api/adminApi'

const users = ref([])
const selectedUserIds = ref([])
const isLoading = ref(true)
const isSending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const manualToken = ref('')
const sendToAll = ref(false)
const result = ref(null)
const activeJob = ref(null)
const activeLocale = ref('es')
const localeTabs = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

const form = ref({
  title: 'Music Mundial VOTING',
  titleEn: 'Worldwide Votes',
  body: 'Tienes una nueva notificacion.',
  bodyEn: 'You have a new notification.',
  url: '/',
})

let jobTimer = null

const selectedCount = computed(() => selectedUserIds.value.length)

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

const stopJobPolling = () => {
  if (jobTimer) {
    clearInterval(jobTimer)
    jobTimer = null
  }
}

const applyFinishedJob = (job) => {
  result.value = {
    sent: job.sent || 0,
    failed: job.failed || 0,
    total: job.total || 0,
    errors: job.errors || [],
  }

  if (job.status === 'failed') {
    errorMessage.value = job.error || 'No se pudo enviar el push.'
    successMessage.value = ''
    return
  }

  successMessage.value = `Push enviado: ${job.sent || 0}/${job.total || 0} correctos.`
}

const pollJob = async (jobId) => {
  try {
    const job = await getAdminPushJob(jobId)
    activeJob.value = job

    if (job.status === 'done' || job.status === 'failed') {
      stopJobPolling()
      isSending.value = false
      applyFinishedJob(job)
    }
  } catch (error) {
    stopJobPolling()
    isSending.value = false
    errorMessage.value = error?.message || 'No se pudo consultar el progreso del push.'
  }
}

const startJobPolling = (jobId) => {
  stopJobPolling()
  pollJob(jobId)
  jobTimer = setInterval(() => {
    pollJob(jobId)
  }, 1000)
}

const loadUsers = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    users.value = await getAdminPushUsers(search.value, 80)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar usuarios con tokens.'
  } finally {
    isLoading.value = false
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

const copyToken = async (token) => {
  if (!token) return
  await navigator.clipboard?.writeText(token).catch(() => {})
  successMessage.value = 'Token copiado.'
}

const sendPush = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  result.value = null

  const tokens = manualToken.value
    .split(/[\n,]/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (!form.value.title.trim() || !form.value.body.trim()) {
    errorMessage.value = 'Titulo y mensaje en español son obligatorios.'
    return
  }

  if (!sendToAll.value && !selectedUserIds.value.length && !tokens.length) {
    errorMessage.value = 'Selecciona usuarios, pega un token o marca enviar a todos.'
    return
  }

  isSending.value = true
  activeJob.value = {
    status: 'queued',
    title: form.value.title,
    body: form.value.body,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    percent: 0,
  }

  try {
    const started = await sendAdminPush({
      title: form.value.title,
      titleEn: form.value.titleEn,
      body: form.value.body,
      bodyEn: form.value.bodyEn,
      url: form.value.url || '/',
      userIds: selectedUserIds.value,
      tokens,
      sendToAll: sendToAll.value,
    })

    if (!started?.jobId) {
      throw new Error('No se pudo iniciar el envio.')
    }

    activeJob.value = {
      ...activeJob.value,
      id: started.jobId,
      total: started.total || 0,
      status: started.status || 'queued',
    }
    startJobPolling(started.jobId)
  } catch (error) {
    stopJobPolling()
    isSending.value = false
    activeJob.value = null
    errorMessage.value = error?.message || 'No se pudo enviar el push.'
  }
}

onMounted(loadUsers)

onUnmounted(() => {
  stopJobPolling()
})
</script>

<template>
  <section class="space-y-6 pb-36">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Push notifications
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            Enviar notificacion a usuarios
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            Elige usuarios con token FCM, pega un token manual o envia a todos los registrados.
          </p>
        </div>
        <button
          type="button"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white sm:w-auto"
          @click="loadUsers"
        >
          Actualizar tokens
        </button>
      </div>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
      >
        {{ successMessage }}
      </p>
    </article>

    <div class="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <h3 class="text-lg font-black text-white">Mensaje</h3>

        <div class="mt-4 grid gap-3">
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

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ activeLocale === 'es' ? 'Titulo (ES)' : 'Title (EN)' }}
            </span>
            <input
              v-if="activeLocale === 'es'"
              v-model="form.title"
              class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Titulo de la notificacion"
            />
            <input
              v-else
              v-model="form.titleEn"
              class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Notification title"
            />
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ activeLocale === 'es' ? 'Mensaje (ES)' : 'Message (EN)' }}
            </span>
            <textarea
              v-if="activeLocale === 'es'"
              v-model="form.body"
              rows="4"
              class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Texto que vera el usuario"
            ></textarea>
            <textarea
              v-else
              v-model="form.bodyEn"
              rows="4"
              class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Text the user will see"
            ></textarea>
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Link al abrir</span>
            <input
              v-model="form.url"
              class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="/votaciones"
            />
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Token manual para prueba</span>
            <textarea
              v-model="manualToken"
              rows="4"
              class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-xs text-white outline-none transition focus:border-cyan-300/50"
              placeholder="Pega aqui un token FCM para probar"
            ></textarea>
          </label>

          <label class="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100">
            <input
              v-model="sendToAll"
              type="checkbox"
              class="size-4 accent-amber-300"
            />
            Enviar a todos los tokens registrados
          </label>

          <button
            type="button"
            class="min-h-12 rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSending"
            @click="sendPush"
          >
            {{ isSending ? 'Enviando...' : 'Enviar push' }}
          </button>

          <div
            v-if="result && !isJobRunning"
            class="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"
          >
            <p class="font-black text-white">
              Resultado: {{ result.sent }} enviados, {{ result.failed }} fallidos, {{ result.total }} tokens.
            </p>
            <div v-if="result.errors?.length" class="mt-3 space-y-2">
              <p class="text-xs font-black uppercase tracking-widest text-red-200">Errores</p>
              <p
                v-for="item in result.errors"
                :key="`${item.token}-${item.code}`"
                class="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100"
              >
                {{ item.token }} · {{ item.code }} · {{ item.message }}
              </p>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-black text-white">Usuarios con token</h3>
            <p class="mt-1 text-sm text-slate-400">
              Seleccionados: {{ selectedCount }}
            </p>
          </div>
          <form class="flex gap-2" @submit.prevent="loadUsers">
            <input
              v-model="search"
              class="min-h-10 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
              placeholder="Buscar usuario"
            />
            <button
              type="submit"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            >
              Buscar
            </button>
          </form>
        </div>

        <div v-if="isLoading" class="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300">
          Cargando usuarios...
        </div>

        <div v-else class="mt-5 space-y-2">
          <div
            v-for="user in users"
            :key="user.id"
            class="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
          >
            <input
              type="checkbox"
              class="size-5 accent-fuchsia-400"
              :checked="selectedUserIds.includes(String(user.id))"
              @change="toggleUser(user.id)"
            />
            <div class="min-w-0">
              <p class="truncate text-sm font-black text-white">{{ user.name }}</p>
              <p class="truncate text-xs text-slate-400">{{ user.email || 'sin email' }}</p>
              <p class="mt-1 font-mono text-[10px] text-slate-500">{{ user.sampleTokenShort || 'sin token visible' }}</p>
            </div>
            <div class="flex flex-wrap gap-2 sm:justify-end">
              <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">
                {{ user.tokenCount }} token(s)
              </span>
              <button
                type="button"
                class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200 transition hover:bg-white/10"
                @click="copyToken(user.sampleToken)"
              >
                Copiar token
              </button>
            </div>
          </div>

          <div v-if="!users.length" class="rounded-2xl border border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            Todavia no hay usuarios con token push. Primero el usuario debe aceptar notificaciones en la web.
          </div>
        </div>
      </article>
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
                Envio push en curso
              </p>
              <p class="mt-1 truncate text-sm font-black text-white">
                {{ activeJob.title || 'Notificacion' }}
              </p>
              <p class="mt-1 text-sm font-bold text-slate-300">
                {{ activeJob.processed || 0 }} / {{ activeJob.total || 0 }} tokens
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
