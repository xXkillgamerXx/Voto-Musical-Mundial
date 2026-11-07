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
  updateAdminNewsPost,
  uploadAdminImage,
} from '../../../src/services/api/adminApi'
import { getMe } from '../../../src/services/api/authApi'
import { compressImageFile } from '../lib/compressImage'
import { articleHref } from '../lib/locale'
import NewsRichEditor from './NewsRichEditor.vue'

type Category = { id: string; name: string; slug: string }
type WpAuthor = {
  id: string
  name: string
  email: string
  postCount: number
  photoUrl?: string
  linkedUserId?: string
}
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

const nowLocalInput = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)

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
  publishedAt: nowLocalInput(),
  categoryIds: [] as string[],
  wpAuthorId: '',
  tags: [] as string[],
  attachments: [] as Attachment[],
})
const categories = ref<Category[]>([])
const wpAuthors = ref<WpAuthor[]>([])
const me = ref<Account | null>(null)
const tagDraft = ref('')
const tagHits = ref<Array<{ name: string; postCount?: number }>>([])
const comments = ref<CommentItem[]>([])
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const uploadingFile = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const slugManual = ref(false)
const coverPreview = ref('')
const coverDragging = ref(false)
let coverObjectUrl = ''
let pendingCoverFile: File | null = null
let tagTimer: ReturnType<typeof setTimeout> | null = null
const draftKey = () => `nmm-news-new-draft-${props.newsLocale === 'en' ? 'en' : 'es'}`
const canChangeAuthor = computed(() => ['admin', 'superadmin', 'owner'].includes(String(me.value?.role || '').toLowerCase()))
const selectedAuthor = computed(
  () => wpAuthors.value.find((item) => String(item.id) === String(form.value.wpAuthorId)) || null,
)
const coverSrc = computed(() => coverPreview.value || form.value.coverUrl || '')

const clearCoverPreview = () => {
  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl)
    coverObjectUrl = ''
  }
  coverPreview.value = ''
  pendingCoverFile = null
}
const primarySlug = computed({
  get: () => (form.value.locale === 'en' ? form.value.enSlug : form.value.esSlug) || form.value.slug,
  set: (value: string) => {
    const next = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180)
    form.value.slug = next
    if (form.value.locale === 'en') form.value.enSlug = next
    else form.value.esSlug = next
  },
})
const primaryHref = computed(() => articleHref(form.value.locale, primarySlug.value))
const localeLabel = computed(() => (form.value.locale === 'en' ? 'English' : 'Español'))
const visibleCategories = computed(() =>
  categories.value.filter((cat) => !['uncategorized', 'sin-categoria', 'sin-categoría'].includes(cat.slug)),
)

const toAccount = (user: Record<string, any>): Account => ({
  id: String(user.id),
  displayName: user.displayName || '',
  username: user.username || '',
  email: user.email || '',
  photoUrl: user.photoUrl || user.photoURL || '',
  role: user.role || '',
})

const ensureDefaultAuthor = () => {
  if (form.value.wpAuthorId) return
  const linkedToMe = me.value
    ? wpAuthors.value.find((item) => String(item.linkedUserId || '') === String(me.value?.id || ''))
    : null
  form.value.wpAuthorId = String((linkedToMe || wpAuthors.value[0])?.id || '')
}

const fileKind = (file: { type?: string; name?: string; url?: string }) => {
  const hint = `${file.type || ''} ${file.name || ''} ${file.url || ''}`.toLowerCase()
  if (hint.includes('gif') || hint.endsWith('.gif')) return 'gif'
  if (hint.includes('video') || /\.(mp4|webm|mov)(\?|$)/.test(hint)) return 'video'
  return 'image'
}

const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

const lookupsLoading = ref(false)

const loadLookups = async (locale: 'es' | 'en') => {
  lookupsLoading.value = true
  try {
    const cats = await withTimeout(getAdminNewsCategories(locale), 15000).catch(() => [])
    categories.value = Array.isArray(cats) ? cats : []
  } catch {
    categories.value = []
  }
  try {
    const authors = await withTimeout(getAdminNewsAuthors(locale), 15000).catch(() => [])
    wpAuthors.value = Array.isArray(authors) ? authors : []
    if (!isEditing.value) ensureDefaultAuthor()
  } catch {
    wpAuthors.value = []
  } finally {
    lookupsLoading.value = false
  }
}

const loadComments = async () => {
  if (!props.postId) {
    comments.value = []
    return
  }
  try {
    const payload = await withTimeout(getAdminNewsComments(props.postId, form.value.locale), 8000)
    comments.value = payload.items || []
  } catch {
    comments.value = []
  }
}

