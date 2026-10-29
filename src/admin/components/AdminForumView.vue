<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  createAdminForumCategory,
  getAdminForumCategories,
  getAdminForumTopics,
  updateAdminForumCategory,
  updateAdminForumTopic,
} from '../../services/api/adminApi'

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

const emptyForm = () => ({
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
})

const tab = ref('rooms')
const categories = ref([])
const topics = ref([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const categoryFilter = ref('')
const status = ref('all')
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
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

const loadRooms = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminForumCategories()
    categories.value = payload.items || []
  } catch {
    errorMessage.value = 'No se pudieron cargar las salas.'
    categories.value = []
  } finally {
    isLoading.value = false
  }
}

const loadTopics = async () => {
  isLoading.value = true
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
    errorMessage.value = 'No se pudieron cargar los temas.'
    topics.value = []
    total.value = 0
  } finally {
    isLoading.value = false
  }
}

const load = () => (tab.value === 'rooms' ? loadRooms() : loadTopics())

const lockPage = (lock) => {
  document.body.style.overflow = lock ? 'hidden' : ''
}

const closeForm = () => {
  formOpen.value = false
  formError.value = ''
  editingSlug.value = ''
  form.value = emptyForm()
  lockPage(false)
}

const openCreate = (parentSlug = '') => {
  editingSlug.value = ''
  form.value = emptyForm()
  form.value.parentSlug = parentSlug
  form.value.sortOrder = (categories.value.at(-1)?.sortOrder || 0) + 1
  formError.value = ''
  formOpen.value = true
  lockPage(true)
}

const editRoom = (row) => {
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

const onEscape = (event) => {
  if (event.key === 'Escape' && formOpen.value && !isSaving.value) closeForm()
}

const saveRoom = async () => {
  if (form.value.nameEs.trim().length < 2 || form.value.nameEn.trim().length < 2) {
    formError.value = 'Pon nombre en español y en inglés.'
    return
  }
  isSaving.value = true
  formError.value = ''
  errorMessage.value = ''
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
      successMessage.value = 'Sala actualizada.'
    } else {
      await createAdminForumCategory({ ...body, slug: form.value.slug.trim() || undefined })
      successMessage.value = 'Sala creada.'
    }
    closeForm()
    await loadRooms()
  } catch (err) {
    formError.value = err?.message || 'No se pudo guardar la sala.'
  } finally {
    isSaving.value = false
  }
}

const toggleRoom = async (row, field) => {
  try {
    await updateAdminForumCategory(row.slug, { [field]: !row[field] })
    await loadRooms()
  } catch (err) {
    errorMessage.value = err?.message || 'No se pudo actualizar la sala.'
  }
}

const patchTopic = async (row, body) => {
  try {
    await updateAdminForumTopic(row.id, body)
    await loadTopics()
  } catch (err) {
    errorMessage.value = err?.message || 'No se pudo actualizar el tema.'
  }
}

