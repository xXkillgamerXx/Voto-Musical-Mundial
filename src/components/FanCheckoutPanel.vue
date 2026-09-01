<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
import { checkoutFanStore } from '../services/api/fanApi'
import { fanPackDiscount, loadFanMe } from '../utils/fanPerks'

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
const phone = ref('+57')
const method = ref('card')
const artists = ref([])
const search = ref('')
const page = ref(0)
const picked = ref([])
const errorMessage = ref('')
const isPaying = ref(false)
const paid = ref(null)
const paidStep = ref('invoice')
const isDownloadingInvoice = ref(false)
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
}

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

const itemIcon = computed(() => item.value.icon || 'fa-solid fa-bolt')

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

const methodLabel = computed(() => {
  if (method.value === 'nequi') return 'Nequi'
  if (method.value === 'pse') return 'PSE'
  if (method.value === 'paypal') return 'PayPal'
  return lang.value === 'en' ? 'Card' : 'Tarjeta'
})

const onCountry = () => {
  const next = selectedCountry.value
  if (!phone.value || phone.value === '+57' || phone.value.startsWith('+')) {
    phone.value = next.dial
  }
  if (!isColombia.value && (method.value === 'nequi' || method.value === 'pse')) {
    method.value = 'card'
  }
  if (isColombia.value && method.value === 'paypal') {
    method.value = 'card'
  }
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
  const max = Number(item.value.maxArtists || 1)
  const exists = picked.value.find((row) => row.id === id)
  if (exists) {
    picked.value = picked.value.filter((row) => row.id !== id)
    return
  }
  const next = [
    ...picked.value,
    { id, name: artist.name, image: artistImage(artist) },
  ]
  if (next.length > max) next.shift()
  picked.value = next
}

const removePicked = (id) => {
  picked.value = picked.value.filter((row) => row.id !== String(id))
}

const isPicked = (artist) => picked.value.some((row) => row.id === String(artist.id))

const bumpMega = () => {
  if (!megaPlan.value) return
  item.value = { type: 'plan', ...megaPlan.value }
  megaNow.value = true
  if (picked.value.length > 3) picked.value = picked.value.slice(0, 3)
}

const undoMega = () => {
  item.value = { ...original.value }
  megaNow.value = false
  const max = Number(item.value.maxArtists || 1)
  if (picked.value.length > max) picked.value = picked.value.slice(0, max)
}

const closePanel = () => emit('close')