const hydrateAuthor = async () => {
  try {
    const account = await withTimeout(getMe().catch(() => null), 6000).catch(() => null)
    me.value = account ? toAccount(account) : null
    if (!isEditing.value) ensureDefaultAuthor()
  } catch {
    /* form stays usable */
  }
}

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    if (props.postId) {
      form.value.locale = props.newsLocale === 'en' ? 'en' : 'es'
      const post = await withTimeout(getAdminNewsPost(props.postId, form.value.locale), 10000)
      slugManual.value = true
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
        publishedAt: post.publishedAt ? String(post.publishedAt).slice(0, 16) : nowLocalInput(),
        categoryIds: (post.categoryIds || []).map((id: string | number) => String(id)),
        wpAuthorId: post.wpAuthorId ? String(post.wpAuthorId) : '',
        tags: Array.isArray(post.tags) ? post.tags.map((item: string) => String(item)) : [],
        attachments: Array.isArray(post.attachments) ? post.attachments : [],
      }
      loading.value = false
      void hydrateAuthor()
      void Promise.all([loadLookups(form.value.locale), loadComments()])
    } else {
      form.value.locale = props.newsLocale === 'en' ? 'en' : 'es'
      slugManual.value = false
      comments.value = []
      try {
        const raw = sessionStorage.getItem(draftKey())
        if (raw) {
          const draft = JSON.parse(raw)
          form.value = {
            ...form.value,
            ...draft,
            locale: form.value.locale,
            publishedAt: draft.publishedAt || nowLocalInput(),
          }
          if (draft.esSlug || draft.enSlug || draft.slug) slugManual.value = true
        } else if (!form.value.publishedAt) {
          form.value.publishedAt = nowLocalInput()
        }
      } catch {
        if (!form.value.publishedAt) form.value.publishedAt = nowLocalInput()
      }
      loading.value = false
      void hydrateAuthor()
      void loadLookups(form.value.locale)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cargar el formulario.'
    loading.value = false
  }
}

watch(
  () => form.value.title,
  (title) => {
    if (isEditing.value || slugManual.value) return
    const next = slugify(title)
    form.value.slug = next
    if (form.value.locale === 'en') form.value.enSlug = next
    else form.value.esSlug = next
  },
)

const onPrimarySlugInput = (event: Event) => {
  slugManual.value = true
  primarySlug.value = (event.target as HTMLInputElement).value
}

watch(
  () => form.value.locale,
  async (locale, previous) => {
    if (locale === previous || isEditing.value) return
    await loadLookups(locale)
    form.value.categoryIds = []
    form.value.wpAuthorId = ''
    ensureDefaultAuthor()
  },
)

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

const uploadCoverWithRetry = async (file: File) => {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withTimeout(uploadAdminImage('news-cover', file), 45000)
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudo subir la portada.')
}

const applyCoverFile = async (file?: File | null) => {
  if (!file || !file.type.startsWith('image/')) return
  uploading.value = true
  errorMessage.value = ''
  const bodyBefore = form.value.content
  try {
    const optimized = await compressImageFile(file, { maxEdge: 1600, targetBytes: 170_000 })
    // Keep previous remote cover until the new one succeeds; only swap local preview.
    if (coverObjectUrl) {
      URL.revokeObjectURL(coverObjectUrl)
      coverObjectUrl = ''
    }
    pendingCoverFile = optimized
    coverObjectUrl = URL.createObjectURL(optimized)
    coverPreview.value = coverObjectUrl
    if (!form.value.coverAlt.trim() && form.value.title.trim()) {
      form.value.coverAlt = form.value.title.trim()
    }
    const uploaded = await uploadCoverWithRetry(optimized)
    const remote = uploaded.path || uploaded.url || ''
    if (!remote) throw new Error('La subida no devolvió URL.')
    form.value.coverUrl = remote
    // Drop local blob preview only after remote URL is assigned; keep pending as save fallback
    // until the next successful remote assignment is confirmed by keeping pending until clear.
    if (coverObjectUrl) {
      URL.revokeObjectURL(coverObjectUrl)
      coverObjectUrl = ''
    }
    coverPreview.value = ''
    pendingCoverFile = null
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? `Portada: ${error.message}. Se mantiene la vista previa local y se reintentará al guardar.`
        : 'No se pudo subir la portada. Se reintentará al guardar.'
  } finally {
    // Cover upload must never wipe the article body (prompt/form races).
    if (!form.value.content?.trim() && bodyBefore?.trim()) {
      form.value.content = bodyBefore
    }
    uploading.value = false
  }
}

