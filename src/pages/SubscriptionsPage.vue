<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FanCheckoutPanel from '../components/FanCheckoutPanel.vue'
import { getCurrentApiAuth } from '../services/api/authApi'
import {
  canSeeFanStore,
  formatStoreMoney,
  getFanPacks,
  getFanPlans,
  getFanStore,
  isFanStoreAdmin,
  loadFanStore,
  onFanStoreChange,
  storeDisplayPrice,
} from '../services/fanStore'
import { pickLocalized, pickLocalizedList } from '../utils/localizedCopy'

const yearly = ref(false)
const currency = ref('USD')
const storeVersion = ref(0)
const { locale } = useI18n()
const formatPrice = (amount) => formatStoreMoney(amount, currency.value)
const currentUser = computed(() => getCurrentApiAuth()?.user || null)
const allowed = computed(() => {
  storeVersion.value
  return canSeeFanStore(currentUser.value)
})
const isAdminPreview = computed(() => {
  storeVersion.value
  return isFanStoreAdmin(currentUser.value) && getFanStore().visibility !== 'public'
})
const copy = computed(() => {
  storeVersion.value
  const store = getFanStore()
  return {
    headline: pickLocalized(store.headline, locale.value),
    subhead: pickLocalized(store.subhead, locale.value),
  }
})

const plans = computed(() => {
  storeVersion.value
  return getFanPlans().map((plan) => ({
    ...plan,
    priceLabel: formatPrice(storeDisplayPrice(plan, { currency: currency.value, yearly: yearly.value })),
    yearTotal: formatPrice(currency.value === 'COP' ? plan.copYTotal : plan.usdYTotal),
    tagline: pickLocalized(plan.tagline, locale.value),
    highlights: pickLocalizedList(plan.benefits, locale.value).filter(
      (line) => !/bienvenida|welcome bonus/i.test(line),
    ),
  }))
})

const packs = computed(() => {
  storeVersion.value
  return getFanPacks().map((pack) => ({
    ...pack,
    priceLabel: formatPrice(currency.value === 'COP' ? pack.cop : pack.usd),
    note: pickLocalized(pack.note, locale.value),
  }))
})

const checkout = ref(null)

const openCheckout = (sku) => {
  checkout.value = {
    sku,
    currency: currency.value,
    yearly: yearly.value,
  }
}

const closeCheckout = () => {
  checkout.value = null
}

const onEscape = (event) => {
  if (event.key === 'Escape') closeCheckout()
}

watch(checkout, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) window.addEventListener('keydown', onEscape)
  else window.removeEventListener('keydown', onEscape)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onEscape)
  stopStore?.()
})

let stopStore = null
onMounted(async () => {
  await loadFanStore()
  storeVersion.value += 1
  stopStore = onFanStoreChange(() => {
    storeVersion.value += 1
  })
})

const planShell = (plan) => {
  if (plan.featured) {
    return 'border-fuchsia-300/35 bg-[#0a0d20]/90 shadow-fuchsia-950/40'
  }
  if (plan.mega) {
    return 'border-amber-300/30 bg-[#0a0d20]/90 shadow-amber-950/30'
  }
  return 'border-violet-300/25 bg-[#0a0d20]/90 shadow-violet-950/30'
}

const planAccent = (plan) => {
  if (plan.mega) return 'from-amber-400 to-orange-500'
  if (plan.featured) return 'from-violet-500 via-fuchsia-500 to-pink-500'
  return 'from-violet-500 to-fuchsia-500'
}

const planCta = (plan) => `bg-linear-to-r ${planAccent(plan)} text-white`

