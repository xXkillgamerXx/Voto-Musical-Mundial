<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  preview: {
    type: Boolean,
    default: false,
  },
})

const selectedOffer = ref(null)
const { locale } = useI18n()

const planStyles = [
  {
    accent: 'from-violet-500 to-fuchsia-500',
    border: 'border-violet-300/30',
    glow: 'shadow-violet-950/35',
    icon: 'fa-solid fa-rocket',
    multiplier: 'x2',
  },
  {
    accent: 'from-violet-500 via-fuchsia-500 to-pink-500',
    border: 'border-fuchsia-300/45',
    glow: 'shadow-fuchsia-950/50',
    icon: 'fa-solid fa-star',
    multiplier: 'x3',
    featured: true,
  },
  {
    accent: 'from-amber-400 to-orange-500',
    border: 'border-amber-300/45',
    glow: 'shadow-amber-950/40',
    icon: 'fa-solid fa-gem',
    multiplier: 'x5',
  },
]

const packStyles = [
  {
    accent: 'from-cyan-400 to-violet-500',
  },
  {
    accent: 'from-violet-500 to-fuchsia-500',
    featured: true,
  },
  {
    accent: 'from-amber-400 to-orange-500',
  },
]

const trustIcons = [
  'fa-solid fa-shield-halved',
  'fa-solid fa-rotate-left',
  'fa-solid fa-diamond',
  'fa-solid fa-heart',
]

