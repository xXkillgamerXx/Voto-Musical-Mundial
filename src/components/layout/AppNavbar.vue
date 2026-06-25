<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import AuthModal from "../auth/AuthModal.vue";

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Votaciones", href: "/votaciones" },
  { label: "Artistas", href: "/artistas" },
  { label: "Ranking Popularity", href: "/ranking-popularity" },
  { label: "Salón de la fama", href: "/salon-de-la-fama" },
  { label: "Noticias", href: "/noticias" },
];
const isMenuOpen = ref(false);
const isAuthModalOpen = ref(false);
const isAccountMenuOpen = ref(false);
const avatarImageFailed = ref(false);
const currentUser = ref(null);
const userRole = ref("");
const userUsername = ref("");
let unsubscribeAuth = null;

const userName = computed(() => currentUser.value?.displayName || "Cuenta fan");
const userEmail = computed(() => currentUser.value?.email || "");
const isAdmin = computed(() => userRole.value === "admin");
const profileHref = computed(() =>
  userUsername.value ? `/user/${userUsername.value}` : "/perfil",
);
const shouldShowAvatarImage = computed(
  () => currentUser.value?.photoURL && !avatarImageFailed.value,
);
const userInitial = computed(() => {
  const source =
    currentUser.value?.displayName || currentUser.value?.email || "U";

  return source.trim().charAt(0).toUpperCase();
});

const openAuthModal = () => {
  isAuthModalOpen.value = true;
  isMenuOpen.value = false;
};

const handleLogout = async () => {
  await signOut(auth);
  isAccountMenuOpen.value = false;
  isMenuOpen.value = false;
};

const handleAvatarError = () => {
  avatarImageFailed.value = true;
};

