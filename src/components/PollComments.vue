<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getMe, getCurrentApiAuth } from "../services/api/authApi";
import { onStoredAuthChange } from "../services/api/client";
import {
  createPollComment,
  deletePollComment,
  getPollComments,
} from "../services/api/commentsApi";
import { subscribePollRealtime } from "../services/api/realtimeApi";
import ReportModal from "./ReportModal.vue";

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
});

const MAX_COMMENT_LENGTH = 500;
const MIN_COMMENT_LENGTH = 3;
const COMMENTS_PER_PAGE = 5;
const COMMENT_COOLDOWN_SECONDS = 5 * 60;
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";
const ADMIN_ROLES = new Set(["admin", "superadmin", "owner"]);

const commentText = ref("");
const comments = ref([]);
const currentUser = ref(null);
const currentUserProfile = ref(null);
const isPublishing = ref(false);
const isGifPickerOpen = ref(false);
const isLoadingGifs = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const cooldownRemaining = ref(0);
const gifSearchTerm = ref("");
const gifResults = ref([]);
const selectedGif = ref(null);
const currentCommentsPage = ref(1);
const commentsRoot = ref(null);
const isCommentsVisible = ref(false);
const isLoadingComments = ref(false);
const hasLoadedComments = ref(false);
const isReportModalOpen = ref(false);
const reportTarget = ref(null);

let unsubscribeAuth = null;
let cooldownTimer = null;
let commentsObserver = null;
let unsubscribeCommentsRealtime = null;
let subscribedCommentsPollId = null;

const remainingCharacters = computed(
  () => MAX_COMMENT_LENGTH - commentText.value.length,
);
const trimmedCommentText = computed(() => commentText.value.trim());
const hasEnoughCommentText = computed(
  () => trimmedCommentText.value.length >= MIN_COMMENT_LENGTH,
);
const isSignedInUser = computed(() => Boolean(currentUser.value));
const userInitial = computed(() => getInitial(currentDisplayName.value));
const currentDisplayName = computed(
  () =>
    currentUserProfile.value?.name ||
    currentUser.value?.displayName ||
    currentUser.value?.email?.split("@")[0] ||
    "Fan",
);
const currentPhotoURL = computed(
  () => currentUserProfile.value?.photoURL || currentUser.value?.photoURL || "",
);
const currentUserRole = computed(() =>
  String(currentUserProfile.value?.role || "").trim().toLowerCase(),
);
const isAdminUser = computed(() => ADMIN_ROLES.has(currentUserRole.value));
const canPublish = computed(
  () =>
    isSignedInUser.value &&
    hasEnoughCommentText.value &&
    !isPublishing.value &&
    (isAdminUser.value || cooldownRemaining.value <= 0),
);
const totalCommentPages = computed(() =>
  Math.max(1, Math.ceil(comments.value.length / COMMENTS_PER_PAGE)),
);
const paginatedComments = computed(() => {
  const startIndex = (currentCommentsPage.value - 1) * COMMENTS_PER_PAGE;

  return comments.value.slice(startIndex, startIndex + COMMENTS_PER_PAGE);
});

const getInitial = (name = "") =>
  (name || "U").trim().charAt(0).toUpperCase() || "U";

const getDisplayName = (user) =>
  currentUserProfile.value?.name || user?.displayName || user?.email?.split("@")[0] || "Fan";

const formatTime = (createdAt) => {
  const date = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);

  if (!date || Number.isNaN(date.getTime())) {
    return "Ahora";
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 60) {
    return "Ahora";
  }

  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)} min`;
  }

  if (diffSeconds < 86400) {
    return `${Math.floor(diffSeconds / 3600)} h`;
  }

  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
};

const formatCooldown = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")} min`;
};

const normalizeGiphyResult = (gif) => ({
  id: gif.id || "",
  url: gif.images?.fixed_height?.url || gif.images?.original?.url || "",
  previewUrl:
    gif.images?.fixed_width_small_still?.url ||
    gif.images?.fixed_height_small_still?.url ||
    gif.images?.fixed_height?.url ||
    "",
  title: gif.title || "GIF de GIPHY",
  source: "giphy",
});

