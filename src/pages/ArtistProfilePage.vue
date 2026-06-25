<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const pathParts = window.location.pathname.split("/").filter(Boolean);
const routeArtistKey = pathParts[1] || "";

const artist = ref(null);
const artistPolls = ref([]);
const followers = ref([]);
const currentUser = ref(null);
const isFollowing = ref(false);
const isLoading = ref(true);
const isTogglingFollow = ref(false);
const errorMessage = ref("");

let unsubscribeAuth = null;
let unsubscribeFollowers = null;
let unsubscribeFollowDoc = null;

const getArtistImage = (artistData) =>
  artistData?.image ||
  artistData?.imageUrl ||
  artistData?.photo ||
  artistData?.photoURL ||
  artistData?.foto ||
  "";

const getArtistBanner = (artistData) =>
  artistData?.banner ||
  artistData?.bannerUrl ||
  artistData?.cover ||
  artistData?.coverImage ||
  artistData?.portada ||
  getArtistImage(artistData);

const getArtistGroup = (artistData) =>
  artistData?.group || artistData?.fandom || "";

const formattedFollowers = computed(() =>
  followers.value.length.toLocaleString("es"),
);

const totalVotes = computed(() =>
  artistPolls.value.reduce((total, poll) => total + poll.votes, 0),
);

const averageSupport = computed(() => {
  const pollsWithVotes = artistPolls.value.filter(
    (poll) => poll.totalVotes > 0,
  );

  if (!pollsWithVotes.length) {
    return "0.00%";
  }

  const totalPercent = pollsWithVotes.reduce(
    (total, poll) => total + poll.percent,
    0,
  );
  return `${(totalPercent / pollsWithVotes.length).toFixed(2)}%`;
});

const popularityScore = computed(() =>
  Math.round(followers.value.length * 10 + totalVotes.value),
);

const stats = computed(() => [
  { label: "Seguidores", value: formattedFollowers.value },
  { label: "Votos acumulados", value: totalVotes.value.toLocaleString("es") },
  { label: "Apoyo promedio", value: averageSupport.value },
  { label: "Popularidad", value: popularityScore.value.toLocaleString("es") },
]);

const followLabel = computed(() => {
  if (!currentUser.value) {
    return "Inicia sesión para seguir";
  }

  return isFollowing.value ? "Siguiendo" : "Seguir";
});

const loadArtist = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const artistsSnap = await getDocs(
      query(collection(db, "artists"), where("slug", "==", routeArtistKey)),
    );
    const artistDoc = artistsSnap.docs[0];
    const artistSnapById = artistDoc
      ? null
      : await getDoc(doc(db, "artists", routeArtistKey));

    if (!artistDoc && !artistSnapById?.exists()) {
      errorMessage.value = "No encontramos ese artista.";
      artist.value = null;
      return;
    }

    artist.value = artistDoc
      ? {
          id: artistDoc.id,
          ...artistDoc.data(),
        }
      : {
          id: artistSnapById.id,
          ...artistSnapById.data(),
        };

    listenFollowers();
    await loadArtistPollStats();
  } catch {
    errorMessage.value = "No se pudo cargar el perfil del artista.";
  } finally {
    isLoading.value = false;
  }
};

const listenFollowers = () => {
  unsubscribeFollowers?.();
  unsubscribeFollowers = onSnapshot(
    collection(db, "artists", artist.value.id, "followers"),
    (followersSnap) => {
      followers.value = followersSnap.docs.map((followerDoc) => ({
        id: followerDoc.id,
        ...followerDoc.data(),
      }));
    },
  );
};

const listenFollowState = () => {
  unsubscribeFollowDoc?.();

  if (!currentUser.value || !artist.value?.id) {
    isFollowing.value = false;
    return;
  }

  unsubscribeFollowDoc = onSnapshot(
    doc(db, "artists", artist.value.id, "followers", currentUser.value.uid),
    (followSnap) => {
      isFollowing.value = followSnap.exists();
    },
  );
};

