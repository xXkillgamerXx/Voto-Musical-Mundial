<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getAdminNewsAuthors,
  getAdminUsers,
  updateAdminNewsAuthor,
  uploadAdminImage,
} from '../../../src/services/api/adminApi'
import { compressImageFile } from '../lib/compressImage'

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
  linkedUserId?: string
}

type Account = {
  id: string
  displayName?: string
  username?: string
  email?: string
  photoUrl?: string
}

const items = ref<Author[]>([])
const locale = ref<'es' | 'en'>('es')
const q = ref('')
const loading = ref(true)
const saving = ref(false)
const uploadingPhoto = ref(false)
const errorMessage = ref('')
const notice = ref('')
const selected = ref<Author | null>(null)
const form = ref({ name: '', bio: '', website: '', photoUrl: '', linkedUserId: '' })
const linkedAccount = ref<Account | null>(null)
const vmmModalOpen = ref(false)
const userQuery = ref('')
const userHits = ref<Account[]>([])
const searchingUsers = ref(false)
const photoInput = ref<HTMLInputElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const accountLabel = (user?: Account | null) =>
  user?.displayName || user?.username || user?.email || 'Cuenta'

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const rows = await getAdminNewsAuthors(locale.value, q.value)
    items.value = Array.isArray(rows) ? rows : []
    if (selected.value) {
      const next = items.value.find((item) => item.id === selected.value?.id)
      if (next) pick(next)
      else selected.value = null
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron cargar los autores.'
    items.value = []
  } finally {
    loading.value = false
  }
}

const setLocale = (next: 'es' | 'en') => {
  if (locale.value === next) return
  locale.value = next
  selected.value = null
  closeVmmModal()
  load()
}

const pick = (author: Author) => {
  selected.value = author
  notice.value = ''
  closeVmmModal()
  form.value = {
    name: author.name || '',
    bio: author.bio || '',
    website: author.website || '',
    photoUrl: author.photoUrl || '',
    linkedUserId: author.linkedUserId || '',
  }
  linkedAccount.value = author.linkedUserId
    ? { id: author.linkedUserId, displayName: `Cuenta ${author.linkedUserId}` }
    : null
}

const closeEditor = () => {
  selected.value = null
  closeVmmModal()
}

const openVmmModal = () => {
  vmmModalOpen.value = true
  userQuery.value = ''
  userHits.value = []
}

const closeVmmModal = () => {
  vmmModalOpen.value = false
  userQuery.value = ''
  userHits.value = []
  searchingUsers.value = false
}

const searchUsers = async (query: string) => {
  const value = query.trim()
  if (value.length < 2) {
    userHits.value = []
    return
  }
  searchingUsers.value = true
  try {
    const payload = await getAdminUsers({ page: 1, limit: 12, search: value })
    if (userQuery.value.trim() !== value) return
    userHits.value = (payload.items || []).map((user: Record<string, any>) => ({
      id: String(user.id),
      displayName: user.displayName || '',
      username: user.username || '',
      email: user.email || '',
      photoUrl: user.photoUrl || user.photoURL || '',
    }))
  } catch {
    userHits.value = []
  } finally {
    searchingUsers.value = false
  }
}

const linkAccount = (user: Account) => {
  form.value.linkedUserId = user.id
  linkedAccount.value = user
  if (!form.value.name.trim()) form.value.name = accountLabel(user)
  if (!form.value.photoUrl.trim() && user.photoUrl) form.value.photoUrl = user.photoUrl
  closeVmmModal()
}

const unlinkAccount = () => {
  form.value.linkedUserId = ''
  linkedAccount.value = null
}

const onPhotoPick = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const [file] = input.files || []
  if (!file) return
  uploadingPhoto.value = true
  errorMessage.value = ''
  try {
    const optimized = await compressImageFile(file, { maxEdge: 800, targetBytes: 120_000 })
    const uploaded = await uploadAdminImage('news-file', optimized)
    form.value.photoUrl = uploaded.path || uploaded.url || form.value.photoUrl
  } catch {
    errorMessage.value = 'No se pudo subir la foto.'
  } finally {
    uploadingPhoto.value = false
    input.value = ''
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
      name: form.value.name,
      bio: form.value.bio,
      website: form.value.website,
      photoUrl: form.value.photoUrl,
      linkedUserId: form.value.linkedUserId || null,
    })
    notice.value = 'Autor actualizado.'
    selected.value = {
      ...selected.value,
      ...saved,
      linkedUserId: saved.linkedUserId || form.value.linkedUserId || '',
      photoUrl: saved.photoUrl || form.value.photoUrl,
    }
    form.value.linkedUserId = selected.value.linkedUserId || ''
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo guardar el autor.'
  } finally {
    saving.value = false
  }
}

watch(userQuery, (value) => {
  if (!vmmModalOpen.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => searchUsers(value), 280)
})

