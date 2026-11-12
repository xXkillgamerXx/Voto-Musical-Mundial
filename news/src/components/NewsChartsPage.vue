<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { t } from '../lib/copy'
import { applyNewsSeo } from '../lib/seo'
import { withLocale } from '../lib/locale'

type ChartTrack = Record<string, any>

type ChartPack = {
  date?: string | null
  count?: number
  note?: string
  tracks: ChartTrack[]
}

type ChartsData = {
  daily: ChartPack
  listeners: ChartPack
  latest: ChartPack
  trending: ChartPack
  insights: ChartPack
  radio: ChartPack
}

type Board = {
  id: string
  kicker: string
  title: string
  pack: ChartPack
  wide?: boolean
  metric: (track: ChartTrack) => number
  heroStats: (track: ChartTrack) => Array<{ label: string; value: string; tone: string }>
  artist: (track: ChartTrack) => string
  titleOf: (track: ChartTrack) => string
  sub: (track: ChartTrack) => string
  metaValue: (track: ChartTrack) => string
  metaDelta: (track: ChartTrack) => string
  metaTone: (track: ChartTrack) => string
  positionOf?: (track: ChartTrack, index: number) => number
}

const props = defineProps<{ locale?: string }>()
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const loading = ref(true)
const error = ref('')
const data = ref<ChartsData | null>(null)
const activeBoard = ref('spotify')
const eqBars = Array.from({ length: 48 }, (_, i) => ({
  h: `${18 + Math.round((Math.sin(i * 0.45) + 1) * 25 + ((i * 17) % 28))}px`,
  d: `${0.7 + ((i * 13) % 18) / 10}s`,
  delay: `${-((i * 7) % 30) / 10}s`,
}))
const syncActiveBoard = () => {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash && boards.value.some((board) => board.id === hash)) {
    activeBoard.value = hash
    return
  }
  let current = boards.value[0]?.id || 'spotify'
  for (const board of boards.value) {
    const el = document.getElementById(board.id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= 190) current = board.id
  }
  activeBoard.value = current
}

const fmt = computed(() => new Intl.NumberFormat(loc.value === 'es' ? 'es' : 'en-US'))
const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthsEs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const niceDate = (iso?: string | null) => {
  if (!iso) return t(loc.value, 'chartsUpdated')
  const parts = iso.split('-').map(Number)
  const months = loc.value === 'es' ? monthsEs : monthsEn
  return `${months[parts[1] - 1]} ${parts[2]}, ${parts[0]}`
}

const signed = (n: number) => {
  if (n > 0) return `+${fmt.value.format(n)}`
  if (n < 0) return `−${fmt.value.format(Math.abs(n))}`
  return '0'
}

const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '')

const pillClass = (change?: string | null) => {
  if (change == null || change === '') return ''
  const raw = String(change)
  if (raw === 'NEW' || (raw !== '=' && raw !== 'RE' && !raw.startsWith('-'))) return 'up'
  if (raw === 'RE' || raw.startsWith('-')) return 'down'
  return ''
}

const pillLabel = (change?: string | null) => {
  if (change == null || change === '') return ''
  const raw = String(change)
  if (raw === '=') return t(loc.value, 'chartsHold')
  if (raw === 'NEW') return t(loc.value, 'chartsNew')
  return raw.replace('-', '−')
}

const moveLabel = (change?: string | null) => {
  if (change == null || change === '') return '—'
  if (change === '=') return t(loc.value, 'chartsHold')
  if (change === 'NEW') return t(loc.value, 'chartsNew')
  return String(change).replace('-', '−')
}

const rankClass = (n: number) => (n === 1 ? 'top1' : n === 2 ? 'top2' : n === 3 ? 'top3' : '')

const coverOf = (track?: ChartTrack | null, large = false) => {
  if (!track) return ''
  let url = ''
  if (track.coverUrl) url = String(track.coverUrl)
  else if (track.videoId) url = `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`
  if (!url) return ''
  if (large) {
    url = url
      .replace('ab67616100005174', 'ab6761610000e5eb')
      .replace('ab67616d00001e02', 'ab67616d0000b273')
      .replace('/hqdefault.jpg', '/maxresdefault.jpg')
  }
  return url
}

