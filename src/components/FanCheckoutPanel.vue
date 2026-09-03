<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CHECKOUT_COUNTRIES,
  checkoutTotals,
  findStoreItem,
  formatStoreMoney,
  getFanStore,
  loadFanStore,
} from '../services/fanStore'
import { getArtistsCached } from '../services/firebaseCache'
import { getCurrentApiAuth, getMe } from '../services/api/authApi'
import { getStoredAuth, setStoredAuth } from '../services/api/client'
import { applyArtistLocale } from '../utils/pollLocale'
import { routePath } from '../utils/localizedRoutes'
import { saveFanPurchase } from '../utils/fanMembership'
import { downloadFanInvoice } from '../utils/fanInvoice'
import { capturePaypalOrder, createPaypalOrder, getPaypalConfig } from '../services/api/fanApi'
import { fanMembershipState, fanPackDiscount, loadFanMe } from '../utils/fanPerks'
import MegaUpgradePills from './MegaUpgradePills.vue'

const props = defineProps({
  sku: { type: String, default: 'FAN' },
  currency: { type: String, default: 'USD' },
  yearly: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { locale } = useI18n()
const lang = computed(() => (String(locale.value || 'es').startsWith('en') ? 'en' : 'es'))
const plansHref = computed(() => routePath('plans', locale.value))
const profileHref = computed(() => {
  const username = getCurrentApiAuth()?.user?.username
  return username ? `/user/${username}` : routePath('profile', locale.value)
})
const currencyCode = computed(() => (props.currency === 'COP' ? 'COP' : 'USD'))

const original = ref(findStoreItem(props.sku))
const item = ref({ ...original.value })
const megaNow = ref(false)
const country = ref('CO')
const phoneDigits = ref('')
const method = ref('paypal')
const artists = ref([])
const search = ref('')
const page = ref(0)
const picked = ref([])
const errorMessage = ref('')
const isPaying = ref(false)
const paid = ref(null)
const paidStep = ref('invoice')
const isDownloadingInvoice = ref(false)
const paypalConfig = ref({ enabled: false, clientId: '', mode: 'sandbox', currency: 'USD' })
const paypalHost = ref(null)
let paypalButtons = null
let paypalSdkKey = ''
const PER = 6

const megaPlan = computed(() => getFanStore().plans.find((plan) => plan.sku === 'MEGA'))

const resetForSku = () => {
  original.value = findStoreItem(props.sku)
  item.value = { ...original.value }
  megaNow.value = false
  picked.value = []
  paid.value = null
  paidStep.value = 'invoice'
  errorMessage.value = ''
  search.value = ''
  page.value = 0
  prefillSupportedArtists()
}

const prefillSupportedArtists = () => {
  if (item.value.type === 'pack' || picked.value.length) return
  const current = fanMembershipState.value?.membership
  if (!current || current.expired || current.type === 'pack') return
  const next = (current.artists || [])
    .map((row) => ({
      id: String(row.id || ''),
      name: row.name,
      image: row.image || '',
    }))
    .filter((row) => row.id)
  if (next.length) picked.value = next
}

const lockedArtistIds = computed(() => {
  const current = fanMembershipState.value?.membership
  if (!current || current.expired || current.type === 'pack') return new Set()
  return new Set((current.artists || []).map((row) => String(row.id || '')).filter(Boolean))
})

const isLockedArtist = (id) => lockedArtistIds.value.has(String(id))

watch(() => [props.sku, props.currency, props.yearly], resetForSku)

const money = (amount) => formatStoreMoney(amount, currencyCode.value)

const totals = computed(() =>
  checkoutTotals(item.value, {
    currency: currencyCode.value,
    yearly: props.yearly,
    country: country.value,
    packDiscount: item.value.type === 'pack' ? fanPackDiscount.value : 0,
  }),
)

const isColombia = computed(() => country.value === 'CO')

const selectedCountry = computed(
  () => CHECKOUT_COUNTRIES.find((row) => row.code === country.value) || CHECKOUT_COUNTRIES[0],
)

const phoneMaxDigits = computed(() => Number(selectedCountry.value.maxDigits || 10))

const formatNationalPhone = (digits) => {
  const code = selectedCountry.value.code
  if (code === 'US' || code === 'DO') {
    const a = digits.slice(0, 3)
    const b = digits.slice(3, 6)
    const c = digits.slice(6, 10)
    if (!digits) return ''
    if (digits.length <= 3) return `(${a}`
    if (digits.length <= 6) return `(${a}) ${b}`
    return `(${a}) ${b}-${c}`
  }
  const groups = selectedCountry.value.groups || [3, 3, 4]
  const parts = []
  let i = 0
  for (const size of groups) {
    if (i >= digits.length) break
    parts.push(digits.slice(i, i + size))
    i += size
  }
  if (parts.length <= 1) return parts[0] || ''
  if (code === 'ES') return parts.join(' ')
  const last = parts.pop()
  return `${parts.join(' ')}-${last}`
}

const phoneDisplay = computed(() => formatNationalPhone(phoneDigits.value))

const phoneFormatMaxLength = computed(() => {
  const sample = '0'.repeat(phoneMaxDigits.value)
  return Math.max(formatNationalPhone(sample).length, 14)
})

const phone = computed(() => `${selectedCountry.value.dial}${phoneDigits.value}`)

const phoneReady = computed(() => phoneDigits.value.length === phoneMaxDigits.value)

const localizedArtists = computed(() =>
  artists.value.map((artist) => applyArtistLocale(artist, locale.value)),
)

const filteredArtists = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return localizedArtists.value
  return localizedArtists.value.filter((artist) =>
    String(artist.name || '').toLowerCase().includes(query),
  )
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredArtists.value.length / PER)))