const copy = {
  es: {
    heroEyebrow: 'Vista visual de membresías',
    heroTitleStart: 'Potencia',
    heroTitleHighlight: 'tu voto',
    heroDescription: 'Suscríbete y multiplica el poder de tus votos. Obtén puntos de bienvenida y beneficios visuales durante 30 días.',
    soonBadge: 'Disponible próximamente',
    plansEyebrow: 'Planes fan',
    plansTitle: 'Elige cómo potenciar tus votos',
    plansDescription: 'Estos planes estarán disponibles pronto para que puedas apoyar con más fuerza a tus artistas favoritos.',
    mostPopular: 'Más popular',
    welcomePointsLabel: 'Puntos de bienvenida',
    voteValueLabel: 'Cada voto gratuito vale',
    planAction: 'Activar beneficio',
    period: 'USD/30 días',
    packsEyebrow: 'Paquetes de votos',
    packsTitle: 'Compra boosts cuando necesites empujar',
    packsDescription: 'Paquetes visuales para la futura compra de votos. La activación estará disponible próximamente.',
    pendingIntegration: 'Integración pendiente',
    popular: 'Popular',
    buy: 'Comprar',
    compareTitle: 'Compara los beneficios',
    includedLabel: 'Incluido',
    footerNote: 'Vista previa visual. Las compras y renovaciones estarán disponibles próximamente.',
    modalEyebrow: 'Próximamente',
    modalTitle: 'Esta opción estará disponible próximamente',
    modalText: 'Muy pronto podrás potenciar tus votos desde esta sección.',
    modalCloseLabel: 'Cerrar',
    understood: 'Entendido',
    plans: [
      {
        name: 'Fan',
        price: '$2.99',
        description: 'Para quienes recién empiezan a potenciar su apoyo.',
        welcomePoints: '20 pts',
        voteValue: '2 votos',
        benefits: ['1 voto cada 10 minutos', 'Insignia FAN exclusiva', 'Banco de hasta 100 votos'],
      },
      {
        name: 'Super Fan',
        price: '$7.99',
        description: 'Para fans que quieren aparecer, votar más y crecer rápido.',
        welcomePoints: '50 pts',
        voteValue: '3 votos',
        benefits: ['1 voto cada 10 minutos', 'Insignia SUPER FAN exclusiva', 'Perfil con color especial', 'Acceso anticipado a votaciones'],
      },
      {
        name: 'Mega Fan',
        price: '$19.99',
        description: 'Para fandoms intensos que quieren el máximo impacto.',
        welcomePoints: '100 pts',
        voteValue: '5 votos',
        benefits: ['1 voto cada 10 minutos', 'Insignia MEGA FAN exclusiva', 'Perfil destacado en rankings', 'Soporte prioritario'],
      },
    ],
    votePacks: [
      { name: 'Boost 50', votes: '50 votos', price: '$1.99', note: 'Ideal para cerrar una diferencia pequeña.' },
      { name: 'Boost 150', votes: '150 votos', price: '$4.99', note: 'Para empujar a tu artista en horas clave.' },
      { name: 'Boost 500', votes: '500 votos', price: '$12.99', note: 'Pensado para campañas fuertes de fandom.' },
    ],
    benefits: [
      ['Puntos de bienvenida', '20 pts', '50 pts', '100 pts'],
      ['Cada voto gratuito vale', '2 votos (x2)', '3 votos (x3)', '5 votos (x5)'],
      ['Frecuencia de votos gratuitos', '1 voto cada 10 minutos', '1 voto cada 10 minutos', '1 voto cada 10 minutos'],
      ['Banco de votos acumulables', 'Hasta 100 votos', 'Hasta 300 votos', 'Hasta 500 votos'],
      ['Insignia exclusiva', true, true, true],
      ['Perfil con color especial', false, true, true],
      ['Acceso anticipado a votaciones', false, true, true],
      ['Perfil destacado en rankings', false, false, true],
      ['Soporte prioritario', false, false, true],
    ],
    trustItems: [
      { title: '100% seguro', text: 'Los pagos estarán protegidos cuando activemos la integración oficial.' },
      { title: 'Cancela cuando quieras', text: 'La suscripción podrá administrarse desde tu cuenta fan.' },
      { title: 'Votos justos', text: 'Todos los votos seguirán validados y verificados.' },
      { title: 'Tu voz importa', text: 'Cada voto ayuda a tu artista favorito a alcanzar la cima.' },
    ],
  },
  en: {
    heroEyebrow: 'Membership visual preview',
    heroTitleStart: 'Boost',
    heroTitleHighlight: 'your vote',
    heroDescription: 'Subscribe and multiply the power of your votes. Get welcome points and visual benefits for 30 days.',
    soonBadge: 'Coming soon',
    plansEyebrow: 'Fan plans',
    plansTitle: 'Choose how to boost your votes',
    plansDescription: 'These plans will be available soon so you can support your favorite artists even harder.',
    mostPopular: 'Most popular',
    welcomePointsLabel: 'Welcome points',
    voteValueLabel: 'Each free vote counts as',
    planAction: 'Activate benefit',
    period: 'USD/30 days',
    packsEyebrow: 'Vote packs',
    packsTitle: 'Buy boosts when you need a push',
    packsDescription: 'Visual packs for future vote purchases. Activation will be available soon.',
    pendingIntegration: 'Integration pending',
    popular: 'Popular',
    buy: 'Buy',
    compareTitle: 'Compare benefits',
    includedLabel: 'Included',
    footerNote: 'Visual preview. Purchases and renewals will be available soon.',
    modalEyebrow: 'Coming soon',
    modalTitle: 'This option will be available soon',
    modalText: 'Very soon you will be able to boost your votes from this section.',
    modalCloseLabel: 'Close',
    understood: 'Got it',
    plans: [
      {
        name: 'Fan',
        price: '$2.99',
        description: 'For fans who are just starting to boost their support.',
        welcomePoints: '20 pts',
        voteValue: '2 votes',
        benefits: ['1 vote every 10 minutes', 'Exclusive FAN badge', 'Bank up to 100 votes'],
      },
      {
        name: 'Super Fan',
        price: '$7.99',
        description: 'For fans who want more presence, more votes, and faster growth.',
        welcomePoints: '50 pts',
        voteValue: '3 votes',
        benefits: ['1 vote every 10 minutes', 'Exclusive SUPER FAN badge', 'Special profile color', 'Early access to polls'],
      },
      {
        name: 'Mega Fan',
        price: '$19.99',
        description: 'For intense fandoms that want maximum impact.',
        welcomePoints: '100 pts',
        voteValue: '5 votes',
        benefits: ['1 vote every 10 minutes', 'Exclusive MEGA FAN badge', 'Featured ranking profile', 'Priority support'],
      },
    ],
    votePacks: [
      { name: 'Boost 50', votes: '50 votes', price: '$1.99', note: 'Ideal for closing a small gap.' },
      { name: 'Boost 150', votes: '150 votes', price: '$4.99', note: 'For pushing your artist during key moments.' },
      { name: 'Boost 500', votes: '500 votes', price: '$12.99', note: 'Built for strong fandom campaigns.' },
    ],
    benefits: [
      ['Welcome points', '20 pts', '50 pts', '100 pts'],
      ['Each free vote counts as', '2 votes (x2)', '3 votes (x3)', '5 votes (x5)'],
      ['Free vote frequency', '1 vote every 10 minutes', '1 vote every 10 minutes', '1 vote every 10 minutes'],
      ['Saved vote bank', 'Up to 100 votes', 'Up to 300 votes', 'Up to 500 votes'],
      ['Exclusive badge', true, true, true],
      ['Special profile color', false, true, true],
      ['Early access to polls', false, true, true],
      ['Featured ranking profile', false, false, true],
      ['Priority support', false, false, true],
    ],
    trustItems: [
      { title: '100% secure', text: 'Payments will be protected when the official integration is enabled.' },
      { title: 'Cancel anytime', text: 'Your subscription can be managed from your fan account.' },
      { title: 'Fair votes', text: 'All votes will remain validated and verified.' },
      { title: 'Your voice matters', text: 'Every vote helps your favorite artist climb to the top.' },
    ],
  },
}

