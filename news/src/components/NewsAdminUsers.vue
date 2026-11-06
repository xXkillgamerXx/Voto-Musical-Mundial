<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  blockModerationUser,
  deleteAdminUser,
  getAdminUsers,
  unblockModerationUser,
  updateAdminUser,
} from '../../../src/services/api/adminApi'

type AccountBlock = {
  blocked?: boolean
  reason?: string
  expiresAt?: string | null
  permanent?: boolean
} | null

type AdminUserRow = {
  id: string
  name?: string
  displayName?: string
  username?: string
  email?: string
  role?: string
  points?: number
  accountStatus?: string
  accountBlock?: AccountBlock
}

const users = ref<AdminUserRow[]>([])
const searchInput = ref('')
const activeSearch = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const sortFilter = ref('newest')
const pageSize = ref(20)
const currentPage = ref(1)
const totalUsers = ref(0)
const totalPages = ref(1)
const loading = ref(true)
const errorMessage = ref('')
const notice = ref('')
const pointAdjustments = ref<Record<string, string>>({})
const busyPointsId = ref('')
const busyRoleId = ref('')
const busyStatusId = ref('')
const deleteTarget = ref<AdminUserRow | null>(null)
const deleting = ref(false)
const blockTarget = ref<AdminUserRow | null>(null)
const blockReason = ref('')
const blockDuration = ref(24)
const blocking = ref(false)

const roleOptions = [
  { value: 'user', label: 'Usuario' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'owner', label: 'Owner' },
]

const sortOptions = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'points_desc', label: 'Más puntos' },
  { value: 'points_asc', label: 'Menos puntos' },
  { value: 'name', label: 'Nombre' },
]

const pageWindow = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  const adjusted = Math.max(1, end - 4)
  return Array.from({ length: end - adjusted + 1 }, (_, i) => adjusted + i)
})

const normalizeRole = (role?: string) => String(role || 'user').trim().toLowerCase()
const accountStatus = (user: AdminUserRow) => (user.accountStatus === 'blocked' ? 'blocked' : 'active')
const userLabel = (user?: AdminUserRow | null) =>
  user?.name || user?.displayName || user?.username || user?.email || 'Usuario'

const formatBlockExpiry = (user: AdminUserRow) => {
  const block = user.accountBlock
  if (!block?.blocked) return ''
  if (block.permanent || !block.expiresAt) return 'Permanente'
  const date = new Date(block.expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return `Hasta ${date.toLocaleString('es-ES')}`
}

const loadUsers = async ({
  page = currentPage.value,
  search = activeSearch.value,
  keepMessages = false,
} = {}) => {
  loading.value = true
  if (!keepMessages) {
    errorMessage.value = ''
    notice.value = ''
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
      accountStatus: statusFilter.value,
    })
    const items = Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response)
        ? response
        : []
    users.value = items as AdminUserRow[]
    totalUsers.value = Number(response?.total ?? items.length)
    totalPages.value = Math.max(1, Number(response?.totalPages || 1))
    currentPage.value = Math.min(Math.max(1, Number(response?.page || currentPage.value)), totalPages.value)
    pointAdjustments.value = Object.fromEntries(users.value.map((user) => [user.id, '']))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.'
    users.value = []
    totalUsers.value = 0
    totalPages.value = 1
  } finally {
    loading.value = false
  }
}

const applyFilters = () => loadUsers({ page: 1, search: searchInput.value })

const clearFilters = () => {
  searchInput.value = ''
  activeSearch.value = ''
  roleFilter.value = ''
  statusFilter.value = ''
  sortFilter.value = 'newest'
  pageSize.value = 20
  loadUsers({ page: 1, search: '' })
}

const goToPage = (page: number) => {
  const next = Math.min(Math.max(1, Number(page) || 1), totalPages.value)
  if (next === currentPage.value && !loading.value) return
  loadUsers({ page: next, keepMessages: true })
}