const pageArtists = computed(() => {
  const start = page.value * PER
  return filteredArtists.value.slice(start, start + PER)
})

const itemIcon = computed(() =>
  item.value.type === 'pack' ? 'fa-solid fa-gift' : item.value.icon || 'fa-solid fa-bolt',
)

const paidArtistNames = computed(() =>
  (paid.value?.artists || []).map((row) => row.name).filter(Boolean).join(', '),
)

const congratsTitle = computed(() => {
  if (!paid.value) return ''
  if (paid.value.type === 'pack') {
    return lang.value === 'en' ? 'A gift just arrived' : 'Te llegó un regalo'
  }
  return lang.value === 'en'
    ? `Congratulations, you're ${paid.value.name}`
    : `Felicidades, ya eres ${paid.value.name}`
})

const congratsCopy = computed(() => {
  if (!paid.value) return ''
  if (paid.value.type === 'pack') {
    const pts = paid.value.welcomePts || paid.value.pointsAwarded || 0
    return lang.value === 'en'
      ? `+${pts} pts added to your balance. Use them whenever you vote.`
      : `+${pts} pts a tu saldo. Úsalos cuando votes.`
  }
  if (paidArtistNames.value) {
    return lang.value === 'en'
      ? `You're now their supporter: ${paidArtistNames.value}.`
      : `Ya eres su supporter: ${paidArtistNames.value}.`
  }
  return lang.value === 'en' ? 'Your plan is active.' : 'Tu plan ya está activo.'
})

const payAccent = computed(() => {
  if (item.value.sku === 'MEGA' || megaNow.value) return 'from-amber-400 to-orange-500'
  if (item.value.featured || item.value.sku === 'SUPER') return 'from-violet-500 via-fuchsia-500 to-pink-500'
  return 'from-violet-500 to-fuchsia-500'
})

const planTone = computed(() => {
  if (item.value.type === 'pack') return 'text-amber-200'
  if (item.value.sku === 'MEGA' || megaNow.value) return 'text-amber-200'
  if (item.value.featured || item.value.sku === 'SUPER') return 'text-fuchsia-200'
  return 'text-violet-200'
})

const checkoutReady = computed(() => {
  if (!paypalConfig.value.enabled || !paypalConfig.value.clientId) return false
  if (!getCurrentApiAuth()?.accessToken) return false
  if (item.value.type === 'plan' && !picked.value.length) return false
  if (!phoneReady.value) return false
  return true
})

const payBlockedReason = computed(() => {
  if (!paypalConfig.value.enabled) {
    return lang.value === 'en' ? 'PayPal sandbox is not configured yet.' : 'PayPal sandbox todavía no está configurado.'
  }
  if (!getCurrentApiAuth()?.accessToken) {
    return lang.value === 'en' ? 'Log in to buy.' : 'Inicia sesión para comprar.'
  }
  if (item.value.type === 'plan' && !picked.value.length) {
    return lang.value === 'en' ? 'Pick an artist first.' : 'Elige un artista primero.'
  }
  if (!phoneReady.value) {
    return lang.value === 'en' ? 'Enter a complete phone number.' : 'Escribe un teléfono completo.'
  }
  return ''
})

const fieldClass =
  'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-300/40'

const methodClass = (id) =>
  method.value === id
    ? 'border-fuchsia-300/40 bg-fuchsia-500/12'
    : 'border-white/10 bg-black/25 hover:bg-white/6'

const description = computed(() => {
  if (item.value.type === 'pack') {
    return lang.value === 'en'
      ? 'Points to vote now. No supported artist and no plan badge.'
      : 'Puntos para votar ahora. Sin apoyar artista ni badge de plan.'
  }
  const copy = props.yearly ? item.value.descYear : item.value.desc
  return copy?.[lang.value] || item.value.desc?.es || ''
})

const onCountry = () => {
  phoneDigits.value = ''
  method.value = 'paypal'
}

