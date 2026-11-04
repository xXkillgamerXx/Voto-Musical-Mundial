<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AuthDialog from './AuthDialog.vue'
import NewsAdminAuthors from './NewsAdminAuthors.vue'
import NewsAdminCategories from './NewsAdminCategories.vue'
import NewsAdminForum from './NewsAdminForum.vue'
import NewsAdminPages from './NewsAdminPages.vue'
import NewsAdminReports from './NewsAdminReports.vue'
import NewsAdminTags from './NewsAdminTags.vue'
import NewsAdminPostForm from './NewsAdminPostForm.vue'
import NewsAdminPosts from './NewsAdminPosts.vue'
import { getAdminNewsOverview } from '../../../src/services/api/adminApi'
import { getCurrentApiAuth, getMe, logout } from '../../../src/services/api/authApi'
import { onStoredAuthChange } from '../../../src/services/api/client'
import { getTheme, toggleTheme as flipTheme, type SiteTheme } from '../lib/theme'

type AdminUser = {
  displayName?: string
  username?: string
  email?: string
  photoUrl?: string
  photoURL?: string
  role?: string
} | null

type SeriesPoint = { day: string; count: number; es?: number; en?: number }
type CategoryRow = { slug: string; name: string; postCount: number }
type RecentPost = {
  id: string
  slug: string
  title: string
  coverUrl?: string | null
  category?: string
  publishedAt?: string
  href?: string
  locale?: string
}
type LocaleBlock = {
  published: number
  drafts: number
  scheduled: number
  thisPeriod: number
  today: number
  comments: number
  views: number
  categories: number
  authors: number
  topCategories: CategoryRow[]
}
type Overview = {
  days: number
  totals: {
    published: number
    drafts: number
    scheduled: number
    thisPeriod: number
    today: number
    comments: number
    views: number
    categories: number
    authors: number
  }
  series: SeriesPoint[]
  recent: RecentPost[]
  es: LocaleBlock
  en: LocaleBlock
}

const props = defineProps<{
  section?: 'dashboard' | 'posts' | 'categories' | 'authors' | 'tags' | 'forum' | 'pages' | 'reports' | 'post-form'
  postId?: string
  newsLocale?: 'es' | 'en'
}>()
const section = computed(() => props.section || 'dashboard')

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'owner'])
const postsLocale = ref<'es' | 'en'>('es')
const newPostHref = computed(() =>
  postsLocale.value === 'en' ? '/es/admin/noticias/en/nueva' : '/es/admin/noticias/nueva',
)

const pageTitle = computed(() => {
  if (section.value === 'post-form') {
    if (props.postId) return props.newsLocale === 'en' ? 'Edit note (EN)' : 'Editar noticia (ES)'
    return props.newsLocale === 'en' ? 'Nueva noticia (EN)' : 'Nueva noticia (ES)'
  }
  if (section.value === 'posts') return 'Noticias'
  if (section.value === 'categories') return 'Categorías'
  if (section.value === 'authors') return 'Autores'
  if (section.value === 'tags') return 'Etiquetas'
  if (section.value === 'forum') return 'Foro'
  if (section.value === 'pages') return 'Páginas'
  if (section.value === 'reports') return 'Reportes'
  return 'Dashboard'
})
const pageLead = computed(() => {
  if (section.value === 'post-form') {
    return props.newsLocale === 'en'
      ? 'English only · saves to musicmundial_en. Independent from Spanish.'
      : 'Solo español · se guarda en musicmundial_es. Independiente del inglés.'
  }
  if (section.value === 'posts') return 'Español e inglés son bases distintas. El tab decide dónde se crea la nota.'
  if (section.value === 'categories') return 'Categorías por base: musicmundial_es y musicmundial_en.'
  if (section.value === 'authors') return 'Autores por idioma. Edítalos y vincula una cuenta Vote Music Mundial.'
  if (section.value === 'tags') return 'Cada etiqueta tiene su página. Aquí se configura la ficha.'
  if (section.value === 'forum') return 'Salas del foro, textos ES/EN, VIP y temas (fijar, cerrar u ocultar).'
  if (section.value === 'pages') return 'About, términos, cookies, privacidad, DMCA y contacto. Editable por idioma.'
  if (section.value === 'reports') return 'Bandeja de comentarios reportados y opciones del modal de reporte.'
  return 'Resumen de musicmundial_es y musicmundial_en'
})

