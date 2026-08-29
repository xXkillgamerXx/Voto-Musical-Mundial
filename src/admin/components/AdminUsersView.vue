<script setup>
import { computed, onMounted, ref } from 'vue'
import { translate } from '../../i18n'
import { getAdminUsers, updateAdminUser, deleteAdminUser } from '../../services/api/adminApi'
import AdminUserActivityModal from './AdminUserActivityModal.vue'

const activityUserId = ref('')

const users = ref([])
const searchInput = ref('')
const activeSearch = ref('')
const roleFilter = ref('')
const sortFilter = ref('newest')
const pageSize = ref(20)
const currentPage = ref(1)
const totalUsers = ref(0)
const totalPages = ref(1)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const pointAdjustments = ref({})
const updatingPointsUserId = ref('')
const updatingRoleUserId = ref('')
const deleteTarget = ref(null)
const isDeleting = ref(false)
const roleOptions = [
  { value: 'user', label: 'Usuario' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'owner', label: 'Owner' },
]

const sortOptions = [
  { value: 'newest', labelKey: 'admin.users.sortNewest' },
  { value: 'oldest', labelKey: 'admin.users.sortOldest' },
  { value: 'points_desc', labelKey: 'admin.users.sortPointsDesc' },
  { value: 'points_asc', labelKey: 'admin.users.sortPointsAsc' },
  { value: 'name', labelKey: 'admin.users.sortName' },
]

const pageSizeOptions = [10, 20, 50, 100]

const normalizeRole = (role) => String(role || 'user').trim().toLowerCase()

const hasActiveFilters = computed(
  () => Boolean(activeSearch.value || roleFilter.value || sortFilter.value !== 'newest'),
)

const pageWindow = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  const adjustedStart = Math.max(1, end - 4)
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index)
})

const loadUsers = async ({
  page = currentPage.value,
  search = activeSearch.value,
  keepMessages = false,
} = {}) => {
  isLoading.value = true
  if (!keepMessages) {
    errorMessage.value = ''
    successMessage.value = ''
  }

  activeSearch.value = String(search || '').trim()
  searchInput.value = activeSearch.value
  currentPage.value = Math.max(1, Number(page) || 1)

  try {
    const response = await getAdminUsers({
      page: currentPage.value,
      limit: pageSize.value,
      search: activeSearch.value,
      role: roleFilter.value,
      sort: sortFilter.value,
    })

    const items = Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response)
        ? response
        : []

    users.value = items
    totalUsers.value = Number(response?.total ?? items.length)
    totalPages.value = Math.max(1, Number(response?.totalPages || 1))
    currentPage.value = Math.min(
      Math.max(1, Number(response?.page || currentPage.value)),
      totalPages.value,
    )
    pointAdjustments.value = users.value.reduce((adjustments, user) => {
      adjustments[user.id] = ''
      return adjustments
    }, {})
  } catch {
    errorMessage.value = translate('admin.users.errors.load')
    users.value = []
    totalUsers.value = 0
    totalPages.value = 1
  } finally {
    isLoading.value = false
  }
}

const applyFilters = () => {
  loadUsers({ page: 1, search: searchInput.value })
}

const clearFilters = () => {
  searchInput.value = ''
  activeSearch.value = ''
  roleFilter.value = ''
  sortFilter.value = 'newest'
  pageSize.value = 20
  loadUsers({ page: 1, search: '' })
}

const goToPage = (page) => {
  const nextPage = Math.min(Math.max(1, Number(page) || 1), totalPages.value)
  if (nextPage === currentPage.value && !isLoading.value) {
    return
  }
  loadUsers({ page: nextPage, keepMessages: true })
}

const formatPoints = (points) => Number(points || 0).toLocaleString('es')

const adjustUserPoints = async (user) => {
  errorMessage.value = ''
  successMessage.value = ''

  const amount = Number(pointAdjustments.value[user.id])

  if (!Number.isInteger(amount) || amount === 0) {
    errorMessage.value = translate('admin.users.errors.invalidAmount')
    return
  }

  updatingPointsUserId.value = user.id

  try {
    const updated = await updateAdminUser(user.id, {
      points: Number(user.points || 0) + amount,
    })
    user.points = Number(updated.points || 0)
    pointAdjustments.value[user.id] = ''
    successMessage.value = translate('admin.users.pointsUpdated', {
      name:
        user.name ||
        user.displayName ||
        user.username ||
        user.email ||
        translate('admin.users.fallbackUser'),
    })
  } catch {
    errorMessage.value = translate('admin.users.errors.updatePoints')
  } finally {
    updatingPointsUserId.value = ''
  }
}

