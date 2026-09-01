<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyLiveSupporterPhoto, getArtistSupporters, mergeArtistSupporters, syncMembershipSupportForArtist } from '../utils/fanMembership'
import { getArtistSupportersApi } from '../services/api/fanApi'
import { getCurrentApiAuth, getMe } from '../services/api/authApi'
import { routePath } from '../utils/localizedRoutes'

const props = defineProps({
  artistId: { type: [String, Number], default: '' },
  artistName: { type: String, default: '' },
  artistSlug: { type: String, default: '' },
  artistFirebaseId: { type: String, default: '' },
  artistKey: { type: String, default: '' },
})

const { locale } = useI18n()
const lang = computed(() => (String(locale.value || 'es').startsWith('en') ? 'en' : 'es'))
const tab = ref('recent')
const rows = ref([])
const plansHref = computed(() => routePath('plans', locale.value))
const emit = defineEmits(['update:count'])
const hasMega = computed(() =>
  rows.value.some((row) => row.tier === 'mega' || row.sku === 'MEGA'),
)

watch(rows, (value) => emit('update:count', value.length), { immediate: true })

const failedPhotos = ref(new Set())

const artistRef = () => ({
  id: props.artistId,
  name: props.artistName,
  slug: props.artistSlug,
  firebaseId: props.artistFirebaseId,
})

const supporterKeys = () =>
  [...new Set(
    [props.artistKey, props.artistId, props.artistSlug, props.artistFirebaseId]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )]

const loadRows = async () => {
  if (!props.artistId && !props.artistKey && !props.artistSlug) {
    rows.value = []
    return
  }
  const lists = await Promise.all(
    supporterKeys().map((key) => getArtistSupportersApi(key).catch(() => [])),
  )
  const live = mergeArtistSupporters(...lists.filter((list) => Array.isArray(list)))
  if (live.length) {
    rows.value = live
    return
  }
  const stored = getCurrentApiAuth()?.user || null
  let user = stored
  try {
    const me = await getMe()
    if (me) user = { ...stored, ...me }
  } catch {
    user = stored
  }
  syncMembershipSupportForArtist(artistRef(), user)
  if (user && props.artistId) applyLiveSupporterPhoto(props.artistId, user)
  rows.value = getArtistSupporters(artistRef())
}

const photoOf = (row) => row?.photo && !failedPhotos.value.has(row.id) ? row.photo : ''

const onPhotoError = (rowId) => {
  const next = new Set(failedPhotos.value)
  next.add(rowId)
  failedPhotos.value = next
}

watch(() => [props.artistId, props.artistSlug, props.artistFirebaseId, props.artistKey], loadRows)

onMounted(() => {
  loadRows()
  window.addEventListener('vmm-fan-membership-changed', loadRows)
})

onUnmounted(() => {
  window.removeEventListener('vmm-fan-membership-changed', loadRows)
})

const pts = (value) => Number(value || 0).toLocaleString(locale.value)

const initials = (name) =>
  String(name || 'F')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()

