<script setup>
import { onMounted, ref } from 'vue'
import { collection, doc, getDocs, increment, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { translate } from '../../i18n'

const users = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const pointAdjustments = ref({})
const updatingPointsUserId = ref('')
const updatingRoleUserId = ref('')
const roleOptions = [
  { value: 'user', label: 'Usuario' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'owner', label: 'Owner' },
]
const normalizeRole = (role) => String(role || 'user').trim().toLowerCase()

const loadUsers = async () => {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const usersSnap = await getDocs(usersQuery)

    users.value = usersSnap.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data(),
    }))
    pointAdjustments.value = users.value.reduce((adjustments, user) => {
      adjustments[user.id] = ''
      return adjustments
    }, {})
  } catch {
    errorMessage.value = translate('admin.users.errors.load')
  } finally {
    isLoading.value = false
  }
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
    await updateDoc(doc(db, 'users', user.id), {
      points: increment(amount),
      pointsUpdatedAt: serverTimestamp(),
    })

    user.points = Number(user.points || 0) + amount
    pointAdjustments.value[user.id] = ''
    successMessage.value = translate('admin.users.pointsUpdated', {
      name: user.name || user.username || user.email || translate('admin.users.fallbackUser'),
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
    await updateDoc(doc(db, 'users', user.id), {
      role: nextRole,
      roleUpdatedAt: serverTimestamp(),
    })

    user.role = nextRole
    successMessage.value = translate('admin.users.roleUpdated', {
      name: user.name || user.username || user.email || translate('admin.users.fallbackUser'),
    })
  } catch {
    errorMessage.value = translate('admin.users.errors.updateRole')
  } finally {
    updatingRoleUserId.value = ''
  }
}

onMounted(loadUsers)
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
          </div>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            @click="loadUsers"
          >
            {{ $t('admin.common.update') }}
          </button>
        </div>

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
          <div class="hidden grid-cols-[1.2fr_1fr_0.45fr_1.15fr] gap-3 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 lg:grid">
            <span>{{ $t('admin.common.user') }}</span>
            <span>{{ $t('admin.common.email') }}</span>
            <span>{{ $t('admin.common.role') }}</span>
            <span>{{ $t('admin.common.points') }}</span>
          </div>
          <div
            v-for="user in users"
            :key="user.id"
            class="grid gap-4 border-t border-white/10 px-4 py-4 text-sm text-slate-200 lg:grid-cols-[1.2fr_1fr_0.45fr_1.15fr] lg:items-center lg:gap-3"
          >
            <span>
              <span class="block text-[10px] font-black uppercase tracking-widest text-slate-500 lg:hidden">{{ $t('admin.common.user') }}</span>
              <span class="font-black text-white">{{ user.name || user.username || $t('admin.common.noName') }}</span>
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
          </div>
          <div v-if="!users.length" class="border-t border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            {{ $t('admin.users.empty') }}
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
