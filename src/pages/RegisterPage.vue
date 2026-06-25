<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { VueTelInput } from 'vue-tel-input'
import 'vue-tel-input/vue-tel-input.css'
import { auth, db } from '../firebase'
import { translate } from '../i18n'

const fallbackCountries = [
  { name: 'República Dominicana', code: 'DO', flag: '🇩🇴', dialCode: '+1', example: '(809) 000-0000', maxDigits: 10 },
  { name: 'México', code: 'MX', flag: '🇲🇽', dialCode: '+52', example: '55 0000 0000', maxDigits: 10 },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴', dialCode: '+57', example: '300 000 0000', maxDigits: 10 },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷', dialCode: '+54', example: '11 0000 0000', maxDigits: 10 },
  { name: 'Chile', code: 'CL', flag: '🇨🇱', dialCode: '+56', example: '9 0000 0000', maxDigits: 9 },
  { name: 'Perú', code: 'PE', flag: '🇵🇪', dialCode: '+51', example: '900 000 000', maxDigits: 9 },
  { name: 'Ecuador', code: 'EC', flag: '🇪🇨', dialCode: '+593', example: '99 000 0000', maxDigits: 9 },
  { name: 'Venezuela', code: 'VE', flag: '🇻🇪', dialCode: '+58', example: '412 000 0000', maxDigits: 10 },
  { name: 'Estados Unidos', code: 'US', flag: '🇺🇸', dialCode: '+1', example: '(555) 000-0000', maxDigits: 10 },
  { name: 'España', code: 'ES', flag: '🇪🇸', dialCode: '+34', example: '600 000 000', maxDigits: 9 },
  { name: 'Puerto Rico', code: 'PR', flag: '🇵🇷', dialCode: '+1', example: '(787) 000-0000', maxDigits: 10 },
  { name: 'Costa Rica', code: 'CR', flag: '🇨🇷', dialCode: '+506', example: '8000 0000', maxDigits: 8 },
  { name: 'Panamá', code: 'PA', flag: '🇵🇦', dialCode: '+507', example: '6000 0000', maxDigits: 8 },
  { name: 'Guatemala', code: 'GT', flag: '🇬🇹', dialCode: '+502', example: '5000 0000', maxDigits: 8 },
  { name: 'Honduras', code: 'HN', flag: '🇭🇳', dialCode: '+504', example: '9000 0000', maxDigits: 8 },
  { name: 'El Salvador', code: 'SV', flag: '🇸🇻', dialCode: '+503', example: '7000 0000', maxDigits: 8 },
  { name: 'Nicaragua', code: 'NI', flag: '🇳🇮', dialCode: '+505', example: '8000 0000', maxDigits: 8 },
  { name: 'Bolivia', code: 'BO', flag: '🇧🇴', dialCode: '+591', example: '7000 0000', maxDigits: 8 },
  { name: 'Uruguay', code: 'UY', flag: '🇺🇾', dialCode: '+598', example: '90 000 000', maxDigits: 8 },
  { name: 'Paraguay', code: 'PY', flag: '🇵🇾', dialCode: '+595', example: '981 000 000', maxDigits: 9 },
  { name: 'Brasil', code: 'BR', flag: '🇧🇷', dialCode: '+55', example: '11 90000 0000', maxDigits: 11 },
  { name: 'Otro', code: 'OT', flag: '🌎', dialCode: '', example: 'Tu número', maxDigits: 15 },
]

