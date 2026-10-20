<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createAdminNewsPost,
  getAdminNewsCategories,
  getAdminNewsPost,
  updateAdminNewsPost,
  uploadAdminImage,
} from '../../services/api/adminApi'

const props = defineProps({
  postId: { type: String, default: '' },
})

const form = ref({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverUrl: '',
  status: 'draft',
  featured: false,
  authorName: 'Redacción',
  publishedAt: '',
  categoryIds: [],
})
const categories = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const isUploading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isEditing = computed(() => Boolean(props.postId))

const load = async () => {
  isLoading.value = true
  try {
    categories.value = await getAdminNewsCategories()
    if (props.postId) {
      const post = await getAdminNewsPost(props.postId)
      form.value = {
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        coverUrl: post.coverUrl || '',
        status: post.status || 'draft',
        featured: Boolean(post.featured),
        authorName: post.authorName || 'Redacción',
        publishedAt: post.publishedAt ? String(post.publishedAt).slice(0, 16) : '',
        categoryIds: post.categoryIds || [],
      }
    }
  } catch {
    errorMessage.value = 'No se pudo cargar la noticia.'
  } finally {
    isLoading.value = false
  }
}

const uploadCover = async (event) => {
  const [file] = event.target.files || []
  if (!file) return
  isUploading.value = true
  errorMessage.value = ''
  try {
    const uploaded = await uploadAdminImage('news-cover', file)
    form.value.coverUrl = uploaded.path || uploaded.url || ''
  } catch {
    errorMessage.value = 'No se pudo subir la imagen.'
  } finally {
    isUploading.value = false
    event.target.value = ''
  }
}

const save = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  const body = {
    title: form.value.title,
    slug: form.value.slug || undefined,
    excerpt: form.value.excerpt || '',
    content: form.value.content || '',
    coverUrl: form.value.coverUrl || undefined,
    status: form.value.status,
    featured: Boolean(form.value.featured),
    authorName: form.value.authorName || 'Redacción',
    publishedAt: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : undefined,
    categoryIds: form.value.categoryIds || [],
  }
  try {
    if (isEditing.value) {
      await updateAdminNewsPost(props.postId, body)
      successMessage.value = 'Noticia actualizada.'
    } else {
      const created = await createAdminNewsPost(body)
      successMessage.value = 'Noticia creada.'
      window.location.href = `/admin/noticias/editar/${created.id}`
    }
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar la noticia.'
  } finally {
    isSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">Music Mundial</p>
          <h2 class="mt-2 text-2xl font-black text-white">{{ isEditing ? 'Editar noticia' : 'Nueva noticia' }}</h2>
        </div>
        <a href="/admin/noticias" class="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-200">Volver</a>
      </div>
      <p v-if="successMessage" class="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">{{ successMessage }}</p>
      <p v-if="errorMessage" class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{{ errorMessage }}</p>
      <form v-if="!isLoading" class="mt-6 grid gap-4" @submit.prevent="save">
        <label class="grid gap-2 text-sm font-bold text-slate-300">
          Título
          <input v-model="form.title" required class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white" />
        </label>
        <label class="grid gap-2 text-sm font-bold text-slate-300">
          Slug
          <input v-model="form.slug" class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white" placeholder="se-genera-del-titulo" />
        </label>
        <label class="grid gap-2 text-sm font-bold text-slate-300">
          Extracto
          <textarea v-model="form.excerpt" rows="3" class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" />
        </label>
        <label class="grid gap-2 text-sm font-bold text-slate-300">
          Contenido HTML
          <textarea v-model="form.content" rows="12" class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-sm text-white" />
        </label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="grid gap-2 text-sm font-bold text-slate-300">
            Portada
            <input v-model="form.coverUrl" class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white" />
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadCover" />
            <span v-if="isUploading">Subiendo…</span>
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-300">
            Estado
            <select v-model="form.status" class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white">
              <option value="draft">Borrador</option>
              <option value="publish">Publicada</option>
              <option value="scheduled">Programada</option>
            </select>
          </label>
        </div>
        <label class="grid gap-2 text-sm font-bold text-slate-300">
          Categorías
          <select v-model="form.categoryIds" multiple class="min-h-40 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
            <option v-for="category in categories" :key="category.id" :value="String(category.id)">
              {{ category.name }}
            </option>
          </select>
        </label>
        <label class="flex items-center gap-3 text-sm font-bold text-slate-300">
          <input v-model="form.featured" type="checkbox" />
          Destacada en portada
        </label>
        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="isSaving"
            class="inline-flex min-h-12 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase text-white"
          >
            {{ isSaving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </article>
  </section>
</template>
