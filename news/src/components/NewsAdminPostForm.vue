<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  createAdminNewsPost,
  deleteAdminNewsComment,
  getAdminNewsAuthors,
  getAdminNewsCategories,
  getAdminNewsComments,
  getAdminNewsPost,
  getAdminNewsTags,
  getAdminUsers,
  updateAdminNewsPost,
  uploadAdminImage,
} from '../../../src/services/api/adminApi'
import { getMe } from '../../../src/services/api/authApi'
import { articleHref } from '../lib/locale'
import NewsRichEditor from './NewsRichEditor.vue'

type Category = { id: string; name: string; slug: string }
type WpAuthor = { id: string; name: string; email: string; postCount: number; linkedUserId?: string }
type Account = {
  id: string
  displayName?: string
  username?: string
  email?: string
  photoUrl?: string
  role?: string
}
type Attachment = { url: string; type: string; name: string }
type CommentItem = {
  id: string
  authorName: string
  authorUsername?: string
  body: string
  createdAt?: string
}

const props = defineProps<{ postId?: string; newsLocale?: 'es' | 'en' }>()
const isEditing = computed(() => Boolean(props.postId))

const form = ref({
  locale: (props.newsLocale === 'en' ? 'en' : 'es') as 'es' | 'en',
  title: '',
  slug: '',
  esSlug: '',
  enSlug: '',
  excerpt: '',
  content: '',
  coverUrl: '',
  coverCaption: '',
  coverAlt: '',
  status: 'draft',
  featured: false,
  publishedAt: '',
  categoryIds: [] as string[],
  wpAuthorId: '',
  tags: [] as string[],
  attachments: [] as Attachment[],
})
const categories = ref<Category[]>([])
const wpAuthors = ref<WpAuthor[]>([])
const me = ref<Account | null>(null)
const author = ref<Account | null>(null)
const wpAuthorName = ref('')
const userQuery = ref('')
const userHits = ref<Account[]>([])
const searchingUsers = ref(false)
const reassignOpen = ref(false)
const tagDraft = ref('')
const tagHits = ref<Array<{ name: string; postCount?: number }>>([])
const comments = ref<CommentItem[]>([])
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const uploadingFile = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
let tagTimer: ReturnType<typeof setTimeout> | null = null
const DRAFT_KEY = 'nmm-news-new-draft'
const canChangeAuthor = computed(() => ['admin', 'superadmin', 'owner'].includes(String(me.value?.role || '').toLowerCase()))
const esHref = computed(() => articleHref('es', form.value.esSlug || form.value.slug))
const enHref = computed(() => articleHref('en', form.value.enSlug || (form.value.locale === 'en' ? form.value.slug : '')))

const authorLabel = (user?: Account | null) =>
  user?.displayName || user?.username || user?.email || 'Cuenta'

const toAccount = (user: Record<string, any>): Account => ({
  id: String(user.id),
  displayName: user.displayName || '',
  username: user.username || '',
  email: user.email || '',
  photoUrl: user.photoUrl || user.photoURL || '',
  role: user.role || '',
})

const fileKind = (file: { type?: string; name?: string; url?: string }) => {
  const hint = `${file.type || ''} ${file.name || ''} ${file.url || ''}`.toLowerCase()
  if (hint.includes('gif') || hint.endsWith('.gif')) return 'gif'
  if (hint.includes('video') || /\.(mp4|webm|mov)(\?|$)/.test(hint)) return 'video'
  return 'image'
}

const loadLookups = async (locale: 'es' | 'en') => {
  const [cats, authors] = await Promise.all([
    getAdminNewsCategories(locale),
    getAdminNewsAuthors(locale),
  ])
  categories.value = Array.isArray(cats) ? cats : []
  wpAuthors.value = Array.isArray(authors) ? authors : []
}