const linkOf = (track?: ChartTrack | null) => {
  if (!track) return ''
  if (track.trackId) return `https://open.spotify.com/track/${track.trackId}`
  if (track.artistId) return `https://open.spotify.com/artist/${track.artistId}`
  if (track.videoId) return `https://www.youtube.com/watch?v=${track.videoId}`
  return ''
}

const linkLabel = (track?: ChartTrack | null) => {
  if (!track) return ''
  if (track.trackId || track.artistId) return t(loc.value, 'chartsOpenSpotify')
  if (track.videoId) return t(loc.value, 'chartsOpenYoutube')
  return ''
}

const positionOf = (board: Board, track: ChartTrack, index: number) =>
  board.positionOf ? board.positionOf(track, index) : Number(track.position || index + 1)

const boards = computed<Board[]>(() => {
  const pack = data.value
  if (!pack) return []
  return [
    {
      id: 'spotify',
      kicker: t(loc.value, 'chartsKickerSpotify'),
      title: t(loc.value, 'chartsSpotifyDaily'),
      pack: pack.daily,
      metric: (track) => Number(track.streams || 0),
      heroStats: (track) => [
        { label: t(loc.value, 'chartsStreams'), value: fmt.value.format(track.streams), tone: '' },
        { label: t(loc.value, 'chartsToday'), value: signed(track.streamsChange), tone: tone(track.streamsChange) },
        { label: t(loc.value, 'chartsTotal'), value: fmt.value.format(track.total), tone: '' },
      ],
      artist: (track) => track.artist,
      titleOf: (track) => track.title,
      sub: (track) =>
        track.with?.length
          ? `${t(loc.value, 'chartsWith')} ${track.with.map((item: { name: string }) => item.name).join(', ')}`
          : '',
      metaValue: (track) => fmt.value.format(track.streams),
      metaDelta: (track) => signed(track.streamsChange),
      metaTone: (track) => tone(track.streamsChange),
    },
    {
      id: 'listeners',
      kicker: t(loc.value, 'chartsKickerSpotify'),
      title: t(loc.value, 'chartsListeners'),
      pack: pack.listeners,
      metric: (track) => Number(track.listeners || 0),
      heroStats: (track) => [
        { label: t(loc.value, 'chartsListeners'), value: fmt.value.format(track.listeners), tone: '' },
        { label: t(loc.value, 'chartsToday'), value: signed(track.listenersChange), tone: tone(track.listenersChange) },
        { label: t(loc.value, 'chartsPeak'), value: fmt.value.format(track.peakListeners), tone: '' },
      ],
      artist: () => t(loc.value, 'chartsArtist'),
      titleOf: (track) => track.artist,
      sub: () => '',
      metaValue: (track) => fmt.value.format(track.listeners),
      metaDelta: (track) => signed(track.listenersChange),
      metaTone: (track) => tone(track.listenersChange),
    },
    {
      id: 'youtube',
      kicker: t(loc.value, 'chartsKickerYoutube'),
      title: t(loc.value, 'chartsYoutubeViews'),
      pack: pack.latest,
      wide: true,
      metric: (track) => Number(track.views || 0),
      heroStats: (track) => [
        { label: t(loc.value, 'chartsViews'), value: fmt.value.format(track.views), tone: '' },
        { label: t(loc.value, 'chartsLikes'), value: fmt.value.format(track.likes), tone: '' },
        {
          label: t(loc.value, 'chartsMove'),
          value: moveLabel(track.change),
          tone: tone(Number(track.change) || 0),
        },
      ],
      artist: () => '',
      titleOf: (track) => track.title,
      sub: (track) => `${fmt.value.format(track.views)} ${t(loc.value, 'chartsViewsUnit')}`,
      metaValue: (track) => fmt.value.format(track.views),
      metaDelta: (track) => `${fmt.value.format(track.likes)} ${t(loc.value, 'chartsLikesUnit')}`,
      metaTone: () => '',
    },
    {
      id: 'trending',
      kicker: t(loc.value, 'chartsKickerYoutube'),
      title: t(loc.value, 'chartsTrending'),
      pack: pack.trending,
      wide: true,
      metric: (track) => Number(track.charts || 0),
      heroStats: (track) => [
        { label: t(loc.value, 'chartsCountries'), value: String(track.charts), tone: '' },
        {
          label: t(loc.value, 'chartsMove'),
          value: moveLabel(track.change),
          tone: track.change === 'NEW' ? 'up' : tone(Number(track.change) || 0),
        },
        { label: t(loc.value, 'chartsLead'), value: String(track.highlights || '').split(',')[0] || '—', tone: '' },
      ],
      artist: () => '',
      titleOf: (track) => track.title,
      sub: (track) => track.highlights || '',
      metaValue: (track) => String(track.charts),
      metaDelta: () => t(loc.value, 'chartsCountries'),
      metaTone: () => '',
    },
    {
      id: 'countries',
      kicker: t(loc.value, 'chartsKickerYoutube'),
      title: t(loc.value, 'chartsByCountry'),
      pack: pack.insights,
      metric: (track) => Number(track.marketSize || 0),
      heroStats: (track) => [
        { label: t(loc.value, 'chartsMarket'), value: `${track.marketSize}%`, tone: '' },
        { label: t(loc.value, 'chartsCountry'), value: track.country, tone: '' },
        { label: t(loc.value, 'chartsWeek'), value: 'No. 1', tone: '' },
      ],
      artist: (track) => track.country,
      titleOf: (track) => `${track.artist} — ${track.title}`,
      sub: () => '',
      metaValue: (track) => `${track.marketSize}%`,
      metaDelta: () => t(loc.value, 'chartsMarket'),
      metaTone: () => '',
      positionOf: (_track, index) => index + 1,
    },
    {
      id: 'radio',
      kicker: t(loc.value, 'chartsKickerRadio'),
      title: t(loc.value, 'chartsRadio'),
      pack: pack.radio,
      metric: (track) => Number(track.spins || 0),
      heroStats: (track) => [
        { label: t(loc.value, 'chartsSpins'), value: fmt.value.format(track.spins), tone: '' },
        { label: t(loc.value, 'chartsSpinMove'), value: signed(track.spinsChange), tone: tone(track.spinsChange) },
        {
          label: t(loc.value, 'chartsAudience'),
          value: track.audience != null ? `${Number(track.audience).toFixed(2)}M` : '—',
          tone: '',
        },
      ],
      artist: (track) => track.artist,
      titleOf: (track) => track.title,
      sub: () => '',
      metaValue: (track) => fmt.value.format(track.spins),
      metaDelta: (track) =>
        track.audience != null
          ? `${Number(track.audience).toFixed(1)}M ${t(loc.value, 'chartsAudienceUnit')}`
          : t(loc.value, 'chartsSpinsOnly'),
      metaTone: () => '',
    },
  ]
})

