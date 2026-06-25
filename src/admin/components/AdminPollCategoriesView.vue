<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'

const props = defineProps({
  showForm: {
    type: Boolean,
    default: false,
  },
})

const currentYear = new Date().getFullYear()
const iconOptions = [
  { label: 'Estrella', value: 'fa-solid fa-star' },
  { label: 'Corona', value: 'fa-solid fa-crown' },
  { label: 'Trofeo', value: 'fa-solid fa-trophy' },
  { label: 'Micrófono', value: 'fa-solid fa-microphone-lines' },
  { label: 'Corazón', value: 'fa-solid fa-heart' },
  { label: 'Fuego', value: 'fa-solid fa-fire' },
  { label: 'Rayo', value: 'fa-solid fa-bolt' },
  { label: 'Música', value: 'fa-solid fa-music' },
  { label: 'Medalla', value: 'fa-solid fa-medal' },
]
const visualOptions = [
  {
    label: 'Violeta / Fuchsia',
    value: 'from-violet-950 via-fuchsia-700 to-indigo-950',
  },
  {
    label: 'Slate / Violeta',
    value: 'from-slate-800 via-violet-700 to-slate-950',
  },
  {
    label: 'Fuchsia / Pink',
    value: 'from-fuchsia-900 via-pink-700 to-slate-950',
  },
  {
    label: 'Indigo / Purple',
    value: 'from-indigo-950 via-purple-700 to-fuchsia-900',
  },
  {
    label: 'Emerald / Cyan',
    value: 'from-emerald-950 via-cyan-700 to-slate-950',
  },
  {
    label: 'Amber / Rose',
    value: 'from-amber-900 via-rose-700 to-fuchsia-950',
  },
]
const categories = ref([])
const categoryForm = ref({
  name: '',
  year: currentYear,
  icon: iconOptions[0].value,
  visual: visualOptions[0].value,
})
const editingCategoryId = ref('')
const isFormOpen = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribeCategories = null

const formTitle = computed(() => editingCategoryId.value ? 'Editar categoría' : 'Crear categoría')
const shouldShowForm = computed(() => props.showForm || isFormOpen.value || Boolean(editingCategoryId.value))
const isFontAwesomeIcon = (icon) => String(icon || '').startsWith('fa-')

const resetForm = () => {
  categoryForm.value = {
    name: '',
    year: currentYear,
    icon: iconOptions[0].value,
    visual: visualOptions[0].value,
  }
  editingCategoryId.value = ''
  isFormOpen.value = false
}

const openCreateForm = () => {
  resetForm()
  isFormOpen.value = true
  errorMessage.value = ''
  successMessage.value = ''
}

const editCategory = (category) => {
  categoryForm.value = {
    name: category.name || '',
    year: Number(category.year || currentYear),
    icon: category.icon || iconOptions[0].value,
    visual: category.visual || visualOptions[0].value,
  }
  editingCategoryId.value = category.id
  isFormOpen.value = true
  errorMessage.value = ''
  successMessage.value = ''
}

const saveCategory = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!categoryForm.value.name.trim()) {
    errorMessage.value = 'Escribe el nombre de la categoría.'
    return
  }

  const year = Number(categoryForm.value.year || currentYear)

  if (!year || year < 2000) {
    errorMessage.value = 'Indica un año válido.'
    return
  }

  isSaving.value = true

  try {
    const categoryData = {
      name: categoryForm.value.name.trim(),
      year,
      icon: categoryForm.value.icon || iconOptions[0].value,
      visual: categoryForm.value.visual || visualOptions[0].value,
      updatedAt: serverTimestamp(),
    }

    if (editingCategoryId.value) {
      await updateDoc(doc(db, 'pollCategories', editingCategoryId.value), categoryData)
      successMessage.value = 'Categoría actualizada.'
    } else {
      await addDoc(collection(db, 'pollCategories'), {
        ...categoryData,
        createdAt: serverTimestamp(),
      })
      successMessage.value = 'Categoría creada.'
    }

    resetForm()

    if (props.showForm) {
      window.location.href = '/admin/categorias'
    }
  } catch {
    errorMessage.value = 'No se pudo guardar la categoría.'
  } finally {
    isSaving.value = false
  }
}

const removeCategory = async (category) => {
  const confirmed = window.confirm(`Eliminar la categoría "${category.name}"?`)

  if (!confirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteDoc(doc(db, 'pollCategories', category.id))
    successMessage.value = 'Categoría eliminada.'

    if (editingCategoryId.value === category.id) {
      resetForm()
    }
  } catch {
    errorMessage.value = 'No se pudo eliminar la categoría.'
  }
}

