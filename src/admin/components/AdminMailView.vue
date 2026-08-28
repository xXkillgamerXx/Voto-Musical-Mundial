<script setup>
import { onMounted, ref } from 'vue'
import { getAdminMailStatus, sendAdminTestEmail } from '../../services/api/adminApi'

const status = ref(null)
const isLoading = ref(true)
const isSending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const lastResult = ref(null)

const form = ref({
  to: '',
  subject: 'Prueba de correo — Music Mundial',
  message:
    'Hola,\n\nEste es un correo de prueba enviado desde el panel de administración.\n\nSi lo ves en Mailtrap, SMTP funciona correctamente.',
})

const loadStatus = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    status.value = await getAdminMailStatus()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar el estado SMTP.'
  } finally {
    isLoading.value = false
  }
}

const sendTest = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  lastResult.value = null

  if (!form.value.to.trim()) {
    errorMessage.value = 'Escribe el correo de destino.'
    return
  }

  isSending.value = true

  try {
    lastResult.value = await sendAdminTestEmail({
      to: form.value.to.trim(),
      subject: form.value.subject.trim(),
      message: form.value.message.trim(),
    })
    successMessage.value = `Correo enviado a ${lastResult.value.to}. Revisa la bandeja de Mailtrap.`
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo enviar el correo.'
  } finally {
    isSending.value = false
  }
}

onMounted(loadStatus)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Correo
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            Enviar correo de prueba
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            Usa Mailtrap sandbox para probar. Remitente:
            <span class="font-bold text-slate-200">noreply@musicmundial.com</span>
          </p>
        </div>
        <button
          type="button"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white sm:w-auto"
          :disabled="isLoading"
          @click="loadStatus"
        >
          <i class="fa-solid fa-rotate-right mr-2" aria-hidden="true"></i>
          Actualizar estado
        </button>
      </div>

      <div
        v-if="isLoading"
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
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2 lg:col-span-1">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Remitente</p>
          <p class="mt-2 truncate text-sm font-black text-white">{{ status.from }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2 lg:col-span-1">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Servidor</p>
          <p class="mt-2 text-sm font-black text-white">
            {{ status.host || '—' }}<span v-if="status.port">:{{ status.port }}</span>
          </p>
        </div>
      </div>

      <p
        v-if="status && !status.configured"
        class="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
        Falta SMTP en el servidor (<code class="text-amber-50">SMTP_HOST</code>,
        <code class="text-amber-50">SMTP_USER</code>,
        <code class="text-amber-50">SMTP_PASS</code>).
      </p>
    </article>

    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <form class="space-y-4" @submit.prevent="sendTest">
        <div>
          <label class="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Destinatario
          </label>
          <input
            v-model="form.to"
            type="email"
            required
            placeholder="tu@email.com"
            class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40 focus:bg-white/8"
          />
          <p class="mt-2 text-xs text-slate-500">
            Con Mailtrap sandbox puedes usar cualquier dirección; el correo aparece en tu inbox de Mailtrap.
          </p>
        </div>

        <div>
          <label class="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Asunto
          </label>
          <input
            v-model="form.subject"
            type="text"
            maxlength="200"
            class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40 focus:bg-white/8"
          />
        </div>

        <div>
          <label class="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Mensaje
          </label>
          <textarea
            v-model="form.message"
            rows="6"
            maxlength="5000"
            class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40 focus:bg-white/8"
          ></textarea>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="https://mailtrap.io/signin"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-bold text-fuchsia-300 transition hover:text-fuchsia-200"
          >
            Abrir Mailtrap →
          </a>
          <button
            type="submit"
            class="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSending || !status?.configured"
          >
            {{ isSending ? 'Enviando...' : 'Enviar correo de prueba' }}
          </button>
        </div>
      </form>

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
      <pre
        v-if="lastResult"
        class="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-300"
      >{{ JSON.stringify(lastResult, null, 2) }}</pre>
    </article>
  </section>
</template>