const loadArtistPollStats = async () => {
  if (!artist.value?.id) {
    artistPolls.value = [];
    return;
  }

  const pollsSnap = await getDocs(collection(db, "polls"));
  const stats = await Promise.all(
    pollsSnap.docs.map(async (pollDoc) => {
      const poll = {
        id: pollDoc.id,
        ...pollDoc.data(),
      };

      const roundsSnap = await getDocs(
        collection(db, "polls", pollDoc.id, "rounds"),
      );
      const contestantDocs = await Promise.all(
        roundsSnap.docs.map((roundDoc) =>
          getDocs(
            query(
              collection(
                db,
                "polls",
                pollDoc.id,
                "rounds",
                roundDoc.id,
                "contestants",
              ),
              where("artistId", "==", artist.value.id),
            ),
          ),
        ),
      );
      const contestants = contestantDocs.flatMap((snap) =>
        snap.docs.map((contestantDoc) => contestantDoc.data()),
      );
      const votes = contestants.reduce(
        (total, contestant) =>
          total +
          Number(
            contestant.totalVotes ??
              (contestant.votes || 0) + (contestant.manualVotes || 0),
          ),
        0,
      );

      if (!votes) {
        return null;
      }

      const totalPollVotes = roundsSnap.docs.length
        ? (
            await Promise.all(
              roundsSnap.docs.map((roundDoc) =>
                getDocs(
                  collection(
                    db,
                    "polls",
                    pollDoc.id,
                    "rounds",
                    roundDoc.id,
                    "contestants",
                  ),
                ),
              ),
            )
          )
            .flatMap((snap) =>
              snap.docs.map((contestantDoc) => contestantDoc.data()),
            )
            .reduce(
              (total, contestant) =>
                total +
                Number(
                  contestant.totalVotes ??
                    (contestant.votes || 0) + (contestant.manualVotes || 0),
                ),
              0,
            )
        : votes;

      return {
        title: poll.title || "Votación",
        status: poll.status || "draft",
        votes,
        totalVotes: totalPollVotes,
        percent: totalPollVotes ? (votes / totalPollVotes) * 100 : 0,
      };
    }),
  );

  artistPolls.value = stats
    .filter(Boolean)
    .sort((current, next) => next.votes - current.votes)
    .slice(0, 6);
};

const toggleFollow = async () => {
  if (!currentUser.value) {
    window.location.href = "/registro";
    return;
  }

  if (!artist.value?.id || isTogglingFollow.value) {
    return;
  }

  isTogglingFollow.value = true;
  errorMessage.value = "";

  try {
    const artistFollowRef = doc(
      db,
      "artists",
      artist.value.id,
      "followers",
      currentUser.value.uid,
    );
    const userFollowRef = doc(
      db,
      "users",
      currentUser.value.uid,
      "followingArtists",
      artist.value.id,
    );

    if (isFollowing.value) {
      await Promise.all([deleteDoc(artistFollowRef), deleteDoc(userFollowRef)]);
    } else {
      const followData = {
        artistId: artist.value.id,
        artistSlug: artist.value.slug || artist.value.id,
        userId: currentUser.value.uid,
        artistName: artist.value.name || "",
        artistImage: getArtistImage(artist.value),
        createdAt: serverTimestamp(),
      };

      await Promise.all([
        setDoc(artistFollowRef, followData),
        setDoc(userFollowRef, followData),
      ]);
    }
  } catch {
    errorMessage.value = "No se pudo actualizar el seguimiento.";
  } finally {
    isTogglingFollow.value = false;
  }
};

onMounted(async () => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    listenFollowState();
  });

  await loadArtist();
  listenFollowState();
});

onUnmounted(() => {
  unsubscribeAuth?.();
  unsubscribeFollowers?.();
  unsubscribeFollowDoc?.();
});
</script>