const onPhoneInput = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '')
  const dialDigits = String(selectedCountry.value.dial || '').replace(/\D/g, '')
  if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    digits = digits.slice(dialDigits.length)
  }
  phoneDigits.value = digits.slice(0, phoneMaxDigits.value)
}

const artistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || ''

const pickedDisplay = computed(() =>
  picked.value.map((row) => {
    const full = localizedArtists.value.find((artist) => String(artist.id) === String(row.id))
    return {
      id: row.id,
      name: full?.name || row.name,
      image: artistImage(full) || row.image || '',
    }
  }),
)

const supportTitle = computed(() => (lang.value === 'en' ? 'Support' : 'Apoyar a'))

const pickedNames = computed(() =>
  pickedDisplay.value.map((row) => row.name).filter(Boolean).join(', '),
)

const toggleArtist = (artist) => {
  const id = String(artist.id)
  const exists = picked.value.find((row) => row.id === id)
  if (exists) {
    if (isLockedArtist(id)) return
    picked.value = picked.value.filter((row) => row.id !== id)
    return
  }
  const max = Number(item.value.maxArtists || 1)
  const lockedCount = picked.value.filter((row) => isLockedArtist(row.id)).length
  const cap = Math.max(max, lockedCount)
  if (picked.value.length >= cap) {
    const unlocked = picked.value.find((row) => !isLockedArtist(row.id))
    if (!unlocked) return
    picked.value = picked.value.filter((row) => row.id !== unlocked.id)
  }
  picked.value = [
    ...picked.value,
    { id, name: artist.name, image: artistImage(artist) },
  ]
}

const removePicked = (id) => {
  if (isLockedArtist(id)) return
  picked.value = picked.value.filter((row) => row.id !== String(id))
}

const isPicked = (artist) => picked.value.some((row) => row.id === String(artist.id))

const closePanel = () => emit('close')

const grantedBenefits = computed(() => {
  if (!paid.value) return []
  const catalog = findStoreItem(paid.value.sku)
  const names = (paid.value.artists || []).map((row) => row.name).filter(Boolean)
  if (paid.value.type === 'pack') {
    return lang.value === 'en'
      ? [`Gift of +${catalog.welcomePts} pts`, 'Use them to vote whenever you want']
      : [`Regalo de +${catalog.welcomePts} pts`, 'Úsalos para votar cuando quieras']
  }
  const extra = (catalog.benefits?.[lang.value] || []).filter(
    (line) => !/bienvenida|welcome bonus/i.test(line),
  )
  const head = lang.value === 'en'
    ? [
        `You are ${catalog.name}`,
        `Votes ×${catalog.multiplier}`,
        `+${catalog.welcomePts} welcome pts`,
        `${paid.value.daysLeft} days on your plan`,
        names.length ? `Supporting ${names.join(', ')}` : '',
      ]
    : [
        `Eres ${catalog.name}`,
        `Votos ×${catalog.multiplier}`,
        `+${catalog.welcomePts} pts de bienvenida`,
        `${paid.value.daysLeft} días de plan`,
        names.length ? `Apoyando a ${names.join(', ')}` : '',
      ]
  return [...head.filter(Boolean), ...extra.slice(0, 4)]
})

const downloadInvoice = async () => {
  if (!paid.value || isDownloadingInvoice.value) return
  isDownloadingInvoice.value = true
  errorMessage.value = ''
  try {
    await downloadFanInvoice(paid.value, lang.value)
  } catch {
    errorMessage.value = lang.value === 'en' ? 'Could not download the PDF.' : 'No se pudo descargar el PDF.'
  } finally {
    isDownloadingInvoice.value = false
  }
}

const goToInvoice = () => {
  paidStep.value = 'invoice'
}

const goToBenefits = () => {
  paidStep.value = 'benefits'
}

const checkoutBody = () => ({
  sku: item.value.sku,
  yearly: Boolean(props.yearly),
  currency: currencyCode.value,
  country: country.value,
  countryName: selectedCountry.value.name,
  method: 'paypal',
  phone: phone.value,
  artists:
    item.value.type === 'pack'
      ? []
      : pickedDisplay.value.map((row) => ({
          id: String(row.id || ''),
          name: row.name,
          image: row.image,
        })),
})

const applyPaidResult = async (result) => {
  const stored = getCurrentApiAuth()?.user || null
  let buyer = stored
  try {
    const me = await getMe()
    if (me) buyer = { ...stored, ...me }
  } catch {
    buyer = stored
  }
  paid.value = saveFanPurchase(result, buyer)
  const auth = getStoredAuth()
  if (auth) {
    const nextUser = buyer
      ? { ...auth.user, ...buyer }
      : auth.user && result.pointsAwarded
        ? {
            ...auth.user,
            points: Number(auth.user.points || 0) + Number(result.pointsAwarded || 0),
          }
        : auth.user
    if (nextUser) setStoredAuth({ ...auth, user: nextUser })
  }
  await loadFanMe()
  paidStep.value = 'congrats'
}

