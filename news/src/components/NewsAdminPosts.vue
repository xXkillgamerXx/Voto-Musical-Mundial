<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { deleteAdminNewsPost, getAdminNewsPosts, restoreAdminNewsPost } from '../../../src/services/api/adminApi'

type Post = {
  id: string
  slug: string
  title: string
  excerpt?: string
  coverUrl?: string | null
  category?: string
  status?: string
  publishedAt?: string
  href?: string
  locale?: string
  authorName?: string
}

const posts = ref<Post[]>([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const author = ref('')
const from = ref('')
const to = ref('')
const status = ref('')
const locale = ref<'es' | 'en'>('es')
const loading = ref(true)
const errorMessage = ref('')
const busyId = ref('')
const limit = 20

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusLabel = (status?: string) => {
  if (status === 'draft') return 'Borrador'
  if (status === 'scheduled') return 'Programada'
  if (status === 'trash') return 'Papelera'
  return ''
}

const editHref = (post: Post) => `/es/admin/noticias/${locale.value === 'en' ? 'en/' : ''}${post.id}`

const pages = () => Math.max(1, Math.ceil(total.value / limit))

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminNewsPosts({
      page: page.value,
      limit,
      q: q.value,
      author: author.value,
      from: from.value,
      to: to.value,
      status: status.value,
      locale: locale.value,
    })
    posts.value = payload.items || []
    total.value = Number(payload.total || 0)
  } catch {
    errorMessage.value = 'No se pudieron cargar las noticias.'
    posts.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const search = () => {
  page.value = 1
  load()
}

const emit = defineEmits<{ localeChange: [locale: 'es' | 'en'] }>()

const setLocale = (next: 'es' | 'en') => {
  if (locale.value === next) return
  locale.value = next
  page.value = 1
  emit('localeChange', next)
  load()
}

const setStatus = (next: string) => {
  status.value = next
  page.value = 1
  load()
}

const removePost = async (post: Post) => {
  const ok = window.confirm(`¿Eliminar “${post.title}”? Quedará en notas eliminadas.`)
  if (!ok) return
  busyId.value = post.id
  try {
    await deleteAdminNewsPost(post.id, locale.value)
    await load()
  } catch {
    errorMessage.value = 'No se pudo eliminar la nota.'
  } finally {
    busyId.value = ''
  }
}

const restorePost = async (post: Post) => {
  busyId.value = post.id
  try {
    await restoreAdminNewsPost(post.id, locale.value)
    await load()
  } catch {
    errorMessage.value = 'No se pudo restaurar la nota.'
  } finally {
    busyId.value = ''
  }
}

const setPage = (next: number) => {
  const max = pages()
  const value = Math.min(max, Math.max(1, next))
  if (value === page.value) return
  page.value = value
  load()
}

watch(page, () => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
onMounted(() => {
  emit('localeChange', locale.value)
  load()
})
</script>

<template>
  <section>
    <div class="na-lang-tabs" role="tablist" aria-label="Idioma de las notas">
      <button
        type="button"
        role="tab"
        :aria-selected="locale === 'es'"
        :class="{ on: locale === 'es' }"
        @click="setLocale('es')"
      >
        <strong>Español</strong>
        <span>Notas en ES</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="locale === 'en'"
        :class="{ on: locale === 'en' }"
        @click="setLocale('en')"
      >
        <strong>English</strong>
        <span>Notes in EN</span>
      </button>
    </div>
    <div class="na-filters">
      <div class="na-toolbar">
        <input
          v-model="q"
          class="na-search"
          type="search"
          placeholder="Buscar título o slug"
          @keydown.enter="search"
        />
        <input v-model="author" class="na-search na-search-author" type="search" placeholder="Autor" @keydown.enter="search" />
        <label class="na-date-field">
          <span>Desde</span>
          <input v-model="from" type="date" />
        </label>
        <label class="na-date-field">
          <span>Hasta</span>
          <input v-model="to" type="date" />
        </label>
        <button class="na-btn" type="button" @click="search">Buscar</button>
      </div>
      <div class="na-ranges" role="group" aria-label="Estado">
        <button type="button" :class="{ on: status === '' }" @click="setStatus('')">Todas</button>
        <button type="button" :class="{ on: status === 'publish' }" @click="setStatus('publish')">Publicadas</button>
        <button type="button" :class="{ on: status === 'draft' }" @click="setStatus('draft')">Borradores</button>
        <button type="button" :class="{ on: status === 'scheduled' }" @click="setStatus('scheduled')">Programadas</button>
        <button type="button" :class="{ on: status === 'trash' }" @click="setStatus('trash')">Eliminadas</button>
      </div>
      <p class="na-count" :aria-busy="loading">
        <template v-if="loading">Cargando noticias…</template>
        <template v-else>{{ total.toLocaleString('es') }} notas · {{ locale === 'en' ? 'English' : 'Español' }}</template>
      </p>
    </div>
    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <div v-else-if="loading && !posts.length" class="na-load" role="status" aria-live="polite">
      <span class="na-load-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span>Cargando noticias…</span>
    </div>
    <div v-else-if="!posts.length" class="na-empty">No hay notas con esa búsqueda.</div>
    <div v-else class="na-news" :class="{ 'is-loading': loading }" :aria-busy="loading">
      <div v-if="loading" class="na-load na-load-inline" role="status" aria-live="polite">
        <span class="na-load-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>Cargando noticias…</span>
      </div>
      <article v-for="post in posts" :key="post.id" class="na-news-card">
        <a class="na-news-cover" :href="editHref(post)">
          <img v-if="post.coverUrl" :src="post.coverUrl" :alt="post.title" />
          <span v-else class="ph"></span>
        </a>
        <div class="na-news-body">
          <div class="na-news-meta">
            <span class="na-chip cat">{{ post.category || 'Noticias' }}</span>
            <span v-if="statusLabel(post.status)" class="na-chip draft">{{ statusLabel(post.status) }}</span>
            <time>{{ formatDate(post.publishedAt) }}</time>
            <span v-if="post.authorName" class="na-news-by">Publicó {{ post.authorName }}</span>
          </div>
          <h3>
            <a :href="editHref(post)">{{ post.title }}</a>
          </h3>
          <p v-if="post.excerpt" class="na-news-excerpt">{{ post.excerpt }}</p>
        </div>
        <div class="na-news-actions">
          <a class="na-btn solid" :href="editHref(post)">Editar</a>
          <a v-if="post.status !== 'trash'" class="na-btn" :href="post.href || (locale === 'es' ? `/es/${post.slug}` : `/${post.slug}`)" target="_blank">Ver</a>
          <button v-if="post.status === 'trash'" class="na-btn" type="button" :disabled="busyId === post.id" @click="restorePost(post)">Restaurar</button>
          <button v-else class="na-btn" type="button" :disabled="busyId === post.id" @click="removePost(post)">Eliminar</button>
        </div>
      </article>
    </div>
    <div v-if="pages() > 1" class="na-pager">
      <button type="button" :disabled="loading || page <= 1" @click="setPage(page - 1)">Anterior</button>
      <span>{{ page }} / {{ pages() }}</span>
      <button type="button" :disabled="loading || page >= pages()" @click="setPage(page + 1)">Siguiente</button>
    </div>
  </section>
</template>