<template>
  <section class="mx-auto max-w-352 px-4 sm:px-6">
    <a
      href="/"
      class="inline-flex text-sm font-black text-fuchsia-300 transition hover:text-white"
    >
      ← Volver
    </a>

    <p
      v-if="errorMessage"
      class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <div
      v-if="isLoading"
      class="artist-profile-skeleton mt-6 overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20"
    >
      <div class="relative min-h-72 bg-white/5">
        <div class="absolute inset-0 skeleton-shimmer"></div>
        <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div class="flex items-end gap-4">
              <div class="size-28 rounded-3xl bg-white/10 sm:size-36"></div>
              <div>
                <div class="h-3 w-36 rounded-full bg-white/10"></div>
                <div class="mt-4 h-10 w-56 rounded-2xl bg-white/10 sm:h-14 sm:w-80"></div>
                <div class="mt-3 h-4 w-32 rounded-full bg-white/10"></div>
              </div>
            </div>
            <div class="h-12 w-36 rounded-full bg-white/10"></div>
          </div>
        </div>
      </div>

      <div class="p-5 lg:p-8">
        <div class="h-4 w-full max-w-3xl rounded-full bg-white/10"></div>
        <div class="mt-3 h-4 w-2/3 rounded-full bg-white/10"></div>
        <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="index in 4"
            :key="index"
            class="h-24 rounded-2xl border border-white/10 bg-white/5"
          ></div>
        </div>
        <div class="mt-5 h-36 rounded-3xl border border-white/10 bg-white/5"></div>
      </div>
    </div>

    <div
      v-else-if="artist"
      class="mt-6 overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20"
    >
      <div
        class="relative min-h-72 bg-linear-to-br from-blue-950 via-violet-950 to-fuchsia-950"
      >
        <img
          v-if="getArtistBanner(artist)"
          :src="getArtistBanner(artist)"
          :alt="artist.name"
          class="absolute inset-0 size-full object-cover opacity-55"
        />
        <div
          class="absolute inset-0 bg-linear-to-t from-[#090b19] via-[#090b19]/30 to-transparent"
        ></div>
        <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div
            class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
          >
            <div class="flex items-end gap-4">
              <div
                class="relative size-28 overflow-hidden rounded-3xl border-2 border-fuchsia-300/40 shadow-xl shadow-fuchsia-500/20 sm:size-36"
              >
                <img
                  v-if="getArtistImage(artist)"
                  :src="getArtistImage(artist)"
                  :alt="artist.name"
                  class="size-full object-cover"
                />
                <span
                  v-else
                  class="grid size-full place-items-center bg-linear-to-br from-violet-500 to-fuchsia-500 text-4xl font-black"
                >
                  {{ artist.name?.charAt(0) || "A" }}
                </span>
              </div>
              <div>
                <p
                  class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300"
                >
                  Perfil de artista
                </p>
                <h1
                  class="mt-2 text-4xl font-black leading-none text-white sm:text-6xl"
                >
                  {{ artist.name }}
                </h1>
                <p class="mt-2 text-lg font-black uppercase text-amber-300">
                  {{ artist.fandom }}
                </p>
              </div>
            </div>

            <div class="flex gap-3">
              <button
                class="rounded-full bg-linear-to-r from-pink-500 to-fuchsia-600 px-7 py-3 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105"
                type="button"
                :disabled="isTogglingFollow"
                @click="toggleFollow"
              >
                {{ isTogglingFollow ? "Guardando..." : followLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="p-5 lg:p-8">
        <div>
          <p class="text-sm font-bold leading-7 text-slate-300">
            {{ artist.bio }}
          </p>

          <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="stat in stats"
              :key="stat.label"
              class="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p
                class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
              >
                {{ stat.label }}
              </p>
              <p class="mt-1 text-2xl font-black text-white">
                {{ stat.value }}
              </p>
            </div>
          </div>

          <div
            class="mt-5 rounded-3xl border border-cyan-300/10 bg-cyan-500/5 p-4"
          >
            <p
              class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300"
            >
              Popularidad pública
            </p>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div class="rounded-2xl bg-white/7 p-4">
                <p class="text-xs font-bold text-slate-400">Seguidores</p>
                <p class="mt-1 text-2xl font-black text-cyan-200">
                  {{ formattedFollowers }}
                </p>
              </div>
              <div class="rounded-2xl bg-white/7 p-4">
                <p class="text-xs font-bold text-slate-400">Votos</p>
                <p class="mt-1 text-2xl font-black text-fuchsia-100">
                  {{ totalVotes.toLocaleString("es") }}
                </p>
              </div>
              <div class="rounded-2xl bg-white/7 p-4">
                <p class="text-xs font-bold text-slate-400">Score</p>
                <p class="mt-1 text-2xl font-black text-emerald-200">
                  {{ popularityScore.toLocaleString("es") }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div class="rounded-3xl border border-violet-300/15 bg-white/7 p-4">
              <p
                class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300"
              >
                Datos
              </p>
              <div
                class="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-200"
              >
                <span
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-2"
                >
                  Rol: {{ artist.role || "Artista" }}
                </span>
                <span
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-2"
                >
                  País: {{ artist.country || "Sin país" }}
                </span>
                <span
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-2"
                >
                  Fandom: {{ getArtistGroup(artist) || "Sin grupo" }}
                </span>
              </div>
            </div>

            <div
              class="rounded-3xl border border-amber-300/15 bg-amber-500/5 p-4"
            >
              <p
                class="text-xs font-black uppercase tracking-[0.22em] text-amber-300"
              >
                Logros
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="poll in artistPolls.slice(0, 3)"
                  :key="poll.title"
                  class="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100"
                >
                  {{ poll.title }}
                </span>
                <span
                  v-if="!artistPolls.length"
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-400"
                >
                  Sin logros todavía
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <article
        v-for="poll in artistPolls"
        :key="poll.title"
        class="rounded-3xl border border-violet-300/10 bg-[#090b19]/90 p-4 shadow-xl shadow-black/20"
      >
        <p class="text-xs font-black uppercase text-fuchsia-300">
          {{ poll.status }}
        </p>
        <h3 class="mt-2 text-lg font-black text-white">{{ poll.title }}</h3>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-400">Apoyo actual</span>
          <span class="text-xl font-black text-fuchsia-100"
            >{{ poll.percent.toFixed(2) }}%</span
          >
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-linear-to-r from-amber-300 to-fuchsia-500"
            :style="{ width: `${Math.min(poll.percent, 100)}%` }"
          ></div>
        </div>
        <p class="mt-2 text-xs font-bold text-slate-500">
          {{ poll.votes.toLocaleString("es") }} votos
        </p>
      </article>
      <p
        v-if="!artistPolls.length && artist"
        class="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-400 lg:col-span-3"
      >
        Este artista todavía no tiene votos registrados en rondas.
      </p>
    </div>
  </section>
  <div class="mb-8"></div>
</template>

<style scoped>
.artist-profile-skeleton {
  position: relative;
}

.skeleton-shimmer {
  background:
    linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.08) 45%, transparent 70%),
    radial-gradient(circle at 25% 20%, rgba(217, 70, 239, 0.18), transparent 30%),
    radial-gradient(circle at 80% 15%, rgba(34, 211, 238, 0.12), transparent 28%);
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    opacity: 0.45;
    transform: translateX(-12%);
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.45;
    transform: translateX(12%);
  }
}
</style>