const checking = ref(true)
const allowed = ref(false)
const user = ref<AdminUser>(null)
const authOpen = ref(false)
const navOpen = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const days = ref(30)
const overview = ref<Overview | null>(null)
const theme = ref<SiteTheme>(getTheme())
const avatarFailed = ref(false)
const forumCreateTick = ref(0)
let stopAuthWatch: (() => void) | null = null

const userName = computed(
  () => user.value?.displayName || user.value?.username || user.value?.email || 'Admin',
)
const userEmail = computed(() => user.value?.email || '')
const userInitial = computed(() => String(userName.value).trim().charAt(0).toUpperCase() || 'A')
const avatarSrc = computed(() => user.value?.photoUrl || user.value?.photoURL || '')
const totals = computed(() => overview.value?.totals)
const series = computed(() => overview.value?.series || [])
const maxSeries = computed(() => Math.max(1, ...series.value.map((row) => Number(row.count || 0))))
const topCategories = computed(() => overview.value?.es?.topCategories || [])
const maxCategory = computed(() => Math.max(1, ...topCategories.value.map((row) => Number(row.postCount || 0))))
const recent = computed(() => overview.value?.recent || [])
const selectedDay = ref<string | null>(null)
const hoverDay = ref<string | null>(null)
const showExactViews = ref(false)
const tipDay = computed(() => hoverDay.value || selectedDay.value)
const tipPoint = computed(() => series.value.find((row) => row.day === tipDay.value) || null)
const axisDays = computed(() => {
  const rows = series.value
  if (!rows.length) return []
  const mid = rows[Math.floor((rows.length - 1) / 2)]
  const labels = [rows[0]?.day, mid?.day, rows[rows.length - 1]?.day]
  return [...new Set(labels.filter(Boolean))]
})

const formatNumber = (value?: number) => Number(value || 0).toLocaleString('es')
const formatCompact = (value?: number) =>
  new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
const displayViews = (value?: number) => (showExactViews.value ? formatNumber(value) : formatCompact(value))

const formatDay = (value?: string) => {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

const setSiteTheme = (event: MouseEvent) => {
  flipTheme()
  theme.value = getTheme()
  const btn = event.currentTarget as HTMLElement
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  btn.classList.remove('is-flipping')
  void btn.offsetWidth
  btn.classList.add('is-flipping')
  window.setTimeout(() => btn.classList.remove('is-flipping'), 560)
}

const closeNav = () => {
  navOpen.value = false
}

const loadOverview = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    overview.value = await getAdminNewsOverview(days.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cargar el dashboard.'
  } finally {
    loading.value = false
  }
}

const setDays = (value: number) => {
  if (days.value === value) return
  days.value = value
  selectedDay.value = null
  hoverDay.value = null
  loadOverview()
}

const pickDay = (day: string) => {
  selectedDay.value = selectedDay.value === day ? null : day
}

