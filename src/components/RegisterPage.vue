<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '../firebase'

const name = ref('')
const country = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptedTerms = ref(false)
const isTermsModalOpen = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

const closeTermsModal = () => {
  isTermsModalOpen.value = false
}

const handleEscape = (event) => {
  if (event.key === 'Escape' && isTermsModalOpen.value) {
    closeTermsModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})

const friendlyAuthError = (error) => {
  const messages = {
    'auth/email-already-in-use': 'Ese correo ya está registrado.',
    'auth/invalid-email': 'Escribe un correo válido.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  }

  return messages[error.code] || 'No se pudo crear la cuenta. Intenta de nuevo.'
}

const handleRegister = async () => {
  errorMessage.value = ''
  isLoading.value = true

  try {
    if (!name.value.trim()) {
      errorMessage.value = 'Escribe tu nombre.'
      return
    }

    if (!country.value) {
      errorMessage.value = 'Selecciona tu país.'
      return
    }

    if (password.value !== confirmPassword.value) {
      errorMessage.value = 'Las contraseñas no coinciden.'
      return
    }

    if (!acceptedTerms.value) {
      errorMessage.value = 'Debes aceptar los términos y condiciones.'
      return
    }

    const credential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    await updateProfile(credential.user, { displayName: name.value.trim() })
    window.location.href = '/'
  } catch (error) {
    errorMessage.value = friendlyAuthError(error)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-96px)] max-w-352 items-center px-4 py-10 sm:px-6">
    <div class="mx-auto w-full max-w-2xl overflow-hidden rounded-4xl border border-violet-300/25 bg-[#080a18] p-1 text-white shadow-2xl shadow-fuchsia-950/40">
      <div class="relative overflow-hidden rounded-[calc(2rem-4px)] p-6 sm:p-8">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(236,72,153,0.34),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(34,211,238,0.2),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,8,32,0.98))]"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-20 left-8 size-52 rounded-full bg-cyan-400/10 blur-3xl"></div>

        <div class="relative z-10">
          <a href="/" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
            ← Volver al inicio
          </a>

          <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">Registro fan</p>
          <h1 class="mt-2 text-3xl font-black leading-tight sm:text-5xl">Crear cuenta</h1>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Completa tus datos básicos para votar, reclamar puntos y guardar tu progreso.
          </p>

          <form class="mt-7 space-y-4" @submit.prevent="handleRegister">
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              Datos básicos
            </p>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Nombre</span>
                <input
                  v-model="name"
                  type="text"
                  required
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  placeholder="Tu nombre fan"
                />
              </label>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">País</span>
                <select
                  v-model="country"
                  required
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/8 focus:ring-0"
                >
                  <option value="" class="bg-slate-950 text-slate-400">Selecciona tu país</option>
                  <option class="bg-slate-950" value="Republica Dominicana">República Dominicana</option>
                  <option class="bg-slate-950" value="Mexico">México</option>
                  <option class="bg-slate-950" value="Colombia">Colombia</option>
                  <option class="bg-slate-950" value="Argentina">Argentina</option>
                  <option class="bg-slate-950" value="Chile">Chile</option>
                  <option class="bg-slate-950" value="Peru">Perú</option>
                  <option class="bg-slate-950" value="Ecuador">Ecuador</option>
                  <option class="bg-slate-950" value="Venezuela">Venezuela</option>
                  <option class="bg-slate-950" value="Estados Unidos">Estados Unidos</option>
                  <option class="bg-slate-950" value="Espana">España</option>
                  <option class="bg-slate-950" value="Otro">Otro</option>
                </select>
              </label>
            </div>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Correo</span>
              <input
                v-model="email"
                type="email"
                required
                class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                placeholder="tu@email.com"
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Contraseña</span>
                <input
                  v-model="password"
                  type="password"
                  required
                  minlength="6"
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  placeholder="Mínimo 6 caracteres"
                />
              </label>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Confirmar contraseña</span>
                <input
                  v-model="confirmPassword"
                  type="password"
                  required
                  minlength="6"
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  placeholder="Repite tu contraseña"
                />
              </label>
            </div>

            <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
              <input
                v-model="acceptedTerms"
                type="checkbox"
                required
                class="mt-0.5 size-4 rounded border border-white/10 bg-white/5 text-fuchsia-500 accent-fuchsia-500 outline-none transition focus:ring-0 focus:ring-offset-0"
              />
              <span>
                Acepto los
                <button
                  type="button"
                  class="font-black text-fuchsia-300 transition hover:text-white"
                  @click.prevent="isTermsModalOpen = true"
                >
                  términos y condiciones
                </button>
              </span>
            </label>

            <p v-if="errorMessage" class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
              {{ errorMessage }}
            </p>

            <button
              type="submit"
              class="min-h-13 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] hover:shadow-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isLoading"
            >
              {{ isLoading ? 'Creando cuenta...' : 'Crear cuenta' }}
            </button>
          </form>
        </div>
      </div>
    </div>

    <div
      v-if="isTermsModalOpen"
      class="fixed inset-0 z-70 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      @click.self="closeTermsModal"
    >
      <div class="w-full max-w-lg rounded-3xl border border-white/10 bg-[#090b19] p-6 text-white shadow-2xl shadow-black/40">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">Legal</p>
            <h3 class="mt-2 text-2xl font-black">Términos y condiciones</h3>
          </div>
          <button
            type="button"
            class="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            @click="closeTermsModal"
          >
            ×
          </button>
        </div>

        <div class="mt-5 space-y-3 text-sm leading-6 text-slate-300">
          <p>Al crear una cuenta aceptas usar la plataforma de forma responsable y respetar las reglas de votación.</p>
          <p>Los puntos, recompensas y rachas pueden ajustarse si se detecta abuso, fraude o actividad automática.</p>
          <p>Tu correo se usa para iniciar sesión, recuperar tu cuenta y guardar tu progreso.</p>
        </div>

        <button
          type="button"
          class="mt-6 min-h-12 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase text-white"
          @click="closeTermsModal"
        >
          Entendido
        </button>
      </div>
    </div>
  </section>
</template>