const searchGifs = async (term = gifSearchTerm.value) => {
  if (!GIPHY_API_KEY) {
    errorMessage.value = "Falta configurar VITE_GIPHY_API_KEY para buscar GIFs.";
    return;
  }

  isLoadingGifs.value = true;
  errorMessage.value = "";

  try {
    const endpoint = term.trim()
      ? "https://api.giphy.com/v1/gifs/search"
      : "https://api.giphy.com/v1/gifs/trending";
    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      limit: "12",
      rating: "pg-13",
    });

    if (term.trim()) {
      params.set("q", term.trim());
      params.set("lang", "es");
    }

    const response = await fetch(`${endpoint}?${params.toString()}`);

    if (!response.ok) {
      throw new Error("giphy-error");
    }

    const payload = await response.json();
    gifResults.value = (payload.data || [])
      .map(normalizeGiphyResult)
      .filter((gif) => gif.url);
  } catch {
    errorMessage.value = "No se pudieron cargar GIFs de GIPHY.";
  } finally {
    isLoadingGifs.value = false;
  }
};

const toggleGifPicker = () => {
  isGifPickerOpen.value = !isGifPickerOpen.value;

  if (isGifPickerOpen.value && !gifResults.value.length) {
    searchGifs();
  }
};

const closeGifPicker = () => {
  isGifPickerOpen.value = false;
};

const selectGif = (gif) => {
  selectedGif.value = gif;
  closeGifPicker();
};

const clearSelectedGif = () => {
  selectedGif.value = null;
};

const goToCommentsPage = (page) => {
  currentCommentsPage.value = Math.min(
    totalCommentPages.value,
    Math.max(1, page),
  );
};

const runCooldownTimer = () => {
  window.clearInterval(cooldownTimer);
  cooldownTimer = window.setInterval(() => {
    cooldownRemaining.value = Math.max(0, cooldownRemaining.value - 1);

    if (cooldownRemaining.value <= 0) {
      window.clearInterval(cooldownTimer);
    }
  }, 1000);
};

const startCooldown = () => {
  cooldownRemaining.value = COMMENT_COOLDOWN_SECONDS;
  runCooldownTimer();
};

const startCooldownFromRemaining = () => {
  runCooldownTimer();
};

const normalizeComment = (comment) => ({
  id: String(comment.id),
  userId: comment.userId === null || comment.userId === undefined ? null : String(comment.userId),
  displayName: comment.displayName || "Fan",
  photoURL: comment.photoUrl || comment.photoURL || "",
  text: comment.text || "",
  gif: comment.gif?.url ? comment.gif : null,
  createdAt: comment.createdAt || null,
});

const canDeleteComment = (comment) =>
  isAdminUser.value ||
  (currentUser.value && comment.userId && comment.userId === String(currentUser.value.id));

const canReportComment = (comment) =>
  isSignedInUser.value &&
  comment.userId &&
  comment.userId !== String(currentUser.value.id);

const openReportComment = (comment) => {
  reportTarget.value = {
    targetType: "comment",
    targetId: comment.id,
    reportedUserId: comment.userId || "",
    pollId: props.pollId,
    contextLabel: comment.displayName || "",
  };
  isReportModalOpen.value = true;
};

const closeReportModal = () => {
  isReportModalOpen.value = false;
  reportTarget.value = null;
};

const subscribeCommentsRealtime = (pollId) => {
  if (!pollId || subscribedCommentsPollId === pollId) {
    return;
  }

  unsubscribeCommentsRealtime?.();
  subscribedCommentsPollId = pollId;

  unsubscribeCommentsRealtime = subscribePollRealtime(pollId, {
    onCommentEvent: (event) => {
      if (!event) {
        return;
      }

      if (event.action === "new" && event.comment) {
        const incoming = normalizeComment(event.comment);
        if (comments.value.some((item) => item.id === incoming.id)) {
          return;
        }
        comments.value = [incoming, ...comments.value];
        return;
      }

      if (event.action === "deleted" && event.commentId) {
        const removedId = String(event.commentId);
        comments.value = comments.value.filter((item) => item.id !== removedId);
      }
    },
  });
};

const stopCommentsRealtime = () => {
  unsubscribeCommentsRealtime?.();
  unsubscribeCommentsRealtime = null;
  subscribedCommentsPollId = null;
};