const phoneFormats = {
  AR: { maxDigits: 10, groups: [2, 4, 4], example: '11 0000-0000' },
  BO: { maxDigits: 8, groups: [4, 4], example: '7000-0000' },
  BR: { maxDigits: 11, groups: [2, 5, 4], example: '11 90000-0000' },
  CL: { maxDigits: 9, groups: [1, 4, 4], example: '9 0000-0000' },
  CO: { maxDigits: 10, groups: [3, 3, 4], example: '300 000-0000' },
  CR: { maxDigits: 8, groups: [4, 4], example: '8000-0000' },
  DO: { maxDigits: 10, groups: [3, 3, 4], example: '809 000-0000' },
  EC: { maxDigits: 9, groups: [2, 3, 4], example: '99 000-0000' },
  ES: { maxDigits: 9, groups: [3, 3, 3], example: '600 000 000' },
  GT: { maxDigits: 8, groups: [4, 4], example: '5000-0000' },
  HN: { maxDigits: 8, groups: [4, 4], example: '0000-0000' },
  MX: { maxDigits: 10, groups: [2, 4, 4], example: '55 0000-0000' },
  NI: { maxDigits: 8, groups: [4, 4], example: '8000-0000' },
  PA: { maxDigits: 8, groups: [4, 4], example: '6000-0000' },
  PE: { maxDigits: 9, groups: [3, 3, 3], example: '900 000 000' },
  PR: { maxDigits: 10, groups: [3, 3, 4], example: '787 000-0000' },
  PY: { maxDigits: 9, groups: [3, 3, 3], example: '981 000 000' },
  SV: { maxDigits: 8, groups: [4, 4], example: '7000-0000' },
  US: { maxDigits: 10, groups: [3, 3, 4], example: '555 000-0000' },
  UY: { maxDigits: 8, groups: [2, 3, 3], example: '90 000 000' },
  VE: { maxDigits: 10, groups: [3, 3, 4], example: '412 000-0000' },
}

const currentStep = ref(1)
const firstName = ref('')
const lastName = ref('')
const username = ref('')
const country = ref('')
const countrySearch = ref('')
const isCountryDropdownOpen = ref(false)
const countries = ref(fallbackCountries)
const phoneCountry = ref(null)
const phone = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptedTerms = ref(false)
const isTermsModalOpen = ref(false)
const isLoadingCountries = ref(false)
const isLoading = ref(false)
const isCheckingUsername = ref(false)
const isCheckingPhone = ref(false)
const isUsernameAvailable = ref(false)
const isPhoneValid = ref(false)
const errorMessage = ref('')
const usernameMessage = ref('')
const phoneMessage = ref('')
const phoneApiInternational = ref('')
let isFormattingPhone = false
let usernameCheckTimeout

const totalSteps = 3
const fullName = computed(() => `${firstName.value.trim()} ${lastName.value.trim()}`.trim())
const normalizedUsername = computed(() => username.value.trim().toLowerCase())
const selectedResidenceCountry = computed(() => countries.value.find((item) => item.name === country.value))
const selectedPhoneCountry = computed(() => phoneCountry.value)
const selectedPhoneFormat = computed(() => phoneFormats[selectedPhoneCountry.value?.code?.toUpperCase()] || {
  maxDigits: 15,
  groups: [3, 3, 4, 5],
  example: translate('register.placeholders.phone'),
})
const filteredCountries = computed(() => {
  const search = countrySearch.value.trim().toLowerCase()

  if (!search) {
    return countries.value
  }

  return countries.value.filter((item) => (
    item.name.toLowerCase().includes(search)
    || item.code.toLowerCase().includes(search)
    || item.dialCode?.includes(search)
  ))
})
const phoneInternational = computed(() => {
  if (!phone.value.trim()) {
    return phone.value.trim()
  }

  return selectedPhoneCountry.value?.dialCode
    ? `${selectedPhoneCountry.value.dialCode} ${phone.value.trim()}`
    : phone.value.trim()
})
const phoneForSave = computed(() => phoneApiInternational.value || phoneInternational.value)
const phoneDigits = computed(() => phone.value.replace(/\D/g, ''))
const hasExpectedPhoneLength = computed(() => (
  phoneDigits.value.length === selectedPhoneFormat.value.maxDigits
))

const closeTermsModal = () => {
  isTermsModalOpen.value = false
}

const handleEscape = (event) => {
  if (event.key === 'Escape' && isTermsModalOpen.value) {
    closeTermsModal()
  }

  if (event.key === 'Escape' && isCountryDropdownOpen.value) {
    isCountryDropdownOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
  loadResidenceCountries()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  clearTimeout(usernameCheckTimeout)
})

