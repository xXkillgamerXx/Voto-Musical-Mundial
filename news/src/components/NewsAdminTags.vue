<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  getAdminNewsTagProfile,
  getAdminNewsTags,
  updateAdminNewsTag,
  uploadAdminImage,
} from '../../../src/services/api/adminApi'

type TagRow = { id: string; slug: string; name: string; postCount?: number; href?: string }
type Supporter = { name: string; tier: string; points: number }

const items = ref<TagRow[]>([])
const locale = ref<'es' | 'en'>('es')
const q = ref('')
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const notice = ref('')
const selected = ref<TagRow | null>(null)
const form = ref({
  name: '',
  description: '',
  about: '',
  logoUrl: '',
  coverUrl: '',
  verified: false,
  followers: 0,
  related: '',
  supporters: [] as Supporter[],
})

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const rows = await getAdminNewsTags(locale.value, q.value)
    items.value = Array.isArray(rows) ? rows : []
  } catch {
    errorMessage.value = 'No se pudieron cargar las etiquetas.'
    items.value = []
  } finally {
    loading.value = false
  }
}

const pick = async (tag: TagRow) => {
  notice.value = ''
  errorMessage.value = ''
  selected.value = tag
  let profile: Record<string, any> = tag
  try {
    profile = await getAdminNewsTagProfile(tag.id, locale.value)
  } catch {
    errorMessage.value = 'No se pudo abrir la etiqueta.'
    return
  }
  form.value = {
    name: profile.name || tag.name,
    description: profile.description || '',
    about: profile.about || '',
    logoUrl: profile.logoUrl || '',
    coverUrl: profile.coverUrl || '',
    verified: Boolean(profile.verified),
    followers: Number(profile.followers || 0),
    related: Array.isArray(profile.related) ? profile.related.join(', ') : '',
    supporters: Array.isArray(profile.supporters) ? profile.supporters : [],
  }
  selected.value = { ...tag, href: profile.href || tag.href, slug: profile.slug || tag.slug }
}

const addSupporter = () => {
  form.value.supporters = [...form.value.supporters, { name: '', tier: 'FAN', points: 0 }]
}

const save = async () => {
  if (!selected.value) return
  saving.value = true
  errorMessage.value = ''
  notice.value = ''
  try {
    const saved = await updateAdminNewsTag(selected.value.id, {
      locale: locale.value,
      name: form.value.name,
      description: form.value.description,
      about: form.value.about,
      logoUrl: form.value.logoUrl,
      coverUrl: form.value.coverUrl,
      verified: form.value.verified,
      followers: Number(form.value.followers || 0),
      related: form.value.related.split(',').map((item) => item.trim()).filter(Boolean),
      supporters: form.value.supporters,
    })
    notice.value = 'Etiqueta guardada.'
    selected.value = { ...selected.value, name: saved.name, slug: saved.slug, href: saved.href }
    await load()
  } catch {
    errorMessage.value = 'No se pudo guardar la etiqueta.'
  } finally {
    saving.value = false
  }
}

const upload = (field: 'logoUrl' | 'coverUrl') => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp'
  input.onchange = async () => {
    const [file] = input.files || []
    if (!file) return
    const uploaded = await uploadAdminImage('news-file', file)
    form.value[field] = uploaded.path || uploaded.url || form.value[field]
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
          <button type="button" :class="{ on: locale === 'en' }" @click="locale = 'en'; selected = null; load()">EN</button>
          <button type="button" :class="{ on: locale === 'es' }" @click="locale = 'es'; selected = null; load()">ES</button>
        </div>
        <input v-model="q" class="na-search" type="search" placeholder="Buscar etiqueta, ej. BTS" @keydown.enter="load" />
        <button class="na-btn" type="button" @click="load">Buscar</button>
      </div>
      <p v-if="errorMessage && !selected" class="na-error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="na-empty">Cargando etiquetas…</p>
      <div v-else class="na-cat-table">
        <button v-for="tag in items" :key="tag.id" type="button" class="na-cat-row" @click="pick(tag)">
          <div>
            <h3>{{ tag.name }}</h3>
            <small>/tag/{{ tag.slug }}</small>
          </div>
          <span class="na-chip">{{ Number(tag.postCount || 0).toLocaleString('es') }} notas</span>
        </button>
      </div>
    </div>
    <form v-if="selected" class="na-card na-form" @submit.prevent="save">
      <h2 style="margin: 0 0 12px">{{ form.name || selected.name }}</h2>
      <label class="na-field"><span>Nombre</span><input v-model="form.name" type="text" maxlength="200" /></label>
      <label class="na-field"><span>Frase corta</span><input v-model="form.description" type="text" maxlength="500" /></label>
      <label class="na-field"><span>About</span><textarea v-model="form.about" rows="5" maxlength="4000"></textarea></label>
      <label class="na-field"><span>Logo</span><input v-model="form.logoUrl" type="url" /></label>
      <label class="na-field"><span>Imagen de fondo</span><input v-model="form.coverUrl" type="url" /></label>
      <label class="na-field"><span>Seguidores</span><input v-model.number="form.followers" type="number" min="0" /></label>
      <label class="na-check"><input v-model="form.verified" type="checkbox" /> Verificada</label>
      <label class="na-field">
        <span>Etiquetas relacionadas (slugs, separadas por coma)</span>
        <input v-model="form.related" type="text" placeholder="kpop, army, jungkook" />
      </label>
      <div class="na-field">
        <span>Supporters</span>
        <div v-for="(fan, index) in form.supporters" :key="index" class="na-inline">
          <input v-model="fan.name" type="text" placeholder="Nombre" />
          <input v-model="fan.tier" type="text" placeholder="FAN" />
          <input v-model.number="fan.points" type="number" min="0" />
        </div>
        <button class="na-btn" type="button" @click="addSupporter">Añadir supporter</button>
      </div>
      <div class="na-actions">
        <button class="na-btn" type="button" @click="upload('logoUrl')">Subir logo</button>
        <button class="na-btn" type="button" @click="upload('coverUrl')">Subir fondo</button>
        <button class="na-btn solid" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        <a v-if="selected.href" class="na-btn" :href="selected.href" target="_blank">Ver página</a>
      </div>
      <p v-if="notice" class="na-count">{{ notice }}</p>
      <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    </form>
  </section>
</template>