const loadComments = async () => {
  if (!props.pollId || !isCommentsVisible.value) {
    return;
  }

  errorMessage.value = "";
  isLoadingComments.value = true;

  try {
    const rows = await getPollComments(props.pollId, 100);
    comments.value = (rows || []).map(normalizeComment);
    subscribeCommentsRealtime(props.pollId);
  } catch {
    errorMessage.value = "No se pudieron cargar los comentarios.";
  } finally {
    isLoadingComments.value = false;
    hasLoadedComments.value = true;
  }
};

const resetAndLoadComments = () => {
  comments.value = [];
  hasLoadedComments.value = false;
  loadComments();
};

const stopCommentsListener = () => {};

const publishComment = async () => {
  const text = trimmedCommentText.value;

  if (isPublishing.value) {
    return;
  }

  if (!isSignedInUser.value) {
    errorMessage.value = "Inicia sesión para comentar.";
    return;
  }

  if (!hasEnoughCommentText.value) {
    errorMessage.value = `Escribe al menos ${MIN_COMMENT_LENGTH} letras para comentar.`;
    return;
  }

  if (!isAdminUser.value && cooldownRemaining.value > 0) {
    errorMessage.value = `Espera ${formatCooldown(cooldownRemaining.value)} antes de comentar otra vez.`;
    return;
  }

  isPublishing.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const created = await createPollComment(props.pollId, {
      text,
      gif: selectedGif.value
        ? { url: selectedGif.value.url, title: selectedGif.value.title }
        : null,
    });

    comments.value = [normalizeComment(created), ...comments.value];
    commentText.value = "";
    selectedGif.value = null;
    currentCommentsPage.value = 1;
    successMessage.value = "Comentario publicado.";

    if (!isAdminUser.value) {
      startCooldown();
    }
  } catch (error) {
    if (error.status === 429) {
      const remainingMs = Number(error.payload?.remainingMs || 0);
      if (remainingMs > 0) {
        cooldownRemaining.value = Math.ceil(remainingMs / 1000);
        startCooldownFromRemaining();
      }
      errorMessage.value = "Espera antes de comentar otra vez.";
    } else if (error.status === 401) {
      errorMessage.value = "Inicia sesión para comentar.";
    } else {
      errorMessage.value = error.message || "No se pudo publicar el comentario.";
    }
  } finally {
    isPublishing.value = false;
  }
};

const removeComment = async (comment) => {
  if (!canDeleteComment(comment)) {
    return;
  }

  errorMessage.value = "";

  try {
    await deletePollComment(props.pollId, comment.id);
    comments.value = comments.value.filter((item) => item.id !== comment.id);
  } catch {
    errorMessage.value = "No se pudo eliminar el comentario.";
  }
};

watch(
  () => props.pollId,
  () => {
    stopCommentsListener();
    stopCommentsRealtime();
    resetAndLoadComments();
  },
);
watch(comments, () => {
  if (currentCommentsPage.value > totalCommentPages.value) {
    currentCommentsPage.value = totalCommentPages.value;
  }
});

const listenCurrentUserProfile = (user) => {
  currentUserProfile.value = null;

  if (!user) {
    return;
  }

  currentUserProfile.value = {
    name: user.displayName || user.username || user.email?.split("@")[0] || "Fan",
    photoURL: user.photoURL || user.photoUrl || "",
    role: String(user.role || "").trim().toLowerCase(),
  };

  getMe()
    .then((userData) => {
      if (userData && currentUser.value) {
        currentUserProfile.value = {
          name: userData.displayName || userData.username || userData.name || currentUserProfile.value.name,
          photoURL: userData.photoURL || userData.photoUrl || currentUserProfile.value.photoURL,
          role: String(userData.role || "").trim().toLowerCase(),
        };
      }
    })
    .catch(() => {});
};

onMounted(() => {
  const syncAuth = (authState = getCurrentApiAuth()) => {
    currentUser.value = authState?.user || null;
    listenCurrentUserProfile(currentUser.value);
  };

  syncAuth();
  unsubscribeAuth = onStoredAuthChange(syncAuth);

  if ("IntersectionObserver" in window && commentsRoot.value) {
    commentsObserver = new IntersectionObserver(
      ([entry]) => {
        isCommentsVisible.value = Boolean(entry?.isIntersecting);
        if (isCommentsVisible.value) {
          loadComments();
        } else {
          stopCommentsListener();
        }
      },
      { rootMargin: "200px 0px" },
    );
    commentsObserver.observe(commentsRoot.value);
  } else {
    isCommentsVisible.value = true;
    loadComments();
  }
});

