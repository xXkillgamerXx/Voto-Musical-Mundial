<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  createAdminForumCategory,
  getAdminForumCategories,
  getAdminForumTopics,
  updateAdminForumCategory,
  updateAdminForumTopic,
} from '../../../src/services/api/adminApi'

type Category = {
  slug: string
  nameEs: string
  nameEn: string
  blurbEs: string
  blurbEn: string
  icon: string
  sortOrder: number
  isVip: boolean
  isActive: boolean
  parentSlug?: string | null
  topicCount: number
}

type Topic = {
  id: string
  title: string
  href: string
  replyCount: number
  viewCount: number
  lastPostAt: string
  pinned?: boolean
  closed?: boolean
  hidden?: boolean
  category: { slug: string; name: string }
  author: { displayName: string; username?: string | null }
}

const ICONS = [
  { value: 'note', label: 'Nota' },
  { value: 'music', label: 'Música' },
  { value: 'artist', label: 'Artista' },
  { value: 'mic', label: 'Micrófono' },
  { value: 'pop', label: 'Pop' },
  { value: 'news', label: 'Noticias' },
  { value: 'film', label: 'Cine' },
  { value: 'series', label: 'Series' },
  { value: 'live', label: 'En vivo' },
  { value: 'social', label: 'Social' },
]

const props = defineProps<{ createTick?: number }>()
const tab = ref<'rooms' | 'topics'>('rooms')
const categories = ref<Category[]>([])
const topics = ref<Topic[]>([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const categoryFilter = ref('')
const status = ref<'all' | 'active' | 'hidden' | 'closed' | 'pinned'>('all')
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const okMessage = ref('')
const formError = ref('')
const formOpen = ref(false)
const editingSlug = ref('')
const form = ref(emptyForm())

const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const formTitle = computed(() =>
  editingSlug.value ? 'Editar sala' : form.value.parentSlug ? 'Nueva subcategoría' : 'Nueva sala',
)
const rootRooms = computed(() => categories.value.filter((row) => !row.parentSlug))
const roomTree = computed(() =>
  rootRooms.value.map((root) => ({
    ...root,
    children: categories.value.filter((row) => row.parentSlug === root.slug),
  })),
)

function emptyForm() {
  return {
    slug: '',
    nameEs: '',
    nameEn: '',
    blurbEs: '',
    blurbEn: '',
    icon: 'note',
    sortOrder: 1,
    isVip: false,
    isActive: true,
    parentSlug: '',
  }
}

function toast(ok: string, err = '') {
  okMessage.value = ok
  errorMessage.value = err
}

async function loadRooms() {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminForumCategories()
    categories.value = payload.items || []
  } catch {
    toast('', 'No se pudieron cargar las salas.')
    categories.value = []
  } finally {
    loading.value = false
  }
}

async function loadTopics() {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminForumTopics({
      page: page.value,
      q: q.value,
      category: categoryFilter.value,
      status: status.value,
    })
    topics.value = payload.items || []
    total.value = Number(payload.total || 0)
  } catch {
    toast('', 'No se pudieron cargar los temas.')
    topics.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function load() {
  return tab.value === 'rooms' ? loadRooms() : loadTopics()
}

function lockPage(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : ''
}

function closeForm() {
  formOpen.value = false
  formError.value = ''
  editingSlug.value = ''
  form.value = emptyForm()
  lockPage(false)
}

function openCreate(parentSlug = '') {
  editingSlug.value = ''
  form.value = emptyForm()
  form.value.parentSlug = parentSlug
  form.value.sortOrder = (categories.value.at(-1)?.sortOrder || 0) + 1
  formError.value = ''
  formOpen.value = true
  lockPage(true)
}

function editRoom(row: Category) {
  editingSlug.value = row.slug
  form.value = {
    slug: row.slug,
    nameEs: row.nameEs,
    nameEn: row.nameEn,
    blurbEs: row.blurbEs,
    blurbEn: row.blurbEn,
    icon: row.icon || 'note',
    sortOrder: row.sortOrder,
    isVip: row.isVip,
    isActive: row.isActive,
    parentSlug: row.parentSlug || '',
  }
  formError.value = ''
  formOpen.value = true
  lockPage(true)
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && formOpen.value && !saving.value) closeForm()
}

async function saveRoom() {
  if (form.value.nameEs.trim().length < 2 || form.value.nameEn.trim().length < 2) {
    formError.value = 'Pon nombre en español y en inglés.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const body = {
      nameEs: form.value.nameEs.trim(),
      nameEn: form.value.nameEn.trim(),
      blurbEs: form.value.blurbEs.trim(),
      blurbEn: form.value.blurbEn.trim(),
      icon: form.value.icon,
      sortOrder: Number(form.value.sortOrder) || 0,
      isVip: Boolean(form.value.isVip),
      isActive: Boolean(form.value.isActive),
      parentSlug: form.value.parentSlug,
    }
    if (editingSlug.value) {
      await updateAdminForumCategory(editingSlug.value, body)
      toast('Sala actualizada.')
    } else {
      await createAdminForumCategory({ ...body, slug: form.value.slug.trim() || undefined })
      toast('Sala creada.')
    }
    closeForm()
    await loadRooms()
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'No se pudo guardar la sala.'
  } finally {
    saving.value = false
  }
}

