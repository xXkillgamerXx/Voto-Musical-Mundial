<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAdminNewsAuthors, updateAdminNewsAuthor, uploadAdminImage } from '../../../src/services/api/adminApi'

type Author = {
  id: string
  name: string
  email?: string
  slug?: string
  bio?: string
  photoUrl?: string
  website?: string
  postCount?: number
  href?: string
}

const items = ref<Author[]>([])
const locale = ref<'es' | 'en'>('es')
const q = ref('')
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const notice = ref('')
const selected = ref<Author | null>(null)
const form = ref({ name: '', bio: '', website: '', photoUrl: '' })

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const rows = await getAdminNewsAuthors(locale.value, q.value)
    items.value = Array.isArray(rows) ? rows : []
  } catch {
    errorMessage.value = 'No se pudieron cargar los autores.'
    items.value = []
  } finally {
    loading.value = false
  }
}

const pick = (author: Author) => {
  selected.value = author
  notice.value = ''
  form.value = {
    name: author.name || '',
    bio: author.bio || '',
    website: author.website || '',
    photoUrl: author.photoUrl || '',
  }
}

const save = async () => {
  if (!selected.value) return
  saving.value = true
  errorMessage.value = ''
  notice.value = ''
  try {
    const saved = await updateAdminNewsAuthor(selected.value.id, {
      locale: locale.value,
      ...form.value,
    })
    notice.value = 'Autor actualizado.'
    selected.value = { ...selected.value, ...saved }
    await load()
  } catch {
    errorMessage.value = 'No se pudo guardar el autor.'
  } finally {
    saving.value = false
  }
}

const uploadPhoto = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp'
  input.onchange = async () => {
    const [file] = input.files || []
    if (!file) return
    const uploaded = await uploadAdminImage('news-file', file)
    form.value.photoUrl = uploaded.path || uploaded.url || form.value.photoUrl
  }
  input.click()
}

onMounted(load)
</script>

<template>
  <section class="na-split">
    <div>
      <div class="na-toolbar">
        <div class="na-ranges" role="group" aria-label="Idioma">
          <button type="button" :class="{ on: locale === 'en' }" @click="locale = 'en'; load()">EN</button>
          <button type="button" :class="{ on: locale === 'es' }" @click="locale = 'es'; load()">ES</button>
        </div>
        <input v-model="q" class="na-search" type="search" placeholder="Buscar autor" @keydown.enter="load" />
        <button class="na-btn" type="button" @click="load">Buscar</button>
      </div>
      <p v-if="errorMessage && !selected" class="na-error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="na-empty">Cargando autores…</p>
      <div v-else class="na-cat-table">
        <button v-for="author in items" :key="author.id" type="button" class="na-cat-row" @click="pick(author)">
          <div>
            <h3>{{ author.name }}</h3>
            <small>{{ author.email || author.slug }}</small>
          </div>
          <span class="na-chip">{{ Number(author.postCount || 0).toLocaleString('es') }} notas</span>
        </button>
      </div>
    </div>
    <form v-if="selected" class="na-card na-form" @submit.prevent="save">
      <h2 style="margin: 0 0 12px">{{ selected.name }}</h2>
      <label class="na-field">
        <span>Nombre público</span>
        <input v-model="form.name" type="text" maxlength="250" />
      </label>
      <label class="na-field">
        <span>Bio</span>
        <textarea v-model="form.bio" rows="5" maxlength="2000"></textarea>
      </label>
      <label class="na-field">
        <span>Web</span>
        <input v-model="form.website" type="url" maxlength="300" placeholder="https://" />
      </label>
      <label class="na-field">
        <span>Foto</span>
        <input v-model="form.photoUrl" type="url" maxlength="500" placeholder="https://" />
      </label>
      <div class="na-actions">
        <button class="na-btn" type="button" @click="uploadPhoto">Subir foto</button>
        <button class="na-btn solid" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        <a v-if="selected.href" class="na-btn" :href="selected.href" target="_blank">Ver página</a>
      </div>
      <p v-if="notice" class="na-count">{{ notice }}</p>
      <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    </form>
  </section>
</template>
