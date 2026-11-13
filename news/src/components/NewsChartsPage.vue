<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { t } from '../lib/copy'
import { applyNewsSeo } from '../lib/seo'
import { withLocale } from '../lib/locale'

type ChartTrack = Record<string, any>

type ChartPack = {
  date?: string | null
  week?: string | null
  scrapedAt?: string | null
  count?: number
  note?: string
  country?: string | null
  code?: string | null
  chart?: string | null
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

type CountryMeta = { code: string; country: string; date?: string | null; count?: number }

type BoardColumn = 'move' | 'streams' | 'spins' | 'audience' | 'listeners' | 'views' | 'likes' | 'countries' | 'market' | 'last'

type Board = {
  id: string
  kicker: string
  title: string
  description: string
  banner: string
  family: 'spotify' | 'youtube' | 'radio'
  hasCountry?: boolean
  hasWeek?: boolean
  wide?: boolean
  roundThumb?: boolean
  columns: BoardColumn[]
  pack: ChartPack
  metric: (track: ChartTrack) => number
  artist: (track: ChartTrack) => string
  titleOf: (track: ChartTrack) => string
  sub: (track: ChartTrack) => string
  positionOf?: (track: ChartTrack, index: number) => number
}

const props = defineProps<{ locale?: string }>()
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const loading = ref(true)
const countryLoading = ref(false)
const error = ref('')
const data = ref<ChartsData | null>(null)
const activeBoard = ref('radio')
const countryCode = ref('global')
const countryPack = ref<ChartPack | null>(null)
const countryError = ref('')
const countryOpen = ref(false)
const countryQuery = ref('')
const availableCountries = ref<CountryMeta[]>([])
const packedCountries = ref<CountryMeta[]>([])
const countryCache = new Map<string, ChartPack>()
const countryBtn = ref<HTMLElement | null>(null)
const selectedWeek = ref('')
const INITIAL_SIZE = 12
const PAGE_SIZE = 8
const visibleCount = ref(INITIAL_SIZE)
let onHashChange: (() => void) | null = null

const eqBars = Array.from({ length: 48 }, (_, i) => ({
  h: `${18 + Math.round((Math.sin(i * 0.45) + 1) * 25 + ((i * 17) % 28))}px`,
  d: `${0.7 + ((i * 13) % 18) / 10}s`,
  delay: `${-((i * 7) % 30) / 10}s`,
}))

const fmt = computed(() => new Intl.NumberFormat(loc.value === 'es' ? 'es' : 'en-US'))
const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthsEs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const niceDate = (iso?: string | null) => {
  if (!iso) return t(loc.value, 'chartsUpdated')
  const parts = String(iso).slice(0, 10).split('-').map(Number)
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return String(iso)
  const months = loc.value === 'es' ? monthsEs : monthsEn
  return `${months[parts[1] - 1]} ${parts[2]}, ${parts[0]}`
}

const niceDateTime = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return niceDate(iso)
  return new Intl.DateTimeFormat(loc.value === 'es' ? 'es' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

const formatWeekLabel = (week?: string | null, dateIso?: string | null) => {
  if (!week) return dateIso ? niceDate(dateIso) : '—'
  const year = dateIso ? String(dateIso).slice(0, 4) : ''
  const cleaned = week.replace(/\s*-\s*/g, ' – ')
  if (year && !cleaned.includes(year)) return `${cleaned}, ${year}`
  return cleaned
}

const signed = (n: number) => {
  if (n > 0) return `+${fmt.value.format(n)}`
  if (n < 0) return `−${fmt.value.format(Math.abs(n))}`
  return '0'
}

const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '')

const pctOf = (change: number, base: number) => {
  if (!base || !Number.isFinite(base) || !Number.isFinite(change)) return ''
  const pct = (change / base) * 100
  const abs = Math.abs(pct)
  const shown = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1)
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${shown}%`
}

const metricDelta = (change: number, previous: number) => {
  const pct = pctOf(change, previous)
  if (!pct) return { text: signed(change), tone: tone(change) }
  return { text: `${signed(change)} (${pct})`, tone: tone(change) }
}

const parseMove = (change?: string | null) => {
  if (change == null || change === '') return { kind: 'none' as const, value: 0 }
  const raw = String(change).trim()
  if (raw === '=') return { kind: 'hold' as const, value: 0 }
  if (raw === 'NEW') return { kind: 'new' as const, value: 0 }
  if (raw === 'RE') return { kind: 're' as const, value: 0 }
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n === 0) return { kind: 'hold' as const, value: 0 }
  return { kind: n > 0 ? ('up' as const) : ('down' as const), value: n }
}

const lastWeekPos = (position: number, change?: string | null) => {
  const move = parseMove(change)
  if (move.kind === 'new' || move.kind === 're' || move.kind === 'none') return null
  if (move.kind === 'hold') return position
  return position + move.value
}

const moveDisplay = (change?: string | null) => {
  const move = parseMove(change)
  if (move.kind === 'none') return { label: '—', tone: '', icon: 'flat' as const }
  if (move.kind === 'hold') return { label: '—', tone: '', icon: 'flat' as const }
  if (move.kind === 'new') return { label: t(loc.value, 'chartsNew'), tone: 'up', icon: 'new' as const }
  if (move.kind === 're') return { label: t(loc.value, 'chartsReEntry'), tone: 'up', icon: 'new' as const }
  const label = move.value > 0 ? `+${move.value}` : String(move.value).replace('-', '−')
  return {
    label,
    tone: move.kind === 'up' ? 'up' : 'down',
    icon: move.kind === 'up' ? ('up' as const) : ('down' as const),
  }
}

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

const positionOf = (board: Board, track: ChartTrack, index: number) =>
  board.positionOf ? board.positionOf(track, index) : Number(track.position || index + 1)

const rankClass = (n: number) => (n === 1 ? 'top1' : n === 2 ? 'top2' : n === 3 ? 'top3' : '')

const activeDailyPack = computed<ChartPack>(() => {
  if (!data.value) return { tracks: [] }
  if (countryCode.value === 'global') return data.value.daily
  return countryPack.value || { tracks: [], code: countryCode.value }
})

const boards = computed<Board[]>(() => {
  const pack = data.value
  if (!pack) return []
  return [
    {
      id: 'radio',
      kicker: t(loc.value, 'chartsKickerRadio'),
      title: t(loc.value, 'chartsRadio'),
      description: t(loc.value, 'chartsRadioDesc'),
      banner: t(loc.value, 'chartsBannerRadio'),
      family: 'radio',
      hasWeek: true,
      columns: ['move', 'spins', 'audience', 'last'],
      pack: pack.radio,
      metric: (track) => Number(track.spins || 0),
      artist: (track) => track.artist,
      titleOf: (track) => track.title,
      sub: () => '',
    },
    {
      id: 'spotify',
      kicker: t(loc.value, 'chartsKickerSpotify'),
      title: t(loc.value, 'chartsSpotifyDaily'),
      description: t(loc.value, 'chartsSpotifyDailyDesc'),
      banner: t(loc.value, 'chartsBannerSpotify'),
      family: 'spotify',
      hasCountry: true,
      columns: ['move', 'streams', 'last'],
      pack: activeDailyPack.value,
      metric: (track) => Number(track.streams || 0),
      artist: (track) => track.artist,
      titleOf: (track) => track.title,
      sub: (track) =>
        track.with?.length
          ? `${t(loc.value, 'chartsWith')} ${track.with.map((item: { name: string }) => item.name).join(', ')}`
          : '',
    },
    {
      id: 'listeners',
      kicker: t(loc.value, 'chartsKickerSpotify'),
      title: t(loc.value, 'chartsListeners'),
      description: t(loc.value, 'chartsListenersDesc'),
      banner: t(loc.value, 'chartsBannerSpotify'),
      family: 'spotify',
      roundThumb: true,
      columns: ['move', 'listeners', 'last'],
      pack: pack.listeners,
      metric: (track) => Number(track.listeners || 0),
      artist: () => t(loc.value, 'chartsArtist'),
      titleOf: (track) => track.artist,
      sub: () => '',
    },
    {
      id: 'youtube',
      kicker: t(loc.value, 'chartsKickerYoutube'),
      title: t(loc.value, 'chartsYoutubeViews'),
      description: t(loc.value, 'chartsYoutubeViewsDesc'),
      banner: t(loc.value, 'chartsBannerYoutube'),
      family: 'youtube',
      wide: true,
      columns: ['move', 'views', 'likes', 'last'],
      pack: pack.latest,
      metric: (track) => Number(track.views || 0),
      artist: () => '',
      titleOf: (track) => track.title,
      sub: () => '',
    },
    {
      id: 'trending',
      kicker: t(loc.value, 'chartsKickerYoutube'),
      title: t(loc.value, 'chartsTrending'),
      description: t(loc.value, 'chartsTrendingDesc'),
      banner: t(loc.value, 'chartsBannerYoutube'),
      family: 'youtube',
      wide: true,
      columns: ['move', 'countries', 'last'],
      pack: pack.trending,
      metric: (track) => Number(track.charts || 0),
      artist: () => '',
      titleOf: (track) => track.title,
      sub: (track) => track.highlights || '',
    },
    {
      id: 'countries',
      kicker: t(loc.value, 'chartsKickerYoutube'),
      title: t(loc.value, 'chartsByCountry'),
      description: t(loc.value, 'chartsByCountryDesc'),
      banner: t(loc.value, 'chartsBannerYoutube'),
      family: 'youtube',
      columns: ['market'],
      pack: pack.insights,
      metric: (track) => Number(track.marketSize || 0),
      artist: (track) => track.country,
      titleOf: (track) => `${track.artist} — ${track.title}`,
      sub: () => '',
      positionOf: (_track, index) => index + 1,
    },
  ]
})

const currentBoard = computed(() => {
  const board = boards.value.find((b) => b.id === activeBoard.value) || boards.value[0]
  if (!board) return board
  if (board.id === 'spotify' && countryCode.value !== 'global') {
    return {
      ...board,
      title: currentCountryLabel.value,
    }
  }
  return board
})

const weekOptions = computed(() => {
  const board = currentBoard.value
  if (!board?.hasWeek) return []
  const week = formatWeekLabel(board.pack.week, board.pack.date)
  if (!week || week === '—') return []
  return [{ id: week, label: week }]
})

const dateOptions = computed(() => {
  const board = currentBoard.value
  if (!board || board.hasWeek) return []
  const date = board.pack.date
  if (!date) return []
  return [{ id: String(date).slice(0, 10), label: niceDate(date) }]
})

watch(
  () => [currentBoard.value?.id, currentBoard.value?.pack.week, currentBoard.value?.pack.date],
  () => {
    if (currentBoard.value?.hasWeek) {
      selectedWeek.value = weekOptions.value[0]?.id || ''
    } else {
      selectedWeek.value = dateOptions.value[0]?.id || ''
    }
  },
  { immediate: true },
)

const updatedLabel = computed(() => {
  const pack = currentBoard.value?.pack
  if (!pack) return ''
  const when = pack.scrapedAt ? niceDateTime(pack.scrapedAt) : pack.date ? niceDate(pack.date) : t(loc.value, 'chartsUpdated')
  return `${t(loc.value, 'chartsUpdatedAt')}: ${when}`
})

const allTracks = computed(() => currentBoard.value?.pack.tracks || [])
const heroTrack = computed(() => allTracks.value[0] || null)
const tableTracks = computed(() => allTracks.value.slice(1, visibleCount.value))
const hasMoreTracks = computed(() => allTracks.value.length > visibleCount.value)
const showingLabel = computed(() => {
  const total = allTracks.value.length
  const shown = Math.min(visibleCount.value, total)
  return `${t(loc.value, 'chartsShowing')} ${shown} ${t(loc.value, 'chartsOf')} ${total}`
})

const resetVisible = () => {
  visibleCount.value = INITIAL_SIZE
}

const loadMore = () => {
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, allTracks.value.length)
}

const flagSrc = (code?: string | null) => {
  const raw = String(code || '').trim().toLowerCase()
  if (!raw || raw === 'global' || raw.length !== 2) return ''
  return `https://flagcdn.com/20x15/${raw}.png`
}

