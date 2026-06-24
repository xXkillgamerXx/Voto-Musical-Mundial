<script setup>
import { onMounted, ref } from 'vue'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'

const users = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const newUser = ref({
  name: '',
  email: '',
  role: 'user',
})

const loadUsers = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const usersSnap = await getDocs(usersQuery)

    users.value = usersSnap.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data(),
    }))
  } catch {
    errorMessage.value = 'No se pudieron cargar los usuarios. Revisa permisos de admin.'
  } finally {
    isLoading.value = false
  }
}

const handleCreateUser = () => {
  errorMessage.value =
    'Para crear usuarios de Auth desde admin hace falta una Cloud Function con Firebase Admin SDK.'
}

onMounted(loadUsers)
</script>

<template>
  <section class="space-y-6">
    <div class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Crear usuario
        </p>
        <h2 class="mt-2 text-2xl font-black text-white">
          Nuevo usuario Auth
        </h2>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          La creacion real de usuarios Auth debe hacerse desde backend para no cambiar la sesion del admin.
        </p>

        <form class="mt-5 space-y-4" @submit.prevent="handleCreateUser">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Nombre</span>
            <input
              v-model="newUser.name"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Nombre del usuario"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Correo</span>
            <input
              v-model="newUser.email"
              type="email"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="usuario@email.com"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Rol</span>
            <select
              v-model="newUser.role"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            >
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <button
            type="submit"
            class="min-h-12 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
          >
            Preparar creacion
          </button>
        </form>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Usuarios
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">
              Cuentas registradas
            </h2>
          </div>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            @click="loadUsers"
          >
            Actualizar
          </button>
        </div>

        <p
          v-if="errorMessage"
          class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
        >
          {{ errorMessage }}
        </p>

        <div v-if="isLoading" class="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300">
          Cargando usuarios...
        </div>

        <div v-else class="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <div class="grid grid-cols-[1.2fr_1fr_0.5fr] gap-3 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400">
            <span>Usuario</span>
            <span>Correo</span>
            <span>Rol</span>
          </div>
          <div
            v-for="user in users"
            :key="user.id"
            class="grid grid-cols-[1.2fr_1fr_0.5fr] gap-3 border-t border-white/10 px-4 py-4 text-sm text-slate-200"
          >
            <span class="font-black text-white">{{ user.name || user.username || 'Sin nombre' }}</span>
            <span class="truncate">{{ user.email || 'Sin correo' }}</span>
            <span class="font-bold capitalize text-fuchsia-200">{{ user.role || 'user' }}</span>
          </div>
          <div v-if="!users.length" class="border-t border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            No hay usuarios para mostrar.
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
