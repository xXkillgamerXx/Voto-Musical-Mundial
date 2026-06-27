<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useI18n } from "vue-i18n";
import { availableLocales, setLocale, translate } from "../../i18n";
import { auth, db } from "../../firebase";
import AuthModal from "../auth/AuthModal.vue";
import ThemeToggle from "../theme/ThemeToggle.vue";

const navItems = [
  { labelKey: "nav.home", href: "/" },
  { labelKey: "nav.polls", href: "/votaciones" },
  { labelKey: "nav.artists", href: "/artistas" },
  { labelKey: "nav.rankingPopularity", href: "/ranking-popularity" },
  { labelKey: "nav.hallOfFame", href: "/salon-de-la-fama" },
  { labelKey: "nav.news", href: "/noticias" },
];
const { locale } = useI18n();
const isMenuOpen = ref(false);
const isAuthModalOpen = ref(false);
const isAccountMenuOpen = ref(false);
const isSettingsMenuOpen = ref(false);
const avatarImageFailed = ref(false);
const settingsMenuRef = ref(null);
const accountMenuRef = ref(null);
const currentUser = ref(null);
const userRole = ref("");
const userUsername = ref("");
const userPoints = ref(0);
let unsubscribeAuth = null;
const adminRoles = new Set(["admin", "superadmin", "owner"]);

const userName = computed(
  () => currentUser.value?.displayName || translate("nav.fanAccount"),
);
const userEmail = computed(() => currentUser.value?.email || "");
const isSignedInUser = computed(() => Boolean(currentUser.value && !currentUser.value.isAnonymous));
const isAdmin = computed(() => adminRoles.has(userRole.value));
const formattedUserPoints = computed(() =>
  Number(userPoints.value || 0).toLocaleString(locale.value),
);
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
  isSettingsMenuOpen.value = false;
};

const handleLogout = async () => {
  await signOut(auth);
  isAccountMenuOpen.value = false;
  isSettingsMenuOpen.value = false;
  isMenuOpen.value = false;
};

const handleAvatarError = () => {
  avatarImageFailed.value = true;
};

const handleLocaleChange = (nextLocale) => {
  setLocale(nextLocale);
};

const toggleSettingsMenu = () => {
  isSettingsMenuOpen.value = !isSettingsMenuOpen.value;
  isAccountMenuOpen.value = false;
};

const closeFloatingMenus = () => {
  isSettingsMenuOpen.value = false;
  isAccountMenuOpen.value = false;
};

const handleDocumentClick = (event) => {
  const target = event.target;

  if (
    settingsMenuRef.value?.contains(target) ||
    accountMenuRef.value?.contains(target)
  ) {
    return;
  }

  closeFloatingMenus();
};

const handleEscape = (event) => {
  if (event.key === "Escape") {
    closeFloatingMenus();
  }
};

const listenUserProfile = (user) => {
  userRole.value = "";
  userUsername.value = "";
  userPoints.value = 0;

  if (!user || user.isAnonymous) {
    return;
  }

  getDoc(doc(db, "users", user.uid))
    .then((userSnap) => {
      if (currentUser.value?.uid === user.uid) {
        const userData = userSnap.data() || {};
        userRole.value = String(userData.role || "").trim().toLowerCase();
        userUsername.value = userData.username || "";
        userPoints.value = Number(userData.points || 0);
      }
    })
    .catch(() => {
      userRole.value = "";
      userUsername.value = "";
      userPoints.value = 0;
    });
};

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleEscape);
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    avatarImageFailed.value = false;
    isAccountMenuOpen.value = false;
    isSettingsMenuOpen.value = false;
    listenUserProfile(user);
  });
});