const currentCountryLabel = computed(() => {
  if (countryCode.value === 'global') return t(loc.value, 'chartsGlobal')
  const hit =
    packedCountries.value.find((c) => c.code.toLowerCase() === countryCode.value) ||
    availableCountries.value.find((c) => c.code.toLowerCase() === countryCode.value)
  return hit?.country || countryCode.value.toUpperCase()
})

const currentCountryFlag = computed(() => flagSrc(countryCode.value))

const filteredCountries = computed(() => {
  const q = countryQuery.value.trim().toLowerCase()
  const map = new Map<string, CountryMeta>()
  for (const c of availableCountries.value) map.set(c.code.toLowerCase(), c)
  for (const c of packedCountries.value) map.set(c.code.toLowerCase(), c)
  const list = [...map.values()].sort((a, b) => a.country.localeCompare(b.country, loc.value === 'es' ? 'es' : 'en'))
  if (!q) return list
  return list.filter(
    (c) => c.country.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  )
})

const streamsDelta = (track: ChartTrack) => {
  const change = Number(track.streamsChange || 0)
  const prev = Number(track.streams || 0) - change
  return metricDelta(change, prev)
}

const listenersDelta = (track: ChartTrack) => {
  const change = Number(track.listenersChange || 0)
  const prev = Number(track.listeners || 0) - change
  return metricDelta(change, prev)
}