const boardMeta = (board: Board) => {
  const count = board.pack.count || board.pack.tracks.length
  const when = board.pack.date ? niceDate(board.pack.date) : t(loc.value, 'chartsUpdated')
  return `${when} · ${fmt.value.format(count)} ${t(loc.value, 'chartsEntries')}`
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/charts/data.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('missing')
    data.value = await res.json()
    applyNewsSeo({
      type: 'website',
      locale: loc.value,
      title: `${t(loc.value, 'navCharts')} — Music Mundial`,
      description: t(loc.value, 'chartsBlurb'),
      path: withLocale('/charts/', loc.value),
      image: coverOf(data.value?.daily?.tracks?.[0]) || '/images/portada-1600x900.jpg',
      imageAlt: 'Music Mundial Charts',
      hreflangEn: '/charts/',
      hreflangEs: '/es/charts/',
    })
    syncActiveBoard()
  } catch {
    error.value = t(loc.value, 'chartsMissing')
  } finally {
    loading.value = false
  }
  window.addEventListener('hashchange', syncActiveBoard)
  window.addEventListener('scroll', syncActiveBoard, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncActiveBoard)
  window.removeEventListener('scroll', syncActiveBoard)
})
</script>

<template>
  <main class="charts-page">
    <section class="charts-hero dark-section">
      <div class="kpop-bg" aria-hidden="true">
        <span class="glow"></span>
        <span class="glow two"></span>
        <svg class="sound-waves" viewBox="0 0 1440 560" preserveAspectRatio="none">
          <path class="wave" d="M-100 190 C110 20 220 410 410 190 S680 20 840 200 S1120 400 1530 145" />
          <path class="wave" d="M-100 250 C160 450 230 30 440 250 S670 470 890 245 S1220 30 1540 275" />
          <path class="wave" d="M-100 330 C90 145 270 490 465 330 S725 180 900 340 S1240 520 1530 300" />
        </svg>
        <div class="equalizer">
          <i v-for="(bar, i) in eqBars" :key="i" :style="{ '--h': bar.h, '--d': bar.d, '--delay': bar.delay }"></i>
        </div>
      </div>
      <div class="charts-hero-inner">
        <p class="charts-kicker">Music Mundial</p>
        <h1>{{ t(loc, 'navCharts') }}</h1>
        <p class="charts-blurb">{{ t(loc, 'chartsBlurb') }}</p>
      </div>
    </section>

    <div class="container">
      <p v-if="loading" class="charts-status">{{ t(loc, 'chartsLoading') }}</p>
      <p v-else-if="error" class="charts-status is-error">{{ error }}</p>
      <template v-else>
        <nav class="jump" aria-label="Charts">
          <a
            v-for="board in boards"
            :key="board.id"
            :href="`#${board.id}`"
            :class="{ on: activeBoard === board.id }"
            @click="activeBoard = board.id"
          >
            <span class="jump-kicker">{{ board.kicker }}</span>
            <span class="jump-title">{{ board.title }}</span>
          </a>
        </nav>

        <section
          v-for="board in boards"
          :id="board.id"
          :key="board.id"
          class="board"
        >
          <div class="board-head">
            <div>
              <p class="eyebrow">{{ board.kicker }}</p>
              <h2>{{ board.title }}</h2>
            </div>
            <p class="board-meta">{{ boardMeta(board) }} · {{ t(loc, 'chartsTop8') }}</p>
          </div>

          <component
            :is="linkOf(board.pack.tracks[0]) ? 'a' : 'article'"
            v-if="board.pack.tracks[0]"
            class="hero-card medal-gold"
            :class="{ wide: board.wide, linked: !!linkOf(board.pack.tracks[0]) }"
            :href="linkOf(board.pack.tracks[0]) || undefined"
            :target="linkOf(board.pack.tracks[0]) ? '_blank' : undefined"
            :rel="linkOf(board.pack.tracks[0]) ? 'noopener noreferrer' : undefined"
          >
            <div class="hero-cover" :class="{ wide: board.wide }">
              <img
                v-if="coverOf(board.pack.tracks[0], true)"
                :src="coverOf(board.pack.tracks[0], true)"
                :alt="board.titleOf(board.pack.tracks[0])"
                loading="lazy"
              >
              <div class="hero-cover-fallback" v-else aria-hidden="true">{{ positionOf(board, board.pack.tracks[0], 0) }}</div>
              <div class="hero-badge">
                <span>#{{ String(positionOf(board, board.pack.tracks[0], 0)).padStart(2, '0') }}</span>
                <i
                  v-if="board.pack.tracks[0].change != null"
                  class="pill"
                  :class="pillClass(board.pack.tracks[0].change)"
                >{{ pillLabel(board.pack.tracks[0].change) }}</i>
              </div>
            </div>

            <div class="hero-body">
              <p v-if="board.artist(board.pack.tracks[0])" class="hero-kicker">{{ board.artist(board.pack.tracks[0]) }}</p>
              <h3>{{ board.titleOf(board.pack.tracks[0]) }}</h3>
              <p v-if="board.sub(board.pack.tracks[0])" class="hero-credit">{{ board.sub(board.pack.tracks[0]) }}</p>
              <div class="stats">
                <div v-for="(stat, i) in board.heroStats(board.pack.tracks[0])" :key="i" class="stat">
                  <label>{{ stat.label }}</label>
                  <b :class="stat.tone">{{ stat.value }}</b>
                </div>
              </div>
              <div
                class="meter"
                aria-hidden="true"
              >
                <i
                  :style="{
                    width: `${Math.max(8, Math.round((board.metric(board.pack.tracks[0]) / Math.max(...board.pack.tracks.map(board.metric))) * 100))}%`,
                  }"
                />
              </div>
              <p v-if="linkLabel(board.pack.tracks[0])" class="hero-link">{{ linkLabel(board.pack.tracks[0]) }} →</p>
            </div>
          </component>

          <div class="rows">
            <component
              :is="linkOf(track) ? 'a' : 'article'"
              v-for="(track, index) in board.pack.tracks.slice(1)"
              :key="`${board.id}-${index}`"
              class="row"
              :class="[rankClass(positionOf(board, track, index + 1)), { linked: !!linkOf(track), wide: board.wide }]"
              :href="linkOf(track) || undefined"
              :target="linkOf(track) ? '_blank' : undefined"
              :rel="linkOf(track) ? 'noopener noreferrer' : undefined"
            >
              <div class="row-scroll">
                <div
                  class="rank"
                  :class="rankClass(positionOf(board, track, index + 1))"
                >
                  {{ positionOf(board, track, index + 1) }}
                </div>
                <div class="row-thumb" :class="{ wide: board.wide, round: board.id === 'listeners' }">
                  <img
                    v-if="coverOf(track)"
                    :src="coverOf(track)"
                    :alt="board.titleOf(track)"
                    loading="lazy"
                  >
                  <span v-else class="row-thumb-fallback">{{ positionOf(board, track, index + 1) }}</span>
                </div>
                <div class="row-copy">
                  <p v-if="board.artist(track) && board.id !== 'listeners'" class="artist">{{ board.artist(track) }}</p>
                  <p class="title">{{ board.titleOf(track) }}</p>
                  <p v-if="board.sub(track)" class="sub">{{ board.sub(track) }}</p>
                </div>
                <div class="row-side">
                  <span
                    v-if="track.change != null"
                    class="pill"
                    :class="pillClass(track.change)"
                  >{{ pillLabel(track.change) }}</span>
                  <div class="row-meta">
                    <p class="value">{{ board.metaValue(track) }}</p>
                    <p class="delta" :class="board.metaTone(track)">{{ board.metaDelta(track) }}</p>
                  </div>
                </div>
              </div>
            </component>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.charts-page { padding-bottom: 56px; }