const refreshAccess = async () => {
  const auth = getCurrentApiAuth()
  const current = auth?.user && !auth.user.isAnonymous ? auth.user : null
  user.value = current
  avatarFailed.value = false
  if (!auth?.accessToken) {
    allowed.value = false
    checking.value = false
    return
  }
  try {
    const me = await Promise.race([
      getMe(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ])
    user.value = me ? { ...current, ...me } : current
    allowed.value = ADMIN_ROLES.has(String(me?.role || current?.role || '').trim().toLowerCase())
    if (allowed.value && section.value === 'dashboard') await loadOverview()
  } catch {
    allowed.value = ADMIN_ROLES.has(String(current?.role || '').trim().toLowerCase())
  } finally {
    checking.value = false
  }
}

const handleLogout = () => {
  logout()
  overview.value = null
  allowed.value = false
  user.value = null
  closeNav()
}

watch(section, (next) => {
  document.title = `${pageTitle.value} — Panel Music Mundial`
  if (next === 'dashboard' && allowed.value && !overview.value) loadOverview()
})

onMounted(() => {
  document.title = `${pageTitle.value} — Panel Music Mundial`
  refreshAccess()
  stopAuthWatch = onStoredAuthChange(() => {
    checking.value = true
    refreshAccess()
  })
})

onUnmounted(() => {
  stopAuthWatch?.()
})
</script>

<template>
  <div v-if="checking" class="news-admin na-loading">
    <div class="na-gate-card">
      <img class="brand-logo-light" src="/images/logo.webp" alt="Music Mundial" width="220" height="36" />
      <img class="brand-logo-dark" src="/images/logo-dark.webp" alt="Music Mundial" width="220" height="36" />
      <div class="na-load" role="status" aria-live="polite">
        <span class="na-load-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>Comprobando acceso…</span>
      </div>
    </div>
  </div>

  <div v-else-if="!user || !allowed" class="news-admin na-gate">
    <div class="na-gate-card">
      <img class="brand-logo-light" src="/images/logo.webp" alt="Music Mundial" width="220" height="36" />
      <img class="brand-logo-dark" src="/images/logo-dark.webp" alt="Music Mundial" width="220" height="36" />
      <p class="kicker" style="color: var(--blue); font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase">
        Panel de noticias
      </p>
      <h1>{{ user ? 'Sin permiso' : 'Entra al panel' }}</h1>
      <p v-if="user">
        Esta cuenta no es de administración. Cierra sesión e inicia con un usuario admin.
      </p>
      <p v-else>Este panel es aparte del de votaciones. Entra con una cuenta admin para ver el dashboard de noticias.</p>
      <div class="na-actions">
        <button v-if="!user" type="button" @click="authOpen = true">Iniciar sesión</button>
        <button v-else type="button" @click="handleLogout">Cerrar sesión</button>
        <a class="ghost" href="/">Volver al sitio</a>
      </div>
    </div>
    <AuthDialog :open="authOpen" mode="login" locale="es" @close="authOpen = false" />
  </div>

  <div v-else class="news-admin" :class="{ 'is-nav': navOpen }">
    <div v-if="navOpen" class="na-scrim" @click="closeNav"></div>
    <aside class="na-side">
      <a class="na-brand" href="/" @click="closeNav">
        <span>
          <img class="brand-logo-light" src="/images/logo.webp" alt="Music Mundial" />
          <img class="brand-logo-dark" src="/images/logo-dark.webp" alt="Music Mundial" />
        </span>
      </a>
      <p class="na-brand-copy">
        <span>Panel de noticias</span>
      </p>
      <nav class="na-nav" aria-label="Panel de noticias">
        <a :class="{ on: section === 'dashboard' }" href="/es/admin" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13V5h7v8H4zm9-8h7v5h-7V5zM4 19v-4h7v4H4zm9 0v-8h7v8h-7z" /></svg>
          Dashboard
        </a>
        <a :class="{ on: section === 'posts' || section === 'post-form' }" href="/es/admin/noticias" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 5v14M4 9h16" /></svg>
          Noticias
        </a>
        <a :class="{ on: section === 'categories' }" href="/es/admin/categorias" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h10" /></svg>
          Categorías
        </a>
        <a :class="{ on: section === 'tags' }" href="/es/admin/etiquetas" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l8-8h7v7l-8 8a2 2 0 0 1-2.8 0L4 14.8A2 2 0 0 1 4 12zm11.5-4.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" /></svg>
          Etiquetas
        </a>
        <a :class="{ on: section === 'authors' }" href="/es/admin/autores" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8a7 7 0 0 1 14 0" /></svg>
          Autores
        </a>
        <a :class="{ on: section === 'forum' }" href="/es/admin/foro" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v4H4zm0 8h10v4H4zm12 0h4v4h-4z" /></svg>
          Foro
        </a>
        <a :class="{ on: section === 'pages' }" href="/es/admin/paginas" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7zM14 3v5h5" /></svg>
          Páginas
        </a>
        <a :class="{ on: section === 'reports' }" href="/es/admin/reportes" @click="closeNav">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 16H3L12 3zm0 5v5m0 3h.01" /></svg>
          Reportes
        </a>
      </nav>
      <div class="na-user">
        <div class="na-user-row">
          <span class="na-avatar">
            <img v-if="avatarSrc && !avatarFailed" :src="avatarSrc" alt="" @error="avatarFailed = true" />
            <span v-else>{{ userInitial }}</span>
          </span>
          <span>
            <b>{{ userName }}</b>
            <small>{{ userEmail }}</small>
          </span>
        </div>
        <div class="na-user-actions">
          <a href="/" @click="closeNav">Ver sitio</a>
          <button class="danger" type="button" @click="handleLogout">Cerrar sesión</button>
        </div>
      </div>
    </aside>

    <div class="na-main">
      <header class="na-top">
        <div style="display: flex; align-items: flex-start; gap: 10px; min-width: 0">
          <button class="na-menu" type="button" aria-label="Abrir menú" @click="navOpen = !navOpen">☰</button>
          <div>
            <h1>{{ pageTitle }}</h1>
            <p>{{ pageLead }}</p>
          </div>
        </div>
        <div class="na-top-actions">
          <a v-if="section === 'posts'" class="na-btn solid" :href="newPostHref">
            {{ postsLocale === 'en' ? 'New note (EN)' : 'Nueva noticia (ES)' }}
          </a>
          <button v-if="section === 'forum'" class="na-btn solid" type="button" @click="forumCreateTick += 1">Nueva sala</button>
          <div v-if="section === 'dashboard'" class="na-ranges" role="group" aria-label="Rango">
            <button v-for="option in [7, 30, 90]" :key="option" type="button" :class="{ on: days === option }" @click="setDays(option)">
              {{ option }}d
            </button>
          </div>
          <button
            class="round theme-toggle"
            type="button"
            :title="theme === 'dark' ? 'Modo claro' : 'Modo oscuro'"
            :aria-label="theme === 'dark' ? 'Modo claro' : 'Modo oscuro'"
            @click="setSiteTheme"
          >
            <svg v-if="theme === 'dark'" class="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
            </svg>
            <svg v-else class="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16.2 13.2A6.2 6.2 0 0 1 11 5.2 6.4 6.4 0 1 0 18.8 15a6.2 6.2 0 0 1-2.6-1.8z" />
            </svg>
          </button>
        </div>
      </header>

      <main class="na-body">
        <NewsAdminPostForm v-if="section === 'post-form'" :post-id="postId" :news-locale="newsLocale" />
        <NewsAdminPosts v-else-if="section === 'posts'" @locale-change="postsLocale = $event" />
        <NewsAdminCategories v-else-if="section === 'categories'" />
        <NewsAdminAuthors v-else-if="section === 'authors'" />
        <NewsAdminTags v-else-if="section === 'tags'" />
        <NewsAdminForum v-else-if="section === 'forum'" :create-tick="forumCreateTick" />
        <NewsAdminPages v-else-if="section === 'pages'" />
        <NewsAdminReports v-else-if="section === 'reports'" />
        <template v-else>
        <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
        <p v-else-if="loading && !overview" class="na-empty">Cargando dashboard…</p>
        <template v-else-if="totals">
          <section class="na-stats">
            <article class="na-card">
              <span class="kicker">Publicadas</span>
              <div class="value">{{ formatNumber(totals.published) }}</div>
              <p class="foot">{{ formatNumber(totals.drafts) }} borradores · {{ formatNumber(totals.scheduled) }} programadas</p>
            </article>
            <article class="na-card">
              <span class="kicker">Últimos {{ days }} días</span>
              <div class="value">{{ formatNumber(totals.thisPeriod) }}</div>
              <p class="foot">{{ formatNumber(totals.today) }} publicadas hoy</p>
            </article>
            <article class="na-card">
              <span class="kicker">Categorías</span>
              <div class="value">{{ formatNumber(totals.categories) }}</div>
              <p class="foot">{{ formatNumber(totals.authors) }} autores</p>
            </article>
            <article class="na-card">
              <span class="kicker">Lecturas</span>
              <button type="button" class="value na-num" :title="formatNumber(totals.views)" @click="showExactViews = !showExactViews">
                {{ displayViews(totals.views) }}
              </button>
              <p class="foot">{{ formatNumber(totals.comments) }} comentarios WP</p>
            </article>
          </section>

          <section class="na-locales">
            <article class="na-card">
              <span class="kicker">Español</span>
              <div class="value">{{ formatNumber(overview?.es.published) }}</div>
              <div class="na-locale-nums">
                <p><span>Borradores</span><b>{{ formatNumber(overview?.es.drafts) }}</b></p>
                <p><span>Este periodo</span><b>{{ formatNumber(overview?.es.thisPeriod) }}</b></p>
                <p><span>Categorías</span><b>{{ formatNumber(overview?.es.categories) }}</b></p>
                <p>
                  <span>Lecturas</span>
                  <button type="button" class="na-num" :title="formatNumber(overview?.es.views)" @click="showExactViews = !showExactViews">
                    {{ displayViews(overview?.es.views) }}
                  </button>
                </p>
              </div>
            </article>
            <article class="na-card">
              <span class="kicker">English</span>
              <div class="value">{{ formatNumber(overview?.en.published) }}</div>
              <div class="na-locale-nums">
                <p><span>Drafts</span><b>{{ formatNumber(overview?.en.drafts) }}</b></p>
                <p><span>This period</span><b>{{ formatNumber(overview?.en.thisPeriod) }}</b></p>
                <p><span>Categories</span><b>{{ formatNumber(overview?.en.categories) }}</b></p>
                <p>
                  <span>Views</span>
                  <button type="button" class="na-num" :title="formatNumber(overview?.en.views)" @click="showExactViews = !showExactViews">
                    {{ displayViews(overview?.en.views) }}
                  </button>
                </p>
              </div>
            </article>
          </section>

          <section class="na-grid">
            <article class="na-card">
              <span class="kicker">Publicaciones</span>
              <h2 style="margin: 8px 0 0; font-size: 18px">Actividad de {{ days }} días</h2>
              <div class="na-chart-wrap">
                <div class="na-chart" :class="{ 'has-pick': Boolean(selectedDay) }" @mouseleave="hoverDay = null">
                  <button
                    v-for="row in series"
                    :key="row.day"
                    class="na-bar"
                    type="button"
                    :class="{ on: selectedDay === row.day, hot: tipDay === row.day }"
                    :aria-pressed="selectedDay === row.day"
                    :aria-label="`${formatDay(row.day)}: ${formatNumber(row.count)} notas`"
                    @click="pickDay(row.day)"
                    @mouseenter="hoverDay = row.day"
                    @focus="hoverDay = row.day"
                  >
                    <i :style="{ height: `${Math.max(8, (Number(row.count || 0) / maxSeries) * 100)}%` }">
                      <span v-if="tipDay === row.day" class="na-tip">
                        <small>{{ formatDay(row.day) }}</small>
                        <b>{{ formatNumber(row.count) }}</b>
                      </span>
                    </i>
                  </button>
                </div>
                <div class="na-chart-axis">
                  <span v-for="day in axisDays" :key="day">{{ formatDay(day) }}</span>
                </div>
                <p v-if="tipPoint" class="na-chart-readout">
                  <b>{{ formatNumber(tipPoint.count) }}</b> notas el {{ formatDay(tipPoint.day) }}
                  <span>ES {{ formatNumber(tipPoint.es) }} · EN {{ formatNumber(tipPoint.en) }}</span>
                </p>
                <p v-else class="na-chart-readout muted">Haz clic en una barra para ver el número de ese día.</p>
              </div>
            </article>
            <article class="na-card">
              <span class="kicker">Español</span>
              <h2 style="margin: 8px 0 0; font-size: 18px">Top categorías</h2>
              <div v-if="topCategories.length" class="na-cats">
                <div v-for="cat in topCategories" :key="cat.slug" class="na-cat">
                  <b>{{ cat.name }}</b>
                  <span>{{ formatNumber(cat.postCount) }}</span>
                  <div class="na-track"><i :style="{ width: `${(Number(cat.postCount || 0) / maxCategory) * 100}%` }"></i></div>
                </div>
              </div>
              <p v-else class="na-empty">Sin categorías con notas.</p>
            </article>
          </section>

          <article class="na-card" style="margin-top: 14px">
            <span class="kicker">Portada</span>
            <h2 style="margin: 8px 0 0; font-size: 18px">Últimas notas</h2>
            <div v-if="recent.length" class="na-posts">
              <a v-for="post in recent" :key="`${post.locale}-${post.id}`" class="na-post" :href="post.href || (post.locale === 'es' ? `/es/${post.slug}` : `/${post.slug}`)" target="_blank">
                <img v-if="post.coverUrl" :src="post.coverUrl" alt="" />
                <span v-else class="ph"></span>
                <div>
                  <h3>{{ post.title }}</h3>
                  <p>
                    <span class="na-badge">{{ post.locale || 'es' }}</span>
                    {{ post.category }} · {{ formatDate(post.publishedAt) }}
                  </p>
                </div>
              </a>
            </div>
            <p v-else class="na-empty">Todavía no hay notas para mostrar.</p>
          </article>
        </template>
        </template>
      </main>
    </div>
  </div>
</template>