const adjustPoints = async (user: AdminUserRow) => {
  errorMessage.value = ''
  notice.value = ''
  const amount = Number(pointAdjustments.value[user.id])
  if (!Number.isInteger(amount) || amount === 0) {
    errorMessage.value = 'Indica un ajuste de puntos distinto de 0.'
    return
  }
  busyPointsId.value = user.id
  try {
    const updated = await updateAdminUser(user.id, { points: Number(user.points || 0) + amount })
    user.points = Number(updated.points || 0)
    pointAdjustments.value[user.id] = ''
    notice.value = `Puntos actualizados para ${userLabel(user)}.`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron actualizar los puntos.'
  } finally {
    busyPointsId.value = ''
  }
}

const updateRole = async (user: AdminUserRow, nextRole: string) => {
  errorMessage.value = ''
  notice.value = ''
  if (!roleOptions.some((role) => role.value === nextRole) || nextRole === normalizeRole(user.role)) return
  busyRoleId.value = user.id
  try {
    const updated = await updateAdminUser(user.id, { role: nextRole })
    user.role = updated.role
    notice.value = `Rol actualizado para ${userLabel(user)}.`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo actualizar el rol.'
  } finally {
    busyRoleId.value = ''
  }
}

const onStatusChange = async (user: AdminUserRow, nextStatus: string) => {
  errorMessage.value = ''
  notice.value = ''
  if (normalizeRole(user.role) === 'owner') return
  if (nextStatus === accountStatus(user)) return
  if (nextStatus === 'active') {
    busyStatusId.value = user.id
    try {
      await unblockModerationUser(user.id)
      user.accountStatus = 'active'
      user.accountBlock = null
      notice.value = `${userLabel(user)} desbloqueado.`
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'No se pudo desbloquear.'
    } finally {
      busyStatusId.value = ''
    }
    return
  }
  blockTarget.value = user
  blockReason.value = ''
  blockDuration.value = 24
}

const confirmBlock = async () => {
  if (!blockTarget.value) return
  const reason = blockReason.value.trim()
  if (!reason) {
    errorMessage.value = 'Escribe el motivo del bloqueo.'
    return
  }
  blocking.value = true
  errorMessage.value = ''
  notice.value = ''
  const user = blockTarget.value
  try {
    const result = await blockModerationUser(user.id, reason, blockDuration.value)
    user.accountStatus = 'blocked'
    user.accountBlock = {
      blocked: true,
      reason,
      expiresAt: result?.expiresAt || null,
      permanent: Boolean(result?.permanent),
    }
    blockTarget.value = null
    notice.value = `${userLabel(user)} bloqueado.`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo bloquear.'
  } finally {
    blocking.value = false
  }
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  errorMessage.value = ''
  notice.value = ''
  const name = userLabel(deleteTarget.value)
  try {
    await deleteAdminUser(deleteTarget.value.id)
    deleteTarget.value = null
    notice.value = `${name} eliminado.`
    await loadUsers({ keepMessages: true })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo eliminar.'
  } finally {
    deleting.value = false
  }
}

const voteProfileHref = (id: string) => `/vote/admin/usuarios/${encodeURIComponent(id)}`

onMounted(() => loadUsers())
</script>

