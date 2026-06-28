<script setup>
import { onMounted, ref } from 'vue'
import { translate } from '../../i18n'
import {
  deleteAdminArtist,
  getAdminArtists,
  getAdminPushUsers,
  sendAdminArtistPush,
  sendAdminPush,
} from '../../services/api/adminApi'

const artists = ref([])
const isLoading = ref(true)
const isSendingPush = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const pushArtist = ref(null)
const pushResult = ref(null)
const pushMode = ref('followers')
const pushUsers = ref([])
const selectedPushUserIds = ref([])
const pushUserSearch = ref('')
const isLoadingPushUsers = ref(false)
const pushForm = ref({
  title: '',
  body: '',
})

const getArtistImage = (artist) => {
  const metadata = artist?.metadata || {}

  return artist?.photoUrl
    || artist?.image
    || artist?.imageUrl
    || artist?.photo
    || artist?.photoURL
    || artist?.foto
    || metadata.photoUrl
    || metadata.image
    || metadata.imageUrl
    || metadata.photo
    || metadata.photoURL
    || metadata.foto
    || artist?.banner
    || artist?.bannerUrl
    || artist?.cover
    || artist?.coverImage
    || artist?.portada
    || metadata.banner
    || metadata.bannerUrl
    || metadata.cover
    || metadata.coverImage
    || metadata.portada
    || ''
}

const getArtistGroup = (artist) => {
  const metadata = artist?.metadata || {}
  return artist?.group || artist?.fandom || metadata.group || metadata.fandom || ''
}
const artistProfileUrl = (artist) => `/artista/${artist.slug || artist.id}`

const openPushModal = (artist) => {
  pushArtist.value = artist
  pushResult.value = null
  pushMode.value = 'followers'
  selectedPushUserIds.value = []
  pushUserSearch.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  pushForm.value = {
    title: `${artist.name} tiene novedades`,
    body: `Mira el perfil de ${artist.name} y apoya sus votaciones.`,
  }
  loadPushUsers()
}

const closePushModal = () => {
  if (isSendingPush.value) return
  pushArtist.value = null
  pushResult.value = null
}

const sendArtistPush = async () => {
  if (!pushArtist.value?.id || isSendingPush.value) return

  errorMessage.value = ''
  successMessage.value = ''
  pushResult.value = null
  isSendingPush.value = true

  try {
    const payload = {
      title: pushForm.value.title,
      body: pushForm.value.body,
      url: artistProfileUrl(pushArtist.value),
    }
    const result = pushMode.value === 'followers'
      ? await sendAdminArtistPush(pushArtist.value.id, payload)
      : await sendAdminPush({
          ...payload,
          sendToAll: pushMode.value === 'all',
          userIds: pushMode.value === 'selected' ? selectedPushUserIds.value : [],
        })
    pushResult.value = result
    successMessage.value = `Push enviado: ${result.sent}/${result.total} tokens.`
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo enviar el push del artista.'
  } finally {
    isSendingPush.value = false
  }
}

const loadPushUsers = async () => {
  isLoadingPushUsers.value = true
  try {
    pushUsers.value = await getAdminPushUsers(pushUserSearch.value, 80)
  } catch {
    pushUsers.value = []
  } finally {
    isLoadingPushUsers.value = false
  }
}

const togglePushUser = (userId) => {
  const value = String(userId)
  selectedPushUserIds.value = selectedPushUserIds.value.includes(value)
    ? selectedPushUserIds.value.filter((id) => id !== value)
    : [...selectedPushUserIds.value, value]
}

const loadArtists = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    artists.value = await getAdminArtists(250)
  } catch {
    errorMessage.value = translate('admin.artists.errors.load')
  } finally {
    isLoading.value = false
  }
}

const removeArtist = async (artist) => {
  const shouldDelete = window.confirm(translate('admin.artists.confirmDelete', { name: artist.name }))

  if (!shouldDelete) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteAdminArtist(artist.id)
    successMessage.value = translate('admin.artists.deleted')
    await loadArtists()
  } catch {
    errorMessage.value = translate('admin.artists.errors.delete')
  }
}