const loadComments = async () => {
  if (!props.postId) {
    comments.value = []
    return
  }
  try {
    const payload = await getAdminNewsComments(props.postId, form.value.locale)
    comments.value = payload.items || []
  } catch {
    comments.value = []
  }
}

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  reassignOpen.value = false
  try {
    const account = await getMe().catch(() => null)
    me.value = account ? toAccount(account) : null
    if (props.postId) {
      const post = await getAdminNewsPost(props.postId, form.value.locale)
      form.value = {
        locale: post.locale === 'en' ? 'en' : 'es',
        title: post.title || '',
        slug: post.slug || '',
        esSlug: post.locale === 'en' ? post.altSlug || '' : post.slug || '',
        enSlug: post.locale === 'en' ? post.slug || '' : post.altSlug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        coverUrl: post.coverUrl || '',
        coverCaption: post.coverCaption || '',
        coverAlt: post.coverAlt || '',
        status: post.status === 'scheduled' ? 'scheduled' : post.status === 'publish' ? 'publish' : 'draft',
        featured: Boolean(post.featured),
        publishedAt: post.publishedAt ? String(post.publishedAt).slice(0, 16) : '',
        categoryIds: (post.categoryIds || []).map((id: string | number) => String(id)),
        wpAuthorId: post.wpAuthorId ? String(post.wpAuthorId) : '',
        tags: Array.isArray(post.tags) ? post.tags.map((item: string) => String(item)) : [],
        attachments: Array.isArray(post.attachments) ? post.attachments : [],
      }
      wpAuthorName.value = post.authorName || ''
      if (post.authorUserId) {
        author.value = {
          id: String(post.authorUserId),
          displayName: post.authorName || '',
          username: post.authorUsername || '',
          email: post.authorEmail || '',
          photoUrl: post.authorPhotoUrl || '',
        }
      } else {
        author.value = null
      }
      await Promise.all([loadLookups(form.value.locale), loadComments()])
    } else {
      await loadLookups(form.value.locale)
      author.value = me.value
      wpAuthorName.value = me.value?.displayName || me.value?.email || ''
      comments.value = []
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY)
        if (raw) {
          const draft = JSON.parse(raw)
          form.value = { ...form.value, ...draft, locale: form.value.locale }
        }
      } catch {
        /* ignore broken drafts */
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cargar el formulario.'
  } finally {
    loading.value = false
  }
}

const searchUsers = async (query: string) => {
  const q = query.trim()
  if (q.length < 2) {
    userHits.value = []
    return
  }
  searchingUsers.value = true
  try {
    const payload = await getAdminUsers({ page: 1, limit: 8, search: q })
    if (userQuery.value.trim() !== q) return
    userHits.value = (payload.items || []).map(toAccount)
  } catch {
    userHits.value = []
  } finally {
    searchingUsers.value = false
  }
}

watch(userQuery, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => searchUsers(value), 280)
})

watch(
  () => form.value.locale,
  async (locale, previous) => {
    if (locale === previous || isEditing.value) return
    await loadLookups(locale)
    form.value.categoryIds = []
    form.value.wpAuthorId = ''
  },
)

const pickUser = (user: Account) => {
  author.value = user
  userQuery.value = ''
  userHits.value = []
  reassignOpen.value = false
}

const addTag = (name?: string) => {
  const value = String(name || tagDraft.value).trim()
  if (value.length < 2) return
  if (!form.value.tags.some((item) => item.toLowerCase() === value.toLowerCase())) {
    form.value.tags = [...form.value.tags, value]
  }
  tagDraft.value = ''
  tagHits.value = []
}

const removeTag = (name: string) => {
  form.value.tags = form.value.tags.filter((item) => item !== name)
}

const searchTags = async (query: string) => {
  const q = query.trim()
  if (q.length < 2) {
    tagHits.value = []
    return
  }
  try {
    const rows = await getAdminNewsTags(form.value.locale, q)
    tagHits.value = (Array.isArray(rows) ? rows : []).filter(
      (item: { name: string }) => !form.value.tags.includes(item.name),
    )
  } catch {
    tagHits.value = []
  }
}

watch(tagDraft, (value) => {
  if (tagTimer) clearTimeout(tagTimer)
  tagTimer = setTimeout(() => searchTags(value), 220)
})

const uploadCover = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const [file] = input.files || []
  if (!file) return
  uploading.value = true
  errorMessage.value = ''
  try {
    const uploaded = await uploadAdminImage('news-cover', file)
    form.value.coverUrl = uploaded.path || uploaded.url || ''
  } catch {
    errorMessage.value = 'No se pudo subir la portada.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

const uploadAttachment = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  uploadingFile.value = true
  errorMessage.value = ''
  try {
    for (const file of files) {
      const uploaded = await uploadAdminImage('news-file', file)
      const url = uploaded.path || uploaded.url || ''
      if (!url) continue
      form.value.attachments = [
        ...form.value.attachments,
        { url, name: file.name, type: fileKind({ type: file.type, name: file.name, url }) },
      ]
    }
  } catch {
    errorMessage.value = 'No se pudo subir el adjunto.'
  } finally {
    uploadingFile.value = false
    input.value = ''
  }
}

const removeAttachment = (url: string) => {
  form.value.attachments = form.value.attachments.filter((item) => item.url !== url)
}

const removeComment = async (id: string) => {
  try {
    await deleteAdminNewsComment(id, form.value.locale)
    comments.value = comments.value.filter((item) => item.id !== id)
  } catch {
    errorMessage.value = 'No se pudo borrar el comentario.'
  }
}