const uploadCover = async (event: Event) => {
  const input = event.target as HTMLInputElement
  await applyCoverFile(input.files?.[0])
  input.value = ''
}

const onCoverDrag = (event: DragEvent, active: boolean) => {
  event.preventDefault()
  event.stopPropagation()
  coverDragging.value = active
}

const onCoverDrop = async (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  coverDragging.value = false
  const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith('image/'))
  await applyCoverFile(file)
}

const uploadAttachment = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  uploadingFile.value = true
  errorMessage.value = ''
  const bodyBefore = form.value.content
  try {
    for (const file of files) {
      let uploaded: { path?: string; url?: string } | null = null
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          uploaded = await withTimeout(uploadAdminImage('news-file', file), 45000)
          break
        } catch (error) {
          lastError = error
          if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
        }
      }
      if (!uploaded) throw lastError instanceof Error ? lastError : new Error('No se pudo subir el adjunto.')
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
    if (!form.value.content?.trim() && bodyBefore?.trim()) {
      form.value.content = bodyBefore
    }
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
  if (pendingCoverFile && !form.value.coverUrl) {
    try {
      const optimized = await compressImageFile(pendingCoverFile, { maxEdge: 1600, targetBytes: 170_000 })
      const uploaded = await uploadAdminImage('news-cover', optimized)
      const remote = uploaded.path || uploaded.url || ''
      if (remote) {
        form.value.coverUrl = remote
        clearCoverPreview()
      }
    } catch {
      errorMessage.value = 'No se pudo subir la portada. Revisa la conexión e inténtalo otra vez.'
      saving.value = false
      return
    }
  }
  const body = {
    locale: form.value.locale,
    title: form.value.title,
    slug: (form.value.locale === 'en' ? form.value.enSlug : form.value.esSlug) || form.value.slug || undefined,
    altSlug: form.value.locale === 'en' ? form.value.esSlug : form.value.enSlug,
    excerpt: form.value.excerpt || '',
    content: form.value.content || '',
    coverUrl: form.value.coverUrl || undefined,
    coverCaption: form.value.coverCaption.trim(),
    coverAlt: form.value.coverAlt.trim() || form.value.title || '',
    status: form.value.status,
    featured: Boolean(form.value.featured),
    publishedAt: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : undefined,
    categoryIds: form.value.categoryIds || [],
    tags: form.value.tags || [],
    attachments: form.value.attachments || [],
    authorUserId: selectedAuthor.value?.linkedUserId || (!isEditing.value ? me.value?.id : undefined) || undefined,
    wpAuthorId: form.value.wpAuthorId ? Number(form.value.wpAuthorId) : undefined,
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
        sessionStorage.removeItem(draftKey())
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
      sessionStorage.setItem(draftKey(), JSON.stringify(value))
    } catch {
      /* ignore quota */
    }
  },
  { deep: true },
)
onUnmounted(() => {
  if (tagTimer) clearTimeout(tagTimer)
  clearCoverPreview()
})
</script>