const content = computed(() => copy[locale.value] || copy.es)
const plans = computed(() => content.value.plans.map((plan, index) => ({ ...planStyles[index], ...plan })))
const votePacks = computed(() => content.value.votePacks.map((pack, index) => ({ ...packStyles[index], ...pack })))
const benefits = computed(() => content.value.benefits)
const trustItems = computed(() => content.value.trustItems.map((item, index) => ({ icon: trustIcons[index], ...item })))

const openOfferModal = (offer) => {
  selectedOffer.value = offer
}

const closeOfferModal = () => {
  selectedOffer.value = null
}
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 text-white sm:px-6 lg:py-12">
    <div
      v-if="!props.preview"
      class="relative overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#060713] p-6 shadow-2xl shadow-fuchsia-950/25 sm:p-8 lg:p-10"
    >
      <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-28 left-8 size-96 rounded-full bg-cyan-400/10 blur-3xl"></div>
      <div class="pointer-events-none absolute left-1/2 top-10 size-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl"></div>

      <div class="relative">
        <div class="max-w-4xl">
          <p class="text-xs font-black uppercase tracking-[0.32em] text-amber-300">
            {{ content.heroEyebrow }}
          </p>
          <h1 class="mt-4 text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            {{ content.heroTitleStart }} <span class="bg-linear-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">{{ content.heroTitleHighlight }}</span>
          </h1>
          <p class="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            {{ content.heroDescription }}
          </p>
          <div class="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100">
            {{ content.soonBadge }}
          </div>
        </div>
    </div>
    </div>

    <div
      class="rounded-4xl border border-white/10 bg-[#080b1c]/80 p-5 shadow-2xl shadow-violet-950/20 backdrop-blur-xl sm:p-6 lg:p-8"
      :class="props.preview ? 'mt-0' : 'mt-10'"
    >
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200">
            {{ content.plansEyebrow }}
          </p>
          <h2 class="mt-3 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            {{ content.plansTitle }}
          </h2>
          <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            {{ content.plansDescription }}
          </p>
        </div>
      </div>

      <div class="mt-7 grid gap-5 lg:grid-cols-3">
          <article
            v-for="plan in plans"
            :key="plan.name"
            class="relative flex min-h-full flex-col overflow-hidden rounded-4xl border bg-[#0a0d20]/88 p-6 shadow-2xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 lg:p-7"
            :class="[plan.border, plan.glow]"
          >
            <div
              v-if="plan.featured"
              class="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-2xl bg-linear-to-r from-fuchsia-500 to-pink-500 px-5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-fuchsia-950/40"
            >
              {{ content.mostPopular }}
            </div>
            <div class="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full opacity-20 blur-2xl" :class="`bg-linear-to-br ${plan.accent}`"></div>

            <div class="pt-5">
              <div class="flex items-start justify-between gap-4">
                <span class="grid size-24 place-items-center rounded-3xl border border-white/10 bg-white/7 text-4xl shadow-inner shadow-white/5">
                  <i :class="plan.icon" aria-hidden="true"></i>
                </span>
                <span class="text-xl">✦</span>
              </div>

              <h2 class="mt-6 text-3xl font-black uppercase tracking-tight">
                {{ plan.name }}
              </h2>
              <p class="mt-3 min-h-12 text-sm leading-6 text-slate-400">
                {{ plan.description }}
              </p>
              <div class="mt-6 inline-flex rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-sm font-black text-white">
                {{ plan.price }} <span class="ml-1 text-slate-400">{{ content.period }}</span>
              </div>
            </div>

            <div class="mt-7 grid gap-5">
              <div class="flex items-center gap-3">
                <span class="grid size-10 place-items-center rounded-xl bg-fuchsia-400/12 text-fuchsia-200">
                  <i class="fa-solid fa-gift" aria-hidden="true"></i>
                </span>
                <div>
                  <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {{ content.welcomePointsLabel }}
                  </p>
                  <p class="text-3xl font-black" :class="plan.featured ? 'text-fuchsia-200' : 'text-white'">
                    {{ plan.welcomePoints }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <span class="grid size-10 place-items-center rounded-xl bg-violet-400/12 text-violet-200">
                  <i class="fa-solid fa-clock" aria-hidden="true"></i>
                </span>
                <div>
                  <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {{ content.voteValueLabel }}
                  </p>
                  <p class="text-3xl font-black">
                    {{ plan.voteValue }}
                    <span class="ml-2 rounded-full border border-white/10 px-2 py-1 text-xs text-fuchsia-200">
                      {{ plan.multiplier }}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <ul class="mt-7 flex-1 space-y-3.5 text-sm font-semibold text-slate-300">
              <li v-for="benefit in plan.benefits" :key="benefit" class="flex items-center gap-3">
                <i class="fa-solid fa-wand-magic-sparkles text-fuchsia-300" aria-hidden="true"></i>
                <span>{{ benefit }}</span>
              </li>
            </ul>

            <button
              type="button"
              class="mt-8 rounded-2xl bg-linear-to-r px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:scale-[1.02]"
              :class="plan.accent"
              @click="openOfferModal({ type: 'plan', title: plan.name, price: plan.price, detail: plan.voteValue })"
            >
              {{ content.planAction }}
            </button>
          </article>
        </div>
      </div>

      <div v-if="!props.preview" id="paquetes-votos" class="mt-14 scroll-mt-28 rounded-4xl border border-white/10 bg-[#080b1c]/85 p-5 shadow-2xl shadow-fuchsia-950/15 backdrop-blur-xl sm:p-6 lg:p-8">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
              {{ content.packsEyebrow }}
            </p>
            <h2 class="mt-3 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              {{ content.packsTitle }}
            </h2>
            <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              {{ content.packsDescription }}
            </p>
          </div>
          <span class="inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-100">
            {{ content.pendingIntegration }}
          </span>
        </div>

        <div class="mt-7 grid gap-5 md:grid-cols-3">
          <article
            v-for="pack in votePacks"
            :key="pack.name"
            class="relative overflow-hidden rounded-4xl border border-white/10 bg-white/6 p-6 shadow-xl shadow-black/20"
            :class="pack.featured ? 'ring-1 ring-fuchsia-300/45' : ''"
          >
            <div class="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full opacity-25 blur-2xl" :class="`bg-linear-to-br ${pack.accent}`"></div>
            <div
              v-if="pack.featured"
              class="absolute right-5 top-5 rounded-full bg-fuchsia-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white"
            >
              {{ content.popular }}
            </div>
            <span class="grid size-13 place-items-center rounded-2xl border border-white/10 bg-black/20 text-xl text-white">
              <i class="fa-solid fa-bolt" aria-hidden="true"></i>
            </span>
            <h3 class="mt-5 text-2xl font-black uppercase text-white">
              {{ pack.name }}
            </h3>
            <p class="mt-2 text-4xl font-black tracking-tight text-white">
              {{ pack.votes }}
            </p>
            <p class="mt-3 min-h-12 text-sm leading-6 text-slate-400">
              {{ pack.note }}
            </p>
            <div class="mt-5 flex items-center justify-between gap-4">
              <span class="text-xl font-black text-amber-100">{{ pack.price }}</span>
              <button
                type="button"
                class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/12"
                @click="openOfferModal({ type: 'pack', title: pack.name, price: pack.price, detail: pack.votes })"
              >
                {{ content.buy }}
              </button>
            </div>
          </article>
        </div>
      </div>

      <div v-if="!props.preview" id="comparar-planes" class="mt-12 scroll-mt-28 overflow-hidden rounded-4xl border border-white/10 bg-white/6 shadow-2xl shadow-violet-950/20 backdrop-blur-xl">
        <div class="grid grid-cols-4 border-b border-white/10 px-4 py-4 text-xs font-black uppercase tracking-wide text-slate-300 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <span>{{ content.compareTitle }}</span>
          <span class="text-center text-fuchsia-200">Fan</span>
          <span class="text-center text-fuchsia-200">Super Fan</span>
          <span class="text-center text-amber-200">Mega Fan</span>
        </div>
        <div class="divide-y divide-white/8">
          <div
            v-for="row in benefits"
            :key="row[0]"
            class="grid grid-cols-4 items-center px-4 py-3 text-xs text-slate-300 md:grid-cols-[1.2fr_repeat(3,1fr)]"
          >
            <span class="font-semibold text-slate-200">{{ row[0] }}</span>
            <span
              v-for="(value, index) in row.slice(1)"
              :key="`${row[0]}-${index}`"
              class="text-center"
            >
              <i
                v-if="value === true"
                class="fa-solid fa-circle-check text-fuchsia-300"
                :aria-label="content.includedLabel"
              ></i>
              <span v-else-if="value === false" class="text-slate-600">—</span>
              <span v-else>{{ value }}</span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="!props.preview" class="mt-6 grid gap-4 rounded-4xl border border-white/10 bg-white/6 p-5 backdrop-blur-xl md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="item in trustItems"
          :key="item.title"
          class="flex gap-4 rounded-3xl border border-white/8 bg-black/12 p-4"
        >
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
            <i :class="item.icon" aria-hidden="true"></i>
          </span>
          <span>
            <span class="block text-sm font-black uppercase tracking-wide text-white">{{ item.title }}</span>
            <span class="mt-1 block text-xs leading-5 text-slate-400">{{ item.text }}</span>
          </span>
        </div>
      </div>

      <p v-if="!props.preview" class="mt-6 text-center text-xs font-semibold text-slate-500">
        {{ content.footerNote }}
      </p>
      <div
        v-if="selectedOffer"
        class="fixed inset-0 z-999 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        @click.self="closeOfferModal"
      >
        <div class="w-full max-w-lg overflow-hidden rounded-4xl border border-fuchsia-300/20 bg-[#080a18] p-6 text-white shadow-2xl shadow-fuchsia-950/40">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200">
                {{ content.modalEyebrow }}
              </p>
              <h3 class="mt-3 text-3xl font-black uppercase leading-none">
                {{ selectedOffer.title }}
              </h3>
            </div>
            <button
              type="button"
              class="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              :aria-label="content.modalCloseLabel"
              @click="closeOfferModal"
            >
              ×
            </button>
          </div>

          <div class="mt-6 rounded-3xl border border-white/10 bg-white/6 p-6 text-center">
            <div class="mx-auto grid size-18 place-items-center rounded-3xl bg-linear-to-br from-violet-500 via-fuchsia-500 to-amber-300 text-3xl shadow-2xl shadow-fuchsia-950/40">
              <i class="fa-solid fa-gift" aria-hidden="true"></i>
            </div>
            <p class="mt-5 text-base font-black uppercase tracking-wide text-white">
              {{ content.modalTitle }}
            </p>
            <p class="mt-2 text-sm leading-7 text-slate-300">
              {{ content.modalText }}
            </p>
          </div>

          <div class="mt-6">
            <button
              type="button"
              class="w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide"
              @click="closeOfferModal"
            >
              {{ content.understood }}
            </button>
          </div>
        </div>
      </div>
  </section>
</template>