const planTone = (plan) => {
  if (plan.mega) return 'text-amber-200'
  if (plan.featured) return 'text-fuchsia-200'
  return 'text-violet-200'
}
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 text-white sm:px-6 lg:py-12">
    <article
      v-if="!allowed"
      class="rounded-4xl border border-white/10 bg-[#060713] p-8 text-center shadow-2xl shadow-fuchsia-950/20 sm:p-12"
    >
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        {{ $t('plans.eyebrow') }}
      </p>
      <h1 class="mt-3 text-3xl font-black text-white sm:text-5xl">
        {{ $t('plans.comingSoonTitle') }}
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-sm font-bold leading-6 text-slate-400">
        {{ $t('plans.comingSoonBody') }}
      </p>
    </article>

    <template v-else>
    <header
      class="relative overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#060713] p-6 shadow-2xl shadow-fuchsia-950/25 sm:p-8 lg:p-10"
    >
      <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-28 left-8 size-96 rounded-full bg-cyan-400/10 blur-3xl"></div>
      <div class="pointer-events-none absolute left-1/2 top-10 size-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl"></div>

      <div class="relative text-center">
        <p
          v-if="isAdminPreview"
          class="mb-4 inline-flex rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100"
        >
          {{ $t('plans.adminPreview') }}
        </p>
        <h1 class="text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
          {{ copy.headline }}
        </h1>
        <p class="mx-auto mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
          {{ copy.subhead }}
        </p>

        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <div class="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              class="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide"
              :class="!yearly ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
              @click="yearly = false"
            >
              {{ $t('plans.monthly') }}
            </button>
            <button
              type="button"
              class="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide"
              :class="yearly ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
              @click="yearly = true"
            >
              {{ $t('plans.yearly') }}
              <span class="ml-1 text-emerald-300">-20%</span>
            </button>
          </div>
          <div class="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              class="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide"
              :class="currency === 'USD' ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
              @click="currency = 'USD'"
            >
              USD
            </button>
            <button
              type="button"
              class="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide"
              :class="currency === 'COP' ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
              @click="currency = 'COP'"
            >
              COP
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="mt-10 grid gap-5 lg:grid-cols-3">
      <article
        v-for="plan in plans"
        :key="plan.sku"
        class="relative flex min-h-full flex-col overflow-hidden rounded-4xl border p-6 shadow-2xl backdrop-blur-xl lg:p-7"
        :class="planShell(plan)"
      >
        <div
          class="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full opacity-20 blur-2xl"
          :class="`bg-linear-to-br ${planAccent(plan)}`"
        ></div>
        <p
          v-if="plan.featured"
          class="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-2xl bg-linear-to-r from-fuchsia-500 to-pink-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white"
        >
          {{ $t('plans.mostPopular') }}
        </p>

        <div class="relative pt-5">
          <span
            class="flex size-14 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/7"
          >
            <i class="fa-fw text-2xl leading-none" :class="[plan.icon, planTone(plan)]" aria-hidden="true"></i>
          </span>
          <h2 class="mt-5 text-3xl font-black uppercase tracking-tight">{{ plan.name }}</h2>
          <p class="mt-2 text-sm font-bold leading-6" :class="planTone(plan)">{{ plan.tagline }}</p>
          <p class="mt-5 text-4xl font-black tracking-tight">
            {{ plan.priceLabel }}
            <span class="ml-1 text-sm font-bold text-slate-400">/ {{ $t('plans.perMonth') }}</span>
          </p>
          <p v-if="yearly" class="mt-1 text-xs font-bold text-emerald-300">
            {{ $t('plans.billedYear', { total: plan.yearTotal }) }}
          </p>
        </div>

        <div class="relative mt-6 grid grid-cols-2 gap-3">
          <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{ $t('plans.eachVote') }}
            </p>
            <p class="mt-1 text-2xl font-black">
              ×{{ plan.multiplier }}
            </p>
          </div>
          <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{ $t('plans.welcome') }}
            </p>
            <p class="mt-1 text-2xl font-black" :class="plan.featured ? 'text-fuchsia-200' : 'text-white'">
              {{ plan.welcomePts }} pts
            </p>
          </div>
        </div>

        <ul class="relative mt-6 flex flex-1 flex-col gap-3.5">
          <li
            v-for="item in plan.highlights"
            :key="item"
            class="flex items-start gap-3 text-base font-bold leading-6 text-white sm:text-lg"
          >
            <i class="fa-solid fa-circle-check mt-1 shrink-0 text-sm text-fuchsia-300" aria-hidden="true"></i>
            <span>{{ item }}</span>
          </li>
        </ul>

        <button
          type="button"
          class="relative mt-7 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide shadow-lg transition hover:scale-[1.02]"
          :class="planCta(plan)"
          @click="openCheckout(plan.sku)"
        >
          {{ $t('plans.choose', { name: plan.name }) }}
        </button>
      </article>
    </div>

    <section id="paquetes-votos" class="mt-12 scroll-mt-28 rounded-4xl border border-white/10 bg-[#080b1c]/85 p-5 shadow-2xl shadow-fuchsia-950/15 sm:p-6 lg:p-8">
      <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
        {{ $t('plans.packsEyebrow') }}
      </p>
      <h2 class="mt-3 text-3xl font-black uppercase tracking-tight">
        {{ $t('plans.packsTitle') }}
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        {{ $t('plans.packsBody') }}
      </p>
      <div class="mt-7 grid gap-5 md:grid-cols-3">
        <article
          v-for="pack in packs"
          :key="pack.sku"
          class="rounded-4xl border border-white/10 bg-white/6 p-6 shadow-xl"
        >
          <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
            <i class="fa-solid fa-bolt fa-fw text-xl leading-none" aria-hidden="true"></i>
          </span>
          <h3 class="mt-5 text-2xl font-black uppercase">{{ pack.pts.toLocaleString(locale) }} pts</h3>
          <p class="mt-2 text-sm text-slate-400">{{ pack.note }}</p>
          <div class="mt-5 flex items-center justify-between gap-3">
            <span class="text-xl font-black text-amber-100">{{ pack.priceLabel }}</span>
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:bg-white/12"
              @click="openCheckout(pack.sku)"
            >
              {{ $t('plans.buy') }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="flex gap-4 rounded-3xl border border-white/8 bg-white/6 p-4">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        </span>
        <span>
          <span class="block text-sm font-black uppercase tracking-wide">{{ $t('plans.trust.secureTitle') }}</span>
          <span class="mt-1 block text-xs leading-5 text-slate-400">{{ $t('plans.trust.secureBody') }}</span>
        </span>
      </div>
      <div class="flex gap-4 rounded-3xl border border-white/8 bg-white/6 p-4">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
          <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
        </span>
        <span>
          <span class="block text-sm font-black uppercase tracking-wide">{{ $t('plans.trust.cancelTitle') }}</span>
          <span class="mt-1 block text-xs leading-5 text-slate-400">{{ $t('plans.trust.cancelBody') }}</span>
        </span>
      </div>
      <div class="flex gap-4 rounded-3xl border border-white/8 bg-white/6 p-4">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
          <i class="fa-solid fa-diamond" aria-hidden="true"></i>
        </span>
        <span>
          <span class="block text-sm font-black uppercase tracking-wide">{{ $t('plans.trust.fairTitle') }}</span>
          <span class="mt-1 block text-xs leading-5 text-slate-400">{{ $t('plans.trust.fairBody') }}</span>
        </span>
      </div>
      <div class="flex gap-4 rounded-3xl border border-white/8 bg-white/6 p-4">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
          <i class="fa-solid fa-heart" aria-hidden="true"></i>
        </span>
        <span>
          <span class="block text-sm font-black uppercase tracking-wide">{{ $t('plans.trust.voiceTitle') }}</span>
          <span class="mt-1 block text-xs leading-5 text-slate-400">{{ $t('plans.trust.voiceBody') }}</span>
        </span>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="checkout"
        class="fixed inset-0 z-999 grid place-items-center bg-[#03030a]/80 px-3 py-4 backdrop-blur-md sm:px-6"
        role="dialog"
        :aria-label="$t('plans.checkout')"
        @click.self="closeCheckout"
      >
        <div
          class="relative max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#060713] shadow-2xl shadow-fuchsia-950/40"
        >
          <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-28 left-8 size-96 rounded-full bg-cyan-400/10 blur-3xl"></div>
          <button
            type="button"
            class="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border border-white/15 bg-white/8 text-xl font-black text-white/70 transition hover:bg-white/15 hover:text-white"
            :aria-label="$t('plans.close')"
            @click="closeCheckout"
          >
            ×
          </button>
          <div class="relative max-h-[94vh] overflow-y-auto p-5 sm:p-7 lg:p-8">
            <FanCheckoutPanel
              :key="`${checkout.sku}-${checkout.currency}-${checkout.yearly}`"
              embedded
              :sku="checkout.sku"
              :currency="checkout.currency"
              :yearly="checkout.yearly"
              @close="closeCheckout"
            />
          </div>
        </div>
      </div>
    </Teleport>
    </template>
  </section>
</template>