const grantedBenefits = computed(() => {
  if (!paid.value) return []
  const catalog = findStoreItem(paid.value.sku)
  const names = (paid.value.artists || []).map((row) => row.name).filter(Boolean)
  if (paid.value.type === 'pack') {
    return lang.value === 'en'
      ? [`+${catalog.welcomePts} pts added now`, 'Use them to vote whenever you want']
      : [`+${catalog.welcomePts} pts acreditados ya`, 'Úsalos para votar cuando quieras']
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

const goToBenefits = () => {
  paidStep.value = 'benefits'
}

const pay = async () => {
  errorMessage.value = ''
  if (!getCurrentApiAuth()?.accessToken) {
    errorMessage.value = lang.value === 'en' ? 'Log in to buy.' : 'Inicia sesión para comprar.'
    return
  }
  if (item.value.type === 'plan' && !picked.value.length) {
    errorMessage.value = lang.value === 'en' ? 'Pick an artist.' : 'Elige un artista.'
    return
  }
  isPaying.value = true
  try {
    const result = await checkoutFanStore({
      sku: item.value.sku,
      yearly: Boolean(props.yearly),
      currency: currencyCode.value,
      country: country.value,
      countryName: selectedCountry.value.name,
      method: method.value,
      phone: phone.value,
      artists: item.value.type === 'pack' ? [] : pickedDisplay.value.map((row) => ({
        id: String(row.id || ''),
        name: row.name,
        image: row.image,
      })),
    })
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
    paidStep.value = 'invoice'
  } catch (error) {
    errorMessage.value = error?.message || (lang.value === 'en' ? 'Could not complete the purchase.' : 'No se pudo completar la compra.')
  } finally {
    isPaying.value = false
  }
}

onMounted(async () => {
  await loadFanStore()
  await loadFanMe()
  resetForSku()
  if (item.value.type === 'pack') return
  try {
    artists.value = await getArtistsCached(null)
  } catch {
    artists.value = []
  }
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
              {{ item.type === 'pack' ? (lang === 'en' ? 'Points' : 'Puntos') : (lang === 'en' ? 'Each vote' : 'Cada voto') }}
            </p>
            <p class="mt-1 text-2xl font-black">
              {{ item.type === 'pack' ? `${item.welcomePts}` : `×${item.multiplier}` }}
            </p>
          </div>
          <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{ lang === 'en' ? 'Welcome' : 'Bienvenida' }}
            </p>
            <p class="mt-1 text-2xl font-black text-fuchsia-200">+{{ item.welcomePts }} pts</p>
          </div>
        </div>

        <button
          v-if="item.type === 'plan' && original.sku !== 'MEGA' && !megaNow"
          type="button"
          class="mt-5 w-full rounded-3xl border border-amber-300/25 bg-amber-300/10 p-4 text-left transition hover:bg-amber-300/15"
          @click="bumpMega"
        >
          <strong class="block text-sm font-black uppercase tracking-wide text-amber-200">
            {{ lang === 'en' ? 'One-time MEGA upgrade' : 'Oportunidad única · MEGA' }}
          </strong>
          <span class="mt-1 block text-xs leading-5 text-slate-300">
            {{
              lang === 'en'
                ? 'Switch now to support 3 artists and get +10 extra votes on this payment.'
                : 'Si cambias ahora apoyas 3 artistas y te llevas +10 votos extra. Solo en este pago.'
            }}
          </span>
        </button>
        <button
          v-if="megaNow"
          type="button"
          class="mt-4 text-sm font-bold text-fuchsia-300"
          @click="undoMega"
        >
          ← {{ lang === 'en' ? `Back to ${original.name}` : `Volver a ${original.name}` }}
        </button>

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
            :title="lang === 'en' ? 'Remove' : 'Quitar'"
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
            <span class="text-white/50">×</span>
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
            <input v-model="phone" class="mt-1" :class="fieldClass" />
          </label>
        </div>

        <div class="mt-4 grid gap-2.5">
          <button
            type="button"
            class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-3xl border px-3 py-3 text-left transition"
            :class="methodClass('card')"
            @click="method = 'card'"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-fuchsia-200">
              <i class="fa-solid fa-credit-card fa-fw leading-none" aria-hidden="true"></i>
            </span>
            <b class="text-sm font-black">{{ lang === 'en' ? 'Card' : 'Tarjeta' }}</b>
            <small class="text-xs text-slate-400">Visa / Mastercard</small>
          </button>
          <button
            v-if="isColombia"
            type="button"
            class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-3xl border px-3 py-3 text-left transition"
            :class="methodClass('nequi')"
            @click="method = 'nequi'"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-fuchsia-200">
              <i class="fa-solid fa-mobile-screen fa-fw leading-none" aria-hidden="true"></i>
            </span>
            <b class="text-sm font-black">Nequi</b>
            <small class="text-xs text-slate-400">{{ lang === 'en' ? 'From your phone' : 'Desde el celular' }}</small>
          </button>
          <button
            v-if="isColombia"
            type="button"
            class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-3xl border px-3 py-3 text-left transition"
            :class="methodClass('pse')"
            @click="method = 'pse'"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-fuchsia-200">
              <i class="fa-solid fa-building-columns fa-fw leading-none" aria-hidden="true"></i>
            </span>
            <b class="text-sm font-black">PSE</b>
            <small class="text-xs text-slate-400">{{ lang === 'en' ? 'Your bank' : 'Tu banco' }}</small>
          </button>
          <button
            v-if="!isColombia"
            type="button"
            class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-3xl border px-3 py-3 text-left transition"
            :class="methodClass('paypal')"
            @click="method = 'paypal'"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-fuchsia-200">
              <i class="fa-brands fa-paypal fa-fw leading-none" aria-hidden="true"></i>
            </span>
            <b class="text-sm font-black">PayPal</b>
            <small class="text-xs text-slate-400">Starflare Group</small>
          </button>
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

        <button
          type="button"
          class="relative mt-5 w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
          :class="`bg-linear-to-r ${payAccent}`"
          :disabled="isPaying"
          @click="pay"
        >
          {{ isPaying ? (lang === 'en' ? 'Processing...' : 'Procesando...') : `${lang === 'en' ? 'Pay' : 'Pagar'} ${money(totals.total)}` }}
        </button>
        <p class="mt-3 text-center text-[11px] leading-5 text-slate-500">
          <template v-if="isColombia">
            {{ lang === 'en' ? 'Colombia adds 19% VAT to the total.' : 'Colombia suma IVA 19% al total.' }}
          </template>
          <template v-else>
            {{ lang === 'en' ? 'Card or PayPal. No Colombian VAT.' : 'Tarjeta o PayPal. Sin IVA colombiano.' }}
          </template>
        </p>
      </div>
    </div>

    <article v-else class="relative mx-auto max-w-lg px-1 py-4 sm:py-6">
      <template v-if="paidStep === 'invoice'">
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