const spinsDelta = (track: ChartTrack) => {
  const change = Number(track.spinsChange || 0)
  const prev = Number(track.spinsLastWeek != null ? track.spinsLastWeek : Number(track.spins || 0) - change)
  return metricDelta(change, prev)
}

const audienceDelta = (track: ChartTrack) => {
  if (track.audience == null) return { text: '—', tone: '' }
  const change = Number(track.audienceChange || 0)
  const prev = Number(track.audience) - change
  const abs = change === 0 ? '0' : `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(2)}M`
  const pct = pctOf(change, prev)
  return { text: pct ? `${abs} (${pct})` : abs, tone: tone(change) }
}

const audienceValue = (track: ChartTrack) =>
  track.audience != null ? `${Number(track.audience).toFixed(2)}M` : '—'

const heroStats = (board: Board, track: ChartTrack) => {
  const pos = positionOf(board, track, 0)
  const move = moveDisplay(track.change)
  const last = lastWeekPos(pos, track.change)
  const lastLabel = last == null ? (parseMove(track.change).kind === 'new' ? t(loc.value, 'chartsNew') : '—') : `#${String(last).padStart(2, '0')}`

  if (board.id === 'radio') {
    const spins = spinsDelta(track)
    const aud = audienceDelta(track)
    return [
      { label: t(loc.value, 'chartsSpins'), value: fmt.value.format(track.spins || 0), delta: spins.text, tone: spins.tone },
      { label: t(loc.value, 'chartsAudience'), value: audienceValue(track), delta: aud.text, tone: aud.tone },
      { label: t(loc.value, 'chartsLastWeek'), value: lastLabel, delta: '', tone: '' },
      { label: t(loc.value, 'chartsMove'), value: move.label, delta: '', tone: move.tone, icon: move.icon },
    ]
  }
  if (board.id === 'spotify') {
    const streams = streamsDelta(track)
    return [
      { label: t(loc.value, 'chartsStreams'), value: fmt.value.format(track.streams || 0), delta: streams.text, tone: streams.tone },
      { label: t(loc.value, 'chartsLastWeek'), value: lastLabel, delta: '', tone: '' },
      { label: t(loc.value, 'chartsMove'), value: move.label, delta: '', tone: move.tone, icon: move.icon },
    ]
  }
  if (board.id === 'listeners') {
    const d = listenersDelta(track)
    return [
      { label: t(loc.value, 'chartsListeners'), value: fmt.value.format(track.listeners || 0), delta: d.text, tone: d.tone },
      { label: t(loc.value, 'chartsPeak'), value: fmt.value.format(track.peakListeners || 0), delta: '', tone: '' },
      { label: t(loc.value, 'chartsMove'), value: move.label, delta: '', tone: move.tone, icon: move.icon },
    ]
  }
  if (board.id === 'youtube') {
    return [
      { label: t(loc.value, 'chartsViews'), value: fmt.value.format(track.views || 0), delta: '', tone: '' },
      { label: t(loc.value, 'chartsLikes'), value: fmt.value.format(track.likes || 0), delta: '', tone: '' },
      { label: t(loc.value, 'chartsMove'), value: move.label, delta: '', tone: move.tone, icon: move.icon },
    ]
  }
  if (board.id === 'trending') {
    return [
      { label: t(loc.value, 'chartsCountries'), value: String(track.charts || '—'), delta: '', tone: '' },
      { label: t(loc.value, 'chartsLead'), value: String(track.highlights || '').split(',')[0] || '—', delta: '', tone: '' },
      { label: t(loc.value, 'chartsMove'), value: move.label, delta: '', tone: move.tone, icon: move.icon },
    ]
  }
  return [
    { label: t(loc.value, 'chartsMarket'), value: `${track.marketSize ?? '—'}%`, delta: '', tone: '' },
    { label: t(loc.value, 'chartsCountry'), value: track.country || '—', delta: '', tone: '' },
    { label: t(loc.value, 'chartsWeek'), value: 'No. 1', delta: '', tone: '' },
  ]
}

