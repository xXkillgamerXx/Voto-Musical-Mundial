<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  consumeLoginNotice,
  goToVerifyEmail,
  login,
  loginWithGoogle,
  register,
  requestPasswordReset,
} from '../../../src/services/api/authApi'
import { GOOGLE_CLIENT_ID, requestGoogleIdToken } from '../../../src/services/googleAuth'
import { t } from '../lib/copy'

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'login' },
  locale: { type: String, default: 'es' },
})

const emit = defineEmits(['close', 'mode'])

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')
const firstName = ref('')
const lastName = ref('')
const resetEmail = ref('')
const showPassword = ref(false)
const acceptedTerms = ref(false)
const isResetOpen = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isLogin = computed(() => props.mode !== 'register')
const lang = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const title = computed(() => {
  if (isResetOpen.value) return t(lang.value, 'authReset')
  return isLogin.value ? t(lang.value, 'authLogin') : t(lang.value, 'authRegister')
})

watch(
  () => [props.open, props.mode],
  () => {
    errorMessage.value = ''
    successMessage.value = ''
    isResetOpen.value = false
    if (!props.open || props.mode !== 'login') return
    const notice = consumeLoginNotice()
    if (notice === 'passwordReset') {
      successMessage.value = 'Tu contraseña se actualizó. Ya puedes iniciar sesión.'
    } else if (notice === 'resetLinkInvalid') {
      errorMessage.value = 'El enlace para restablecer la contraseña no es válido o ya expiró.'
    }
  },
)

const close = () => emit('close')

const setMode = (mode) => {
  errorMessage.value = ''
  successMessage.value = ''
  isResetOpen.value = false
  emit('mode', mode)
}

const friendlyError = (error) => {
  const message = error?.payload?.message || error?.message
  if (Array.isArray(message)) return message[0] || 'No se pudo completar la acción.'
  return message || 'No se pudo completar la acción.'
}

const handleLogin = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true
  try {
    await login({
      identifier: email.value.trim().toLowerCase(),
      password: password.value,
    })
    close()
  } catch (error) {
    if (error?.payload?.error === 'EMAIL_NOT_VERIFIED' || error?.status === 403) {
      goToVerifyEmail(error?.payload?.email || email.value.trim().toLowerCase())
      return
    }
    errorMessage.value = friendlyError(error)
  } finally {
    isLoading.value = false
  }
}

const handleGoogle = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (!GOOGLE_CLIENT_ID) {
    errorMessage.value = 'Falta configurar Google Sign-In.'
    return
  }
  isLoading.value = true
  try {
    const credential = await requestGoogleIdToken()
    const referralCode = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase()
    await loginWithGoogle({
      credential,
      locale: props.locale === 'en' ? 'en' : 'es',
      ...(referralCode ? { referralCode } : {}),
    })
    close()
  } catch (error) {
    errorMessage.value = friendlyError(error)
  } finally {
    isLoading.value = false
  }
}

const handleReset = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (!resetEmail.value.trim()) {
    errorMessage.value = 'Escribe tu correo para recuperar la contraseña.'
    return
  }
  isLoading.value = true
  try {
    await requestPasswordReset({
      email: resetEmail.value.trim().toLowerCase(),
      locale: 'es',
    })
    successMessage.value = 'Te enviamos un correo para restablecer la contraseña.'
  } catch (error) {
    errorMessage.value = friendlyError(error)
  } finally {
    isLoading.value = false
  }
}

const handleRegister = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  const user = username.value.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(user)) {
    errorMessage.value = 'El usuario debe tener 3 a 20 caracteres: letras, números o _.'
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
  isLoading.value = true
  try {
    const result = await register({
      email: email.value.trim().toLowerCase(),
      password: password.value,
      username: user,
      displayName: `${firstName.value.trim()} ${lastName.value.trim()}`.trim(),
      locale: 'es',
      metadata: {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        locale: 'es',
      },
    })
    if (result?.requiresEmailVerification) {
      successMessage.value = result.message || `Enviamos un código a ${email.value.trim().toLowerCase()}.`
      window.setTimeout(() => goToVerifyEmail(email.value.trim().toLowerCase()), 900)
      return
    }
    goToVerifyEmail(email.value.trim().toLowerCase())
  } catch (error) {
    errorMessage.value = friendlyError(error)
  } finally {
    isLoading.value = false
  }
}