const setTab = async (next) => {
  if (tab.value === next) return
  tab.value = next
  page.value = 1
  if (next === 'topics' && !categories.value.length) await loadRooms()
  await load()
}

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
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">Community Forum</p>
          <h2 class="mt-2 text-2xl font-black text-white sm:text-3xl">Foro</h2>
          <p class="mt-2 text-sm text-slate-400">Salas, subcategorías, textos ES/EN, VIP y temas (fijar, cerrar u ocultar).</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-full px-4 py-2 text-sm font-black" :class="tab === 'rooms' ? 'bg-fuchsia-400/20 text-white' : 'bg-white/5 text-slate-300'" @click="setTab('rooms')">Salas</button>
          <button type="button" class="rounded-full px-4 py-2 text-sm font-black" :class="tab === 'topics' ? 'bg-fuchsia-400/20 text-white' : 'bg-white/5 text-slate-300'" @click="setTab('topics')">Temas</button>
          <a href="/forum" class="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 text-sm font-black text-slate-200" target="_blank" rel="noreferrer">Ver foro</a>
          <button v-if="tab === 'rooms'" type="button" class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-black text-white" @click="openCreate()">Nueva sala</button>
        </div>
      </div>

      <p v-if="successMessage" class="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">{{ successMessage }}</p>
      <p v-if="errorMessage" class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{{ errorMessage }}</p>

      <div v-if="tab === 'topics'" class="mt-6 flex flex-col gap-3 sm:flex-row">
        <input v-model="q" class="min-h-11 flex-1 rounded-full border border-white/10 bg-slate-950/60 px-4 text-sm text-white" placeholder="Buscar título o autor" @keydown.enter.prevent="page = 1; loadTopics()" />
        <select v-model="categoryFilter" class="min-h-11 rounded-full border border-white/10 bg-slate-950 px-4 text-sm text-white" @change="page = 1; loadTopics()">
          <option value="">Todas las salas</option>
          <template v-for="row in roomTree" :key="row.slug">
            <option :value="row.slug">{{ row.nameEs }}</option>
            <option v-for="child in row.children" :key="child.slug" :value="child.slug">— {{ child.nameEs }}</option>
          </template>
        </select>
        <select v-model="status" class="min-h-11 rounded-full border border-white/10 bg-slate-950 px-4 text-sm text-white" @change="page = 1; loadTopics()">
          <option value="all">Todos</option>
          <option value="active">Visibles</option>
          <option value="pinned">Fijados</option>
          <option value="closed">Cerrados</option>
          <option value="hidden">Ocultos</option>
        </select>
        <button type="button" class="rounded-full border border-white/10 px-4 text-sm font-black text-slate-200" @click="page = 1; loadTopics()">Buscar</button>
      </div>

      <div v-if="isLoading" class="mt-6 text-sm font-bold text-slate-300">Cargando…</div>
      <div v-else-if="tab === 'rooms'" class="mt-6 overflow-hidden rounded-3xl border border-white/10">
        <template v-for="row in roomTree" :key="row.slug">
          <article class="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <p class="font-black text-white">{{ row.nameEs }} <span class="text-slate-500">/ {{ row.nameEn }}</span></p>
              <p class="text-sm text-slate-400">{{ row.slug }} · {{ row.topicCount }} temas · {{ row.blurbEs || 'Sin descripción' }}</p>
            </div>
            <span v-if="row.children.length" class="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">{{ row.children.length }} sub</span>
            <span v-if="row.isVip" class="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-200">FAN</span>
            <span v-if="!row.isActive" class="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">Oculta</span>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-full bg-fuchsia-400/20 px-3 py-1.5 text-xs font-black text-white" @click="openCreate(row.slug)">Subcategoría</button>
              <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="editRoom(row)">Editar</button>
              <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="toggleRoom(row, 'isVip')">{{ row.isVip ? 'Quitar FAN' : 'Solo FAN' }}</button>
              <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="toggleRoom(row, 'isActive')">{{ row.isActive ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
          </article>
          <article v-for="child in row.children" :key="child.slug" class="flex flex-col gap-3 border-b border-white/10 bg-white/3 p-4 pl-8 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <p class="font-black text-white">{{ child.nameEs }} <span class="text-slate-500">/ {{ child.nameEn }}</span></p>
              <p class="text-sm text-slate-400">{{ child.slug }} · {{ child.topicCount }} temas · {{ child.blurbEs || 'Sin descripción' }}</p>
            </div>
            <span v-if="child.isVip" class="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-200">FAN</span>
            <span v-if="!child.isActive" class="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">Oculta</span>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="editRoom(child)">Editar</button>
              <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="toggleRoom(child, 'isVip')">{{ child.isVip ? 'Quitar FAN' : 'Solo FAN' }}</button>
              <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="toggleRoom(child, 'isActive')">{{ child.isActive ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
          </article>
        </template>
      </div>
      <div v-else class="mt-6 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10">
        <article v-for="row in topics" :key="row.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <p class="font-black text-white">{{ row.title }}</p>
            <p class="text-sm text-slate-400">{{ row.category.name }} · {{ row.author.displayName }} · {{ row.replyCount }} resp. · {{ row.viewCount }} vistas</p>
          </div>
          <span v-if="row.pinned" class="rounded-full bg-fuchsia-400/15 px-3 py-1 text-xs font-black text-fuchsia-200">Fijado</span>
          <span v-if="row.closed" class="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">Cerrado</span>
          <span v-if="row.hidden" class="rounded-full bg-red-400/15 px-3 py-1 text-xs font-black text-red-200">Oculto</span>
          <div class="flex flex-wrap gap-2">
            <a :href="row.href" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" target="_blank" rel="noreferrer">Ver</a>
            <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="patchTopic(row, { pinned: !row.pinned })">{{ row.pinned ? 'Desfijar' : 'Fijar' }}</button>
            <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="patchTopic(row, { closed: !row.closed })">{{ row.closed ? 'Abrir' : 'Cerrar' }}</button>
            <button type="button" class="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200" @click="patchTopic(row, { hidden: !row.hidden })">{{ row.hidden ? 'Restaurar' : 'Ocultar' }}</button>
          </div>
        </article>
        <p v-if="!topics.length" class="p-4 text-sm font-bold text-slate-400">Todavía no hay temas.</p>
      </div>
      <div v-if="tab === 'topics' && pages > 1" class="mt-4 flex items-center justify-center gap-3 text-sm font-black text-slate-200">
        <button type="button" :disabled="page <= 1" @click="page -= 1; loadTopics()">Anterior</button>
        <span>{{ page }} / {{ pages }}</span>
        <button type="button" :disabled="page >= pages" @click="page += 1; loadTopics()">Siguiente</button>
      </div>
    </article>

    <Teleport to="body">
      <div v-if="formOpen" class="fixed inset-0 z-80 grid place-items-center bg-black/70 px-4 py-6 text-white backdrop-blur-md" @click.self="closeForm">
        <form class="w-full max-w-xl max-h-[86vh] overflow-auto rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl" role="dialog" aria-modal="true" :aria-label="formTitle" @submit.prevent="saveRoom">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-xl font-black">{{ formTitle }}</h3>
            <button type="button" class="grid size-10 place-items-center rounded-full bg-white/10 text-xl" aria-label="Cerrar" @click="closeForm">×</button>
          </div>
          <p v-if="formError" class="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{{ formError }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Nombre ES<input v-model="form.nameEs" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white" maxlength="48" required /></label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Nombre EN<input v-model="form.nameEn" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white" maxlength="48" required /></label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400 sm:col-span-2">Dentro de
              <select v-model="form.parentSlug" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white">
                <option value="">Sala principal</option>
                <option v-for="row in rootRooms" :key="row.slug" :value="row.slug" :disabled="row.slug === editingSlug">{{ row.nameEs }}</option>
              </select>
            </label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Slug<input v-model="form.slug" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white" maxlength="48" :disabled="Boolean(editingSlug)" placeholder="kpop" /></label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Icono
              <select v-model="form.icon" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white">
                <option v-for="icon in ICONS" :key="icon.value" :value="icon.value">{{ icon.label }}</option>
              </select>
            </label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Texto ES<input v-model="form.blurbEs" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white" maxlength="240" /></label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Texto EN<input v-model="form.blurbEn" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white" maxlength="240" /></label>
            <label class="text-xs font-black uppercase tracking-wide text-slate-400">Orden<input v-model.number="form.sortOrder" class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white" type="number" min="0" max="999" /></label>
            <div class="flex flex-wrap items-center gap-4 text-sm font-black text-slate-200">
              <label class="inline-flex items-center gap-2"><input v-model="form.isVip" type="checkbox" /> Solo FAN</label>
              <label class="inline-flex items-center gap-2"><input v-model="form.isActive" type="checkbox" /> Visible</label>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-200" @click="closeForm">Cancelar</button>
            <button type="submit" class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-black text-white" :disabled="isSaving">{{ isSaving ? 'Guardando…' : 'Guardar sala' }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>
