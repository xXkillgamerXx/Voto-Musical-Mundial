<script setup>
import { onMounted, ref } from 'vue'
import { deleteAdminNewsPost, getAdminNewsPosts } from '../../services/api/adminApi'

const posts = ref([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

const loadPosts = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminNewsPosts({ page: page.value, limit: 20, q: q.value })
    posts.value = payload.items || []
    total.value = payload.total || 0
  } catch {
    errorMessage.value = 'No se pudieron cargar las noticias.'
  } finally {
    isLoading.value = false
  }
}

const removePost = async (post) => {
  if (!window.confirm(`¿Borrar “${post.title}”?`)) return
  try {
    await deleteAdminNewsPost(post.id)
    successMessage.value = 'Noticia eliminada.'
    loadPosts()
  } catch {
    errorMessage.value = 'No se pudo eliminar la noticia.'
  }
}

onMounted(loadPosts)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">Music Mundial</p>
          <h2 class="mt-2 text-2xl font-black text-white sm:text-3xl">Noticias</h2>
          <p class="mt-2 text-sm text-slate-400">{{ total }} posts publicados desde WordPress y los nuevos que crees aquí.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <input
            v-model="q"
            class="min-h-12 rounded-full border border-white/10 bg-slate-950/60 px-4 text-sm text-white"
            placeholder="Buscar título o slug"
            @keydown.enter="page = 1; loadPosts()"
          />
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200"
            @click="page = 1; loadPosts()"
          >
            Buscar
          </button>
          <a
            href="/admin/noticias/crear"
            class="inline-flex min-h-12 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white"
          >
            Nueva noticia
          </a>
        </div>
      </div>
      <p v-if="successMessage" class="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">{{ successMessage }}</p>
      <p v-if="errorMessage" class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{{ errorMessage }}</p>
      <div v-if="isLoading" class="mt-6 text-sm font-bold text-slate-300">Cargando noticias…</div>
      <div v-else class="mt-6 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10">
        <article v-for="post in posts" :key="post.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <img
            v-if="post.coverUrl"
            :src="post.coverUrl"
            alt=""
            class="h-16 w-24 shrink-0 rounded-xl object-cover"
          />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold uppercase tracking-wide text-fuchsia-300">{{ post.category }} · {{ post.status }}</p>
            <h3 class="truncate text-base font-black text-white">{{ post.title }}</h3>
            <p class="truncate text-sm text-slate-400">/{{ post.slug }}</p>
          </div>
          <div class="flex gap-2">
            <a :href="`/${post.slug}`" target="_blank" class="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-200">Ver</a>
            <a :href="`/admin/noticias/editar/${post.id}`" class="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-200">Editar</a>
            <button type="button" class="rounded-full border border-red-300/20 px-4 py-2 text-xs font-black text-red-200" @click="removePost(post)">Borrar</button>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>