const onKey = (event) => {
  if (event.key === 'Escape' && props.open) close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="notice-modal" @click.self="close">
      <div class="notice-dialog auth-dialog" role="dialog" aria-modal="true" :aria-label="title">
        <div class="auth-head">
          <h2>{{ title }}</h2>
          <p v-if="!isResetOpen" class="auth-lead">
            {{ isLogin ? t(lang, 'authLoginLead') : t(lang, 'authRegisterLead') }}
          </p>
          <p v-else class="auth-lead">{{ t(lang, 'authResetLead') }}</p>
          <button class="auth-close" type="button" :aria-label="t(lang, 'close')" @click="close">×</button>
        </div>

        <div class="auth-body">
          <button
            v-if="!isResetOpen"
            type="button"
            class="auth-google"
            :disabled="isLoading"
            @click="handleGoogle"
          >
            <svg class="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.78-.07-1.53-.2-2.25H12v4.26h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3h3.89c2.27-2.1 3.54-5.18 3.54-8.63z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.89-3c-1.08.72-2.46 1.15-4.05 1.15-3.12 0-5.77-2.11-6.72-4.94H1.26v3.09C3.24 21.31 7.3 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.26C.45 8.24 0 10.07 0 12s.45 3.76 1.26 5.38l4.02-3.09z"/>
              <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.45-3.45C17.95 1.17 15.24 0 12 0 7.3 0 3.24 2.69 1.26 6.62l4.02 3.09C6.23 6.88 8.88 4.77 12 4.77z"/>
            </svg>
            {{ t(lang, 'google') }}
          </button>

          <div v-if="!isResetOpen" class="auth-or"><span>{{ t(lang, 'or') }}</span></div>

          <form v-if="isResetOpen" class="auth-form" @submit.prevent="handleReset">
            <label>
              {{ t(lang, 'email') }}
              <input v-model="resetEmail" type="email" required placeholder="you@email.com" />
            </label>
            <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="auth-ok">{{ successMessage }}</p>
            <button class="auth-submit" type="submit" :disabled="isLoading">
              {{ isLoading ? t(lang, 'sending') : t(lang, 'sendLink') }}
            </button>
            <button class="auth-ghost" type="button" @click="isResetOpen = false">{{ t(lang, 'backToLogin') }}</button>
          </form>

          <form v-else-if="isLogin" class="auth-form" @submit.prevent="handleLogin">
            <label>
              {{ t(lang, 'email') }}
              <input v-model="email" type="email" required placeholder="you@email.com" />
            </label>
            <label>
              {{ t(lang, 'password') }}
              <span class="auth-pass">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="8"
                  :placeholder="t(lang, 'passwordPlaceholder')"
                />
                <button
                  type="button"
                  class="auth-eye"
                  :aria-label="showPassword ? t(lang, 'hidePassword') : t(lang, 'showPassword')"
                  @click="showPassword = !showPassword"
                >
                  <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.6 12S6.2 6.5 12 6.5 21.4 12 21.4 12 17.8 17.5 12 17.5 2.6 12 2.6 12Z" />
                    <circle cx="12" cy="12" r="2.7" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M9.9 6.7A7.6 7.6 0 0 1 12 6.5c5.8 0 9.4 5.5 9.4 5.5a16 16 0 0 1-3.2 3.5" />
                    <path d="M6.6 8.7A16 16 0 0 0 2.6 12S6.2 17.5 12 17.5c1.1 0 2.1-.2 3.1-.5" />
                    <path d="M10.1 10.2a2.7 2.7 0 0 0 3.7 3.7" />
                  </svg>
                </button>
              </span>
            </label>
            <button class="auth-link" type="button" @click="isResetOpen = true; resetEmail = email">
              {{ t(lang, 'forgot') }}
            </button>
            <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="auth-ok">{{ successMessage }}</p>
            <button class="auth-submit" type="submit" :disabled="isLoading">
              {{ isLoading ? t(lang, 'entering') : t(lang, 'authLogin') }}
            </button>
            <p class="auth-switch">
              {{ t(lang, 'noAccount') }}
              <button type="button" @click="setMode('register')">{{ t(lang, 'signUp') }}</button>
            </p>
          </form>

          <form v-else class="auth-form" @submit.prevent="handleRegister">
            <label>
              {{ t(lang, 'username') }}
              <input v-model="username" type="text" required minlength="3" maxlength="20" placeholder="your_user" />
            </label>
            <label>
              {{ t(lang, 'firstName') }}
              <input v-model="firstName" type="text" required :placeholder="t(lang, 'firstName')" />
            </label>
            <label>
              {{ t(lang, 'lastName') }}
              <input v-model="lastName" type="text" required :placeholder="t(lang, 'lastName')" />
            </label>
            <label>
              {{ t(lang, 'email') }}
              <input v-model="email" type="email" required placeholder="you@email.com" />
            </label>
            <label>
              {{ t(lang, 'password') }}
              <input v-model="password" type="password" required minlength="8" :placeholder="t(lang, 'passwordPlaceholder')" />
            </label>
            <label>
              {{ t(lang, 'confirmPassword') }}
              <input v-model="confirmPassword" type="password" required minlength="8" :placeholder="t(lang, 'repeatPassword')" />
            </label>
            <label class="auth-check">
              <input v-model="acceptedTerms" type="checkbox" />
              <span>
                {{ t(lang, 'acceptTerms') }}
                <a href="https://www.musicmundial.com/terminos-y-condiciones/" target="_blank" rel="noreferrer">{{ t(lang, 'terms') }}</a>
              </span>
            </label>
            <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="auth-ok">{{ successMessage }}</p>
            <button class="auth-submit" type="submit" :disabled="isLoading">
              {{ isLoading ? t(lang, 'creating') : t(lang, 'authRegister') }}
            </button>
            <p class="auth-switch">
              {{ t(lang, 'hasAccount') }}
              <button type="button" @click="setMode('login')">{{ t(lang, 'signIn') }}</button>
            </p>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
