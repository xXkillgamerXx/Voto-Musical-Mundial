<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

const polls = ref([]);
const isLoading = ref(true);
const errorMessage = ref("");
let unsubscribePolls = null;

const pollUrl = (poll) =>
  `/votacion/${poll.year || new Date().getFullYear()}/${poll.slug || poll.id}`;

const statusLabel = (status) =>
  ({
    live: "En vivo",
    selecting_winners: "En proceso",
    closed: "Cerrada",
    draft: "Borrador",
  })[status] || "Borrador";

const statusClass = (status) =>
  ({
    live: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    selecting_winners: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    closed: "border-slate-300/20 bg-white/5 text-slate-200",
  })[status] || "border-white/10 bg-white/5 text-slate-300";

const formatDate = (value) => {
  const date = value?.toDate?.();

  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const visiblePolls = computed(() =>
  polls.value.filter((poll) =>
    ["live", "selecting_winners", "closed"].includes(poll.status),
  ),
);

const openPolls = computed(() =>
  visiblePolls.value.filter((poll) =>
    ["live", "selecting_winners"].includes(poll.status),
  ),
);

const closedPolls = computed(() =>
  visiblePolls.value.filter((poll) => poll.status === "closed"),
);

const loadPolls = () => {
  isLoading.value = true;
  errorMessage.value = "";

  unsubscribePolls = onSnapshot(
    query(collection(db, "polls"), orderBy("createdAt", "desc")),
    (pollsSnap) => {
      polls.value = pollsSnap.docs.map((pollDoc) => ({
        id: pollDoc.id,
        ...pollDoc.data(),
      }));
      isLoading.value = false;
    },
    () => {
      errorMessage.value = "No se pudieron cargar las votaciones.";
      isLoading.value = false;
    },
  );
};

onMounted(loadPolls);

onUnmounted(() => {
  unsubscribePolls?.();
});
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div
      class="rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-violet-950/20 sm:p-8"
    >
      <p
        class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300"
      >
        Votaciones
      </p>
      <h1
        class="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl"
      >
        Votaciones abiertas y cerradas
      </h1>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        Entra a votar mientras esten en vivo o revisa los resultados de
        votaciones ya cerradas.
      </p>
    </div>

    <p
      v-if="errorMessage"
      class="mt-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="isLoading"
      class="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-300"
    >
      Cargando votaciones...
    </p>

    <template v-else>
      <section class="mt-8">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-xl font-black uppercase tracking-tight text-white">
            En vivo / proceso
          </h2>
          <span
            class="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-100"
          >
            {{ openPolls.length }} activas
          </span>
        </div>

        <div v-if="openPolls.length" class="grid gap-4 lg:grid-cols-2">
          <article
            v-for="poll in openPolls"
            :key="poll.id"
            class="overflow-hidden rounded-3xl border border-white/10 bg-[#090b19]/90 shadow-xl shadow-violet-950/20"
          >
            <div
              class="relative h-52 overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-800 to-slate-950"
            >
              <img
                v-if="poll.banner"
                :src="poll.banner"
                :alt="poll.title"
                class="absolute inset-0 size-full object-cover"
              />
              <div
                class="absolute inset-0 bg-linear-to-t from-[#080a17] via-black/15 to-white/5"
              ></div>
              <span
                class="absolute left-4 top-4 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="statusClass(poll.status)"
              >
                {{ statusLabel(poll.status) }}
              </span>
            </div>

            <div class="p-5">
              <h3 class="text-2xl font-black text-white">
                {{ poll.title || "Votacion" }}
              </h3>
              <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                {{ poll.description || "Votacion en tiempo real." }}
              </p>
              <p
                class="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500"
              >
                Finaliza: {{ formatDate(poll.endAt) }}
              </p>
              <a
                :href="pollUrl(poll)"
                class="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01]"
              >
                {{
                  poll.status === "selecting_winners"
                    ? "Ver proceso"
                    : "Votar ahora"
                }}
              </a>
            </div>
          </article>
        </div>

        <article
          v-else
          class="relative overflow-hidden rounded-4xl border border-violet-300/15 bg-[#080a18]/90 p-6 shadow-2xl shadow-violet-950/20 sm:p-8"
        >
          <div
            class="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-fuchsia-400/15 blur-3xl"
          ></div>
          <div
            class="pointer-events-none absolute -bottom-28 right-0 size-80 rounded-full bg-cyan-400/10 blur-3xl"
          ></div>
          <div
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(217,70,239,0.18),transparent_24%)]"
          ></div>

          <div
            class="relative grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-stretch"
          >
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100"
                >
                  Próximamente
                </span>
                <span
                  class="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300"
                >
                  En vivo / proceso
                </span>
              </div>
              <h3 class="mt-3 text-3xl font-black text-white">
                No hay votaciones activas ahora
              </h3>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Estamos preparando las próximas batallas. Mientras tanto puedes
                explorar resultados cerrados, visitar el ranking popularity o
                volver cuando el contador vuelva a encenderse.
              </p>

              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <i
                    class="fa-solid fa-clock text-fuchsia-200"
                    aria-hidden="true"
                  ></i>
                  <p
                    class="mt-2 text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Estado
                  </p>
                  <p class="mt-1 text-lg font-black text-white">En espera</p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <i
                    class="fa-solid fa-trophy text-amber-200"
                    aria-hidden="true"
                  ></i>
                  <p
                    class="mt-2 text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Resultados
                  </p>
                  <p class="mt-1 text-lg font-black text-white">
                    {{ closedPolls.length }}
                  </p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <i
                    class="fa-solid fa-fire text-cyan-200"
                    aria-hidden="true"
                  ></i>
                  <p
                    class="mt-2 text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Próximo live
                  </p>
                  <p class="mt-1 text-lg font-black text-white">Pendiente</p>
                </div>
              </div>
            </div>

            <div class="flex flex-col justify-end gap-3 sm:flex-row lg:min-w-80 lg:flex-col">
              <a
                href="/ranking-popularity"
                class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/25 transition hover:scale-[1.01]"
              >
                Ver ranking
              </a>
              <a
                href="/salon-de-la-fama"
                class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 px-5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/12"
              >
                Salón de la fama
              </a>
            </div>
          </div>
        </article>
      </section>

      <section class="mt-10">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-xl font-black uppercase tracking-tight text-white">
            Cerradas
          </h2>
          <span
            class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300"
          >
            {{ closedPolls.length }} cerradas
          </span>
        </div>

        <div
          v-if="closedPolls.length"
          class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <article
            v-for="poll in closedPolls"
            :key="poll.id"
            class="overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:border-fuchsia-300/25 hover:bg-white/8"
          >
            <div
              class="relative h-40 overflow-hidden bg-linear-to-br from-slate-900 via-violet-950 to-slate-950"
            >
              <img
                v-if="poll.banner"
                :src="poll.banner"
                :alt="poll.title"
                class="absolute inset-0 size-full object-cover opacity-75"
              />
              <div
                class="absolute inset-0 bg-linear-to-t from-[#080a17] to-transparent"
              ></div>
              <span
                class="absolute left-4 top-4 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="statusClass(poll.status)"
              >
                {{ statusLabel(poll.status) }}
              </span>
            </div>

            <div class="p-5">
              <h3 class="line-clamp-2 text-lg font-black text-white">
                {{ poll.title || "Votacion" }}
              </h3>
              <p
                class="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500"
              >
                Finalizo: {{ formatDate(poll.endAt) }}
              </p>
              <a
                :href="pollUrl(poll)"
                class="mt-4 inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-5 py-2 text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              >
                Ver resultados
              </a>
            </div>
          </article>
        </div>

        <p
          v-else
          class="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-400"
        >
          Todavia no hay votaciones cerradas.
        </p>
      </section>
    </template>
  </section>
</template>
