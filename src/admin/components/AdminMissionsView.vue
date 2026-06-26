<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const missionTypes = [
  { value: "vote_count", label: "Votar varias veces" },
  { value: "daily_login", label: "Entrar varios dias" },
  { value: "share_poll", label: "Compartir votacion" },
  { value: "follow_artist", label: "Seguir artista" },
  { value: "favorite_poll", label: "Dar like/favorito" },
  { value: "complete_profile", label: "Completar perfil" },
  { value: "manual", label: "Manual / externa" },
];

const emptyForm = {
  title: "",
  description: "",
  type: "vote_count",
  target: 1,
  rewardPoints: 25,
  icon: "fa-solid fa-check",
  order: 1,
  active: true,
  featured: false,
};

const missions = ref([]);
const form = ref({ ...emptyForm });
const editingMissionId = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
let unsubscribeMissions = null;

const formTitle = computed(() =>
  editingMissionId.value ? "Editar mision" : "Crear mision",
);

const typeLabel = (type) =>
  missionTypes.find((missionType) => missionType.value === type)?.label || "Manual";

const resetForm = () => {
  editingMissionId.value = "";
  form.value = {
    ...emptyForm,
    order: missions.value.length + 1,
  };
};

const editMission = (mission) => {
  editingMissionId.value = mission.id;
  form.value = {
    title: mission.title || "",
    description: mission.description || "",
    type: mission.type || "manual",
    target: Number(mission.target || 1),
    rewardPoints: Number(mission.rewardPoints || 0),
    icon: mission.icon || "fa-solid fa-check",
    order: Number(mission.order || 1),
    active: mission.active !== false,
    featured: Boolean(mission.featured),
  };
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const missionPayload = () => ({
  title: form.value.title.trim(),
  description: form.value.description.trim(),
  type: form.value.type,
  target: Math.max(1, Math.floor(Number(form.value.target || 1))),
  rewardPoints: Math.max(0, Math.floor(Number(form.value.rewardPoints || 0))),
  icon: form.value.icon.trim() || "fa-solid fa-check",
  order: Math.max(1, Math.floor(Number(form.value.order || 1))),
  active: Boolean(form.value.active),
  featured: Boolean(form.value.featured),
  updatedAt: serverTimestamp(),
});

const saveMission = async () => {
  errorMessage.value = "";
  successMessage.value = "";

  if (!form.value.title.trim()) {
    errorMessage.value = "Escribe el titulo de la mision.";
    return;
  }

  if (!form.value.description.trim()) {
    errorMessage.value = "Escribe una descripcion para la mision.";
    return;
  }

  isSaving.value = true;

  try {
    const payload = missionPayload();

    if (editingMissionId.value) {
      await updateDoc(doc(db, "missions", editingMissionId.value), payload);
      successMessage.value = "Mision actualizada.";
    } else {
      await addDoc(collection(db, "missions"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      successMessage.value = "Mision creada.";
    }

    resetForm();
  } catch {
    errorMessage.value = "No se pudo guardar la mision.";
  } finally {
    isSaving.value = false;
  }
};

const toggleMission = async (mission) => {
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await updateDoc(doc(db, "missions", mission.id), {
      active: mission.active === false,
      updatedAt: serverTimestamp(),
    });
  } catch {
    errorMessage.value = "No se pudo cambiar el estado de la mision.";
  }
};

const removeMission = async (mission) => {
  const confirmed = window.confirm(`Eliminar "${mission.title}"?`);

  if (!confirmed) {
    return;
  }

  errorMessage.value = "";
  successMessage.value = "";

  try {
    await deleteDoc(doc(db, "missions", mission.id));
    successMessage.value = "Mision eliminada.";

    if (editingMissionId.value === mission.id) {
      resetForm();
    }
  } catch {
    errorMessage.value = "No se pudo eliminar la mision.";
  }
};

onMounted(() => {
  unsubscribeMissions = onSnapshot(
    query(collection(db, "missions"), orderBy("order", "asc")),
    (missionsSnap) => {
      missions.value = missionsSnap.docs.map((missionDoc) => ({
        id: missionDoc.id,
        ...missionDoc.data(),
      }));
      isLoading.value = false;
    },
    () => {
      errorMessage.value = "No se pudieron cargar las misiones.";
      isLoading.value = false;
    },
  );
});

onUnmounted(() => {
  unsubscribeMissions?.();
});
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
    <article class="rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/30 sm:p-6">
      <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
        Gana puntos extra
      </p>
      <h2 class="mt-2 text-2xl font-black text-white">{{ formTitle }}</h2>
      <p class="mt-2 text-sm leading-6 text-slate-400">
        Configura misiones para mostrar en el home. El tipo deja preparado que luego se pueda validar automaticamente.
      </p>

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

      <form class="mt-6 space-y-4" @submit.prevent="saveMission">
        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Titulo</span>
          <input
            v-model="form.title"
            type="text"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50"
            placeholder="Vota 10 veces"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Descripcion</span>
          <textarea
            v-model="form.description"
            rows="3"
            class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50"
            placeholder="Apoya a tu artista favorito en cualquier votacion activa."
          ></textarea>
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Tipo</span>
            <select
              v-model="form.type"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            >
              <option
                v-for="missionType in missionTypes"
                :key="missionType.value"
                :value="missionType.value"
              >
                {{ missionType.label }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Icono</span>
            <input
              v-model="form.icon"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50"
              placeholder="fa-solid fa-check"
            />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Meta</span>
            <input
              v-model.number="form.target"
              type="number"
              min="1"
              step="1"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Puntos</span>
            <input
              v-model.number="form.rewardPoints"
              type="number"
              min="0"
              step="1"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Orden</span>
            <input
              v-model.number="form.order"
              type="number"
              min="1"
              step="1"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            />
          </label>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-black text-slate-200">
            <input v-model="form.active" type="checkbox" class="size-4 accent-fuchsia-500" />
            Activa en el home
          </label>
          <label class="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-black text-slate-200">
            <input v-model="form.featured" type="checkbox" class="size-4 accent-fuchsia-500" />
            Destacada
          </label>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            class="min-h-12 flex-1 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
          >
            {{ isSaving ? "Guardando..." : "Guardar mision" }}
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="resetForm"
          >
            Nueva
          </button>
        </div>
      </form>
    </article>

    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-violet-950/20 sm:p-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Misiones</p>
          <h2 class="mt-2 text-2xl font-black text-white">{{ missions.length }} configuradas</h2>
        </div>
        <span class="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-100">
          Firestore
        </span>
      </div>

      <div v-if="isLoading" class="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300">
        Cargando misiones...
      </div>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="mission in missions"
          :key="mission.id"
          class="rounded-3xl border border-white/10 bg-[#090b19]/85 p-4"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-fuchsia-200">
                  <i v-if="mission.icon?.startsWith('fa-')" :class="mission.icon" aria-hidden="true"></i>
                  <span v-else>{{ mission.icon || "+" }}</span>
                </span>
                <span class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest" :class="mission.active !== false ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-slate-400'">
                  {{ mission.active !== false ? "Activa" : "Inactiva" }}
                </span>
                <span v-if="mission.featured" class="rounded-full bg-fuchsia-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-200">
                  Destacada
                </span>
              </div>

              <h3 class="mt-3 text-lg font-black text-white">{{ mission.title }}</h3>
              <p class="mt-1 text-sm leading-6 text-slate-400">{{ mission.description }}</p>
              <p class="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                {{ typeLabel(mission.type) }} · Meta {{ mission.target || 1 }} · +{{ mission.rewardPoints || 0 }} pts
              </p>
            </div>

            <div class="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                class="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                @click="editMission(mission)"
              >
                Editar
              </button>
              <button
                type="button"
                class="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-100 transition hover:bg-amber-400/20"
                @click="toggleMission(mission)"
              >
                {{ mission.active !== false ? "Ocultar" : "Activar" }}
              </button>
              <button
                type="button"
                class="rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-red-100 transition hover:bg-red-500/20"
                @click="removeMission(mission)"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>

        <div v-if="!missions.length" class="rounded-3xl border border-white/10 bg-slate-950/45 p-6 text-center">
          <p class="text-lg font-black text-white">No hay misiones todavia</p>
          <p class="mt-2 text-sm text-slate-400">Crea la primera mision para mostrarla en el home.</p>
        </div>
      </div>
    </article>
  </section>
</template>