.charts-hero {
  position: relative;
  overflow: hidden;
  min-height: 280px;
  display: flex;
  align-items: end;
  margin-top: 0;
  padding: 28px 0 34px;
  border-bottom: 0;
}
.charts-hero.dark-section {
  margin-top: 0;
  padding: 28px 0 34px;
}
.charts-hero-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}
.charts-kicker {
  margin: 0 0 8px;
  color: #8eb0ff;
  font: 800 11px/1 'Manrope', sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.charts-hero h1 {
  margin: 0;
  color: #fff;
  font: 800 42px/1 'Manrope', sans-serif;
  letter-spacing: -1.1px;
}
.charts-blurb {
  margin: 10px 0 0;
  max-width: 42ch;
  color: rgba(220, 230, 255, 0.74);
  font-size: 15px;
  line-height: 1.45;
}
.charts-status {
  margin: 24px 0;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  color: var(--sub);
}
.charts-status.is-error { color: #c62828; }

.jump {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 14px 0 12px;
  padding: 0;
  overflow: visible;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.jump a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  background: var(--card);
  border-radius: 999px;
  padding: 8px 12px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.jump-kicker {
  color: var(--blue);
  font: 800 10px/1 'Manrope', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.jump-title {
  color: var(--ink);
  font: 750 12.5px/1.15 'Manrope', sans-serif;
}
.jump a:hover {
  border-color: color-mix(in srgb, var(--blue) 40%, var(--line));
  background: var(--hover);
}
.jump a.on {
  background: color-mix(in srgb, var(--blue) 14%, var(--card));
  border-color: var(--blue);
}
.jump a.on .jump-kicker,
.jump a.on .jump-title {
  color: var(--blue);
}

.board {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  scroll-margin-top: 150px;
}
.board-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: end;
  gap: 10px;
  margin-bottom: 16px;
}
.board-head h2 {
  margin: 4px 0 0;
  font: 800 28px/1.1 'Manrope', sans-serif;
  letter-spacing: -0.55px;
}
.board-meta { margin: 0; color: var(--sub); font-size: 13px; }

.hero-card {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 22px;
  align-items: stretch;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.hero-card.wide { grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); }
.hero-card.medal-gold {
  border: 2px solid #e2b63a;
  box-shadow:
    0 0 0 1px rgba(226, 182, 58, 0.25),
    0 12px 28px rgba(226, 182, 58, 0.12),
    var(--shadow);
  background:
    linear-gradient(135deg, rgba(226, 182, 58, 0.12), transparent 42%),
    var(--card);
}
.hero-card.medal-gold .hero-cover {
  border-color: #e2b63a;
  box-shadow: 0 0 0 1px rgba(226, 182, 58, 0.35);
}
.hero-card.medal-gold .hero-badge > span {
  background: linear-gradient(135deg, #f6d860, #c9961a);
  color: #2a1d00;
}
.hero-cover {
  position: relative;
  width: 100%;
  min-height: 260px;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  background: var(--off);
  border: 1px solid var(--line);
  flex: none;
}
.hero-cover.wide {
  min-height: 200px;
  aspect-ratio: 16 / 10;
}
.hero-cover img,
.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hero-cover-fallback,
.row-thumb-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font: 800 28px/1 'Manrope', sans-serif;
  color: var(--blue);
  background: linear-gradient(145deg, color-mix(in srgb, var(--blue) 16%, var(--off)), var(--off));
}
.hero-badge {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.hero-badge > span {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(10, 16, 28, 0.78);
  color: #fff;
  font: 800 12px/1 'Manrope', sans-serif;
  letter-spacing: 0.04em;
}
.hero-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sub);
}
.hero-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.hero-body h3 {
  margin: 6px 0 0;
  font: 800 28px/1.15 'Manrope', sans-serif;
  letter-spacing: -0.5px;
}
.hero-credit { margin: 8px 0 0; color: var(--sub); font-size: 14px; }
.hero-link {
  margin: 14px 0 0;
  color: var(--blue);
  font: 800 13px/1 'Manrope', sans-serif;
}
.hero-card.linked,
.row.linked {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.hero-card.linked { display: grid; }
.hero-card.linked:hover .hero-link,
.row.linked:hover .title { color: var(--blue); }
.stats {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.stat {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--off);
  padding: 12px 14px;
}
.stat label {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sub);
}
.stat b {
  display: block;
  margin-top: 6px;
  font: 800 22px/1 'Manrope', sans-serif;
  letter-spacing: -0.4px;
}
.stat b.up, .delta.up { color: #0f8a4b; }
.stat b.down, .delta.down { color: #c62828; }
html[data-theme='dark'] .stat b.up,
html[data-theme='dark'] .delta.up { color: #3dd68c; }
html[data-theme='dark'] .stat b.down,
html[data-theme='dark'] .delta.down { color: #ff7b7b; }
.meter {
  margin-top: 10px;
  height: 5px;
  border-radius: 999px;
  background: var(--off);
  border: 1px solid var(--line);
  overflow: hidden;
}
.meter > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--blue), #6ea0ff);
}

.rows { margin-top: 12px; display: grid; gap: 8px; }
.row {
  display: block;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  overflow: hidden;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.row:hover {
  border-color: color-mix(in srgb, var(--blue) 35%, var(--line));
  transform: translateY(-1px);
}
.row-scroll {
  display: grid;
  grid-template-columns: 44px 72px minmax(180px, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 560px;
  padding: 12px 14px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.row.wide .row-scroll {
  grid-template-columns: 44px 120px minmax(220px, 1fr) auto;
  min-width: 640px;
}
.row.linked {
  display: block;
}
.rank {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--off);
  font: 800 15px/1 'Manrope', sans-serif;
}
.rank.top1 {
  color: #8a6500;
  background: linear-gradient(145deg, #fff4c4, #f0d060);
  border: 2px solid #d4a017;
}
.rank.top2 {
  color: #4b5563;
  background: linear-gradient(145deg, #f7f8fa, #d5d9e0);
  border: 2px solid #a8b0bc;
}
.rank.top3 {
  color: #8a4a12;
  background: linear-gradient(145deg, #ffe4c8, #e0a06a);
  border: 2px solid #c67a3a;
}
.row.top1 {
  border: 2px solid #e2b63a;
  background:
    linear-gradient(135deg, rgba(226, 182, 58, 0.16), transparent 46%),
    var(--card);
}
.row.top1 .row-thumb { border-color: #e2b63a; }
.row.top2 {
  border: 2px solid #b8c0cc;
  background:
    linear-gradient(135deg, rgba(184, 192, 204, 0.16), transparent 46%),
    var(--card);
}
.row.top2 .row-thumb { border-color: #b8c0cc; }
.row.top3 {
  border: 2px solid #c67a3a;
  background:
    linear-gradient(135deg, rgba(198, 122, 58, 0.14), transparent 46%),
    var(--card);
}
.row.top3 .row-thumb { border-color: #c67a3a; }
html[data-theme='dark'] .rank.top1 {
  color: #ffe08a;
  background: linear-gradient(145deg, #5a4514, #3a2f12);
  border-color: #e2b63a;
}
html[data-theme='dark'] .rank.top2 {
  color: #e8edf5;
  background: linear-gradient(145deg, #3a4456, #243044);
  border-color: #c0c8d4;
}
html[data-theme='dark'] .rank.top3 {
  color: #ffc090;
  background: linear-gradient(145deg, #5a3418, #3a2416);
  border-color: #d4894a;
}
html[data-theme='dark'] .row.top1 {
  border-color: #e2b63a;
  background:
    linear-gradient(135deg, rgba(226, 182, 58, 0.14), transparent 46%),
    var(--card);
}
html[data-theme='dark'] .row.top2 {
  border-color: #c0c8d4;
  background:
    linear-gradient(135deg, rgba(192, 200, 212, 0.12), transparent 46%),
    var(--card);
}
html[data-theme='dark'] .row.top3 {
  border-color: #d4894a;
  background:
    linear-gradient(135deg, rgba(212, 137, 74, 0.12), transparent 46%),
    var(--card);
}

.row-thumb {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  overflow: hidden;
  flex: none;
  background: var(--off);
  border: 1px solid var(--line);
}
.row-thumb.wide {
  width: 120px;
  height: 68px;
  border-radius: 10px;
}
.row-thumb.round { border-radius: 999px; }
.row-copy {
  min-width: 180px;
  padding-right: 8px;
}
.row-copy .artist,
.row-copy .sub {
  margin: 0;
  color: var(--sub);
  font-size: 12.5px;
}
.row-copy .title {
  margin: 2px 0 0;
  font: 800 15px/1.35 'Manrope', sans-serif;
  letter-spacing: -0.2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.row-copy .sub { margin-top: 3px; font-size: 12px; }
.row-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  padding-left: 4px;
}
.pill {
  display: inline-flex;
  min-width: 3.1rem;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font: 800 11px/1 'Manrope', sans-serif;
  letter-spacing: 0.04em;
  background: var(--off);
  color: var(--sub);
}
.pill.up { color: #0f8a4b; background: color-mix(in srgb, #0f8a4b 12%, var(--card)); border-color: color-mix(in srgb, #0f8a4b 28%, var(--line)); }
.pill.down { color: #c62828; background: color-mix(in srgb, #c62828 10%, var(--card)); border-color: color-mix(in srgb, #c62828 26%, var(--line)); }
.hero-badge .pill { background: rgba(255,255,255,0.92); }
.row-meta { text-align: right; white-space: nowrap; min-width: 88px; }
.row-meta .value { margin: 0; font: 800 16px/1 'Manrope', sans-serif; }
.row-meta .delta { margin: 5px 0 0; font-size: 12px; color: var(--sub); }

@media (max-width: 900px) {
  .charts-hero {
    min-height: 240px;
    padding: 22px 0 26px;
  }
  .charts-hero h1 { font-size: 34px; }
  .jump {
    margin: 10px 0 12px;
    gap: 6px;
  }
  .jump a {
    padding: 7px 10px;
  }
  .jump-kicker { font-size: 9px; }
  .jump-title { font-size: 12px; }
  .hero-card,
  .hero-card.wide {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .hero-cover,
  .hero-cover.wide {
    width: 100%;
    max-width: none;
    min-height: 240px;
    aspect-ratio: 1;
  }
  .hero-cover.wide { aspect-ratio: 16 / 10; min-height: 180px; }
  .hero-body h3 { font-size: 24px; }
  .stats { grid-template-columns: 1fr; }
  .row-scroll {
    grid-template-columns: 36px 64px minmax(200px, 1fr) auto;
    gap: 12px;
    min-width: 520px;
    padding: 10px 12px;
  }
  .row.wide .row-scroll {
    grid-template-columns: 36px 110px minmax(220px, 1fr) auto;
    min-width: 600px;
  }
  .row-thumb { width: 64px; height: 64px; }
  .row-thumb.wide { width: 110px; height: 62px; }
  .row-side { display: flex; }
}
</style>