const timeAgo = (iso) => {
  const ms = Math.max(0, Date.now() - new Date(iso || Date.now()).getTime())
  const min = Math.floor(ms / 60000)
  const hours = Math.floor(min / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  if (lang.value === 'en') {
    if (min < 1) return 'just now'
    if (min < 60) return `${min} min ago`
    if (hours < 24) return `${hours} h ago`
    if (days < 30) return `${days}d ago`
    return months === 1 ? '1 month' : `${months} months`
  }
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (hours < 24) return `hace ${hours} h`
  if (days < 30) return `hace ${days} d`
  return months === 1 ? '1 mes' : `${months} meses`
}

const monthsSupported = (iso) => {
  const days = Math.max(1, Math.floor((Date.now() - new Date(iso || Date.now()).getTime()) / 86400000))
  const months = Math.max(1, Math.round(days / 30))
  return lang.value === 'en' ? `${months} mo` : `${months} mes${months === 1 ? '' : 'es'}`
}

const decorate = (row, extra = {}) => {
  const pinned = Boolean(row.pinnedUntil && new Date(row.pinnedUntil).getTime() > Date.now())
  return {
    ...row,
    pinned,
    initials: initials(row.name),
    markIcon: row.tier === 'mega' ? 'fa-solid fa-crown' : row.tier === 'super' ? 'fa-solid fa-bolt' : 'fa-solid fa-star',
    badge: row.tier === 'mega' ? 'MEGA FAN' : row.tier === 'super' ? 'SUPER FAN' : 'FAN',
    ...extra,
  }
}

const recentLine = (row) =>
  lang.value === 'en'
    ? `${timeAgo(row.at)} · subscribed ${row.sku}`
    : `${timeAgo(row.at)} · se suscribió ${row.sku}`

const splitBoard = (sorted, champExtra, cardLine) => {
  if (!sorted.length) return { champ: null, cards: [] }
  return {
    champ: decorate(sorted[0], { featured: true, rank: 1, ...champExtra(sorted[0]) }),
    cards: sorted.slice(1).map((row, index) =>
      decorate(row, {
        rank: index + 2,
        line: cardLine(row, index + 2),
      }),
    ),
  }
}

const board = computed(() => {
  if (tab.value === 'top') {
    const sorted = [...rows.value].sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
    return splitBoard(
      sorted,
      (row) => ({
        label: '#1',
        line:
          lang.value === 'en'
            ? `Top support · ${pts(row.points)} pts to ${props.artistName}`
            : `Top apoyo · ${pts(row.points)} pts a ${props.artistName}`,
      }),
      (row, rank) =>
        lang.value === 'en'
          ? `#${rank} · ${pts(row.points)} pts`
          : `#${rank} · ${pts(row.points)} pts`,
    )
  }

  if (tab.value === 'loyal') {
    const sorted = [...rows.value].sort(
      (a, b) => new Date(a.startedAt || a.at || 0) - new Date(b.startedAt || b.at || 0),
    )
    return splitBoard(
      sorted,
      (row) => ({
        label: '#1',
        line:
          lang.value === 'en'
            ? `Longest supporting · ${monthsSupported(row.startedAt || row.at)} · ${pts(row.points)} pts`
            : `La que más tiempo lleva · ${monthsSupported(row.startedAt || row.at)} seguidos · ${pts(row.points)} pts`,
      }),
      (row) =>
        lang.value === 'en'
          ? `${monthsSupported(row.startedAt || row.at)} · ${pts(row.points)} pts`
          : `${monthsSupported(row.startedAt || row.at)} · ${pts(row.points)} pts`,
    )
  }

  const sorted = [...rows.value].sort((a, b) => {
    const pinA = a.pinnedUntil && new Date(a.pinnedUntil).getTime() > Date.now() ? 1 : 0
    const pinB = b.pinnedUntil && new Date(b.pinnedUntil).getTime() > Date.now() ? 1 : 0
    if (pinB !== pinA) return pinB - pinA
    return new Date(b.at || 0) - new Date(a.at || 0)
  })
  const latestMega = sorted.find((row) => row.tier === 'mega')
  const cards = sorted
    .filter((row) => row.id !== latestMega?.id)
    .map((row) => decorate(row, { line: recentLine(row) }))

  if (!latestMega) {
    return { champ: null, cards }
  }

  return {
    champ: decorate(latestMega, {
      featured: true,
      label: 'NEW',
      line:
        lang.value === 'en'
          ? `Latest MEGA in · ${timeAgo(latestMega.at)} · ${pts(latestMega.points)} pts to ${props.artistName}`
          : `Último MEGA en entrar · ${timeAgo(latestMega.at)} · ${pts(latestMega.points)} pts a ${props.artistName}`,
    }),
    cards,
  }
})

const hasRows = computed(() => Boolean(board.value.champ || board.value.cards.length))

const title = computed(() => {
  if (tab.value === 'top') return lang.value === 'en' ? 'Top support' : 'Top apoyo'
  if (tab.value === 'loyal') return lang.value === 'en' ? 'Longest supporting' : 'Más tiempo apoyando'
  return lang.value === 'en' ? 'Recent fans' : 'Fans recientes'
})

const subtitle = computed(() => {
  if (tab.value === 'top') return lang.value === 'en' ? 'Ranked by points to this artist' : 'Ranking por puntos al artista'
  if (tab.value === 'loyal') return lang.value === 'en' ? 'Sorted by time supporting' : 'Ordenado por antigüedad'
  return lang.value === 'en'
    ? `Latest purchases linked to ${props.artistName}`
    : `Últimas compras ligadas a ${props.artistName}`
})

const cardClass = (row) => {
  if (row.tier === 'mega') return 'border-amber-300/40 bg-linear-to-b from-amber-400/12 to-[#1a1424] shadow-[0_0_18px_rgba(245,197,24,0.12)]'
  if (row.tier === 'super') return 'border-fuchsia-300/35 bg-linear-to-b from-fuchsia-500/16 to-[#1a1428] shadow-[0_0_18px_rgba(232,77,255,0.12)]'
  return 'border-sky-300/30 bg-linear-to-b from-blue-500/16 to-[#171322] shadow-[0_0_14px_rgba(96,165,250,0.1)]'
}

const avatarClass = (row, featured = false) => {
  if (row.tier === 'mega') {
    return featured
      ? 'size-20 border-3 border-amber-300 bg-[#4a2f08] text-xl text-amber-200 shadow-[0_0_0_4px_rgba(245,197,24,0.15),0_0_24px_rgba(245,197,24,0.35)]'
      : 'size-14 border-2 border-amber-300 bg-[#4a2f08] text-amber-200 shadow-[0_0_14px_rgba(245,197,24,0.25)]'
  }
  if (row.tier === 'super') {
    return featured
      ? 'size-20 border-3 border-fuchsia-300 bg-[#3b1650] text-xl text-fuchsia-200 shadow-[0_0_24px_rgba(232,77,255,0.3)]'
      : 'size-12 border-2 border-fuchsia-300 bg-[#3b1650] text-fuchsia-200'
  }
  return featured
    ? 'size-20 border-3 border-sky-400 bg-[#172554] text-xl text-sky-200 shadow-[0_0_24px_rgba(96,165,250,0.28)]'
    : 'size-11 border-2 border-sky-400 bg-[#172554] text-sky-200'
}

const champShell = (row) => {
  if (row?.tier === 'mega') {
    return {
      className: 'border-amber-300/45 shadow-[0_0_0_1px_rgba(245,197,24,0.12),0_16px_40px_rgba(245,197,24,0.12)]',
      style: 'background: radial-gradient(500px 120px at 0% 0%, rgba(245,197,24,.22), transparent 50%), linear-gradient(90deg, #2a1c08 0%, #1a1428 55%)',
      rank: 'text-amber-300',
    }
  }
  if (row?.tier === 'super') {
    return {
      className: 'border-fuchsia-300/40 shadow-[0_0_0_1px_rgba(232,77,255,0.12),0_16px_40px_rgba(232,77,255,0.12)]',
      style: 'background: radial-gradient(500px 120px at 0% 0%, rgba(232,77,255,.22), transparent 50%), linear-gradient(90deg, #2a1440 0%, #1a1428 55%)',
      rank: 'text-fuchsia-300',
    }
  }
  return {
    className: 'border-sky-300/40 shadow-[0_0_0_1px_rgba(96,165,250,0.12),0_16px_40px_rgba(96,165,250,0.12)]',
    style: 'background: radial-gradient(500px 120px at 0% 0%, rgba(59,130,246,.22), transparent 50%), linear-gradient(90deg, #0f1c3a 0%, #1a1428 55%)',
    rank: 'text-sky-300',
  }
}

const champTheme = computed(() => champShell(board.value.champ))

const badgeClass = (row) => {
  if (row.tier === 'mega') return 'bg-linear-to-r from-amber-700 to-amber-300 text-amber-950'
  if (row.tier === 'super') return 'bg-linear-to-r from-violet-600 to-fuchsia-500 text-white'
  return 'bg-linear-to-r from-blue-600 to-sky-400 text-white'
}

const dotClass = (row) => {
  if (row.tier === 'mega') return 'bg-amber-400 text-slate-950'
  if (row.tier === 'super') return 'bg-fuchsia-400 text-white'
  return 'bg-sky-400 text-slate-950'
}
</script>

<template>
  <section
    id="artist-supporters"
    class="mt-8 overflow-hidden rounded-4xl border p-5 shadow-2xl sm:p-6"
    :class="hasMega
      ? 'border-amber-300/50 bg-[#1a1408] shadow-amber-950/30'
      : 'border-white/10 bg-[#14101f] shadow-fuchsia-950/15'"
  >
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="flex flex-wrap items-center gap-3 text-2xl font-black text-white">
        Supporters
        <span
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
          :class="hasMega
            ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
            : 'border-white/10 bg-[#241833] text-slate-300'"
        >
          <span
            class="grid size-4 place-items-center rounded-full bg-linear-to-b from-amber-200 to-amber-500 text-amber-950 shadow-[0_0_10px_rgba(245,197,24,0.45)]"
            aria-hidden="true"
          >
            <i class="fa-solid fa-check text-[8px]"></i>
          </span>
          {{ rows.length }} {{ lang === 'en' ? 'real fans' : 'fans reales' }}
        </span>
      </h2>
      <div class="inline-flex rounded-full border border-white/10 bg-[#1a1328] p-1">
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide"
          :class="tab === 'recent' ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
          @click="tab = 'recent'"
        >
          {{ lang === 'en' ? 'Recent' : 'Recientes' }}
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide"
          :class="tab === 'top' ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
          @click="tab = 'top'"
        >
          {{ lang === 'en' ? 'Top' : 'Top apoyo' }}
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide"
          :class="tab === 'loyal' ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-300'"
          @click="tab = 'loyal'"
        >
          {{ lang === 'en' ? 'Longest' : 'Más tiempo' }}
        </button>
      </div>
    </div>

    <div class="mt-5 flex items-end justify-between gap-3">
      <h3 class="text-base font-black text-white">{{ title }}</h3>
      <span class="text-xs font-bold text-slate-400">{{ subtitle }}</span>
    </div>

    <div v-if="hasRows" class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-if="board.champ"
        class="relative col-span-full flex items-center gap-4 overflow-hidden rounded-3xl border p-5"
        :class="[champTheme.className, board.champ.tier === 'mega' ? 'champ-mega' : '']"
        :style="champTheme.style"
      >
        <span
          class="shrink-0 text-4xl font-black tracking-tight"
          :class="[champTheme.rank, board.champ.tier === 'mega' ? 'champ-mega-rank' : '']"
        >
          {{ board.champ.label }}
        </span>
        <span
          class="relative grid shrink-0 place-items-center overflow-hidden rounded-full font-black"
          :class="[avatarClass(board.champ, true), board.champ.tier === 'mega' ? 'champ-mega-avatar' : '']"
        >
          <img
            v-if="photoOf(board.champ)"
            :src="photoOf(board.champ)"
            alt=""
            class="size-full object-cover"
            referrerpolicy="no-referrer"
            @error="onPhotoError(board.champ.id)"
          />
          <span v-else>{{ board.champ.initials }}</span>
          <span
            class="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-[#1a1428] text-[7px]"
            :class="dotClass(board.champ)"
          >
            <i :class="board.champ.markIcon" aria-hidden="true"></i>
          </span>
        </span>
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-xl font-black text-white"
            :class="board.champ.tier === 'mega' ? 'champ-mega-name' : ''"
          >
            {{ board.champ.name }}
          </p>
          <p class="mt-0.5 text-xs font-bold text-amber-100/80">{{ board.champ.line }}</p>
          <p
            v-if="board.champ.pinned"
            class="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-200"
          >
            <i class="fa-solid fa-thumbtack mr-1" aria-hidden="true"></i>
            {{ lang === 'en' ? 'Pinned 24h' : 'Fijado 24h' }}
          </p>
        </div>
        <div class="ml-auto hidden sm:block">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black tracking-wide"
            :class="[badgeClass(board.champ), board.champ.tier === 'mega' ? 'champ-mega-badge' : '']"
          >
            <i :class="board.champ.markIcon" aria-hidden="true"></i>
            {{ board.champ.badge }}
          </span>
        </div>
      </article>

      <article
        v-for="row in board.cards"
        :key="`${row.id}-${tab}`"
        class="relative flex items-center gap-3 overflow-hidden rounded-3xl border p-3"
        :class="cardClass(row)"
      >
        <span
          class="relative grid shrink-0 place-items-center overflow-hidden rounded-full font-black"
          :class="avatarClass(row)"
        >
          <img
            v-if="photoOf(row)"
            :src="photoOf(row)"
            alt=""
            class="size-full object-cover"
            referrerpolicy="no-referrer"
            @error="onPhotoError(row.id)"
          />
          <span v-else>{{ row.initials }}</span>
          <span
            class="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-[#1a1428] text-[7px]"
            :class="dotClass(row)"
          >
            <i :class="row.markIcon" aria-hidden="true"></i>
          </span>
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-black text-white">{{ row.name }}</p>
          <p class="mt-0.5 text-xs font-bold text-slate-400">{{ row.line }}</p>
          <p
            v-if="row.pinned"
            class="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-200"
          >
            <i class="fa-solid fa-thumbtack mr-1" aria-hidden="true"></i>
            {{ lang === 'en' ? 'Pinned 24h' : 'Fijado 24h' }}
          </p>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide"
          :class="badgeClass(row)"
        >
          <i :class="row.markIcon" aria-hidden="true"></i>
          {{ row.badge }}
        </span>
      </article>
    </div>

    <div
      v-else
      class="mt-4 rounded-3xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm font-bold text-slate-400"
    >
      {{ lang === 'en' ? 'No supporters yet. Be the first on this wall.' : 'Todavía no hay supporters. Sé el primero en este muro.' }}
    </div>

    <div class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-4"
      :class="hasMega ? 'border-amber-300/30 bg-amber-400/10' : 'border-fuchsia-300/20 bg-fuchsia-500/10'"
    >
      <p class="max-w-2xl text-sm font-bold leading-6 text-slate-200">
        <b class="text-white">{{ lang === 'en' ? 'Want to appear here?' : '¿Quieres salir aquí?' }}</b>
        {{
          lang === 'en'
            ? 'When you buy a plan you pick the artist to support. Your name, badge, and time show on their profile.'
            : 'Al comprar un plan eliges a qué artista apoyar. Tu nombre, badge y tiempo aparecen en su perfil.'
        }}
      </p>
      <a
        :href="plansHref"
        class="rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-xs font-black uppercase tracking-wide text-white"
      >
        {{ lang === 'en' ? `Support ${artistName}` : `Apoyar a ${artistName}` }}
      </a>
    </div>
  </section>
</template>

<style scoped>
.champ-mega {
  animation: champ-mega-wash 2.8s ease-in-out infinite;
}

.champ-mega-avatar {
  animation: champ-mega-ring 2.2s ease-in-out infinite;
}

.champ-mega-rank,
.champ-mega-name {
  text-shadow: 0 0 18px rgba(245, 197, 24, 0.45);
  animation: champ-mega-name 2.6s ease-in-out infinite;
}

.champ-mega-badge {
  animation: champ-mega-badge 2.4s ease-in-out infinite;
}

@keyframes champ-mega-wash {
  0%, 100% {
    box-shadow: 0 0 0 1px rgba(245, 197, 24, 0.12), 0 16px 40px rgba(245, 197, 24, 0.12);
  }
  50% {
    box-shadow: 0 0 0 1px rgba(245, 197, 24, 0.28), 0 18px 52px rgba(245, 197, 24, 0.28);
  }
}

@keyframes champ-mega-ring {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(245, 197, 24, 0.15), 0 0 24px rgba(245, 197, 24, 0.35);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(245, 197, 24, 0.32), 0 0 36px rgba(245, 197, 24, 0.55);
  }
}

@keyframes champ-mega-name {
  0%, 100% { text-shadow: 0 0 12px rgba(245, 197, 24, 0.28); }
  50% { text-shadow: 0 0 26px rgba(245, 197, 24, 0.7); }
}

@keyframes champ-mega-badge {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 197, 24, 0); transform: translateY(0); }
  50% { box-shadow: 0 8px 22px rgba(245, 197, 24, 0.35); transform: translateY(-1px); }
}

@media (prefers-reduced-motion: reduce) {
  .champ-mega,
  .champ-mega-avatar,
  .champ-mega-rank,
  .champ-mega-name,
  .champ-mega-badge {
    animation: none;
  }
}
</style>