<template>
  <section class="na-users">
    <div class="na-users-toolbar">
      <div>
        <p class="na-users-kicker">Moderación</p>
        <h2>Usuarios</h2>
        <p class="na-help">{{ totalUsers.toLocaleString('es') }} cuentas · bloqueo, roles, puntos y borrado</p>
      </div>
      <button type="button" class="na-btn" @click="loadUsers({ keepMessages: true })">Actualizar</button>
    </div>

    <form class="na-users-filters" @submit.prevent="applyFilters">
      <input v-model="searchInput" type="search" placeholder="Buscar por nombre, usuario o email" />
      <select v-model="roleFilter" @change="applyFilters">
        <option value="">Todos los roles</option>
        <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
      </select>
      <select v-model="statusFilter" @change="applyFilters">
        <option value="">Todos los estados</option>
        <option value="active">Activos</option>
        <option value="blocked">Bloqueados</option>
      </select>
      <select v-model="sortFilter" @change="applyFilters">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <select v-model.number="pageSize" @change="applyFilters">
        <option :value="10">10 / pág</option>
        <option :value="20">20 / pág</option>
        <option :value="50">50 / pág</option>
        <option :value="100">100 / pág</option>
      </select>
      <button type="submit" class="na-btn solid">Buscar</button>
      <button type="button" class="na-btn" @click="clearFilters">Limpiar</button>
    </form>

    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-else-if="notice" class="na-ok">{{ notice }}</p>
    <p v-if="loading" class="na-empty">Cargando usuarios…</p>

    <div v-else class="na-users-list">
      <article v-for="user in users" :key="user.id" class="na-user-card">
        <div class="na-user-main">
          <div>
            <a class="na-user-name" :href="voteProfileHref(user.id)">{{ userLabel(user) }}</a>
            <small>#{{ user.id }} · {{ user.email || 'Sin email' }}</small>
          </div>
          <span class="na-pill" :data-tone="accountStatus(user)">
            {{ accountStatus(user) === 'blocked' ? 'Bloqueado' : 'Activo' }}
          </span>
        </div>
        <p v-if="accountStatus(user) === 'blocked'" class="na-block-note">{{ formatBlockExpiry(user) }}</p>

        <div class="na-user-controls">
          <label>
            <span>Estado</span>
            <select
              :value="accountStatus(user)"
              :disabled="normalizeRole(user.role) === 'owner' || busyStatusId === user.id"
              @change="onStatusChange(user, ($event.target as HTMLSelectElement).value)"
            >
              <option value="active">Activo</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </label>
          <label>
            <span>Rol</span>
            <select
              :value="normalizeRole(user.role)"
              :disabled="busyRoleId === user.id"
              @change="updateRole(user, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
            </select>
          </label>
          <form class="na-points" @submit.prevent="adjustPoints(user)">
            <span>{{ Number(user.points || 0).toLocaleString('es') }} pts</span>
            <input v-model="pointAdjustments[user.id]" type="number" step="1" placeholder="+/-" />
            <button type="submit" class="na-btn solid" :disabled="busyPointsId === user.id">
              {{ busyPointsId === user.id ? '…' : 'Aplicar' }}
            </button>
          </form>
        </div>

        <div class="na-user-actions">
          <a class="na-btn" :href="voteProfileHref(user.id)">Ver perfil</a>
          <button
            type="button"
            class="na-btn danger"
            :disabled="normalizeRole(user.role) === 'owner'"
            @click="deleteTarget = user"
          >
            Eliminar
          </button>
        </div>
      </article>

      <p v-if="!users.length" class="na-empty">No hay usuarios para mostrar.</p>
    </div>

    <div v-if="!loading && totalUsers > 0" class="na-pager">
      <span>Página {{ currentPage }} de {{ totalPages }}</span>
      <div>
        <button type="button" class="na-btn" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">Anterior</button>
        <button
          v-for="page in pageWindow"
          :key="page"
          type="button"
          class="na-btn"
          :class="{ solid: page === currentPage }"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
        <button type="button" class="na-btn" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">Siguiente</button>
      </div>
    </div>

    <div v-if="deleteTarget" class="na-modal" @click.self="!deleting && (deleteTarget = null)">
      <div class="na-modal-card">
        <h3>Eliminar usuario</h3>
        <p>¿Seguro que quieres eliminar a <b>{{ userLabel(deleteTarget) }}</b>? Esta acción no se puede deshacer.</p>
        <div class="na-modal-actions">
          <button type="button" class="na-btn" :disabled="deleting" @click="deleteTarget = null">Cancelar</button>
          <button type="button" class="na-btn danger" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="blockTarget" class="na-modal" @click.self="!blocking && (blockTarget = null)">
      <div class="na-modal-card">
        <h3>Bloquear a {{ userLabel(blockTarget) }}</h3>
        <p>No podrá votar ni comentar mientras esté bloqueado.</p>
        <label class="na-field">
          <span>Motivo</span>
          <textarea v-model="blockReason" rows="3" placeholder="Motivo del bloqueo" />
        </label>
        <label class="na-field">
          <span>Duración</span>
          <select v-model.number="blockDuration">
            <option :value="1">1 hora</option>
            <option :value="24">24 horas</option>
            <option :value="168">7 días</option>
            <option :value="720">30 días</option>
            <option :value="0">Permanente</option>
          </select>
        </label>
        <div class="na-modal-actions">
          <button type="button" class="na-btn" :disabled="blocking" @click="blockTarget = null">Cancelar</button>
          <button type="button" class="na-btn danger" :disabled="blocking" @click="confirmBlock">
            {{ blocking ? 'Bloqueando…' : 'Bloquear' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.na-users {
  display: grid;
  gap: 16px;
}
.na-users-toolbar,
.na-user-main,
.na-pager,
.na-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}
.na-users-kicker {
  margin: 0;
  color: var(--blue);
  font: 800 11px/1 Manrope, sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.na-users-toolbar h2 {
  margin: 6px 0 4px;
  font: 800 24px/1.1 Manrope, sans-serif;
}
.na-help {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.na-users-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}
.na-users-filters input,
.na-users-filters select,
.na-user-controls select,
.na-points input,
.na-field textarea,
.na-field select {
  min-height: 40px;
  width: 100%;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
}
.na-field textarea {
  padding: 10px 12px;
  resize: vertical;
}
.na-btn {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font: 800 12px/1 Manrope, sans-serif;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.na-btn.solid {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}
.na-btn.danger {
  border-color: color-mix(in srgb, #ef4444 45%, var(--line));
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
}
.na-error,
.na-ok,
.na-empty {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  font: 700 13px/1.4 Manrope, sans-serif;
}
.na-error {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
}
.na-ok {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #059669;
}
.na-empty {
  background: color-mix(in srgb, var(--ink) 4%, var(--card));
  color: var(--sub);
}
.na-users-list {
  display: grid;
  gap: 12px;
}
.na-user-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
}
.na-user-name {
  color: var(--ink);
  font: 800 15px/1.2 Manrope, sans-serif;
  text-decoration: none;
}
.na-user-main small,
.na-block-note {
  display: block;
  margin-top: 4px;
  color: var(--sub);
  font-size: 12px;
}
.na-pill {
  padding: 5px 10px;
  border-radius: 999px;
  font: 800 11px/1 Manrope, sans-serif;
  text-transform: uppercase;
}
.na-pill[data-tone='active'] {
  background: color-mix(in srgb, #10b981 14%, transparent);
  color: #059669;
}
.na-pill[data-tone='blocked'] {
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: #ef4444;
}
.na-user-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.na-user-controls label,
.na-field {
  display: grid;
  gap: 6px;
}
.na-user-controls span,
.na-field span {
  color: var(--sub);
  font: 800 10px/1 Manrope, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.na-points {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: end;
}
.na-points span {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 10px;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #d97706;
  font: 800 12px/1 Manrope, sans-serif;
}
.na-user-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.na-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(4, 8, 18, 0.72);
}
.na-modal-card {
  width: min(440px, 100%);
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--card);
  color: var(--ink);
}
.na-modal-card h3 {
  margin: 0;
  font: 800 20px/1.2 Manrope, sans-serif;
}
.na-modal-card p {
  margin: 0;
  color: var(--sub);
  font-size: 14px;
}
</style>