onMounted(load)
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <section class="na-authors" :class="{ 'has-editor': Boolean(selected) }">
    <div class="na-authors-main">
      <div class="na-lang-tabs" role="tablist" aria-label="Idioma de autores">
        <button type="button" role="tab" :aria-selected="locale === 'es'" :class="{ on: locale === 'es' }" @click="setLocale('es')">
          <strong>Español</strong>
          <span>Autores ES</span>
        </button>
        <button type="button" role="tab" :aria-selected="locale === 'en'" :class="{ on: locale === 'en' }" @click="setLocale('en')">
          <strong>English</strong>
          <span>Authors EN</span>
        </button>
      </div>
      <div class="na-toolbar">
        <input v-model="q" class="na-search" type="search" placeholder="Buscar autor" @keydown.enter="load" />
        <button class="na-btn" type="button" @click="load">Buscar</button>
      </div>
      <p class="na-help">
        Autores de esta lengua.
        <template v-if="locale === 'en'">Ej. <code>/author/derwynsjose</code> está en English.</template>
        <template v-else>Ej. <code>/es/author/derwyns-diaz</code> está en Español.</template>
      </p>
      <p v-if="errorMessage && !selected" class="na-error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="na-empty">Cargando autores…</p>
      <p v-else-if="!items.length" class="na-empty">No hay autores en {{ locale === 'en' ? 'English' : 'Español' }}.</p>
      <div v-else class="na-author-grid">
        <button
          v-for="author in items"
          :key="author.id"
          type="button"
          class="na-author-card"
          :class="{ on: selected?.id === author.id }"
          @click="pick(author)"
        >
          <img v-if="author.photoUrl" class="na-author-card-photo" :src="author.photoUrl" alt="" />
          <span v-else class="na-author-card-photo ph">{{ (author.name || 'A').slice(0, 1) }}</span>
          <div class="na-author-card-body">
            <h3>{{ author.name }}</h3>
            <small>{{ author.href || `/${locale === 'en' ? '' : 'es/'}author/${author.slug}` }}</small>
            <div class="na-author-card-meta">
              <span class="na-chip">{{ Number(author.postCount || 0).toLocaleString('es') }} notas</span>
              <span class="na-chip" :class="{ on: Boolean(author.linkedUserId) }">
                {{ author.linkedUserId ? 'VMM' : 'Sin VMM' }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <form v-if="selected" class="na-card na-form na-authors-editor" @submit.prevent="save">
      <div class="na-authors-editor-top">
        <div>
          <b>{{ selected.name }}</b>
          <small>{{ selected.href }}</small>
        </div>
        <button class="na-btn" type="button" @click="closeEditor">Cerrar</button>
      </div>

      <div class="na-author-photo-box">
        <img v-if="form.photoUrl" :src="form.photoUrl" :alt="form.name || 'Foto'" />
        <span v-else class="ph">{{ (form.name || 'A').slice(0, 1) }}</span>
        <div class="na-author-photo-actions">
          <button class="na-btn solid" type="button" :disabled="uploadingPhoto" @click="photoInput?.click()">
            {{ uploadingPhoto ? 'Subiendo…' : form.photoUrl ? 'Cambiar foto' : 'Elegir foto' }}
          </button>
          <button v-if="form.photoUrl" class="na-btn" type="button" @click="form.photoUrl = ''">Quitar</button>
        </div>
        <input
          ref="photoInput"
          class="na-hidden-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          @change="onPhotoPick"
        />
      </div>

      <label class="na-field">
        <span>Nombre público</span>
        <input v-model="form.name" type="text" maxlength="250" />
      </label>
      <label class="na-field">
        <span>Bio</span>
        <textarea v-model="form.bio" rows="4" maxlength="2000"></textarea>
      </label>
      <label class="na-field">
        <span>Web</span>
        <input v-model="form.website" type="url" maxlength="300" placeholder="https://" />
      </label>

      <div class="na-field">
        <span>Cuenta Vote Music Mundial</span>
        <div v-if="form.linkedUserId" class="na-author-chip na-vmm-linked">
          <img v-if="linkedAccount?.photoUrl" :src="linkedAccount.photoUrl" alt="" />
          <span v-else class="ph">V</span>
          <div>
            <b>{{ accountLabel(linkedAccount) }}</b>
            <small>{{ linkedAccount?.email || `ID ${form.linkedUserId}` }}</small>
          </div>
        </div>
        <p v-else class="na-help">Sin vincular. Abre el buscador para elegir una cuenta VMM.</p>
        <div class="na-author-photo-actions">
          <button class="na-btn solid" type="button" @click="openVmmModal">
            {{ form.linkedUserId ? 'Cambiar cuenta VMM' : 'Buscar cuenta VMM' }}
          </button>
          <button v-if="form.linkedUserId" class="na-btn" type="button" @click="unlinkAccount">Quitar vínculo</button>
        </div>
      </div>

      <div class="na-actions">
        <button class="na-btn solid" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        <a v-if="selected.href" class="na-btn" :href="selected.href" target="_blank">Ver perfil</a>
      </div>
      <p v-if="notice" class="na-count">{{ notice }}</p>
      <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    </form>

    <div v-if="vmmModalOpen" class="na-modal" @click.self="closeVmmModal">
      <div class="na-modal-card na-vmm-modal" role="dialog" aria-modal="true" aria-labelledby="na-vmm-title">
        <div class="na-modal-head">
          <h2 id="na-vmm-title">Buscar cuenta VMM</h2>
          <button class="na-modal-close" type="button" aria-label="Cerrar" @click="closeVmmModal">×</button>
        </div>
        <p class="na-help">Escribe nombre, usuario o correo de una cuenta Vote Music Mundial.</p>
        <input
          v-model="userQuery"
          class="na-search"
          type="search"
          placeholder="Buscar cuenta…"
          autocomplete="off"
          autofocus
        />
        <p v-if="searchingUsers" class="na-help">Buscando…</p>
        <p v-else-if="userQuery.trim().length >= 2 && !userHits.length" class="na-empty">Sin resultados.</p>
        <div v-else-if="userHits.length" class="na-vmm-hits">
          <button v-for="hit in userHits" :key="hit.id" type="button" @click="linkAccount(hit)">
            <img v-if="hit.photoUrl" :src="hit.photoUrl" alt="" />
            <span v-else class="ph">{{ accountLabel(hit).slice(0, 1) }}</span>
            <span>
              <b>{{ accountLabel(hit) }}</b>
              <small>{{ hit.email || (hit.username ? `@${hit.username}` : `ID ${hit.id}`) }}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