const friendlyAuthError = (error) => {
  const messages = {
    'auth/email-already-in-use': translate('register.errors.emailInUse'),
    'auth/invalid-email': translate('register.errors.invalidEmail'),
    'auth/weak-password': translate('register.errors.weakPassword'),
  }

  return messages[error.code] || translate('register.errors.createAccount')
}

const countryCodeToFlag = (countryCode) => countryCode
  .toUpperCase()
  .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()))

const countryNameInSpanish = (countryCode, fallbackName) => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(countryCode) || fallbackName
  } catch (error) {
    return fallbackName
  }
}

const loadResidenceCountries = async () => {
  isLoadingCountries.value = true

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 7000)
    const response = await fetch('https://date.nager.at/api/v3/AvailableCountries', {
      signal: controller.signal,
    })

    window.clearTimeout(timeout)

    if (!response.ok) {
      throw new Error('countries-api-error')
    }

    const data = await response.json()

    countries.value = data
      .map((item) => ({
        name: countryNameInSpanish(item.countryCode, item.name),
        code: item.countryCode,
        flag: countryCodeToFlag(item.countryCode),
        dialCode: '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  } catch (error) {
    countries.value = fallbackCountries
  } finally {
    isLoadingCountries.value = false
  }
}

const handlePhoneCountryChanged = (newCountry) => {
  phoneCountry.value = {
    name: newCountry.name,
    code: newCountry.iso2,
    flag: '',
    dialCode: `+${newCountry.dialCode}`,
  }

  if (!phone.value.trim()) {
    phoneMessage.value = ''
    phoneApiInternational.value = ''
    isPhoneValid.value = false
  }
}

const applyPhoneMask = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, selectedPhoneFormat.value.maxDigits)
  const parts = []
  let cursor = 0

  selectedPhoneFormat.value.groups.forEach((groupSize, index) => {
    const part = digits.slice(cursor, cursor + groupSize)

    if (!part) {
      return
    }

    parts.push(part)
    cursor += groupSize

    if (index === selectedPhoneFormat.value.groups.length - 1 && cursor < digits.length) {
      parts.push(digits.slice(cursor))
    }
  })

  if (parts.length <= 1) {
    return parts[0] || ''
  }

  const lastPart = parts.pop()
  return `${parts.join(' ')}-${lastPart}`
}

const handlePhoneInput = (number) => {
  if (isFormattingPhone) {
    return
  }

  const formattedPhone = applyPhoneMask(number || phone.value)

  if (formattedPhone !== phone.value) {
    isFormattingPhone = true
    phone.value = formattedPhone
    window.queueMicrotask(() => {
      isFormattingPhone = false
    })
  }

  phoneMessage.value = ''
  phoneApiInternational.value = ''
}

const handlePhoneValidate = (phoneObject) => {
  phoneMessage.value = ''
  isPhoneValid.value = phoneObject?.isValid === true || hasExpectedPhoneLength.value

  if (!phone.value.trim()) {
    phoneApiInternational.value = ''
    return
  }

  phoneApiInternational.value = phoneObject?.formatted || phoneObject?.number || phoneInternational.value
  phoneMessage.value = isPhoneValid.value ? translate('register.states.phoneValid') : translate('register.states.phoneInvalid')
}

const selectCountry = (selectedCountry) => {
  country.value = selectedCountry.name
  countrySearch.value = ''
  isCountryDropdownOpen.value = false
}

