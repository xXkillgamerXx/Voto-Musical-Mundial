<script setup>
import { onMounted, ref } from 'vue'
import { translate } from '../../i18n'
import { deleteAdminPoll, getAdminPolls } from '../../services/api/adminApi'

const polls = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const pollToDelete = ref(null)
const isDeleting = ref(false)

const formatShortDate = (value) => {
  const date = value?.toDate?.() || (typeof value === 'string' ? new Date(value) : null)

  if (!date) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'short',
  }).format(date)
}

const pollRoundsCount = (poll) => (poll.rounds || []).length
const pollContestantsCount = (poll) => (poll.contestants || []).length
const pollLiveRound = (poll) =>
  (poll.rounds || []).find((round) => round.status === 'live') ||
  (poll.rounds || []).find((round) => String(round.id) === String(poll.activeRoundId || poll.config?.activeRoundId || '')) ||
  null
const statusLabel = (status) => ({
  live: 'En vivo',
  draft: 'Borrador',
  closed: 'Cerrada',
  selecting_winners: 'Eligiendo ganadores',
})[status || 'draft'] || status || 'Borrador'

const loadPolls = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    polls.value = await getAdminPolls(100)
  } catch {
    errorMessage.value = translate('admin.polls.errors.load')
  } finally {
    isLoading.value = false
  }
}

const openDeleteModal = (poll) => {
  pollToDelete.value = poll
  errorMessage.value = ''
  successMessage.value = ''
}

const closeDeleteModal = () => {
  if (isDeleting.value) {
    return
  }

  pollToDelete.value = null
}

const confirmDeletePoll = async () => {
  if (!pollToDelete.value) {
    return
  }

  const pollId = pollToDelete.value.id
  errorMessage.value = ''
  successMessage.value = ''
  isDeleting.value = true

  try {
    await deleteAdminPoll(pollId)
    successMessage.value = translate('admin.polls.deleted')
    pollToDelete.value = null
    await loadPolls()
  } catch {
    errorMessage.value = translate('admin.polls.errors.delete')
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadPolls)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            {{ $t('admin.polls.eyebrow') }}
          </p>
          <h2 class="mt-2 text-3xl font-black text-white">
            {{ $t('admin.polls.listTitle') }}
          </h2>
          <p class="mt-2 text-sm text-slate-400">
            {{ $t('admin.polls.listDescription') }}
          </p>
        </div>

        <a
          href="/admin/votaciones/crear"
          class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
        >
          <i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>
          {{ $t('admin.polls.create') }}
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
        {{ $t('admin.polls.loading') }}
      </div>

      <div v-else class="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-white/5 text-xs font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th class="px-4 py-4">{{ $t('admin.polls.banner') }}</th>
                <th class="px-4 py-4">{{ $t('admin.polls.title') }}</th>
                <th class="px-4 py-4">Datos</th>
                <th class="px-4 py-4">{{ $t('admin.polls.status') }}</th>
                <th class="px-4 py-4 text-right">{{ $t('admin.polls.actions') }}</th>
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
                    {{ poll.description || $t('admin.polls.noDescription') }}
                  </p>
                </td>
                <td class="px-4 py-4">
                  <div class="flex flex-wrap gap-2">
                    <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-100">
                      {{ pollRoundsCount(poll) }} rondas
                    </span>
                    <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-100">
                      {{ pollContestantsCount(poll) }} participantes
                    </span>
                  </div>
                  <p
                    v-if="pollLiveRound(poll)"
                    class="mt-2 text-xs font-bold text-emerald-200"
                  >
                    En vivo: {{ pollLiveRound(poll).title || 'Ronda actual' }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    Actualizada: {{ formatShortDate(poll.updatedAt || poll.createdAt) }}
                  </p>
                </td>
                <td class="px-4 py-4">
                  <span class="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                    {{ statusLabel(poll.status) }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex flex-wrap justify-end gap-2">
                    <a
                      :href="`/admin/votaciones/${poll.id}`"
                      class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                    >
                      {{ $t('admin.polls.manage') }}
                    </a>
                    <a
                      :href="`/admin/votaciones/editar/${poll.id}`"
                      class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      {{ $t('admin.common.edit') }}
                    </a>
                    <button
                      type="button"
                      class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                      @click="openDeleteModal(poll)"
                    >
                      {{ $t('admin.common.delete') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!polls.length">
                <td colspan="5" class="px-4 py-10 text-center">
                  <p class="text-lg font-black text-white">{{ $t('admin.polls.empty') }}</p>
                  <p class="mt-2 text-sm text-slate-400">
                    {{ $t('admin.polls.emptyDescription') }}
                  </p>
                  <a
                    href="/admin/votaciones/crear"
                    class="mt-5 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white"
                  >
                    {{ $t('admin.polls.create') }}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>

    <Teleport to="body">
      <div
        v-if="pollToDelete"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 py-6 text-white backdrop-blur-md"
        @click.self="closeDeleteModal"
      >
        <article class="relative w-full max-w-lg overflow-hidden rounded-4xl border border-red-300/25 bg-[#090b19] p-6 shadow-2xl shadow-red-950/30">
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(248,113,113,0.22),transparent_32%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.16),transparent_34%)]"></div>

          <div class="relative z-10">
            <div class="flex items-start gap-4">
              <span class="grid size-13 shrink-0 place-items-center rounded-2xl border border-red-300/25 bg-red-500/10 text-xl text-red-100">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-black uppercase tracking-[0.28em] text-red-200">
                  Confirmar eliminacion
                </p>
                <h3 class="mt-2 text-2xl font-black text-white">
                  Eliminar votacion
                </h3>
                <p class="mt-3 text-sm font-bold leading-6 text-slate-300">
                  Vas a eliminar
                  <span class="font-black text-white">"{{ pollToDelete.title }}"</span>.
                  Esta accion quita la votacion de la lista administrativa.
                </p>
              </div>
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cerrar"
                :disabled="isDeleting"
                @click="closeDeleteModal"
              >
                ×
              </button>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isDeleting"
                @click="closeDeleteModal"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="min-h-12 rounded-2xl bg-red-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isDeleting"
                @click="confirmDeletePoll"
              >
                {{ isDeleting ? 'Eliminando...' : 'Si, eliminar' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>
