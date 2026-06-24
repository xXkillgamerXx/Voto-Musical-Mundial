<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'

const polls = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribePolls = null

const formatDate = (value) => {
  const date = value?.toDate?.()

  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const loadPolls = () => {
  isLoading.value = true
  errorMessage.value = ''

  const pollsQuery = query(collection(db, 'polls'), orderBy('createdAt', 'desc'))

  unsubscribePolls = onSnapshot(
    pollsQuery,
    (pollsSnap) => {
      polls.value = pollsSnap.docs.map((pollDoc) => ({
        id: pollDoc.id,
        ...pollDoc.data(),
      }))
      isLoading.value = false
    },
    () => {
      errorMessage.value = 'No se pudieron cargar las votaciones.'
      isLoading.value = false
    },
  )
}

const removePoll = async (poll) => {
  const shouldDelete = window.confirm(`Eliminar la votacion "${poll.title}"?`)

  if (!shouldDelete) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteDoc(doc(db, 'polls', poll.id))
    successMessage.value = 'Votacion eliminada.'
  } catch {
    errorMessage.value = 'No se pudo eliminar la votacion.'
  }
}

onMounted(loadPolls)

onUnmounted(() => {
  unsubscribePolls?.()
})
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Tiempo real
          </p>
          <h2 class="mt-2 text-3xl font-black text-white">
            Lista de votaciones
          </h2>
          <p class="mt-2 text-sm text-slate-400">
            Esta tabla escucha Firestore en vivo y se actualiza automaticamente.
          </p>
        </div>

        <a
          href="/admin/votaciones/crear"
          class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
        >
          <i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>
          Crear votacion
        </a>
      </div>

      <p
        v-if="successMessage"
        class="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="errorMessage"
        class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>

      <div
        v-if="isLoading"
        class="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300"
      >
        Cargando votaciones...
      </div>

      <div v-else class="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-white/5 text-xs font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th class="px-4 py-4">Banner</th>
                <th class="px-4 py-4">Titulo</th>
                <th class="px-4 py-4">Inicio</th>
                <th class="px-4 py-4">Finaliza</th>
                <th class="px-4 py-4">Estado</th>
                <th class="px-4 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/10">
              <tr
                v-for="poll in polls"
                :key="poll.id"
                class="text-sm text-slate-300 transition hover:bg-white/3"
              >
                <td class="px-4 py-4">
                  <span class="grid h-14 w-24 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white">
                    <img
                      v-if="poll.banner"
                      :src="poll.banner"
                      :alt="poll.title"
                      class="size-full object-cover"
                    />
                    <i v-else class="fa-solid fa-image" aria-hidden="true"></i>
                  </span>
                </td>
                <td class="max-w-80 px-4 py-4">
                  <p class="truncate font-black text-white">{{ poll.title }}</p>
                  <p class="mt-1 line-clamp-1 text-xs text-slate-500">
                    {{ poll.description || 'Sin descripcion' }}
                  </p>
                </td>
                <td class="px-4 py-4">{{ formatDate(poll.startAt) }}</td>
                <td class="px-4 py-4">{{ formatDate(poll.endAt) }}</td>
                <td class="px-4 py-4">
                  <span class="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                    {{ poll.status || 'draft' }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex flex-wrap justify-end gap-2">
                    <a
                      :href="`/admin/votaciones/${poll.id}`"
                      class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                    >
                      Gestionar
                    </a>
                    <a
                      :href="`/admin/votaciones/editar/${poll.id}`"
                      class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Editar
                    </a>
                    <button
                      type="button"
                      class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                      @click="removePoll(poll)"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!polls.length">
                <td colspan="6" class="px-4 py-10 text-center">
                  <p class="text-lg font-black text-white">Todavia no hay votaciones.</p>
                  <p class="mt-2 text-sm text-slate-400">
                    Crea la primera votacion para lanzarla en vivo.
                  </p>
                  <a
                    href="/admin/votaciones/crear"
                    class="mt-5 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white"
                  >
                    Crear votacion
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