const validatePhoneWithApi = async () => {
  phoneMessage.value = ''
  phoneApiInternational.value = ''

  if (!phone.value.trim()) {
    return true
  }

  if (!isPhoneValid.value && !hasExpectedPhoneLength.value) {
    phoneMessage.value = translate('register.states.phoneInvalid')
    errorMessage.value = translate('register.errors.invalidPhoneOptional')
    return false
  }

  isPhoneValid.value = true
  phoneApiInternational.value = phoneInternational.value

  const endpoint = import.meta.env.VITE_PHONE_VALIDATION_API_URL

  if (!endpoint) {
    phoneMessage.value = ''
    return true
  }

  isCheckingPhone.value = true

  try {
    const url = new URL(endpoint, window.location.origin)
    url.searchParams.set('phone', phoneInternational.value)
    url.searchParams.set('countryCode', selectedPhoneCountry.value?.code || '')

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('phone-api-error')
    }

    const data = await response.json()
    const isValid = data.valid === true || data.isValid === true

    if (!isValid) {
      phoneMessage.value = translate('register.errors.invalidPhoneCountry')
      errorMessage.value = translate('register.errors.invalidPhoneOptional')
      return false
    }

    phoneApiInternational.value = data.internationalFormat || data.formatInternational || phoneInternational.value
    phoneMessage.value = translate('register.states.phoneValid')
    isPhoneValid.value = true
    return true
  } catch (error) {
    phoneMessage.value = translate('register.errors.validatePhone')
    errorMessage.value = translate('register.errors.validatePhone')
    return false
  } finally {
    isCheckingPhone.value = false
  }
}

const validateUsernameFormat = (showError = true) => {
  if (!normalizedUsername.value) {
    if (showError) {
      errorMessage.value = translate('register.errors.usernameRequired')
    }

    return translate('register.errors.usernameRequired')
  }

  if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername.value)) {
    if (showError) {
      errorMessage.value = translate('register.errors.usernameFormat')
    }

    return translate('register.errors.usernameFormat')
  }

  return ''
}

const checkUsernameAvailable = async (showError = true) => {
  usernameMessage.value = ''
  isUsernameAvailable.value = false

  const formatError = validateUsernameFormat(showError)

  if (formatError) {
    return false
  }

  const usernameToCheck = normalizedUsername.value
  isCheckingUsername.value = true

  try {
    const usernameSnap = await getDoc(doc(db, 'usernames', usernameToCheck))

    if (usernameToCheck !== normalizedUsername.value) {
      return false
    }

    if (usernameSnap.exists()) {
      usernameMessage.value = translate('register.errors.usernameTaken')

      if (showError) {
        errorMessage.value = translate('register.errors.usernameTaken')
      }

      return false
    }

    usernameMessage.value = translate('register.states.usernameValid')
    isUsernameAvailable.value = true
    return true
  } catch (error) {
    usernameMessage.value = translate('register.errors.validateUsername')

    if (showError) {
      errorMessage.value = translate('register.errors.validateUsernamePermissions')
    }

    return false
  } finally {
    isCheckingUsername.value = false
  }
}

watch(normalizedUsername, () => {
  clearTimeout(usernameCheckTimeout)
  usernameMessage.value = ''
  isUsernameAvailable.value = false

  if (validateUsernameFormat(false)) {
    return
  }

  usernameCheckTimeout = setTimeout(() => {
    checkUsernameAvailable(false)
  }, 600)
})

watch(country, () => {
  phoneMessage.value = ''
  phoneApiInternational.value = ''
  isPhoneValid.value = false
})

const validateProfileStep = async () => {
  if (!firstName.value.trim()) {
    errorMessage.value = translate('register.errors.firstNameRequired')
    return false
  }

  if (!lastName.value.trim()) {
    errorMessage.value = translate('register.errors.lastNameRequired')
    return false
  }

  return checkUsernameAvailable()
}

const validateContactStep = async () => {
  if (!email.value.trim()) {
    errorMessage.value = translate('register.errors.emailRequired')
    return false
  }

  if (!country.value) {
    errorMessage.value = translate('register.errors.countryRequired')
    return false
  }

  return validatePhoneWithApi()
}

const goToNextStep = async () => {
  errorMessage.value = ''

  if (currentStep.value === 1 && !(await validateProfileStep())) {
    return
  }

  if (currentStep.value === 2 && !(await validateContactStep())) {
    return
  }

  currentStep.value += 1
}

const goToPreviousStep = () => {
  errorMessage.value = ''
  currentStep.value -= 1
}