const colLabel = (col: BoardColumn) => {
  const map: Record<BoardColumn, string> = {
    move: t(loc.value, 'chartsMove'),
    streams: t(loc.value, 'chartsStreams'),
    spins: t(loc.value, 'chartsSpins'),
    audience: t(loc.value, 'chartsAudience'),
    listeners: t(loc.value, 'chartsListeners'),
    views: t(loc.value, 'chartsViews'),
    likes: t(loc.value, 'chartsLikes'),
    countries: t(loc.value, 'chartsCountries'),
    market: t(loc.value, 'chartsMarket'),
    last: t(loc.value, 'chartsLastWeek'),
  }
  return map[col]
}

const syncUrl = () => {
  const url = new URL(window.location.href)
  url.hash = activeBoard.value
  if (activeBoard.value === 'spotify' && countryCode.value !== 'global') {
    url.searchParams.set('country', countryCode.value.toUpperCase())
  } else {
    url.searchParams.delete('country')
  }
  const next = `${url.pathname}${url.search}${url.hash}`
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    history.replaceState(null, '', next)
  }
}

const readUrlState = () => {
  const url = new URL(window.location.href)
  const hash = url.hash.replace(/^#/, '')
  if (hash && boards.value.some((b) => b.id === hash)) activeBoard.value = hash
  else activeBoard.value = 'radio'
  const country = (url.searchParams.get('country') || 'global').toLowerCase()
  countryCode.value = country === 'global' || country === '' ? 'global' : country
}

const loadCountry = async (code: string) => {
  countryError.value = ''
  if (code === 'global') {
    countryPack.value = null
    return
  }
  if (countryCache.has(code)) {
    countryPack.value = countryCache.get(code) || null
    return
  }
  countryLoading.value = true
  try {
    const res = await fetch(`/charts/spotify/${code}-daily.json`, { cache: 'no-store' })
    if (!res.ok) throw new Error('missing')
    const pack = (await res.json()) as ChartPack
    if (!pack.tracks?.length) throw new Error('empty')
    countryCache.set(code, pack)
    countryPack.value = pack
    if (!packedCountries.value.some((c) => c.code.toLowerCase() === code)) {
      packedCountries.value = [
        ...packedCountries.value,
        { code, country: pack.country || code.toUpperCase(), date: pack.date, count: pack.count },
      ]
    }
  } catch {
    countryPack.value = null
    countryError.value = t(loc.value, 'chartsNoCountryData')
  } finally {
    countryLoading.value = false
  }
}

const selectBoard = (id: string) => {
  activeBoard.value = id
  countryOpen.value = false
  resetVisible()
  syncUrl()
}

const selectCountry = async (code: string) => {
  countryCode.value = code
  countryOpen.value = false
  countryQuery.value = ''
  resetVisible()
  await loadCountry(code)
  syncUrl()
}

const onDocClick = (event: MouseEvent) => {
  if (!countryOpen.value) return
  const target = event.target as Node
  if (countryBtn.value && !countryBtn.value.contains(target)) {
    const menu = document.getElementById('charts-country-menu')
    if (menu && menu.contains(target)) return
    countryOpen.value = false
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const [chartsRes, countriesRes] = await Promise.all([
      fetch('/charts/data.json', { cache: 'no-store' }),
      fetch('/charts/spotify/countries.json', { cache: 'no-store' }).catch(() => null),
    ])
    if (!chartsRes.ok) throw new Error('missing')
    data.value = await chartsRes.json()
    if (countriesRes?.ok) {
      const meta = await countriesRes.json()
      availableCountries.value = meta.available || []
      packedCountries.value = meta.packed || []
    }
    readUrlState()
    await loadCountry(countryCode.value)
    syncUrl()
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
  } catch {
    error.value = t(loc.value, 'chartsMissing')
  } finally {
    loading.value = false
  }
  onHashChange = () => {
    readUrlState()
    void loadCountry(countryCode.value)
  }
  window.addEventListener('hashchange', onHashChange)
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  if (onHashChange) window.removeEventListener('hashchange', onHashChange)
  document.removeEventListener('click', onDocClick)
})

