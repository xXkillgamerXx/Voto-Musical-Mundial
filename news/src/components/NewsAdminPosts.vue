<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { getAdminNewsPosts } from '../../../src/services/api/adminApi'

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
const locale = ref<'es' | 'en'>('es')
const loading = ref(true)
const errorMessage = ref('')
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

const setLocale = (next: 'es' | 'en') => {
  if (locale.value === next) return
  locale.value = next
  page.value = 1
  load()
}

const setPage = (next: number) => {
  const max = pages()
  const value = Math.min(max, Math.max(1, next))
  if (value === page.value) return
  page.value = value
  load()
}

watch(page, () => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
onMounted(load)
</script>

<template>
  <section>
    <div class="na-toolbar">
      <div class="na-ranges" role="group" aria-label="Idioma">
        <button type="button" :class="{ on: locale === 'en' }" @click="setLocale('en')">EN</button>
        <button type="button" :class="{ on: locale === 'es' }" @click="setLocale('es')">ES</button>
      </div>
      <input
        v-model="q"
        class="na-search"
        type="search"
        placeholder="Buscar título o slug"
        @keydown.enter="search"
      />
      <button class="na-btn" type="button" @click="search">Buscar</button>
    </div>
    <p class="na-count">{{ total.toLocaleString('es') }} notas · {{ locale === 'en' ? 'English' : 'Español' }}</p>
    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="na-empty">Cargando noticias…</p>
    <div v-else-if="!posts.length" class="na-empty">No hay notas con esa búsqueda.</div>
    <div v-else class="na-news">
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
            <span v-if="post.authorName" class="na-news-by">{{ post.authorName }}</span>
          </div>
          <h3>
            <a :href="editHref(post)">{{ post.title }}</a>
          </h3>
          <p v-if="post.excerpt" class="na-news-excerpt">{{ post.excerpt }}</p>
        </div>
        <div class="na-news-actions">
          <a class="na-btn solid" :href="editHref(post)">Editar</a>
          <a class="na-btn" :href="post.href || (locale === 'es' ? `/es/${post.slug}` : `/${post.slug}`)" target="_blank">Ver</a>
        </div>
      </article>
    </div>
    <div v-if="pages() > 1" class="na-pager">
      <button type="button" :disabled="page <= 1" @click="setPage(page - 1)">Anterior</button>
      <span>{{ page }} / {{ pages() }}</span>
      <button type="button" :disabled="page >= pages()" @click="setPage(page + 1)">Siguiente</button>
    </div>
  </section>
</template>