onUnmounted(() => {
  unsubscribeAuth?.();
  commentsObserver?.disconnect();
  stopCommentsRealtime();
  window.clearInterval(cooldownTimer);
});
</script>

<template>
  <section ref="commentsRoot" class="mx-auto mt-10 max-w-5xl">
    <div class="mb-5 flex items-end justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">
          {{ $t('widgets.comments.eyebrow') }}
        </p>
        <h2 class="mt-1 text-2xl font-black text-white drop-shadow-[0_0_12px_rgba(217,70,239,0.25)]">
          {{ $t('widgets.comments.title') }}
        </h2>
      </div>
      <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-1 text-sm font-black text-fuchsia-100">
        {{ comments.length }}
      </span>
    </div>

    <div class="relative overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 p-4 shadow-xl shadow-fuchsia-950/20">
      <div class="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-fuchsia-300/60 to-transparent"></div>
      <div class="pointer-events-none absolute -right-20 -top-20 size-44 rounded-full bg-fuchsia-500/10 blur-3xl"></div>
      <div class="flex gap-3">
        <div class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-fuchsia-500 to-violet-500 text-sm font-black shadow-lg shadow-fuchsia-500/25">
          <img
            v-if="currentPhotoURL"
            :src="currentPhotoURL"
            :alt="currentDisplayName"
            class="size-full object-cover"
            referrerpolicy="no-referrer"
          />
          <span v-else>{{ userInitial }}</span>
        </div>
        <textarea
          v-model="commentText"
          maxlength="500"
          class="min-h-24 flex-1 resize-none rounded-2xl border border-violet-300/15 bg-[#050817]/95 p-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50 focus:shadow-[0_0_24px_rgba(217,70,239,0.12)]"
          :placeholder="$t('widgets.comments.placeholder')"
          :disabled="!isSignedInUser || isPublishing"
        ></textarea>
      </div>
      <div
        v-if="selectedGif"
        class="mt-3 ml-13 max-w-xs overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/70"
      >
        <div class="relative">
          <img
            :src="selectedGif.url"
            :alt="selectedGif.title"
            class="max-h-56 w-full object-cover"
          />
          <button
            type="button"
            class="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white"
            @click="clearSelectedGif"
          >
            Quitar
          </button>
        </div>
        <p class="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          GIF por GIPHY
        </p>
      </div>
      <div class="mt-3 flex flex-col gap-3 pl-13 sm:flex-row sm:items-center sm:justify-between">
        <p
          class="font-bold"
          :class="
            !isSignedInUser
              ? 'rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 shadow-lg shadow-cyan-950/15'
              : !isAdminUser && cooldownRemaining > 0
              ? 'rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-950/15'
              : 'text-[10px] text-slate-500'
          "
        >
          <span v-if="!isSignedInUser" class="flex items-center gap-2">
            <i class="fa-solid fa-user-lock text-cyan-300" aria-hidden="true"></i>
            <span>Inicia sesión para participar.</span>
          </span>
          <span v-else-if="!isAdminUser && cooldownRemaining > 0" class="flex items-center gap-2">
            <i class="fa-solid fa-clock text-amber-300" aria-hidden="true"></i>
            <span>
              Espera
              <strong class="text-base font-black text-amber-200">
                {{ formatCooldown(cooldownRemaining) }}
              </strong>
              para comentar otra vez.
            </span>
          </span>
          <span v-else-if="isAdminUser" class="text-cyan-200">
            Admin: sin bloqueo anti-spam. Mínimo {{ MIN_COMMENT_LENGTH }} letras.
          </span>
          <span v-else-if="!hasEnoughCommentText">
            Mínimo {{ MIN_COMMENT_LENGTH }} letras para comentar.
          </span>
          <span v-else>{{ remainingCharacters }}/500</span>
        </p>
        <div class="flex items-center gap-2">
          <button
            class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-xs font-black uppercase text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            :disabled="!isSignedInUser || isPublishing"
            @click="toggleGifPicker"
          >
            GIF
          </button>
          <button
            class="rounded-full bg-linear-to-r from-pink-500 to-fuchsia-600 px-7 py-3 text-xs font-black uppercase text-white shadow-lg shadow-fuchsia-500/25 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            :disabled="!canPublish"
            @click="publishComment"
          >
            {{ isPublishing ? 'Publicando...' : $t('widgets.comments.publish') }}
          </button>
        </div>
      </div>
      <p
        v-if="errorMessage"
        class="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200"
      >
        {{ successMessage }}
      </p>
    </div>

    <p class="mt-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
      {{ $t('widgets.comments.count', { count: comments.length }) }}
    </p>

    <div class="mt-4 space-y-4">
      <article
        v-for="comment in paginatedComments"
        :key="comment.id"
        class="grid grid-cols-[3rem_1fr] gap-3"
      >
        <div class="grid size-10 place-items-center overflow-hidden rounded-full border border-cyan-300/10 bg-linear-to-br from-slate-700 to-slate-900 text-sm font-black text-white shadow-lg shadow-black/20">
          <img
            v-if="comment.photoURL"
            :src="comment.photoURL"
            :alt="comment.displayName"
            class="size-full object-cover"
            referrerpolicy="no-referrer"
          />
          <span v-else>{{ getInitial(comment.displayName) }}</span>
        </div>
        <div class="rounded-2xl border border-white/8 bg-white/7 p-4 shadow-lg shadow-black/10">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-black text-white">
              {{ comment.displayName || 'Fan' }}
              <span class="ml-2 text-[10px] font-bold text-slate-500">
                {{ formatTime(comment.createdAt) }}
              </span>
            </p>
            <div class="flex items-center gap-2">
              <button
                v-if="canReportComment(comment)"
                class="rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200 transition hover:bg-red-500/20"
                type="button"
                @click="openReportComment(comment)"
              >
                <i class="fa-solid fa-flag mr-1" aria-hidden="true"></i>
                {{ $t('report.button') }}
              </button>
              <button
                v-if="canDeleteComment(comment)"
                class="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-200 transition hover:bg-red-500/20"
                type="button"
                @click="removeComment(comment)"
              >
                × Eliminar
              </button>
            </div>
          </div>
          <p v-if="comment.text" class="mt-4 text-sm font-bold text-slate-200">
            {{ comment.text }}
          </p>
          <div
            v-if="comment.gif?.url"
            class="mt-4 max-w-sm overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-950/60"
          >
            <img
              :src="comment.gif.url"
              :alt="comment.gif.title || 'GIF de GIPHY'"
              class="max-h-72 w-full object-cover"
            />
            <p class="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              GIF por GIPHY
            </p>
          </div>
        </div>
      </article>

      <p
        v-if="isLoadingComments && !comments.length"
        class="flex items-center justify-center gap-2 rounded-3xl border border-white/8 bg-white/5 p-6 text-center text-sm font-bold text-slate-400"
      >
        <i class="fa-solid fa-spinner fa-spin text-fuchsia-300" aria-hidden="true"></i>
        Cargando comentarios...
      </p>
      <div
        v-else-if="!comments.length && hasLoadedComments"
        class="comments-empty relative overflow-hidden rounded-3xl border border-fuchsia-300/15 bg-[#0a0c1c]/80 p-8 text-center"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(217,70,239,0.18),transparent_38%),radial-gradient(circle_at_85%_100%,rgba(34,211,238,0.14),transparent_40%)]"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-fuchsia-500/10 blur-3xl"></div>

        <div class="relative">
          <div class="comments-empty-orb mx-auto grid size-16 place-items-center rounded-3xl border border-fuchsia-300/25 bg-linear-to-br from-fuchsia-500/20 to-cyan-400/15 text-2xl text-fuchsia-200 shadow-lg shadow-fuchsia-950/30">
            <i class="fa-solid fa-comments" aria-hidden="true"></i>
          </div>
          <h3 class="mt-4 text-lg font-black text-white">
            Aún no hay comentarios
          </h3>
          <p class="mx-auto mt-2 max-w-md text-sm font-bold leading-6 text-slate-400">
            Sé el primero en comentar lo que está pasando en esta votación.
          </p>
          <span
            v-if="isSignedInUser"
            class="mt-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-fuchsia-100"
          >
            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
            Escribe arriba para empezar
          </span>
          <span
            v-else
            class="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100"
          >
            <i class="fa-solid fa-user-lock" aria-hidden="true"></i>
            Inicia sesión para comentar
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="comments.length > COMMENTS_PER_PAGE"
      class="mt-5 flex flex-col items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/5 p-3 sm:flex-row"
    >
      <p class="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Página {{ currentCommentsPage }} de {{ totalCommentPages }}
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black uppercase text-slate-200 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentCommentsPage <= 1"
          @click="goToCommentsPage(currentCommentsPage - 1)"
        >
          Anterior
        </button>
        <button
          v-for="page in totalCommentPages"
          :key="`comments-page-${page}`"
          type="button"
          class="grid size-9 place-items-center rounded-full text-xs font-black transition"
          :class="
            page === currentCommentsPage
              ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/25'
              : 'border border-white/10 bg-white/8 text-slate-300 hover:bg-white/12'
          "
          @click="goToCommentsPage(page)"
        >
          {{ page }}
        </button>
        <button
          type="button"
          class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black uppercase text-slate-200 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentCommentsPage >= totalCommentPages"
          @click="goToCommentsPage(currentCommentsPage + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>
  </section>

  <Teleport to="body">
    <Transition name="gif-modal">
      <div
        v-if="isGifPickerOpen"
        class="fixed inset-0 z-999 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        @click.self="closeGifPicker"
      >
        <div class="relative w-full max-w-4xl overflow-hidden rounded-4xl border border-cyan-300/20 bg-[#070a18] p-4 text-white shadow-2xl shadow-cyan-950/35 sm:p-5">
          <div class="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-cyan-400/15 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-24 left-0 size-72 rounded-full bg-fuchsia-500/12 blur-3xl"></div>

          <div class="relative flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                GIPHY
              </p>
              <h3 class="mt-1 text-2xl font-black text-white">
                Buscar GIF
              </h3>
            </div>
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/8 text-lg font-black text-white transition hover:bg-white/15"
              @click="closeGifPicker"
            >
              ×
            </button>
          </div>

          <form class="relative mt-5 flex flex-col gap-2 sm:flex-row" @submit.prevent="searchGifs()">
            <input
              v-model="gifSearchTerm"
              class="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#050817] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
              placeholder="Buscar GIF en GIPHY..."
              autofocus
            />
            <button
              type="submit"
              class="rounded-2xl bg-cyan-400/15 px-5 py-3 text-xs font-black uppercase text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-40"
              :disabled="isLoadingGifs"
            >
              Buscar
            </button>
          </form>

          <p
            v-if="isLoadingGifs"
            class="relative py-12 text-center text-xs font-bold text-slate-400"
          >
            Cargando GIFs...
          </p>
          <div
            v-else
            class="relative mt-4 grid max-h-[58vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4"
          >
            <button
              v-for="gif in gifResults"
              :key="gif.id"
              type="button"
              class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:scale-[1.02] hover:border-cyan-300/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              @click="selectGif(gif)"
            >
              <img
                :src="gif.previewUrl || gif.url"
                :alt="gif.title"
                class="h-32 w-full object-cover sm:h-36"
              />
            </button>
          </div>
          <p class="relative mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Powered by GIPHY
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ReportModal
    v-if="reportTarget"
    :open="isReportModalOpen"
    :target-type="reportTarget.targetType"
    :target-id="reportTarget.targetId"
    :reported-user-id="reportTarget.reportedUserId"
    :poll-id="reportTarget.pollId"
    :context-label="reportTarget.contextLabel"
    @close="closeReportModal"
  />
</template>

<style scoped>
.gif-modal-enter-active,
.gif-modal-leave-active {
  transition: opacity 0.18s ease;
}

.gif-modal-enter-from,
.gif-modal-leave-to {
  opacity: 0;
}

.comments-empty-orb {
  animation: comments-empty-float 3s ease-in-out infinite;
}

@keyframes comments-empty-float {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 14px 30px rgba(217, 70, 239, 0.18);
  }
  50% {
    transform: translateY(-6px);
    box-shadow: 0 0 42px rgba(217, 70, 239, 0.4);
  }
}
</style>