const handleRegister = async () => {
  errorMessage.value = ''
  isLoading.value = true

  try {
    if (!(await validateProfileStep()) || !(await validateContactStep())) {
      return
    }

    if (password.value !== confirmPassword.value) {
      errorMessage.value = translate('register.errors.passwordsMismatch')
      return
    }

    if (!acceptedTerms.value) {
      errorMessage.value = translate('register.errors.termsRequired')
      return
    }

    const credential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    await updateProfile(credential.user, { displayName: fullName.value })

    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', normalizedUsername.value)
      const usernameSnap = await transaction.get(usernameRef)

      if (usernameSnap.exists()) {
        throw new Error('username-unavailable')
      }

      transaction.set(usernameRef, {
        uid: credential.user.uid,
        username: normalizedUsername.value,
        createdAt: serverTimestamp(),
      })
      transaction.set(doc(db, 'users', credential.user.uid), {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        name: fullName.value,
        username: normalizedUsername.value,
        country: selectedResidenceCountry.value?.name || country.value,
        countryCode: selectedResidenceCountry.value?.code || '',
        phoneCountry: selectedPhoneCountry.value?.name || '',
        phoneCountryCode: selectedPhoneCountry.value?.code || '',
        phoneDialCode: selectedPhoneCountry.value?.dialCode || '',
        phone: phone.value.trim(),
        phoneInternational: phoneForSave.value,
        email: email.value.trim(),
        points: 25,
        spentPoints: 0,
        createdAt: serverTimestamp(),
      })
    })

    window.location.href = '/'
  } catch (error) {
    errorMessage.value = error.message === 'username-unavailable'
      ? translate('register.errors.usernameTaken')
      : friendlyAuthError(error)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <section class="sm:px-6">
    <div class="mx-auto w-full max-w-2xl overflow-hidden rounded-b-4xl bg-[#080a18] p-0 text-white shadow-2xl shadow-fuchsia-950/40 sm:rounded-4xl sm:border sm:border-violet-300/25 sm:p-1">
      <div class="relative overflow-hidden rounded-b-[calc(2rem-4px)] p-6 sm:rounded-[calc(2rem-4px)] sm:p-8">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(236,72,153,0.34),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(34,211,238,0.2),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,8,32,0.98))]"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-20 left-8 size-52 rounded-full bg-cyan-400/10 blur-3xl"></div>

        <div class="relative z-10">
          <a href="/" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
            {{ $t('register.backHome') }}
          </a>

          <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">{{ $t('register.eyebrow') }}</p>
          <h1 class="mt-2 text-3xl font-black leading-tight sm:text-5xl">{{ $t('register.title') }}</h1>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            {{ $t('register.description') }}
          </p>

          <form class="mt-7 space-y-5" @submit.prevent="handleRegister">
            <div class="grid grid-cols-3 gap-2">
              <div
                v-for="step in totalSteps"
                :key="step"
                class="h-2 rounded-full transition"
                :class="step <= currentStep ? 'bg-fuchsia-400' : 'bg-white/10'"
              ></div>
            </div>

            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ $t('register.step', { current: currentStep, total: totalSteps }) }}
            </p>

            <div v-if="currentStep === 1" class="space-y-4">
              <p class="text-lg font-black text-white">{{ $t('register.sections.profile') }}</p>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.username') }}</span>
                <input
                  v-model="username"
                  type="text"
                  required
                  autocomplete="username"
                  class="mt-2 min-h-12 w-full rounded-lg border bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:bg-white/8 focus:ring-0"
                  :class="[
                    isUsernameAvailable && 'border-emerald-300/60 focus:border-emerald-300/80',
                    usernameMessage && !isUsernameAvailable && 'border-red-300/70 focus:border-red-300',
                    !usernameMessage && !isUsernameAvailable && 'border-white/10 focus:border-white/20',
                  ]"
                  :placeholder="$t('register.placeholders.username')"
                />
                <p v-if="isCheckingUsername" class="mt-2 text-xs font-bold text-slate-400">
                  {{ $t('register.states.checkingUsername') }}
                </p>
                <p
                  v-else-if="usernameMessage"
                  class="mt-2 text-xs font-bold"
                  :class="isUsernameAvailable ? 'text-emerald-300' : 'text-red-200'"
                >
                  {{ usernameMessage }}
                </p>
              </label>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.firstName') }}</span>
                  <input
                    v-model="firstName"
                    type="text"
                    required
                    class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                    :placeholder="$t('register.placeholders.firstName')"
                  />
                </label>

                <label class="block">
                  <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.lastName') }}</span>
                  <input
                    v-model="lastName"
                    type="text"
                    required
                    class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                    :placeholder="$t('register.placeholders.lastName')"
                  />
                </label>
              </div>

            </div>

            <div v-else-if="currentStep === 2" class="space-y-4">
              <p class="text-lg font-black text-white">{{ $t('register.sections.contact') }}</p>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.email') }}</span>
                <input
                  v-model="email"
                  type="email"
                  required
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  :placeholder="$t('register.placeholders.email')"
                />
              </label>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.residenceCountry') }}</span>
                <div class="relative mt-2">
                  <button
                    type="button"
                    class="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-5 text-left text-sm text-white outline-none transition hover:bg-white/8 focus:border-white/20 focus:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="isLoadingCountries"
                    @click="isCountryDropdownOpen = !isCountryDropdownOpen"
                  >
                    <span v-if="selectedResidenceCountry" class="flex items-center gap-2">
                      <span>{{ selectedResidenceCountry.flag }}</span>
                      <span>{{ selectedResidenceCountry.name }}</span>
                    </span>
                    <span v-else class="text-slate-400">
                      {{ isLoadingCountries ? $t('register.states.loadingCountries') : $t('register.placeholders.selectCountry') }}
                    </span>
                    <span class="text-slate-500">⌄</span>
                  </button>

                  <div
                    v-if="isCountryDropdownOpen"
                    class="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b1024] shadow-2xl shadow-black/40"
                  >
                    <input
                      v-model="countrySearch"
                      type="search"
                      class="min-h-12 w-full border-b border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-slate-500"
                      :placeholder="$t('register.placeholders.searchCountry')"
                    />
                    <div class="max-h-56 overflow-y-auto p-2">
                      <button
                        v-for="item in filteredCountries"
                        :key="item.code"
                        type="button"
                        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
                        :class="country === item.name ? 'bg-fuchsia-500/20 text-fuchsia-100' : 'text-slate-300'"
                        @click="selectCountry(item)"
                      >
                        <span>{{ item.flag }}</span>
                        <span>{{ item.name }}</span>
                      </button>
                      <p v-if="!filteredCountries.length" class="px-3 py-2 text-sm text-slate-400">
                        {{ $t('register.states.noCountryFound') }}
                      </p>
                    </div>
                  </div>
                </div>
              </label>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.phone') }} <span class="text-slate-500">{{ $t('register.fields.optional') }}</span></span>
                <VueTelInput
                  v-model="phone"
                  class="mt-2 register-phone-input"
                  mode="national"
                  :auto-default-country="false"
                  :auto-format="false"
                  default-country="DO"
                  :valid-characters-only="true"
                  :dropdown-options="{
                    showDialCodeInList: true,
                    showDialCodeInSelection: true,
                    showFlags: true,
                    showSearchBox: true,
                    searchBoxPlaceholder: $t('register.placeholders.searchCountry'),
                  }"
                  :input-options="{
                    placeholder: selectedPhoneFormat.example,
                    inputmode: 'tel',
                  }"
                  @on-input="handlePhoneInput"
                  @country-changed="handlePhoneCountryChanged"
                  @validate="handlePhoneValidate"
                />
                <p v-if="selectedPhoneCountry" class="mt-2 text-xs font-bold text-slate-400">
                  {{ $t('register.states.selectedCode', { country: selectedPhoneCountry.name, dialCode: selectedPhoneCountry.dialCode }) }}
                </p>
                <p
                  v-if="phoneMessage"
                  class="mt-2 text-xs font-bold"
                  :class="isPhoneValid ? 'text-emerald-300' : 'text-red-200'"
                >
                  {{ phoneMessage }}
                </p>
              </label>
            </div>

            <div v-else class="space-y-4">
              <p class="text-lg font-black text-white">{{ $t('register.sections.security') }}</p>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.password') }}</span>
                <input
                  v-model="password"
                  type="password"
                  required
                  minlength="6"
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  :placeholder="$t('register.placeholders.password')"
                />
              </label>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('register.fields.confirmPassword') }}</span>
                <input
                  v-model="confirmPassword"
                  type="password"
                  required
                  minlength="6"
                  class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  :placeholder="$t('register.placeholders.confirmPassword')"
                />
              </label>

              <label class="block pb-3 text-sm text-slate-300">
                <input
                  v-model="acceptedTerms"
                  type="checkbox"
                  required
                  class="mt-0.5 size-4 rounded border border-white/10 bg-white/5 text-fuchsia-500 accent-fuchsia-500 outline-none transition focus:ring-0 focus:ring-offset-0"
                />
                <span>
                  {{ $t('register.terms.acceptPrefix') }}
                  <a
                    href="/terminos-y-condiciones"
                    class="font-black text-fuchsia-300 transition hover:text-white"
                  >
                    {{ $t('register.terms.link') }}
                  </a>
                </span>
              </label>
            </div>

            <p v-if="errorMessage" class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
              {{ errorMessage }}
            </p>

            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-if="currentStep > 1"
                type="button"
                class="min-h-13 rounded-2xl border border-white/10 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                :disabled="isLoading"
                @click="goToPreviousStep"
              >
                {{ $t('register.actions.previous') }}
              </button>

              <button
                v-if="currentStep < totalSteps"
                type="button"
                class="min-h-13 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] hover:shadow-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                :class="currentStep === 1 ? 'sm:col-span-2' : ''"
                :disabled="isCheckingUsername || isCheckingPhone"
                @click="goToNextStep"
              >
                {{ $t('register.actions.next') }}
              </button>

              <button
                v-else
                type="submit"
                class="min-h-13 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] hover:shadow-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isLoading"
              >
                {{ isLoading ? $t('register.states.creatingAccount') : $t('register.actions.createAccount') }}
              </button>
            </div>
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
            <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">{{ $t('register.sections.legal') }}</p>
            <h3 class="mt-2 text-2xl font-black">{{ $t('register.terms.title') }}</h3>
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
          <p>{{ $t('register.terms.one') }}</p>
          <p>{{ $t('register.terms.two') }}</p>
          <p>{{ $t('register.terms.three') }}</p>
        </div>

        <button
          type="button"
          class="mt-6 min-h-12 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase text-white"
          @click="closeTermsModal"
        >
          {{ $t('register.actions.understood') }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.register-phone-input {
  min-height: 3rem;
  border-color: rgb(255 255 255 / 0.1);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.05);
}

.register-phone-input:focus-within {
  border-color: rgb(255 255 255 / 0.2);
  box-shadow: none;
}

.register-phone-input :deep(.vti__dropdown),
.register-phone-input :deep(.vti__input) {
  min-height: 3rem;
  background: transparent;
  color: #fff;
}

.register-phone-input :deep(.vti__input::placeholder) {
  color: #64748b;
}

.register-phone-input :deep(.vti__dropdown-list) {
  border-color: rgb(255 255 255 / 0.1);
  background: #0b1024;
  color: #e2e8f0;
}

.register-phone-input :deep(.vti__dropdown-item.highlighted),
.register-phone-input :deep(.vti__dropdown-item:hover) {
  background: rgb(255 255 255 / 0.1);
}

.register-phone-input :deep(.vti__search_box) {
  border-color: rgb(255 255 255 / 0.1);
  background: rgb(255 255 255 / 0.05);
  color: #fff;
}
</style>