onUnmounted(() => {
  document.removeEventListener("click", handleDocumentClick);
  document.removeEventListener("keydown", handleEscape);
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
            :alt="$t('common.appNamePlain') + ' logo'"
            class="h-full w-full object-contain"
          />
        </span>
        <span>
          <span
            class="block text-base font-black uppercase leading-none tracking-wide sm:text-lg"
          >
            {{ $t("common.appNamePlain") }}
          </span>
          <span
            class="mt-1 hidden text-[10px] uppercase tracking-[0.28em] text-violet-200/70 sm:block"
          >
            {{ $t("common.tagline") }}
          </span>
        </span>
      </a>

      <div
        class="hidden items-center gap-1 rounded-full border border-white/10 bg-white/3 p-1 lg:flex"
      >
        <a
          v-for="item in navItems"
          :key="item.labelKey"
          :href="item.href"
          class="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {{ $t(item.labelKey) }}
        </a>
      </div>

      <div class="flex items-center gap-2">
        <div
          v-if="isSignedInUser"
          class="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 md:flex"
        >
          <span class="text-amber-300">◆</span>
          <span>{{ $t("common.points", { count: formattedUserPoints }) }}</span>
        </div>

        <div ref="settingsMenuRef" class="relative hidden md:block">
          <button
            type="button"
            class="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
            :aria-label="$t('nav.settings')"
            :aria-expanded="isSettingsMenuOpen"
            @click="toggleSettingsMenu"
          >
            <i class="fa-solid fa-gear" aria-hidden="true"></i>
          </button>

          <div
            v-if="isSettingsMenuOpen"
            class="absolute right-0 top-12 z-70 w-72 rounded-3xl border border-white/10 bg-[#080a18] p-3 text-white shadow-2xl shadow-black/40"
          >
            <p class="px-2 pb-3 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t("nav.settings") }}
            </p>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-2">
              <p class="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {{ $t("common.language.label") }}
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="item in availableLocales"
                  :key="item.code"
                  type="button"
                  class="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition"
                  :class="
                    locale === item.code
                      ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/20'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  "
                  :aria-pressed="locale === item.code"
                  @click="handleLocaleChange(item.code)"
                >
                  {{ item.code }}
                </button>
              </div>
            </div>
            <ThemeToggle class="mt-2 w-full" />
          </div>
        </div>

        <div v-if="isSignedInUser" ref="accountMenuRef" class="relative">
          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-fuchsia-950/30"
            :aria-label="$t('nav.userAccount')"
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
              {{ $t("nav.myProfile") }}
            </a>
            <a
              v-if="isAdmin"
              href="/admin"
              class="block rounded-2xl px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            >
              {{ $t("nav.adminPanel") }}
            </a>
            <button
              type="button"
              class="block w-full rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-200 transition hover:bg-red-500/10"
              @click="handleLogout"
            >
              {{ $t("nav.logout") }}
            </button>
          </div>
        </div>

        <button
          v-if="!isSignedInUser"
          type="button"
          class="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white lg:inline-flex"
          @click="openAuthModal"
        >
          {{ $t("nav.loginNoAccent") }}
        </button>

        <a
          v-if="!isSignedInUser"
          href="/registro"
          class="hidden rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold shadow-lg shadow-fuchsia-500/25 transition hover:shadow-fuchsia-500/40 sm:inline-flex"
        >
          {{ $t("nav.register") }}
        </a>

        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 lg:hidden"
          :aria-label="$t('nav.openMenu')"
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
          :key="item.labelKey"
          :href="item.href"
          class="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          @click="isMenuOpen = false"
        >
          {{ $t(item.labelKey) }}
        </a>

        <div
          class="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-3"
        >
          <div
            v-if="isSignedInUser"
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
            v-if="isSignedInUser"
            class="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100"
          >
            <span class="text-amber-300">◆</span>
            <span>{{ $t("common.points", { count: formattedUserPoints }) }}</span>
          </div>
          <div
            class="rounded-2xl border border-white/10 bg-white/5 p-2 text-center sm:col-span-3"
          >
            <p class="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {{ $t("common.language.label") }}
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="item in availableLocales"
                :key="item.code"
                type="button"
                class="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition"
                :class="
                  locale === item.code
                    ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/20'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                "
                :aria-pressed="locale === item.code"
                @click="handleLocaleChange(item.code)"
              >
                {{ item.code }}
              </button>
            </div>
          </div>
          <ThemeToggle class="sm:col-span-3" />
          <a
            v-if="isSignedInUser"
            :href="profileHref"
            class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-slate-100"
            @click="isMenuOpen = false"
          >
            {{ $t("nav.myProfile") }}
          </a>
          <a
            v-if="isSignedInUser && isAdmin"
            href="/admin"
            class="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-3 text-center text-sm font-black text-fuchsia-100"
            @click="isMenuOpen = false"
          >
            {{ $t("nav.adminPanel") }}
          </a>
          <button
            v-if="!isSignedInUser"
            type="button"
            class="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200"
            @click="openAuthModal"
          >
            {{ $t("nav.loginNoAccent") }}
          </button>
          <a
            v-if="!isSignedInUser"
            href="/registro"
            class="rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-center text-sm font-bold"
          >
            {{ $t("nav.register") }}
          </a>
          <button
            v-if="isSignedInUser"
            type="button"
            class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-100"
            @click="handleLogout"
          >
            {{ $t("nav.logout") }}
          </button>
        </div>
      </div>
    </div>

    <AuthModal v-if="isAuthModalOpen" @close="isAuthModalOpen = false" />
  </header>
</template>