let paypalSdkLoad = null
let paypalMountSeq = 0

const paypalSdkSrc = (clientId) => {
  const currency = currencyCode.value === 'COP' ? 'COP' : 'USD'
  const params = new URLSearchParams({
    'client-id': clientId,
    currency,
    intent: 'capture',
    components: 'buttons',
    'enable-funding': 'paypal',
    'disable-funding': 'card,credit,paylater,venmo',
  })
  return `https://www.paypal.com/sdk/js?${params.toString()}`
}

const waitForPaypalButtons = (timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (window.paypal?.Buttons) {
        resolve(window.paypal)
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(
          new Error(
            lang.value === 'en' ? 'PayPal did not load. Reload the page.' : 'PayPal no cargó. Recarga la página.',
          ),
        )
        return
      }
      window.setTimeout(tick, 40)
    }
    tick()
  })

const loadPaypalSdk = async (clientId) => {
  const src = paypalSdkSrc(clientId)
  if (window.paypal?.Buttons && paypalSdkKey === src) return window.paypal
  if (paypalSdkLoad && paypalSdkKey === src) return paypalSdkLoad

  if (paypalSdkKey && paypalSdkKey !== src) {
    document.getElementById('paypal-sdk')?.remove()
    paypalSdkLoad = null
  }

  paypalSdkKey = src
  paypalSdkLoad = (async () => {
    if (!document.getElementById('paypal-sdk')) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.id = 'paypal-sdk'
        script.src = src
        script.async = true
        script.onload = resolve
        script.onerror = () =>
          reject(new Error(lang.value === 'en' ? 'Could not load PayPal.' : 'No se pudo cargar PayPal.'))
        document.head.appendChild(script)
      })
    }
    return waitForPaypalButtons()
  })()

  try {
    return await paypalSdkLoad
  } catch (error) {
    paypalSdkLoad = null
    throw error
  }
}

const closePaypalButtons = () => {
  try {
    paypalButtons?.close?.()
  } catch {
    /* ignore */
  }
  paypalButtons = null
}

const mountPaypalButtons = async () => {
  const seq = ++paypalMountSeq
  closePaypalButtons()
  if (method.value !== 'paypal' || paid.value || !checkoutReady.value) return
  await nextTick()
  if (seq !== paypalMountSeq || !paypalHost.value) return
  try {
    const paypal = await loadPaypalSdk(paypalConfig.value.clientId)
    if (seq !== paypalMountSeq || !paypalHost.value) return
    if (!paypal?.Buttons) {
      throw new Error(lang.value === 'en' ? 'PayPal did not load. Reload the page.' : 'PayPal no cargó. Recarga la página.')
    }
    paypalButtons = paypal.Buttons({
      ...(paypal.FUNDING?.PAYPAL ? { fundingSource: paypal.FUNDING.PAYPAL } : {}),
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 48,
      },
      onClick: (_data, actions) => {
        if (!checkoutReady.value) return actions.reject()
        return actions.resolve()
      },
      createOrder: async () => {
        errorMessage.value = ''
        if (!checkoutReady.value) {
          throw new Error(payBlockedReason.value)
        }
        try {
          const created = await createPaypalOrder(checkoutBody())
          return created.orderId
        } catch (error) {
          errorMessage.value =
            error?.message || (lang.value === 'en' ? 'Could not connect to PayPal.' : 'No se pudo conectar con PayPal.')
          throw error
        }
      },
      onApprove: async (data) => {
        isPaying.value = true
        errorMessage.value = ''
        try {
          const result = await capturePaypalOrder(data.orderID)
          await applyPaidResult(result)
        } catch (error) {
          errorMessage.value =
            error?.message || (lang.value === 'en' ? 'PayPal could not confirm the payment.' : 'PayPal no pudo confirmar el pago.')
        } finally {
          isPaying.value = false
        }
      },
      onCancel: () => {
        errorMessage.value = lang.value === 'en' ? 'PayPal payment cancelled.' : 'Pago de PayPal cancelado.'
      },
      onError: (err) => {
        errorMessage.value =
          err?.message || (lang.value === 'en' ? 'PayPal error.' : 'Error de PayPal.')
      },
    })
    await paypalButtons.render(paypalHost.value)
    if (seq !== paypalMountSeq) {
      closePaypalButtons()
      return
    }
    errorMessage.value = ''
  } catch (error) {
    if (seq !== paypalMountSeq) return
    errorMessage.value =
      error?.message || (lang.value === 'en' ? 'Could not start PayPal.' : 'No se pudo iniciar PayPal.')
  }
}