watch(activeBoard, async () => {
  if (activeBoard.value !== 'spotify' && countryCode.value !== 'global') {
    // keep country in memory but hide selector; restore when returning
  }
  await nextTick()
  syncUrl()
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
        <p class="charts-blurb">{{ currentBoard?.banner || t(loc, 'chartsBlurb') }}</p>
      </div>
    </section>

    <div class="container">
      <p v-if="loading" class="charts-status">{{ t(loc, 'chartsLoading') }}</p>
      <p v-else-if="error" class="charts-status is-error">{{ error }}</p>
      <template v-else-if="currentBoard">
        <nav class="jump" aria-label="Charts">
          <button
            v-for="board in boards"
            :key="board.id"
            type="button"
            :class="{ on: activeBoard === board.id }"
            @click="selectBoard(board.id)"
          >
            <span class="jump-kicker">{{ board.kicker }}</span>
            <span class="jump-title">{{ board.title }}</span>
          </button>
        </nav>

        <section class="board" :id="currentBoard.id">
          <div class="board-toolbar">
            <div class="board-title-block">
              <div class="board-title-row">
                <h2>{{ currentBoard.title }}</h2>
                <span class="info-dot" :title="currentBoard.description" :aria-label="t(loc, 'chartsInfoAria')">i</span>
              </div>
              <p class="board-desc">{{ currentBoard.description }}</p>
            </div>

            <div class="board-controls">
              <div v-if="currentBoard.hasCountry" class="country-wrap" ref="countryBtn">
                <button
                  type="button"
                  class="control-btn country-btn"
                  :aria-expanded="countryOpen"
                  @click.stop="countryOpen = !countryOpen"
                >
                  <img v-if="currentCountryFlag" class="flag-img" :src="currentCountryFlag" alt="" width="20" height="15">
                  <svg v-else class="ctrl-ico" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
                    <path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                  <span>{{ currentCountryLabel }}</span>
                  <span class="caret" aria-hidden="true">▾</span>
                </button>
                <div v-if="countryOpen" id="charts-country-menu" class="country-menu" @click.stop>
                  <input
                    v-model="countryQuery"
                    class="country-search"
                    type="search"
                    :placeholder="t(loc, 'chartsSearchCountry')"
                  >
                  <div class="country-list">
                    <button
                      v-if="!countryQuery.trim() || t(loc, 'chartsGlobal').toLowerCase().includes(countryQuery.trim().toLowerCase())"
                      type="button"
                      class="country-item"
                      :class="{ on: countryCode === 'global' }"
                      @click="selectCountry('global')"
                    >
                      <span class="country-left">
                        <svg class="ctrl-ico" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
                          <path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" />
                        </svg>
                        <span>{{ t(loc, 'chartsGlobal') }}</span>
                      </span>
                      <span v-if="countryCode === 'global'" class="check">✓</span>
                    </button>
                    <button
                      v-for="c in filteredCountries"
                      :key="c.code"
                      type="button"
                      class="country-item"
                      :class="{ on: countryCode === c.code.toLowerCase() }"
                      @click="selectCountry(c.code.toLowerCase())"
                    >
                      <span class="country-left">
                        <img class="flag-img" :src="flagSrc(c.code)" :alt="c.code" width="20" height="15" loading="lazy">
                        <span>{{ c.country }}</span>
                      </span>
                      <span v-if="countryCode === c.code.toLowerCase()" class="check">✓</span>
                      <span v-else class="code">{{ c.code.toUpperCase() }}</span>
                    </button>
                    <p v-if="!filteredCountries.length && countryQuery.trim()" class="country-empty">{{ t(loc, 'chartsNoCountryData') }}</p>
                  </div>
                </div>
              </div>

              <label v-if="currentBoard.hasWeek && weekOptions.length" class="control-btn date-btn">
                <svg class="ctrl-ico" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
                  <path d="M8 3.5v3M16 3.5v3M3.5 10h17" fill="none" stroke="currentColor" stroke-width="1.8" />
                </svg>
                <span class="date-label">{{ t(loc, 'chartsChartWeek') }}:</span>
                <select v-model="selectedWeek">
                  <option v-for="opt in weekOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                </select>
              </label>
              <label v-else-if="dateOptions.length" class="control-btn date-btn">
                <svg class="ctrl-ico" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
                  <path d="M8 3.5v3M16 3.5v3M3.5 10h17" fill="none" stroke="currentColor" stroke-width="1.8" />
                </svg>
                <select v-model="selectedWeek">
                  <option v-for="opt in dateOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                </select>
              </label>

              <p class="updated"><i></i>{{ updatedLabel }}</p>
            </div>
          </div>

          <p v-if="countryLoading" class="charts-status slim">{{ t(loc, 'chartsLoading') }}</p>
          <p v-else-if="currentBoard.hasCountry && countryError" class="charts-status slim is-error">{{ countryError }}</p>

          <template v-else-if="heroTrack">
            <component
              :is="linkOf(heroTrack) ? 'a' : 'article'"
              class="hero-card medal-gold"
              :class="{ wide: currentBoard.wide, linked: !!linkOf(heroTrack) }"
              :href="linkOf(heroTrack) || undefined"
              :target="linkOf(heroTrack) ? '_blank' : undefined"
              :rel="linkOf(heroTrack) ? 'noopener noreferrer' : undefined"
            >
              <div class="hero-cover" :class="{ wide: currentBoard.wide, round: currentBoard.roundThumb }">
                <img
                  v-if="coverOf(heroTrack, true)"
                  :src="coverOf(heroTrack, true)"
                  :alt="currentBoard.titleOf(heroTrack)"
                  loading="lazy"
                >
                <div class="hero-cover-fallback" v-else aria-hidden="true">01</div>
                <div class="hero-badge">
                  <span>#01</span>
                </div>
              </div>

              <div class="hero-body">
                <p v-if="currentBoard.artist(heroTrack)" class="hero-kicker">{{ currentBoard.artist(heroTrack) }}</p>
                <h3>{{ currentBoard.titleOf(heroTrack) }}</h3>
                <p v-if="currentBoard.sub(heroTrack)" class="hero-credit">{{ currentBoard.sub(heroTrack) }}</p>
                <div class="stats" :class="`cols-${heroStats(currentBoard, heroTrack).length}`">
                  <div v-for="(stat, i) in heroStats(currentBoard, heroTrack)" :key="i" class="stat">
                    <label>{{ stat.label }}</label>
                    <b :class="stat.tone">
                      <i v-if="stat.icon === 'up'" class="tri up" aria-hidden="true" />
                      <i v-else-if="stat.icon === 'down'" class="tri down" aria-hidden="true" />
                      {{ stat.value }}
                    </b>
                    <em v-if="stat.delta" :class="stat.tone">{{ stat.delta }}</em>
                  </div>
                </div>
              </div>
            </component>

            <div
              class="chart-table"
              role="table"
              :style="{ '--cols': String(currentBoard.columns.length) }"
            >
              <div class="chart-head" role="row">
                <span class="c-rank" role="columnheader">#</span>
                <span class="c-song" role="columnheader">{{ t(loc, 'chartsSongArtist') }}</span>
                <span
                  v-for="col in currentBoard.columns"
                  :key="col"
                  class="c-metric"
                  :class="`c-${col}`"
                  role="columnheader"
                >{{ colLabel(col) }}</span>
              </div>

              <component
                :is="linkOf(track) ? 'a' : 'div'"
                v-for="(track, index) in tableTracks"
                :key="`${currentBoard.id}-${index}`"
                class="chart-row"
                :class="rankClass(positionOf(currentBoard, track, index + 1))"
                role="row"
                :href="linkOf(track) || undefined"
                :target="linkOf(track) ? '_blank' : undefined"
                :rel="linkOf(track) ? 'noopener noreferrer' : undefined"
              >
                <div class="row-scroll">
                  <span class="c-rank" role="cell">
                    <b :class="rankClass(positionOf(currentBoard, track, index + 1))">
                      {{ String(positionOf(currentBoard, track, index + 1)).padStart(2, '0') }}
                    </b>
                  </span>
                  <span class="c-song" role="cell">
                    <span
                      class="row-thumb"
                      :class="[
                        { wide: currentBoard.wide, round: currentBoard.roundThumb },
                        rankClass(positionOf(currentBoard, track, index + 1)),
                      ]"
                    >
                      <img
                        v-if="coverOf(track)"
                        :src="coverOf(track)"
                        :alt="currentBoard.titleOf(track)"
                        loading="lazy"
                      >
                      <span v-else class="row-thumb-fallback">{{ positionOf(currentBoard, track, index + 1) }}</span>
                    </span>
                    <span class="row-copy">
                      <p v-if="currentBoard.artist(track) && currentBoard.id !== 'listeners'" class="artist">{{ currentBoard.artist(track) }}</p>
                      <p class="title">{{ currentBoard.titleOf(track) }}</p>
                      <p v-if="currentBoard.sub(track)" class="sub">{{ currentBoard.sub(track) }}</p>
                    </span>
                  </span>

                  <template v-for="col in currentBoard.columns" :key="`${index}-${col}`">
                    <span v-if="col === 'move'" class="c-metric c-move" role="cell">
                      <span class="move" :class="moveDisplay(track.change).tone">
                        <i v-if="moveDisplay(track.change).icon === 'up'" class="tri up" />
                        <i v-else-if="moveDisplay(track.change).icon === 'down'" class="tri down" />
                        <i v-else class="dash">—</i>
                        <b v-if="moveDisplay(track.change).icon !== 'flat'">{{ moveDisplay(track.change).label }}</b>
                      </span>
                    </span>
                    <span v-else-if="col === 'streams'" class="c-metric c-streams" role="cell">
                      <strong>{{ fmt.format(track.streams || 0) }}</strong>
                      <em :class="streamsDelta(track).tone">{{ streamsDelta(track).text }}</em>
                    </span>
                    <span v-else-if="col === 'listeners'" class="c-metric c-listeners" role="cell">
                      <strong>{{ fmt.format(track.listeners || 0) }}</strong>
                      <em :class="listenersDelta(track).tone">{{ listenersDelta(track).text }}</em>
                    </span>
                    <span v-else-if="col === 'spins'" class="c-metric c-spins" role="cell">
                      <strong>{{ fmt.format(track.spins || 0) }}</strong>
                      <em :class="spinsDelta(track).tone">{{ spinsDelta(track).text }}</em>
                    </span>
                    <span v-else-if="col === 'audience'" class="c-metric c-audience" role="cell">
                      <strong>{{ audienceValue(track) }}</strong>
                      <em :class="audienceDelta(track).tone">{{ audienceDelta(track).text }}</em>
                    </span>
                    <span v-else-if="col === 'views'" class="c-metric c-views" role="cell">
                      <strong>{{ fmt.format(track.views || 0) }}</strong>
                    </span>
                    <span v-else-if="col === 'likes'" class="c-metric c-likes" role="cell">
                      <strong>{{ fmt.format(track.likes || 0) }}</strong>
                    </span>
                    <span v-else-if="col === 'countries'" class="c-metric c-countries" role="cell">
                      <strong>{{ track.charts || '—' }}</strong>
                    </span>
                    <span v-else-if="col === 'market'" class="c-metric c-market" role="cell">
                      <strong>{{ track.marketSize != null ? `${track.marketSize}%` : '—' }}</strong>
                    </span>
                    <span v-else-if="col === 'last'" class="c-metric c-last" role="cell">
                      <strong>
                        <template v-if="lastWeekPos(positionOf(currentBoard, track, index + 1), track.change) != null">
                          #{{ String(lastWeekPos(positionOf(currentBoard, track, index + 1), track.change)).padStart(2, '0') }}
                        </template>
                        <template v-else>—</template>
                      </strong>
                    </span>
                  </template>
                </div>
              </component>
            </div>

            <div class="load-more-wrap">
              <p class="showing">{{ showingLabel }}</p>
              <button
                v-if="hasMoreTracks"
                type="button"
                class="load-more-btn"
                @click="loadMore"
              >
                {{ t(loc, 'chartsLoadMore') }}
              </button>
            </div>
          </template>
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
  max-width: 52ch;
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
.charts-status.slim { margin: 0 0 16px; padding: 12px 14px; }
.charts-status.is-error { color: #c62828; }

.jump {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 14px 0 18px;
  padding: 0;
}
.jump button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  background: var(--card);
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
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
.jump button:hover {
  border-color: color-mix(in srgb, var(--blue) 40%, var(--line));
  background: var(--hover);
}
.jump button.on {
  background: color-mix(in srgb, var(--blue) 14%, var(--card));
  border-color: var(--blue);
}
.jump button.on .jump-kicker,
.jump button.on .jump-title { color: var(--blue); }

.board { margin-top: 4px; }
.board-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 18px;
}
.board-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.board-title-block h2 {
  margin: 0;
  font: 800 28px/1.1 'Manrope', sans-serif;
  letter-spacing: -0.55px;
}
.info-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  display: inline-grid;
  place-items: center;
  font: 800 11px/1 'Manrope', sans-serif;
  color: var(--sub);
  cursor: help;
}
.board-desc {
  margin: 6px 0 0;
  color: var(--sub);
  font-size: 14px;
}
.board-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}
.control-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font: 750 13px/1 'Manrope', sans-serif;
  cursor: pointer;
}
.control-btn select {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  margin: 0;
  outline: none;
  cursor: pointer;
}
.date-btn { cursor: default; }
.date-label { color: var(--sub); font-weight: 700; }
.country-wrap { position: relative; }
.ctrl-ico {
  width: 15px;
  height: 15px;
  flex: none;
  color: var(--sub);
}
.flag-img {
  width: 20px;
  height: 15px;
  flex: none;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
}
.country-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.country-btn .caret { color: var(--sub); font-size: 11px; }
.country-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: min(320px, 82vw);
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.country-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font: 650 13.5px/1.2 'Manrope', sans-serif;
  text-align: left;
  cursor: pointer;
}
.country-item:hover,
.country-item.on { background: color-mix(in srgb, var(--blue) 10%, var(--card)); }
.country-item .code { color: var(--sub); font-size: 11px; font-weight: 800; }
.country-item .check { color: var(--blue); font-weight: 800; }
.country-search {
  width: 100%;
  margin-bottom: 6px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--off);
  color: var(--ink);
  font: 650 13px/1 'Manrope', sans-serif;
}
.country-list {
  max-height: 320px;
  overflow: auto;
}
.country-empty {
  margin: 10px;
  color: var(--sub);
  font-size: 12.5px;
}
.updated {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--sub);
  font-size: 12.5px;
  white-space: nowrap;
}
.updated > i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #1f9d57;
  box-shadow: 0 0 0 3px rgba(31, 157, 87, 0.16);
}