onMounted(() => {
  unsubscribeCategories = onSnapshot(
    collection(db, 'pollCategories'),
    (categoriesSnap) => {
      categories.value = categoriesSnap.docs.map((categoryDoc) => ({
        id: categoryDoc.id,
        ...categoryDoc.data(),
      })).sort((current, next) =>
        Number(next.year || 0) - Number(current.year || 0)
          || String(current.name || '').localeCompare(String(next.name || '')),
      )
    },
  )
})

onUnmounted(() => {
  unsubscribeCategories?.()
})
</script>

<template>
  <section class="grid gap-6">
    <article
      v-if="shouldShowForm"
      class="fixed inset-0 z-80 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
    >
      <div
        class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/30 sm:p-6"
        @click.stop
        @mousedown.stop
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Categorías
            </p>
            <h2 class="mt-2 text-3xl font-black text-white">
              {{ formTitle }}
            </h2>
          </div>
          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-xl font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
            @click="resetForm"
          >
            ×
          </button>
        </div>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          Crea categorías por año. Luego al crear una votación seleccionas una categoría.
        </p>

        <a
          v-if="props.showForm"
          href="/admin/categorias"
          class="mt-4 inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black text-slate-200 transition hover:bg-white/10"
        >
          Volver a categorías
        </a>

        <form class="mt-5 space-y-4" @submit.stop.prevent="saveCategory">
        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Nombre</span>
          <input
            v-model="categoryForm.name"
            type="text"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
            placeholder="VOCALIST OF THE YEAR"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Año</span>
          <input
            v-model.number="categoryForm.year"
            type="number"
            min="2000"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
            :placeholder="String(currentYear)"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Icono</span>
          <select
            v-model="categoryForm.icon"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#111327] px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
          >
            <option
              v-for="option in iconOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Fondo</span>
          <select
            v-model="categoryForm.visual"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#111327] px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
          >
            <option
              v-for="option in visualOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <div
          class="overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br p-5"
          :class="categoryForm.visual"
        >
          <div class="grid min-h-28 place-items-center rounded-3xl border border-white/15 bg-black/25 backdrop-blur">
            <i
              v-if="isFontAwesomeIcon(categoryForm.icon)"
              class="text-5xl text-white"
              :class="categoryForm.icon"
              aria-hidden="true"
            ></i>
            <span v-else class="text-5xl">{{ categoryForm.icon }}</span>
          </div>
        </div>

        <p
          v-if="errorMessage"
          class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
        >
          {{ errorMessage }}
        </p>
        <p
          v-if="successMessage"
          class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
        >
          {{ successMessage }}
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Guardando...' : editingCategoryId ? 'Actualizar' : 'Crear' }}
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
            @click="resetForm"
          >
            {{ editingCategoryId ? 'Cancelar edición' : 'Cerrar' }}
          </button>
        </div>
        </form>
      </div>
    </article>

    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
            Salón de la fama
          </p>
          <h3 class="mt-2 text-2xl font-black text-white">Categorías por año</h3>
        </div>
        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="inline-flex min-h-10 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01]"
            @click="openCreateForm"
          >
            Crear categoría
          </button>
          <span class="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-widest text-slate-300">
            {{ categories.length }} categorías
          </span>
        </div>
      </div>

      <div class="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45">
        <table class="min-w-full text-left">
          <thead class="bg-white/5 text-xs font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th class="px-4 py-4">Categoría</th>
              <th class="px-4 py-4">Visual</th>
              <th class="px-4 py-4">Año</th>
              <th class="px-4 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            <tr
              v-for="category in categories"
              :key="category.id"
              class="text-sm text-slate-300 transition hover:bg-white/3"
            >
              <td class="px-4 py-4">
                <p class="font-black text-white">{{ category.name }}</p>
              </td>
              <td class="px-4 py-4">
                <span
                  class="inline-grid size-11 place-items-center rounded-2xl bg-linear-to-br text-lg"
                  :class="category.visual || visualOptions[0].value"
                >
                  <i
                    v-if="isFontAwesomeIcon(category.icon || iconOptions[0].value)"
                    :class="category.icon || iconOptions[0].value"
                    aria-hidden="true"
                  ></i>
                  <span v-else>{{ category.icon || '✦' }}</span>
                </span>
              </td>
              <td class="px-4 py-4">{{ category.year }}</td>
              <td class="px-4 py-4">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
                    @click="editCategory(category)"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                    @click="removeCategory(category)"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!categories.length">
              <td colspan="4" class="px-4 py-10 text-center text-sm font-bold text-slate-400">
                Todavía no hay categorías.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