const updateUserRole = async (user, nextRole) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!roleOptions.some((role) => role.value === nextRole) || nextRole === normalizeRole(user.role)) {
    return
  }

  updatingRoleUserId.value = user.id

  try {
    const updated = await updateAdminUser(user.id, { role: nextRole })
    user.role = updated.role
    successMessage.value = translate('admin.users.roleUpdated', {
      name:
        user.name ||
        user.displayName ||
        user.username ||
        user.email ||
        translate('admin.users.fallbackUser'),
    })
  } catch {
    errorMessage.value = translate('admin.users.errors.updateRole')
  } finally {
    updatingRoleUserId.value = ''
  }
}

const userLabel = (user) =>
  user?.name ||
  user?.displayName ||
  user?.username ||
  user?.email ||
  translate('admin.users.fallbackUser')

const openDeleteModal = (user) => {
  errorMessage.value = ''
  successMessage.value = ''
  deleteTarget.value = user
}

const closeDeleteModal = () => {
  if (isDeleting.value) return
  deleteTarget.value = null
}

const confirmDeleteUser = async () => {
  if (!deleteTarget.value) return

  errorMessage.value = ''
  successMessage.value = ''
  isDeleting.value = true

  const name = userLabel(deleteTarget.value)

  try {
    await deleteAdminUser(deleteTarget.value.id)
    deleteTarget.value = null
    successMessage.value = translate('admin.users.deleted', { name })
    await loadUsers({ keepMessages: true })
  } catch (error) {
    errorMessage.value =
      error?.payload?.message || error?.message || translate('admin.users.errors.delete')
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => loadUsers())
</script>

<template>
  <section class="space-y-6">
    <div>
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t('admin.users.eyebrow') }}
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">
              {{ $t('admin.users.title') }}
            </h2>
            <p class="mt-2 text-sm font-bold text-slate-400">
              {{ $t('admin.users.results', { total: totalUsers.toLocaleString('es') }) }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            @click="loadUsers({ keepMessages: true })"
          >
            {{ $t('admin.common.update') }}
          </button>
        </div>

        <form class="mt-5 space-y-3" @submit.prevent="applyFilters">
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              v-model="searchInput"
              type="search"
              class="min-h-11 w-full flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50"
              :placeholder="$t('admin.users.searchPlaceholder')"
            />
            <div class="flex gap-2">
              <button
                type="submit"
                class="min-h-11 flex-1 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] sm:flex-none"
              >
                {{ $t('admin.users.search') }}
              </button>
              <button
                v-if="hasActiveFilters || searchInput"
                type="button"
                class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                @click="clearFilters"
              >
                {{ $t('admin.common.clear') }}
              </button>
            </div>
          </div>

          <div class="grid gap-2 sm:grid-cols-3">
            <label class="grid gap-1.5">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.users.filterRole') }}
              </span>
              <select
                v-model="roleFilter"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                @change="applyFilters"
              >
                <option value="">
                  {{ $t('admin.users.roleAll') }}
                </option>
                <option
                  v-for="role in roleOptions"
                  :key="role.value"
                  :value="role.value"
                >
                  {{ role.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-1.5">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.users.filterSort') }}
              </span>
              <select
                v-model="sortFilter"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                @change="applyFilters"
              >
                <option
                  v-for="option in sortOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ $t(option.labelKey) }}
                </option>
              </select>
            </label>

            <label class="grid gap-1.5">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.users.filterPageSize') }}
              </span>
              <select
                v-model.number="pageSize"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
                @change="applyFilters"
              >
                <option
                  v-for="size in pageSizeOptions"
                  :key="size"
                  :value="size"
                >
                  {{ size }}
                </option>
              </select>
            </label>
          </div>
        </form>

        <p
          v-if="errorMessage"
          class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
        >
          {{ errorMessage }}
        </p>
        <p
          v-if="successMessage"
          class="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
        >
          {{ successMessage }}
        </p>

        <div v-if="isLoading" class="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300">
          {{ $t('admin.users.loading') }}
        </div>

        <div v-else class="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <div class="hidden grid-cols-[1.2fr_1fr_0.45fr_1.15fr_auto] gap-3 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 lg:grid">
            <span>{{ $t('admin.common.user') }}</span>
            <span>{{ $t('admin.common.email') }}</span>
            <span>{{ $t('admin.common.role') }}</span>
            <span>{{ $t('admin.common.points') }}</span>
            <span class="sr-only">{{ $t('admin.users.deleteAction') }}</span>
          </div>
          <div
            v-for="user in users"
            :key="user.id"
            class="grid gap-4 border-t border-white/10 px-4 py-4 text-sm text-slate-200 lg:grid-cols-[1.2fr_1fr_0.45fr_1.15fr_auto] lg:items-center lg:gap-3"
          >
            <span>
              <span class="block text-[10px] font-black uppercase tracking-widest text-slate-500 lg:hidden">{{ $t('admin.common.user') }}</span>
              <button
                type="button"
                class="flex items-center gap-2 text-left font-black text-white transition hover:text-fuchsia-200"
                title="Ver actividad"
                @click="activityUserId = String(user.id)"
              >
                {{ user.name || user.displayName || user.username || $t('admin.common.noName') }}
                <i class="fa-solid fa-clock-rotate-left text-xs text-slate-500" aria-hidden="true"></i>
              </button>
              <span class="mt-1 block text-[11px] font-bold text-slate-500">#{{ user.id }}</span>
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-black uppercase tracking-widest text-slate-500 lg:hidden">{{ $t('admin.common.email') }}</span>
              <span class="block truncate">{{ user.email || $t('admin.common.noEmail') }}</span>
            </span>
            <span>
              <span class="block text-[10px] font-black uppercase tracking-widest text-slate-500 lg:hidden">{{ $t('admin.common.role') }}</span>
              <select
                :value="normalizeRole(user.role)"
                class="min-h-10 w-full rounded-2xl border border-fuchsia-300/20 bg-slate-950 px-3 text-sm font-black capitalize text-fuchsia-100 outline-none transition focus:border-fuchsia-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="updatingRoleUserId === user.id"
                @change="updateUserRole(user, $event.target.value)"
              >
                <option
                  v-for="role in roleOptions"
                  :key="role.value"
                  :value="role.value"
                >
                  {{ role.label }}
                </option>
              </select>
            </span>
            <form class="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center" @submit.prevent="adjustUserPoints(user)">
              <span class="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-black text-amber-100">
                {{ formatPoints(user.points) }} pts
              </span>
              <input
                v-model="pointAdjustments[user.id]"
                type="number"
                step="1"
                class="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/50"
                :placeholder="$t('admin.users.pointsPlaceholder')"
              />
              <button
                type="submit"
                class="min-h-10 rounded-2xl bg-linear-to-r from-amber-400 to-fuchsia-500 px-4 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="updatingPointsUserId === user.id"
              >
                {{ updatingPointsUserId === user.id ? $t('admin.common.saving') : $t('admin.common.apply') }}
              </button>
            </form>
            <div class="flex items-center lg:justify-end">
              <button
                type="button"
                class="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 text-xs font-black uppercase tracking-wide text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="normalizeRole(user.role) === 'owner'"
                :title="normalizeRole(user.role) === 'owner' ? 'No se puede eliminar owner' : $t('admin.users.deleteAction')"
                @click="openDeleteModal(user)"
              >
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
                {{ $t('admin.users.deleteAction') }}
              </button>
            </div>
          </div>
          <div v-if="!users.length" class="border-t border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            {{
              hasActiveFilters || searchInput
                ? $t('admin.users.emptySearch')
                : $t('admin.users.empty')
            }}
          </div>
        </div>

        <div
          v-if="!isLoading && totalUsers > 0"
          class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm font-bold text-slate-400">
            {{
              $t('admin.users.pageOf', {
                page: currentPage,
                totalPages,
              })
            }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="currentPage <= 1"
              @click="goToPage(currentPage - 1)"
            >
              {{ $t('admin.users.prev') }}
            </button>
            <button
              v-for="page in pageWindow"
              :key="`users-page-${page}`"
              type="button"
              class="grid size-10 place-items-center rounded-2xl text-xs font-black transition"
              :class="
                page === currentPage
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              "
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
            <button
              type="button"
              class="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="currentPage >= totalPages"
              @click="goToPage(currentPage + 1)"
            >
              {{ $t('admin.users.next') }}
            </button>
          </div>
        </div>
      </article>
    </div>

    <AdminUserActivityModal :user-id="activityUserId" @close="activityUserId = ''" />

    <Teleport to="body">
      <div
        v-if="deleteTarget"
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
                  {{ $t('admin.users.deleteAction') }}
                </p>
                <h3 class="mt-2 text-2xl font-black text-white">
                  {{ $t('admin.users.deleteTitle') }}
                </h3>
                <p class="mt-3 text-sm font-bold leading-6 text-slate-300">
                  {{ $t('admin.users.deleteConfirm', { name: userLabel(deleteTarget) }) }}
                </p>
              </div>
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                :aria-label="$t('admin.users.deleteCancel')"
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
                {{ $t('admin.users.deleteCancel') }}
              </button>
              <button
                type="button"
                class="min-h-12 rounded-2xl bg-red-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isDeleting"
                @click="confirmDeleteUser"
              >
                {{ isDeleting ? $t('admin.users.deleting') : $t('admin.users.deleteSubmit') }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>