const save = async () => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  const body = {
    locale: form.value.locale,
    title: form.value.title,
    slug: (form.value.locale === 'en' ? form.value.enSlug : form.value.esSlug) || form.value.slug || undefined,
    altSlug: form.value.locale === 'en' ? form.value.esSlug : form.value.enSlug,
    excerpt: form.value.excerpt || '',
    content: form.value.content || '',
    coverUrl: form.value.coverUrl || undefined,
    coverCaption: form.value.coverCaption || '',
    coverAlt: form.value.coverAlt || '',
    status: form.value.status,
    featured: Boolean(form.value.featured),
    publishedAt: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : undefined,
    categoryIds: form.value.categoryIds || [],
    tags: form.value.tags || [],
    attachments: form.value.attachments || [],
    authorUserId: author.value?.id || (!isEditing.value ? me.value?.id : undefined) || undefined,
    wpAuthorId: canChangeAuthor.value && form.value.wpAuthorId ? Number(form.value.wpAuthorId) : undefined,
  }
  try {
    if (isEditing.value && props.postId) {
      await updateAdminNewsPost(props.postId, body)
      successMessage.value = 'Noticia actualizada.'
      window.dispatchEvent(new Event('nmm:news-home-stale'))
    } else {
      const created = await createAdminNewsPost(body)
      successMessage.value = 'Noticia creada.'
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event('nmm:news-home-stale'))
      const db = form.value.locale === 'en' ? 'en/' : ''
      window.history.pushState({}, '', `/es/admin/noticias/${db}${created.id}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo guardar la noticia.'
  } finally {
    saving.value = false
  }
}

watch(() => [props.postId, props.newsLocale] as const, load, { immediate: true })
watch(
  form,
  (value) => {
    if (isEditing.value || loading.value) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value))
    } catch {
      /* ignore quota */
    }
  },
  { deep: true },
)
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (tagTimer) clearTimeout(tagTimer)
})
</script>

<template>
  <section class="na-form">
    <p v-if="successMessage" class="na-ok">{{ successMessage }}</p>
    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-if="loading" class="na-empty">Cargando formulario…</p>
    <form v-show="!loading" class="na-form-grid" @submit.prevent="save">
      <article class="na-card na-form-main">
        <input
          v-model="form.title"
          class="na-title-input"
          required
          maxlength="220"
          placeholder="Añadir título"
        />
        <div class="na-url-grid">
          <label class="na-slug-field">
            URL en español
            <div class="na-url-line">
              <span>/es/</span>
              <input v-model="form.esSlug" maxlength="180" placeholder="ese" />
            </div>
            <small>{{ esHref }}</small>
          </label>
          <label class="na-slug-field">
            URL in English
            <div class="na-url-line">
              <span>/</span>
              <input v-model="form.enSlug" maxlength="180" placeholder="adaszd" />
            </div>
            <small>{{ enHref }}</small>
          </label>
        </div>
        <NewsRichEditor v-model="form.content" />
        <label>
          Extracto
          <textarea v-model="form.excerpt" rows="3" placeholder="Resumen corto de la nota" />
        </label>
      </article>

      <aside class="na-form-side">
        <article class="na-card">
          <span class="kicker">Publicación</span>
          <label>
            Idioma
            <select v-model="form.locale" :disabled="isEditing">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Estado
            <select v-model="form.status">
              <option value="draft">Borrador</option>
              <option value="publish">Publicada</option>
              <option value="scheduled">Programada</option>
            </select>
          </label>
          <label>
            Fecha
            <input v-model="form.publishedAt" type="datetime-local" />
          </label>
          <label class="na-check">
            <input v-model="form.featured" type="checkbox" />
            Destacada en portada
          </label>
        </article>

        <article class="na-card">
          <span class="kicker">Portada</span>
          <div v-if="form.coverUrl" class="na-cover-box">
            <img class="na-cover-preview" :src="form.coverUrl" alt="" />
          </div>
          <label>
            URL
            <input v-model="form.coverUrl" />
          </label>
          <label>
            Pie de foto (SEO)
            <input v-model="form.coverCaption" placeholder="Texto debajo de la imagen" />
          </label>
          <label>
            Texto alternativo
            <input v-model="form.coverAlt" placeholder="Describe la foto" />
          </label>
          <label class="na-file">
            {{ uploading ? 'Subiendo…' : 'Subir imagen' }}
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadCover" />
          </label>
        </article>

        <article class="na-card">
          <span class="kicker">Autor</span>
          <p class="na-help">La nota se firma con el correo de la cuenta. Solo un admin puede cambiarlo.</p>
          <div class="na-author-chip">
            <img v-if="author?.photoUrl" :src="author.photoUrl" alt="" />
            <span v-else class="ph">{{ (author ? authorLabel(author) : wpAuthorName || 'A').slice(0, 1) }}</span>
            <div>
              <b>{{ author ? authorLabel(author) : wpAuthorName || 'Redacción' }}</b>
              <small>{{ author?.email || (author?.username ? `@${author.username}` : 'Autor de la nota') }}</small>
            </div>
          </div>
          <button v-if="canChangeAuthor && !reassignOpen" class="na-btn" type="button" @click="reassignOpen = true">
            Cambiar autor
          </button>
          <template v-if="canChangeAuthor && reassignOpen">
            <label>
              Buscar cuenta
              <input v-model="userQuery" type="search" placeholder="Nombre, usuario o correo" autocomplete="off" />
            </label>
            <p v-if="searchingUsers" class="na-help">Buscando cuentas…</p>
            <div v-else-if="userHits.length" class="na-user-hits">
              <button v-for="hit in userHits" :key="hit.id" type="button" @click="pickUser(hit)">
                <img v-if="hit.photoUrl" :src="hit.photoUrl" alt="" />
                <span>
                  <b>{{ authorLabel(hit) }}</b>
                  <small>{{ hit.email || (hit.username ? `@${hit.username}` : '') }}</small>
                </span>
              </button>
            </div>
            <label>
              Sustituir autor de noticias
              <select v-model="form.wpAuthorId">
                <option value="">Mantener / crear firma nueva</option>
                <option v-for="item in wpAuthors" :key="item.id" :value="item.id">
                  {{ item.name }} · {{ item.postCount }} notas
                </option>
              </select>
            </label>
            <button class="na-btn" type="button" @click="reassignOpen = false">Cerrar</button>
          </template>
        </article>

        <article class="na-card">
          <span class="kicker">Categorías</span>
          <div class="na-checks">
            <label v-for="cat in categories" :key="cat.id" class="na-check">
              <input v-model="form.categoryIds" type="checkbox" :value="String(cat.id)" />
              {{ cat.name }}
            </label>
          </div>
        </article>

        <article class="na-card">
          <span class="kicker">Tags</span>
          <div class="na-tag-list">
            <button v-for="tag in form.tags" :key="tag" type="button" class="na-tag" @click="removeTag(tag)">
              {{ tag }} ×
            </button>
          </div>
          <label>
            Añadir tag
            <input
              v-model="tagDraft"
              maxlength="80"
              placeholder="Taylor Swift, BLACKPINK…"
              @keydown.enter.prevent="addTag()"
            />
          </label>
          <div v-if="tagHits.length" class="na-user-hits">
            <button v-for="hit in tagHits" :key="hit.name" type="button" @click="addTag(hit.name)">
              <span>
                <b>{{ hit.name }}</b>
                <small v-if="hit.postCount">{{ hit.postCount }} notas</small>
              </span>
            </button>
          </div>
        </article>

        <article class="na-card">
          <span class="kicker">Adjuntos</span>
          <p class="na-help">Imágenes, GIF y videos. También puedes insertarlos en el contenido.</p>
          <div v-if="form.attachments.length" class="na-attach-grid">
            <figure v-for="file in form.attachments" :key="file.url">
              <video v-if="file.type === 'video'" :src="file.url" controls playsinline />
              <img v-else :src="file.url" :alt="file.name" />
              <button type="button" @click="removeAttachment(file.url)">Quitar</button>
            </figure>
          </div>
          <label class="na-file">
            {{ uploadingFile ? 'Subiendo…' : 'Subir imagen, GIF o video' }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              multiple
              @change="uploadAttachment"
            />
          </label>
        </article>

        <article v-if="isEditing" class="na-card">
          <span class="kicker">Comentarios</span>
          <p v-if="!comments.length" class="na-help">Todavía no hay comentarios de usuarios.</p>
          <ul v-else class="na-comment-list">
            <li v-for="item in comments" :key="item.id">
              <div>
                <b>{{ item.authorName }}</b>
                <p>{{ item.body }}</p>
              </div>
              <button type="button" @click="removeComment(item.id)">Borrar</button>
            </li>
          </ul>
        </article>

        <div class="na-form-actions">
          <button class="na-btn solid" type="submit" :disabled="saving">
            {{ saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear noticia' }}
          </button>
          <a class="na-btn" href="/es/admin/noticias">Volver</a>
        </div>
      </aside>
    </form>
  </section>
</template>