onMounted(async () => {
  await loadFanStore()
  await loadFanMe()
  resetForSku()
  try {
    paypalConfig.value = await getPaypalConfig()
  } catch {
    paypalConfig.value = { enabled: false, clientId: '', mode: 'sandbox', currency: 'USD' }
  }
  if (item.value.type !== 'pack') {
    try {
      artists.value = await getArtistsCached(null)
    } catch {
      artists.value = []
    }
  }
  await mountPaypalButtons()
})

watch(
  [
    method,
    checkoutReady,
    () => item.value.sku,
    () => totals.value.total,
    () => picked.value.length,
    currencyCode,
    () => props.yearly,
  ],
  () => {
    if (isPaying.value) return
    mountPaypalButtons()
  },
)

onBeforeUnmount(() => {
  closePaypalButtons()
})
</script>

<template>
  <section :class="embedded ? 'relative text-white' : 'relative overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#060713] p-5 text-white shadow-2xl shadow-fuchsia-950/25 sm:p-7 lg:p-8'">
    <template v-if="!embedded">
      <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-28 left-8 size-96 rounded-full bg-cyan-400/10 blur-3xl"></div>
    </template>

    <div v-if="!embedded" class="relative mb-6 flex items-center justify-between gap-3 pr-2">
      <a :href="plansHref" class="text-sm font-bold text-slate-400 transition hover:text-white">
        ← {{ lang === 'en' ? 'Plans' : 'Planes' }}
      </a>
    </div>

    <div v-if="!paid" class="relative grid gap-6 lg:grid-cols-2 lg:gap-8">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2 pr-12">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200">
            {{ lang === 'en' ? 'Checkout' : 'Pago' }}
          </p>
        </div>

        <div class="mt-4 flex items-center gap-4">
          <span class="flex size-14 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/7">
            <i class="fa-fw text-2xl leading-none" :class="[itemIcon, planTone]" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <h1 class="text-3xl font-black uppercase tracking-tight">{{ item.name }}</h1>
            <p class="mt-1 text-sm font-bold leading-6" :class="planTone">{{ description }}</p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{
                item.type === 'pack'
                  ? (lang === 'en' ? 'Gift' : 'Regalo')
                  : (lang === 'en' ? 'Each vote' : 'Cada voto')
              }}
            </p>
            <p class="mt-1 text-2xl font-black">
              {{ item.type === 'pack' ? `${item.welcomePts}` : `×${item.multiplier}` }}
            </p>
          </div>
          <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{
                item.type === 'pack'
                  ? (lang === 'en' ? 'Points' : 'Puntos')
                  : (lang === 'en' ? 'Welcome' : 'Bienvenida')
              }}
            </p>
            <p class="mt-1 text-2xl font-black text-fuchsia-200">+{{ item.welcomePts }} pts</p>
          </div>
        </div>

        <MegaUpgradePills v-if="item.type === 'plan'" class="mt-5" :sku="item.sku" />

        <div v-if="item.type === 'plan'">
        <p class="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="text-xs font-black uppercase tracking-[0.28em] text-slate-400">{{ supportTitle }}</span>
          <span v-if="pickedNames" class="text-sm font-black leading-5" :class="planTone">{{ pickedNames }}</span>
        </p>
        <div v-if="pickedDisplay.length" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="artist in pickedDisplay"
            :key="artist.id"
            type="button"
            class="flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 text-left text-sm font-bold"
            :class="item.sku === 'MEGA' || megaNow ? 'border-amber-300/35 bg-amber-300/10 text-amber-100' : 'border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-100'"
            :title="isLockedArtist(artist.id) ? (lang === 'en' ? 'Already supporting' : 'Ya lo apoyas') : (lang === 'en' ? 'Remove' : 'Quitar')"
            @click="removePicked(artist.id)"
          >
            <img
              v-if="artist.image"
              :src="artist.image"
              :alt="artist.name"
              class="size-7 shrink-0 rounded-full object-cover"
            />
            <span v-else class="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-[10px]">
              {{ String(artist.name || '?').charAt(0) }}
            </span>
            <span class="truncate">{{ artist.name }}</span>
            <span v-if="!isLockedArtist(artist.id)" class="text-white/50">×</span>
          </button>
        </div>
        <input
          v-model="search"
          class="mt-2"
          :class="fieldClass"
          :placeholder="lang === 'en' ? 'Search artist...' : 'Buscar artista...'"
          @input="page = 0"
        />
        <div class="mt-3 grid grid-cols-2 gap-2.5">
          <button
            v-for="artist in pageArtists"
            :key="artist.id"
            type="button"
            class="flex items-center gap-3 rounded-3xl border px-3 py-2.5 text-left text-sm font-bold transition"
            :class="isPicked(artist) ? 'border-fuchsia-300/40 bg-fuchsia-500/15' : 'border-white/10 bg-black/25 hover:bg-white/6'"
            @click="toggleArtist(artist)"
          >
            <img
              v-if="artistImage(artist)"
              :src="artistImage(artist)"
              :alt="artist.name"
              class="size-9 shrink-0 rounded-full object-cover"
            />
            <span v-else class="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs">
              {{ String(artist.name || '?').charAt(0) }}
            </span>
            <span class="truncate">{{ artist.name }}</span>
          </button>
        </div>
        <div v-if="filteredArtists.length" class="mt-3 flex items-center justify-between">
          <button
            type="button"
            class="grid size-10 place-items-center rounded-2xl border border-white/10 bg-black/25 disabled:opacity-40"
            :disabled="page <= 0"
            @click="page -= 1"
          >
            ‹
          </button>
          <span class="text-xs font-bold text-slate-400">{{ page + 1 }} / {{ pageCount }}</span>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-2xl border border-white/10 bg-black/25 disabled:opacity-40"
            :disabled="page >= pageCount - 1"
            @click="page += 1"
          >
            ›
          </button>
        </div>
        <p class="mt-3 text-xs leading-5 text-slate-500">
          {{
            Number(item.maxArtists || 1) > 1
              ? (lang === 'en' ? `You can pick up to ${item.maxArtists} artists.` : `Puedes elegir hasta ${item.maxArtists} artistas.`)
              : (lang === 'en' ? 'Pick 1 artist to appear on their profile.' : 'Elige 1 artista para salir en su perfil.')
          }}
          <span v-if="lockedArtistIds.size" class="mt-1 block">
            {{ lang === 'en' ? 'Artists you already support stay supported.' : 'El artista que ya apoyas se queda. No se quita al comprar otro plan.' }}
          </span>
        </p>
        </div>
      </div>

      <div class="min-w-0 rounded-4xl border border-white/10 bg-[#0a0d20]/90 p-5 shadow-2xl shadow-fuchsia-950/20 sm:p-6">
        <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200">
          {{ lang === 'en' ? 'Payment' : 'Pago' }}
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {{ lang === 'en' ? 'Country' : 'País' }}
            <select v-model="country" class="mt-1" :class="fieldClass" @change="onCountry">
              <option v-for="row in CHECKOUT_COUNTRIES" :key="row.code" :value="row.code">{{ row.name }}</option>
            </select>
          </label>
          <label class="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {{ lang === 'en' ? 'Phone' : 'Teléfono' }}
            <span class="mt-1 flex overflow-hidden rounded-2xl border border-white/10 bg-black/30 focus-within:border-fuchsia-300/40">
              <span class="shrink-0 border-r border-white/10 px-3 py-3 text-sm font-bold text-slate-300">
                {{ selectedCountry.dial }}
              </span>
              <input
                class="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
                type="tel"
                inputmode="tel"
                autocomplete="tel-national"
                :value="phoneDisplay"
                :placeholder="selectedCountry.example"
                :maxlength="phoneFormatMaxLength"
                @input="onPhoneInput($event.target.value)"
              />
            </span>
          </label>
        </div>

        <div class="mt-4 grid gap-2.5">
          <div
            class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-3xl border px-3 py-3 text-left"
            :class="methodClass('paypal')"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-fuchsia-200">
              <i class="fa-brands fa-paypal fa-fw leading-none" aria-hidden="true"></i>
            </span>
            <b class="text-sm font-black">PayPal</b>
            <small class="text-xs text-slate-400">{{ paypalConfig.mode === 'live' ? 'Starflare Group' : 'Sandbox' }}</small>
          </div>
        </div>

        <div class="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4 text-sm">
          <div class="flex justify-between text-slate-400">
            <span>{{ lang === 'en' ? 'Subtotal' : 'Subtotal' }}</span>
            <span>{{ money(totals.base) }}</span>
          </div>
          <div class="mt-2 flex justify-between" :class="totals.tax ? 'text-fuchsia-200' : 'text-slate-400'">
            <span>{{ totals.tax ? 'IVA 19%' : 'IVA' }}</span>
            <span>{{ totals.tax ? money(totals.tax) : '—' }}</span>
          </div>
          <div class="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3 font-black">
            <span class="text-sm uppercase tracking-wide">Total</span>
            <b class="text-3xl tracking-tight">{{ money(totals.total) }}</b>
          </div>
        </div>

        <p v-if="errorMessage" class="mt-3 text-sm font-bold text-red-300">{{ errorMessage }}</p>

        <div class="mt-5">
          <button
            v-if="!checkoutReady"
            type="button"
            disabled
            class="relative w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
            :class="`bg-linear-to-r ${payAccent}`"
          >
            {{ lang === 'en' ? 'Pay' : 'Pagar' }} {{ money(totals.total) }}
          </button>
          <p v-if="payBlockedReason" class="mt-3 text-center text-sm font-bold text-slate-300">
            {{ payBlockedReason }}
          </p>
          <div
            v-if="checkoutReady"
            class="paypal-gold-btn overflow-hidden rounded-2xl shadow-[0_10px_28px_rgba(255,196,57,0.22)]"
          >
            <div ref="paypalHost" class="paypal-gold-btn__host w-full"></div>
          </div>
          <p v-if="paypalConfig.enabled && paypalConfig.mode !== 'live'" class="mt-2 text-center text-[11px] text-amber-200/80">
            {{ lang === 'en' ? 'Test mode. Use a PayPal sandbox buyer account.' : 'Modo prueba. Usa una cuenta comprador de PayPal sandbox.' }}
          </p>
        </div>

        <p class="mt-3 text-center text-[11px] leading-5 text-slate-500">
          <template v-if="isColombia">
            {{ lang === 'en' ? 'Colombia adds 19% VAT to the total.' : 'Colombia suma IVA 19% al total.' }}
          </template>
          <template v-else>
            {{ lang === 'en' ? 'PayPal only. No Colombian VAT.' : 'Solo PayPal. Sin IVA colombiano.' }}
          </template>
        </p>
      </div>
    </div>

    <article v-else class="relative mx-auto max-w-lg px-1 py-4 sm:py-6">
      <template v-if="paidStep === 'congrats'">
        <div class="relative overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#0a0d20]/90 px-5 py-8 text-center shadow-2xl shadow-fuchsia-950/30 sm:p-10">
          <div class="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-20 left-0 size-56 rounded-full bg-amber-400/10 blur-3xl"></div>
          <div class="relative">
            <span
              class="mx-auto flex size-20 items-center justify-center rounded-4xl border text-3xl"
              :class="paid.type === 'pack'
                ? 'border-amber-300/35 bg-amber-400/15 text-amber-200'
                : 'border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100'"
            >
              <i
                class="fa-fw leading-none"
                :class="paid.type === 'pack' ? 'fa-solid fa-gift' : 'fa-solid fa-crown'"
                aria-hidden="true"
              ></i>
            </span>
            <p class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
              {{ lang === 'en' ? 'Congratulations' : 'Felicidades' }}
            </p>
            <h2 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {{ congratsTitle }}
            </h2>
            <p class="mx-auto mt-3 max-w-sm text-sm font-bold leading-6 text-slate-300">
              {{ congratsCopy }}
            </p>
            <div v-if="paid.type === 'plan' && paid.artists?.length" class="mt-5 flex flex-wrap justify-center gap-2">
              <span
                v-for="artist in paid.artists"
                :key="artist.id"
                class="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm font-bold"
              >
                <img
                  v-if="artist.image"
                  :src="artist.image"
                  :alt="artist.name"
                  class="size-7 shrink-0 rounded-full object-cover"
                />
                <span class="truncate">{{ artist.name }}</span>
              </span>
            </div>
            <p v-if="paid.type === 'pack'" class="mt-5 text-5xl font-black tracking-tight text-amber-200">
              +{{ paid.welcomePts || paid.pointsAwarded || 0 }}
            </p>
            <button
              type="button"
              class="mt-7 w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg"
              :class="`bg-linear-to-r ${payAccent}`"
              @click="goToInvoice"
            >
              {{ lang === 'en' ? 'See invoice' : 'Ver factura' }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="paidStep === 'invoice'">
        <div class="flex flex-col items-center text-center">
          <span class="flex size-16 shrink-0 items-center justify-center rounded-3xl border border-emerald-300/35 bg-emerald-400/15">
            <i class="fa-solid fa-check fa-fw text-2xl leading-none text-emerald-200" aria-hidden="true"></i>
          </span>
          <p class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">
            {{ lang === 'en' ? 'Invoice' : 'Factura' }}
          </p>
          <h2 class="mt-2 text-3xl font-black uppercase tracking-tight">
            {{ lang === 'en' ? 'Payment confirmed' : 'Pago confirmado' }}
          </h2>
          <p class="mt-2 text-sm font-bold text-slate-400">{{ paid.invoiceId }}</p>
        </div>

        <div class="mt-7 overflow-hidden rounded-4xl border border-white/10 bg-[#0a0d20]/90 p-5 text-left shadow-2xl shadow-fuchsia-950/20 sm:p-6">
          <div class="flex items-center gap-4">
            <span class="flex size-14 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/7">
              <i class="fa-fw text-2xl leading-none" :class="[paid.icon || 'fa-solid fa-star', planTone]" aria-hidden="true"></i>
            </span>
            <div class="min-w-0">
              <h3 class="text-2xl font-black uppercase tracking-tight">{{ paid.name }}</h3>
              <p class="mt-1 text-sm font-bold" :class="planTone">
                {{
                  paid.type === 'pack'
                    ? (lang === 'en' ? 'One-time' : 'Pago único')
                    : paid.yearly
                      ? (lang === 'en' ? 'Yearly' : 'Anual')
                      : (lang === 'en' ? 'Monthly' : 'Mensual')
                }}
                · {{ paid.method }}
              </p>
            </div>
          </div>

          <div v-if="paid.artists?.length" class="mt-5">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{ lang === 'en' ? 'Supporting' : 'Apoyando a' }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="artist in paid.artists"
                :key="artist.id"
                class="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm font-bold"
              >
                <img
                  v-if="artist.image"
                  :src="artist.image"
                  :alt="artist.name"
                  class="size-7 shrink-0 rounded-full object-cover"
                />
                <span v-else class="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-[10px]">
                  {{ String(artist.name || '?').charAt(0) }}
                </span>
                <span class="truncate">{{ artist.name }}</span>
              </span>
            </div>
          </div>

          <div class="mt-5 space-y-2.5 text-sm">
            <div class="flex justify-between text-slate-400">
              <span>{{ lang === 'en' ? 'Country' : 'País' }}</span>
              <span class="font-bold text-white">{{ paid.country }}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span class="font-bold text-white">{{ money(paid.base) }}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>{{ paid.tax ? 'IVA 19%' : 'IVA' }}</span>
              <span class="font-bold text-white">{{ paid.tax ? money(paid.tax) : '—' }}</span>
            </div>
          </div>
          <div class="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
            <span class="text-sm font-black uppercase tracking-wide">Total</span>
            <b class="text-3xl font-black tracking-tight">{{ money(paid.total) }}</b>
          </div>
        </div>

        <p v-if="errorMessage" class="mt-3 text-sm font-bold text-red-300">{{ errorMessage }}</p>
        <button
          type="button"
          class="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-black uppercase tracking-wide disabled:opacity-60"
          :disabled="isDownloadingInvoice"
          @click="downloadInvoice"
        >
          <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i>
          {{
            isDownloadingInvoice
              ? (lang === 'en' ? 'Downloading PDF...' : 'Descargando PDF...')
              : (lang === 'en' ? 'Download PDF invoice' : 'Descargar factura PDF')
          }}
        </button>
        <button
          type="button"
          class="mt-3 w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg"
          :class="`bg-linear-to-r ${payAccent}`"
          @click="goToBenefits"
        >
          {{ lang === 'en' ? 'See your benefits' : 'Ver tus beneficios' }}
        </button>
      </template>

      <template v-else>
        <div class="overflow-hidden rounded-4xl border border-white/10 bg-[#0a0d20]/90 p-5 text-center shadow-2xl shadow-fuchsia-950/20 sm:p-7">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
            {{ lang === 'en' ? 'Your tier' : 'Tu tier' }}
          </p>
          <p v-if="paid.type === 'plan'" class="mt-3 text-sm font-black uppercase tracking-wide" :class="planTone">
            {{ lang === 'en' ? "You're" : 'Eres' }}
          </p>
          <h2 class="mt-1 text-4xl font-black uppercase tracking-tight sm:text-5xl" :class="planTone">
            {{ paid.name }}
          </h2>
          <div v-if="paid.type === 'plan'" class="mt-5">
            <p class="text-6xl font-black leading-none tracking-tight">{{ paid.daysLeft }}</p>
            <p class="mt-2 text-sm font-black uppercase tracking-[0.22em]" :class="planTone">
              {{ lang === 'en' ? (paid.daysLeft === 1 ? 'day left' : 'days left') : (paid.daysLeft === 1 ? 'día restante' : 'días restantes') }}
            </p>
          </div>
          <p v-else class="mt-5 text-3xl font-black" :class="planTone">
            +{{ paid.welcomePts }} pts
          </p>
        </div>

        <ul class="mt-5 space-y-2.5">
          <li
            v-for="line in grantedBenefits"
            :key="line"
            class="flex items-start gap-3 rounded-3xl border border-white/10 bg-black/25 px-4 py-3 text-left text-sm font-bold leading-6"
          >
            <i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-fuchsia-300" aria-hidden="true"></i>
            <span>{{ line }}</span>
          </li>
        </ul>

        <a
          :href="profileHref"
          class="mt-6 flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg"
          :class="`bg-linear-to-r ${payAccent}`"
        >
          {{ lang === 'en' ? 'See it on my profile' : 'Verlo en mi perfil' }}
        </a>
        <button
          v-if="embedded"
          type="button"
          class="mt-3 w-full text-sm font-bold text-slate-400"
          @click="closePanel"
        >
          {{ lang === 'en' ? 'Close' : 'Cerrar' }}
        </button>
      </template>
    </article>
  </section>
</template>

<style scoped>
.paypal-gold-btn {
  background: #ffc439;
  min-height: 48px;
}
.paypal-gold-btn__host :deep(.paypal-buttons),
.paypal-gold-btn__host :deep(iframe) {
  min-height: 48px !important;
  background: #ffc439 !important;
}
</style>