const loadUserRole = async (user) => {
  userRole.value = "";
  userUsername.value = "";

  if (!user) {
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (currentUser.value?.uid === user.uid) {
      const userData = userSnap.data() || {};
      userRole.value = (userData.role || "").toLowerCase();
      userUsername.value = userData.username || "";
    }
  } catch {
    userRole.value = "";
    userUsername.value = "";
  }
};

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    avatarImageFailed.value = false;
    isAccountMenuOpen.value = false;
    loadUserRole(user);
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 border-b border-violet-400/15 bg-slate-950/85 backdrop-blur-xl"
  >
    <nav
      class="mx-auto flex max-w-352 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:py-4"
    >
      <a href="/" class="group flex items-center gap-3">
        <span
          class="grid h-10 w-14 shrink-0 place-items-center sm:h-12 sm:w-16"
        >
          <img
            src="/logo-votos.png"
            alt="Votos Musica Mundial logo"
            class="h-full w-full object-contain"
          />
        </span>
        <span>
          <span
            class="block text-base font-black uppercase leading-none tracking-wide sm:text-lg"
          >
            Votos Musica Mundial
          </span>
          <span
            class="mt-1 hidden text-[10px] uppercase tracking-[0.28em] text-violet-200/70 sm:block"
          >
            Awards globales
          </span>
        </span>
      </a>

      <div
        class="hidden items-center gap-1 rounded-full border border-white/10 bg-white/3 p-1 lg:flex"
      >
        <a
          v-for="item in navItems"
          :key="item.label"
          :href="item.href"
          class="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {{ item.label }}
        </a>
      </div>

      <div class="flex items-center gap-2">
        <div
          v-if="currentUser"
          class="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 md:flex"
        >
          <span class="text-amber-300">◆</span>
          <span>2,450 pts</span>
        </div>

        <div v-if="currentUser" class="relative">
          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-fuchsia-950/30"
            aria-label="Cuenta de usuario"
            :aria-expanded="isAccountMenuOpen"
            @click="isAccountMenuOpen = !isAccountMenuOpen"
          >
            <img
              v-if="shouldShowAvatarImage"
              :src="currentUser.photoURL"
              alt=""
              class="size-full object-cover"
              referrerpolicy="no-referrer"
              @error="handleAvatarError"
            />
            <span v-else>{{ userInitial }}</span>
          </button>

          <div
            v-if="isAccountMenuOpen"
            class="absolute right-0 top-12 z-70 w-72 overflow-hidden rounded-3xl border border-white/10 bg-[#080a18] p-3 text-white shadow-2xl shadow-black/40"
          >
            <div class="flex items-center gap-3 border-b border-white/10 pb-3">
              <span
                class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black"
              >
                <img
                  v-if="shouldShowAvatarImage"
                  :src="currentUser.photoURL"
                  alt=""
                  class="size-full object-cover"
                  referrerpolicy="no-referrer"
                  @error="handleAvatarError"
                />
                <span v-else>{{ userInitial }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-black">{{
                  userName
                }}</span>
                <span class="block truncate text-xs text-slate-400">{{
                  userEmail
                }}</span>
              </span>
            </div>

            <a
              :href="profileHref"
              class="mt-3 block rounded-2xl px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            >
              Mi perfil
            </a>
            <a
              v-if="isAdmin"
              href="/admin"
              class="block rounded-2xl px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            >
              Panel admin
            </a>
            <button
              type="button"
              class="block w-full rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-200 transition hover:bg-red-500/10"
              @click="handleLogout"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <button
          v-if="!currentUser"
          type="button"
          class="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white lg:inline-flex"
          @click="openAuthModal"
        >
          Iniciar sesion
        </button>

        <a
          v-if="!currentUser"
          href="/registro"
          class="hidden rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold shadow-lg shadow-fuchsia-500/25 transition hover:shadow-fuchsia-500/40 sm:inline-flex"
        >
          Registrarse
        </a>

        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 lg:hidden"
          aria-label="Abrir menu"
          :aria-expanded="isMenuOpen"
          @click="isMenuOpen = !isMenuOpen"
        >
          {{ isMenuOpen ? "×" : "☰" }}
        </button>
      </div>
    </nav>

    <div v-if="isMenuOpen" class="border-t border-white/10 px-4 pb-4 lg:hidden">
      <div
        class="mx-auto max-w-352 rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl shadow-violet-950/30"
      >
        <a
          v-for="item in navItems"
          :key="item.label"
          :href="item.href"
          class="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          @click="isMenuOpen = false"
        >
          {{ item.label }}
        </a>

        <div
          class="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-3"
        >
          <div
            v-if="currentUser"
            class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-3"
          >
            <span
              class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black"
            >
              <img
                v-if="shouldShowAvatarImage"
                :src="currentUser.photoURL"
                alt=""
                class="size-full object-cover"
                referrerpolicy="no-referrer"
                @error="handleAvatarError"
              />
              <span v-else>{{ userInitial }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-white">{{
                userName
              }}</span>
              <span class="block truncate text-xs text-slate-400">{{
                userEmail
              }}</span>
            </span>
          </div>

          <div
            v-if="currentUser"
            class="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100"
          >
            <span class="text-amber-300">◆</span>
            <span>2,450 pts</span>
          </div>
          <a
            v-if="currentUser"
            :href="profileHref"
            class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-slate-100"
            @click="isMenuOpen = false"
          >
            Mi perfil
          </a>
          <a
            v-if="currentUser && isAdmin"
            href="/admin"
            class="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-3 text-center text-sm font-black text-fuchsia-100"
            @click="isMenuOpen = false"
          >
            Panel admin
          </a>
          <button
            v-if="!currentUser"
            type="button"
            class="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200"
            @click="openAuthModal"
          >
            Iniciar sesion
          </button>
          <a
            v-if="!currentUser"
            href="/registro"
            class="rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-center text-sm font-bold"
          >
            Registrarse
          </a>
          <button
            v-if="currentUser"
            type="button"
            class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-100"
            @click="handleLogout"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>

    <AuthModal v-if="isAuthModalOpen" @close="isAuthModalOpen = false" />
  </header>
</template>