.hero-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 22px;
  align-items: stretch;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.hero-card.wide { grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); }
.hero-card.medal-gold {
  border: 1.5px solid #e2b63a;
  box-shadow:
    0 0 0 1px rgba(226, 182, 58, 0.18),
    0 12px 28px rgba(226, 182, 58, 0.1),
    var(--shadow);
  background:
    linear-gradient(135deg, rgba(226, 182, 58, 0.1), transparent 42%),
    var(--card);
}
.hero-card.medal-gold .hero-cover {
  border-color: #e2b63a;
}
.hero-card.medal-gold .hero-badge > span {
  background: linear-gradient(135deg, #f6d860, #c9961a);
  color: #2a1d00;
}
.hero-cover {
  position: relative;
  width: 100%;
  min-height: 240px;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  background: var(--off);
  border: 1px solid var(--line);
  flex: none;
}
.hero-cover.wide {
  min-height: 180px;
  aspect-ratio: 16 / 10;
}
.hero-cover.round { border-radius: 999px; }
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
.hero-card.linked {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.hero-card.linked:hover h3 { color: var(--blue); }

.stats {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}
.stats.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.stats.cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.stat {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--blue) 4%, var(--off));
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
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font: 800 22px/1 'Manrope', sans-serif;
  letter-spacing: -0.4px;
}
.stat em {
  display: block;
  margin-top: 5px;
  font: 700 12px/1.2 'Manrope', sans-serif;
  font-style: normal;
  color: var(--sub);
}
.stat b.up, .stat em.up, .move.up, .c-metric em.up { color: #0f8a4b; }
.stat b.down, .stat em.down, .move.down, .c-metric em.down { color: #c62828; }
html[data-theme='dark'] .stat b.up,
html[data-theme='dark'] .stat em.up,
html[data-theme='dark'] .move.up,
html[data-theme='dark'] .c-metric em.up { color: #3dd68c; }
html[data-theme='dark'] .stat b.down,
html[data-theme='dark'] .stat em.down,
html[data-theme='dark'] .move.down,
html[data-theme='dark'] .c-metric em.down { color: #ff7b7b; }

.tri {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  display: inline-block;
}
.tri.up { border-bottom: 8px solid currentColor; }
.tri.down { border-top: 8px solid currentColor; }

.chart-table {
  --cols: 3;
  margin-top: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  background: var(--card);
}
.chart-head,
.chart-row .row-scroll {
  display: grid;
  grid-template-columns: 52px minmax(220px, 1.4fr) repeat(var(--cols, 3), minmax(88px, 1fr));
  gap: 8px;
  align-items: center;
  min-width: 720px;
  padding: 12px 14px;
}
.chart-head {
  background: var(--off);
  border-bottom: 1px solid var(--line);
  color: var(--sub);
  font: 800 11px/1 'Manrope', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  overflow-x: auto;
}
.chart-row {
  display: block;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--line);
}
.chart-row:last-child { border-bottom: 0; }
.chart-row:hover { background: color-mix(in srgb, var(--blue) 5%, var(--card)); }
.chart-row .row-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.c-rank b {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--off);
  font: 800 13px/1 'Manrope', sans-serif;
  color: var(--sub);
}
.c-rank b.top2 {
  color: #4b5563;
  background: linear-gradient(145deg, #f7f8fa, #d5d9e0);
  border: 2px solid #a8b0bc;
}
.c-rank b.top3 {
  color: #8a4a12;
  background: linear-gradient(145deg, #ffe4c8, #e0a06a);
  border: 2px solid #c67a3a;
}
.chart-row.top2 {
  box-shadow: inset 3px 0 0 #a8b0bc;
  background:
    linear-gradient(90deg, rgba(184, 192, 204, 0.18), transparent 42%),
    var(--card);
}
.chart-row.top2 .row-thumb { border-color: #a8b0bc; }
.chart-row.top3 {
  box-shadow: inset 3px 0 0 #c67a3a;
  background:
    linear-gradient(90deg, rgba(198, 122, 58, 0.16), transparent 42%),
    var(--card);
}
.chart-row.top3 .row-thumb { border-color: #c67a3a; }
html[data-theme='dark'] .c-rank b.top2 {
  color: #e8edf5;
  background: linear-gradient(145deg, #3a4456, #243044);
  border-color: #c0c8d4;
}
html[data-theme='dark'] .c-rank b.top3 {
  color: #ffc090;
  background: linear-gradient(145deg, #5a3418, #3a2416);
  border-color: #d4894a;
}
html[data-theme='dark'] .chart-row.top2 {
  border-color: #c0c8d4;
  background:
    linear-gradient(135deg, rgba(192, 200, 212, 0.12), transparent 46%),
    var(--card);
}
html[data-theme='dark'] .chart-row.top3 {
  border-color: #d4894a;
  background:
    linear-gradient(135deg, rgba(212, 137, 74, 0.12), transparent 46%),
    var(--card);
}
.c-song {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.row-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex: none;
  background: var(--off);
  border: 1px solid var(--line);
}
.row-thumb.wide {
  width: 72px;
  height: 42px;
}
.row-thumb.round { border-radius: 999px; }
.row-copy { min-width: 0; }
.row-copy .artist,
.row-copy .sub {
  margin: 0;
  color: var(--sub);
  font-size: 12px;
}
.row-copy .title {
  margin: 2px 0 0;
  font: 800 14.5px/1.3 'Manrope', sans-serif;
  letter-spacing: -0.2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.row-copy .sub { margin-top: 2px; }
.c-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.c-metric strong {
  font: 800 14px/1.15 'Manrope', sans-serif;
  letter-spacing: -0.2px;
}
.c-metric em {
  font: 700 12px/1.2 'Manrope', sans-serif;
  font-style: normal;
  color: var(--sub);
}
.move {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 800 13px/1 'Manrope', sans-serif;
}
.move .dash { color: var(--sub); font-style: normal; }

.load-more-wrap {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.load-more-wrap .showing {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.load-more-btn {
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--blue);
  border-radius: 999px;
  background: color-mix(in srgb, var(--blue) 12%, var(--card));
  color: var(--blue);
  font: 800 13.5px/1 'Manrope', sans-serif;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.load-more-btn:hover {
  background: color-mix(in srgb, var(--blue) 20%, var(--card));
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .charts-hero {
    min-height: 240px;
    padding: 22px 0 26px;
  }
  .charts-hero h1 { font-size: 34px; }
  .board-toolbar { align-items: start; }
  .board-controls { justify-content: flex-start; }
  .hero-card,
  .hero-card.wide {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .hero-cover,
  .hero-cover.wide {
    width: 100%;
    max-width: none;
    min-height: 220px;
    aspect-ratio: 1;
  }
  .hero-cover.wide { aspect-ratio: 16 / 10; min-height: 160px; }
  .hero-body h3 { font-size: 24px; }
  .stats.cols-3,
  .stats.cols-4 { grid-template-columns: 1fr 1fr; }
  .chart-head,
  .chart-row .row-scroll {
    min-width: 680px;
    padding: 10px 12px;
  }
}
</style>