onMounted(loadArtists)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            {{ $t('admin.artists.eyebrow') }}
          </p>
          <h2 class="mt-2 text-3xl font-black text-white">
            {{ $t('admin.artists.title') }}
          </h2>
          <p class="mt-2 text-sm text-slate-400">
            {{ $t('admin.artists.description') }}
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            @click="loadArtists"
          >
            {{ $t('admin.common.update') }}
          </button>
          <a
            href="/admin/artistas/crear"
            class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
          >
            <i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>
            {{ $t('admin.artists.create') }}
          </a>
        </div>
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
        {{ $t('admin.artists.loading') }}
      </div>

      <div v-else class="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-white/5 text-xs font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th class="px-4 py-4">{{ $t('admin.artists.photo') }}</th>
                <th class="px-4 py-4">{{ $t('admin.artists.artist') }}</th>
                <th class="px-4 py-4">{{ $t('admin.artists.group') }}</th>
                <th class="px-4 py-4">{{ $t('admin.artists.country') }}</th>
                <th class="px-4 py-4">{{ $t('admin.artists.role') }}</th>
                <th class="px-4 py-4">{{ $t('admin.artists.status') }}</th>
                <th class="px-4 py-4 text-right">{{ $t('admin.artists.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/10">
              <tr
                v-for="artist in artists"
                :key="artist.id"
                class="text-sm text-slate-300 transition hover:bg-white/3"
              >
                <td class="px-4 py-4">
                  <span
                    class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-black text-white"
                  >
                    <img
                      v-if="getArtistImage(artist)"
                      :src="getArtistImage(artist)"
                      :alt="artist.name"
                      class="size-full object-cover"
                    />
                    <span v-else>{{ artist.name?.charAt(0) || 'A' }}</span>
                  </span>
                </td>
                <td class="max-w-64 px-4 py-4">
                  <p class="truncate font-black text-white">{{ artist.name }}</p>
                  <p class="mt-1 line-clamp-1 text-xs text-slate-500">
                    {{ artist.bio || $t('admin.artists.noBio') }}
                  </p>
                </td>
                <td class="px-4 py-4 font-bold text-fuchsia-200">
                  {{ getArtistGroup(artist) || '-' }}
                </td>
                <td class="px-4 py-4">
                  {{ artist.country || '-' }}
                </td>
                <td class="px-4 py-4">
                  {{ artist.role || '-' }}
                </td>
                <td class="px-4 py-4">
                  <span
                    class="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300"
                  >
                    {{ artist.status || 'active' }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <a
                      :href="artistProfileUrl(artist)"
                      class="rounded-full border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-400/20"
                    >
                      {{ $t('admin.artists.profile') }}
                    </a>
                    <button
                      type="button"
                      class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                      @click="openPushModal(artist)"
                    >
                      Push
                    </button>
                    <a
                      :href="`/admin/artistas/editar/${artist.id}`"
                      class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      {{ $t('admin.common.edit') }}
                    </a>
                    <button
                      type="button"
                      class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                      @click="removeArtist(artist)"
                    >
                      {{ $t('admin.common.delete') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!artists.length">
                <td colspan="7" class="px-4 py-10 text-center">
                  <p class="text-lg font-black text-white">{{ $t('admin.artists.empty') }}</p>
                  <p class="mt-2 text-sm text-slate-400">
                    {{ $t('admin.artists.emptyDescription') }}
                  </p>
                  <a
                    href="/admin/artistas/crear"
                    class="mt-5 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white"
                  >
                    {{ $t('admin.artists.create') }}
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
        v-if="pushArtist"
        class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 text-white backdrop-blur-md"
        @click.self="closePushModal"
      >
        <div class="relative w-full max-w-xl overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#090b19] p-6 shadow-2xl shadow-fuchsia-950/45">
          <div class="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-cyan-400/15 blur-3xl"></div>

          <div class="relative">
            <button
              type="button"
              class="absolute right-0 top-0 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
              :disabled="isSendingPush"
              @click="closePushModal"
            >
              ×
            </button>

            <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
              Push de artista
            </p>
            <h2 class="mt-3 pr-12 text-3xl font-black text-white">
              Enviar push de {{ pushArtist.name }}
            </h2>
            <p class="mt-2 text-sm font-bold leading-6 text-slate-300">
              Puedes enviarlo a sus seguidores, a todos los usuarios con push activo o solo a usuarios seleccionados. Al abrir la notificación irán a
              <span class="font-mono text-cyan-100">{{ artistProfileUrl(pushArtist) }}</span>.
            </p>

            <div class="mt-5 grid gap-3">
              <div class="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  class="rounded-2xl border px-3 py-3 text-xs font-black uppercase tracking-wide transition"
                  :class="pushMode === 'followers' ? 'border-fuchsia-300/40 bg-fuchsia-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
                  @click="pushMode = 'followers'"
                >
                  Seguidores
                </button>
                <button
                  type="button"
                  class="rounded-2xl border px-3 py-3 text-xs font-black uppercase tracking-wide transition"
                  :class="pushMode === 'selected' ? 'border-cyan-300/40 bg-cyan-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
                  @click="pushMode = 'selected'"
                >
                  Seleccionar
                </button>
                <button
                  type="button"
                  class="rounded-2xl border px-3 py-3 text-xs font-black uppercase tracking-wide transition"
                  :class="pushMode === 'all' ? 'border-amber-300/40 bg-amber-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
                  @click="pushMode = 'all'"
                >
                  Todos
                </button>
              </div>

              <div
                v-if="pushMode === 'selected'"
                class="rounded-3xl border border-white/10 bg-slate-950/45 p-3"
              >
                <form class="flex gap-2" @submit.prevent="loadPushUsers">
                  <input
                    v-model="pushUserSearch"
                    class="min-h-10 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
                    placeholder="Buscar usuario con token"
                  />
                  <button
                    type="submit"
                    class="rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase text-slate-200 transition hover:bg-white/10"
                  >
                    Buscar
                  </button>
                </form>

                <p class="mt-3 text-xs font-bold text-slate-400">
                  Seleccionados: {{ selectedPushUserIds.length }}
                </p>

                <div class="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                  <p v-if="isLoadingPushUsers" class="text-sm font-bold text-slate-400">
                    Cargando usuarios...
                  </p>
                  <button
                    v-for="user in pushUsers"
                    :key="user.id"
                    type="button"
                    class="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                    @click="togglePushUser(user.id)"
                  >
                    <span
                      class="grid size-5 place-items-center rounded-md border text-[10px]"
                      :class="selectedPushUserIds.includes(String(user.id)) ? 'border-cyan-300 bg-cyan-400 text-slate-950' : 'border-white/20 text-transparent'"
                    >
                      ✓
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-black text-white">{{ user.name }}</span>
                      <span class="block truncate text-xs text-slate-500">{{ user.email || 'sin email' }} · {{ user.tokenCount }} token(s)</span>
                    </span>
                  </button>
                  <p v-if="!isLoadingPushUsers && !pushUsers.length" class="text-sm font-bold text-slate-500">
                    No hay usuarios con token push.
                  </p>
                </div>
              </div>

              <label class="grid gap-2">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Título</span>
                <input
                  v-model="pushForm.title"
                  class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Mensaje</span>
                <textarea
                  v-model="pushForm.body"
                  rows="4"
                  class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                ></textarea>
              </label>

              <div
                v-if="pushResult"
                class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200"
              >
                Enviados: {{ pushResult.sent }} / {{ pushResult.total }} · Fallidos: {{ pushResult.failed }}
              </div>

              <div
                v-if="pushResult?.errors?.length"
                class="rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-xs text-red-100"
              >
                <p class="font-black uppercase tracking-widest">Errores</p>
                <p
                  v-for="item in pushResult.errors"
                  :key="`${item.token}-${item.code}`"
                  class="mt-2"
                >
                  {{ item.code }} · {{ item.message }}
                </p>
              </div>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                :disabled="isSendingPush"
                @click="closePushModal"
              >
                Cerrar
              </button>
              <button
                type="button"
                class="min-h-12 rounded-2xl bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-950/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isSendingPush || (pushMode === 'selected' && !selectedPushUserIds.length)"
                @click="sendArtistPush"
              >
                {{ isSendingPush ? 'Enviando...' : 'Enviar push' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