async function toggleRoom(row: Category, field: 'isActive' | 'isVip') {
  try {
    await updateAdminForumCategory(row.slug, { [field]: !row[field] })
    await loadRooms()
  } catch (err) {
    toast('', err instanceof Error ? err.message : 'No se pudo actualizar la sala.')
  }
}

async function patchTopic(row: Topic, body: Record<string, boolean>) {
  try {
    await updateAdminForumTopic(row.id, body)
    await loadTopics()
  } catch (err) {
    toast('', err instanceof Error ? err.message : 'No se pudo actualizar el tema.')
  }
}

async function setTab(next: 'rooms' | 'topics') {
  if (tab.value === next) return
  tab.value = next
  page.value = 1
  if (next === 'topics' && !categories.value.length) await loadRooms()
  await load()
}

function searchTopics() {
  page.value = 1
  loadTopics()
}

watch(
  () => props.createTick,
  (tick) => {
    if (tick) openCreate()
  },
)

onMounted(() => {
  window.addEventListener('keydown', onEscape)
  load()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onEscape)
  lockPage(false)
})
</script>

<template>
  <section>
    <div class="na-toolbar">
      <div class="na-ranges" role="tablist" aria-label="Foro">
        <button type="button" :class="{ on: tab === 'rooms' }" @click="setTab('rooms')">Salas</button>
        <button type="button" :class="{ on: tab === 'topics' }" @click="setTab('topics')">Temas</button>
      </div>
      <a class="na-btn" href="/forum" target="_blank">Ver foro</a>
    </div>

    <p v-if="okMessage" class="na-ok">{{ okMessage }}</p>
    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>

    <template v-if="tab === 'rooms'">
      <p class="na-count">{{ rootRooms.length }} salas · {{ categories.length - rootRooms.length }} subcategorías</p>
      <p v-if="loading" class="na-empty">Cargando salas…</p>
      <div v-else class="na-cat-table">
        <template v-for="row in roomTree" :key="row.slug">
          <article class="na-cat-row">
            <div>
              <h3>{{ row.nameEs }} <small>/ {{ row.nameEn }}</small></h3>
              <small>{{ row.slug }} · {{ row.blurbEs || 'Sin descripción' }}</small>
            </div>
            <span class="na-chip">{{ row.topicCount }} temas</span>
            <span v-if="row.children.length" class="na-chip">{{ row.children.length }} sub</span>
            <span v-if="row.isVip" class="na-chip cat">FAN</span>
            <span v-if="!row.isActive" class="na-chip draft">Oculta</span>
            <div class="na-row-actions">
              <button class="na-btn solid" type="button" @click="openCreate(row.slug)">Subcategoría</button>
              <button class="na-btn" type="button" @click="editRoom(row)">Editar</button>
              <button class="na-btn" type="button" @click="toggleRoom(row, 'isVip')">{{ row.isVip ? 'Quitar FAN' : 'Solo FAN' }}</button>
              <button class="na-btn" type="button" @click="toggleRoom(row, 'isActive')">{{ row.isActive ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
          </article>
          <article v-for="child in row.children" :key="child.slug" class="na-cat-row na-cat-child">
            <div class="na-cat-child-label">
              <span class="na-cat-branch" aria-hidden="true"></span>
              <div>
                <h3>{{ child.nameEs }} <small>/ {{ child.nameEn }}</small></h3>
                <small>{{ child.slug }} · {{ child.blurbEs || 'Sin descripción' }}</small>
              </div>
            </div>
            <span class="na-chip">{{ child.topicCount }} temas</span>
            <span v-if="child.isVip" class="na-chip cat">FAN</span>
            <span v-if="!child.isActive" class="na-chip draft">Oculta</span>
            <div class="na-row-actions">
              <button class="na-btn" type="button" @click="editRoom(child)">Editar</button>
              <button class="na-btn" type="button" @click="toggleRoom(child, 'isVip')">{{ child.isVip ? 'Quitar FAN' : 'Solo FAN' }}</button>
              <button class="na-btn" type="button" @click="toggleRoom(child, 'isActive')">{{ child.isActive ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
          </article>
        </template>
      </div>
    </template>

    <template v-else>
      <div class="na-toolbar">
        <input
          v-model="q"
          class="na-search"
          type="search"
          placeholder="Buscar título o autor"
          @keydown.enter.prevent="searchTopics"
        />
        <select class="na-select" v-model="categoryFilter" @change="searchTopics">
          <option value="">Todas las salas</option>
          <template v-for="row in roomTree" :key="row.slug">
            <option :value="row.slug">{{ row.nameEs }}</option>
            <option v-for="child in row.children" :key="child.slug" :value="child.slug">— {{ child.nameEs }}</option>
          </template>
        </select>
        <select class="na-select" v-model="status" @change="searchTopics">
          <option value="all">Todos</option>
          <option value="active">Visibles</option>
          <option value="pinned">Fijados</option>
          <option value="closed">Cerrados</option>
          <option value="hidden">Ocultos</option>
        </select>
        <button class="na-btn solid" type="button" @click="searchTopics">Buscar</button>
      </div>
      <p class="na-count">{{ total.toLocaleString('es') }} temas</p>
      <p v-if="loading" class="na-empty">Cargando temas…</p>
      <div v-else class="na-cat-table">
        <article v-for="row in topics" :key="row.id" class="na-cat-row">
          <div>
            <h3>{{ row.title }}</h3>
            <small>{{ row.category.name }} · {{ row.author.displayName }} · {{ row.replyCount }} resp. · {{ row.viewCount }} vistas</small>
          </div>
          <span v-if="row.pinned" class="na-chip cat">Fijado</span>
          <span v-if="row.closed" class="na-chip draft">Cerrado</span>
          <span v-if="row.hidden" class="na-chip draft">Oculto</span>
          <div class="na-row-actions">
            <a class="na-btn" :href="row.href" target="_blank">Ver</a>
            <button class="na-btn" type="button" @click="patchTopic(row, { pinned: !row.pinned })">{{ row.pinned ? 'Desfijar' : 'Fijar' }}</button>
            <button class="na-btn" type="button" @click="patchTopic(row, { closed: !row.closed })">{{ row.closed ? 'Abrir' : 'Cerrar' }}</button>
            <button class="na-btn" type="button" @click="patchTopic(row, { hidden: !row.hidden })">{{ row.hidden ? 'Restaurar' : 'Ocultar' }}</button>
          </div>
        </article>
        <p v-if="!topics.length" class="na-empty" style="margin: 16px">Todavía no hay temas.</p>
      </div>
      <div v-if="pages > 1" class="na-pager">
        <button type="button" :disabled="page <= 1" @click="page -= 1; loadTopics()">Anterior</button>
        <span>{{ page }} / {{ pages }}</span>
        <button type="button" :disabled="page >= pages" @click="page += 1; loadTopics()">Siguiente</button>
      </div>
    </template>

    <Teleport to="body">
      <div v-if="formOpen" class="na-modal" @click.self="closeForm">
        <form class="na-modal-card na-form" role="dialog" aria-modal="true" :aria-label="formTitle" @submit.prevent="saveRoom">
          <div class="na-modal-head">
            <h2>{{ formTitle }}</h2>
            <button class="na-modal-close" type="button" aria-label="Cerrar" @click="closeForm">×</button>
          </div>
          <p v-if="formError" class="na-error">{{ formError }}</p>
          <div class="na-forum-fields">
            <label>
              Nombre ES
              <input v-model="form.nameEs" maxlength="48" required />
            </label>
            <label>
              Nombre EN
              <input v-model="form.nameEn" maxlength="48" required />
            </label>
            <label>
              Dentro de
              <select v-model="form.parentSlug">
                <option value="">Sala principal</option>
                <option v-for="row in rootRooms" :key="row.slug" :value="row.slug" :disabled="row.slug === editingSlug">{{ row.nameEs }}</option>
              </select>
            </label>
            <label>
              Slug
              <input v-model="form.slug" maxlength="48" :disabled="Boolean(editingSlug)" placeholder="kpop" />
            </label>
            <label>
              Icono
              <select v-model="form.icon">
                <option v-for="icon in ICONS" :key="icon.value" :value="icon.value">{{ icon.label }}</option>
              </select>
            </label>
            <label>
              Texto ES
              <input v-model="form.blurbEs" maxlength="240" />
            </label>
            <label>
              Texto EN
              <input v-model="form.blurbEn" maxlength="240" />
            </label>
            <label>
              Orden
              <input v-model.number="form.sortOrder" type="number" min="0" max="999" />
            </label>
            <label class="na-check">
              <input v-model="form.isVip" type="checkbox" />
              Solo FAN
            </label>
            <label class="na-check">
              <input v-model="form.isActive" type="checkbox" />
              Visible
            </label>
          </div>
          <div class="na-form-actions">
            <button class="na-btn" type="button" @click="closeForm">Cancelar</button>
            <button class="na-btn solid" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar sala' }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>