<template>
  <section class="na-form">
    <p v-if="successMessage" class="na-ok">{{ successMessage }}</p>
    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-if="loading" class="na-empty">Cargando formulario…</p>
    <form v-show="!loading" class="na-form-grid" @submit.prevent>
      <article class="na-card na-form-main">
        <label class="na-title-field">
          <span>{{ form.locale === 'en' ? 'Title (English)' : 'Título (Español)' }}</span>
          <input
            v-model="form.title"
            class="na-title-input"
            required
            maxlength="220"
            :placeholder="form.locale === 'en' ? 'Add English title' : 'Añadir título en español'"
          />
        </label>
        <label class="na-dek-field">
          <span>Subtítulo (h2) · opcional</span>
          <textarea
            v-model="form.excerpt"
            rows="2"
            maxlength="320"
            :placeholder="
              form.locale === 'en'
                ? 'Optional subtitle under the title. Leave empty to hide.'
                : 'Opcional. Solo aparece debajo del título si lo escribes aquí.'
            "
          />
          <small>Solo se muestra en la nota si lo agregas. No se genera solo.</small>
        </label>
        <label class="na-slug-field">
          URL {{ form.locale === 'en' ? '(English)' : '(Español)' }}
          <div class="na-url-line">
            <input
              :value="primarySlug"
              maxlength="180"
              :placeholder="form.locale === 'en' ? 'from-the-title' : 'desde-el-titulo'"
              @input="onPrimarySlugInput"
            />
          </div>
          <small>{{ primaryHref }}</small>
        </label>
        <NewsRichEditor v-model="form.content" :default-alt="form.title" />
      </article>

      <aside class="na-form-side">
        <article class="na-card">
          <span class="kicker">Publicación</span>
          <p class="na-locale-badge">
            Solo {{ localeLabel }} ·
            <b>{{ form.locale === 'en' ? 'musicmundial_en' : 'musicmundial_es' }}</b>
          </p>
          <p class="na-help">
            Español e inglés son bases distintas. Esta nota no afecta al otro idioma.
          </p>
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

        <article class="na-card na-cover-card">
          <span class="kicker">Portada</span>
          <div
            class="na-cover-drop"
            :class="{ 'is-dragging': coverDragging, 'has-cover': Boolean(coverSrc) }"
            @dragenter="onCoverDrag($event, true)"
            @dragover="onCoverDrag($event, true)"
            @dragleave="onCoverDrag($event, false)"
            @drop="onCoverDrop"
          >
            <label class="na-file na-cover-upload">
              {{
                uploading
                  ? 'Subiendo…'
                  : coverDragging
                    ? 'Suelta la imagen aquí'
                    : coverSrc
                      ? 'Cambiar imagen'
                      : 'Arrastra una imagen o haz clic'
              }}
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadCover" />
            </label>
            <div v-if="coverSrc" class="na-cover-box">
              <img class="na-cover-preview" :src="coverSrc" :alt="form.coverAlt || form.title || ''" />
            </div>
            <p v-else class="na-help">JPG, PNG o WebP. Se comprime a ~170 KB al subir.</p>
          </div>
          <p v-if="coverPreview && !form.coverUrl" class="na-help">Vista previa local · se sube al servidor al guardar.</p>
          <label class="na-cover-seo">
            Banner en portada (opcional)
            <input
              v-model="form.coverCaption"
              maxlength="180"
              placeholder="Solo si quieres el texto sobre la foto. Déjalo vacío para no mostrarlo."
            />
            <small class="na-help">Si no escribes nada, la portada sale sin banner.</small>
          </label>
          <label>
            Texto alternativo (SEO)
            <input v-model="form.coverAlt" :placeholder="form.title || 'Título de la noticia'" />
          </label>
        </article>

        <article class="na-card">
          <span class="kicker">Autor</span>
          <p class="na-help">
            Elige un autor del panel Autores. Edita nombre, bio, foto y vínculo VMM allí.
          </p>
          <div v-if="selectedAuthor" class="na-author-chip">
            <img v-if="selectedAuthor.photoUrl" :src="selectedAuthor.photoUrl" alt="" />
            <span v-else class="ph">{{ selectedAuthor.name.slice(0, 1) }}</span>
            <div>
              <b>{{ selectedAuthor.name }}</b>
              <small>
                {{ selectedAuthor.email || 'Autor de noticias' }}
                ·
                {{ selectedAuthor.linkedUserId ? 'Cuenta VMM vinculada' : 'Sin cuenta VMM' }}
              </small>
            </div>
          </div>
          <label>
            Autor de la nota
            <select v-model="form.wpAuthorId" :disabled="!canChangeAuthor || lookupsLoading">
              <option disabled value="">{{ lookupsLoading ? 'Cargando autores…' : 'Seleccionar autor' }}</option>
              <option v-for="item in wpAuthors" :key="item.id" :value="String(item.id)">
                {{ item.name }} · {{ item.postCount }} notas{{ item.linkedUserId ? ' · VMM' : '' }}
              </option>
            </select>
          </label>
          <a class="na-btn" href="/es/admin/autores">Gestionar autores</a>
        </article>

        <article class="na-card">
          <span class="kicker">Categorías · {{ localeLabel }}</span>
          <p v-if="lookupsLoading && !visibleCategories.length" class="na-help">Cargando categorías…</p>
          <p v-else-if="!visibleCategories.length" class="na-help">
            No hay categorías en {{ localeLabel }} ({{ form.locale === 'en' ? 'musicmundial_en' : 'musicmundial_es' }}).
            Créalas en Categorías del menú.
          </p>
          <div v-else class="na-checks">
            <label v-for="cat in visibleCategories" :key="cat.id" class="na-check">
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
          <button class="na-btn solid" type="button" :disabled="saving" @click="save">
            {{ saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear noticia' }}
          </button>
          <a class="na-btn" href="/es/admin/noticias">Volver</a>
        </div>
      </aside>
    </form>
  </section>
</template>
