<script setup>
import { computed, onMounted, ref } from "vue";
import {
  createAdminMission,
  deleteAdminMission,
  getAdminMissions,
  updateAdminMission,
} from "../../services/api/adminApi";

const missionCategories = [
  { value: "social", label: "Redes sociales" },
  { value: "referral", label: "Referidos" },
  { value: "daily", label: "Diarias" },
  { value: "general", label: "General" },
];

const missionTypes = [
  { value: "vote_count", label: "Votar varias veces" },
  { value: "daily_login", label: "Entrar varios dias" },
  { value: "daily_open", label: "Abrir la app" },
  { value: "daily_streak", label: "Racha diaria" },
  { value: "daily_view_polls", label: "Ver votaciones del dia" },
  { value: "daily_poll", label: "Participar en encuesta" },
  { value: "share_poll", label: "Compartir votacion" },
  { value: "share_whatsapp", label: "Compartir en WhatsApp" },
  { value: "share_facebook", label: "Compartir en Facebook" },
  { value: "share_twitter", label: "Compartir en X/Twitter" },
  { value: "share_instagram_story", label: "Compartir en Instagram Stories" },
  { value: "follow_social", label: "Seguir red oficial" },
  { value: "follow_artist", label: "Seguir artista" },
  { value: "favorite_poll", label: "Dar like/favorito" },
  { value: "like_social_post", label: "Me gusta en publicacion" },
  { value: "comment_social_post", label: "Comentar publicacion" },
  { value: "referral_share", label: "Compartir invitacion" },
  { value: "referral_signup", label: "Registro referido" },
  { value: "referral_signup_milestone", label: "Meta de registros" },
  { value: "referral_first_vote", label: "Primer voto referido" },
  { value: "complete_profile", label: "Completar perfil" },
  { value: "manual", label: "Manual / externa" },
];

const missionCreationTypes = [
  {
    key: "referral_signup",
    title: "Invitar a un amigo",
    description:
      "El usuario comparte su enlace personal. Cuando un amigo se registra con ese link, la mision avanza y ambos pueden ganar puntos.",
    category: "referral",
    type: "referral_signup",
    icon: "fa-solid fa-user-plus",
    target: 1,
    rewardPoints: 50,
    inviteeRewardPoints: 50,
    actionUrl: "",
    helper: "Validacion real por codigo de referido en el registro.",
  },
  {
    key: "follow_social",
    title: "Seguirnos en redes sociales",
    description:
      "El usuario abre la red social configurada para seguir la cuenta oficial y reclamar los puntos de la mision.",
    category: "social",
    type: "follow_social",
    icon: "fa-solid fa-user-plus",
    target: 1,
    rewardPoints: 5,
    inviteeRewardPoints: 0,
    actionUrl: "https://instagram.com/",
    helper: "Se valida por accion/clic al abrir la red social configurada.",
  },
];

const missionTemplates = [
  {
    category: "social",
    title: "Compartir la app en WhatsApp",
    description: "Comparte el enlace de la app en WhatsApp.",
    type: "share_whatsapp",
    target: 1,
    rewardPoints: 10,
    icon: "fa-brands fa-whatsapp",
  },
  {
    category: "social",
    title: "Compartir en Facebook",
    description: "Comparte la app o una votacion en Facebook.",
    type: "share_facebook",
    target: 1,
    rewardPoints: 10,
    icon: "fa-brands fa-facebook",
  },
  {
    category: "social",
    title: "Compartir en X/Twitter",
    description: "Publica la app o una votacion en X/Twitter.",
    type: "share_twitter",
    target: 1,
    rewardPoints: 10,
    icon: "fa-brands fa-x-twitter",
  },
  {
    category: "social",
    title: "Compartir en Instagram Stories",
    description: "Comparte la app o una votacion en tus stories.",
    type: "share_instagram_story",
    target: 1,
    rewardPoints: 15,
    icon: "fa-brands fa-instagram",
  },
  {
    category: "social",
    title: "Seguir las redes oficiales",
    description: "Sigue una red oficial disponible.",
    type: "follow_social",
    target: 1,
    rewardPoints: 5,
    icon: "fa-solid fa-user-plus",
  },
  {
    category: "social",
    title: "Dar me gusta a una publicacion",
    description: "Marca me gusta en una publicacion oficial.",
    type: "like_social_post",
    target: 1,
    rewardPoints: 3,
    icon: "fa-solid fa-heart",
  },
  {
    category: "social",
    title: "Comentar en una publicacion",
    description: "Comenta en una publicacion oficial.",
    type: "comment_social_post",
    target: 1,
    rewardPoints: 5,
    icon: "fa-solid fa-comment",
  },
  {
    category: "referral",
    title: "Compartir enlace de invitacion",
    description: "Comparte tu enlace de invitacion con otros fans.",
    type: "referral_share",
    target: 1,
    rewardPoints: 5,
    icon: "fa-solid fa-link",
  },
  {
    category: "referral",
    title: "Conseguir que alguien se registre",
    description: "Gana puntos cuando un invitado cree su cuenta.",
    type: "referral_signup",
    target: 1,
    rewardPoints: 50,
    icon: "fa-solid fa-user-plus",
  },
  {
    category: "referral",
    title: "Conseguir 5 registros",
    description: "Logra que 5 invitados se registren.",
    type: "referral_signup_milestone",
    target: 5,
    rewardPoints: 300,
    icon: "fa-solid fa-users",
  },
  {
    category: "referral",
    title: "Conseguir 10 registros",
    description: "Logra que 10 invitados se registren.",
    type: "referral_signup_milestone",
    target: 10,
    rewardPoints: 700,
    icon: "fa-solid fa-users",
  },
  {
    category: "referral",
    title: "Que el invitado vote por primera vez",
    description: "Gana puntos cuando tu invitado haga su primer voto.",
    type: "referral_first_vote",
    target: 1,
    rewardPoints: 100,
    icon: "fa-solid fa-check-to-slot",
  },
  {
    category: "daily",
    title: "Abrir la app",
    description: "Abre la app durante el dia.",
    type: "daily_open",
    target: 1,
    rewardPoints: 5,
    icon: "fa-solid fa-mobile-screen",
  },
  {
    category: "daily",
    title: "Iniciar sesion diariamente",
    description: "Entra con tu cuenta una vez al dia.",
    type: "daily_login",
    target: 1,
    rewardPoints: 5,
    icon: "fa-solid fa-calendar-check",
  },
  {
    category: "daily",
    title: "Completar 7 dias seguidos",
    description: "Manten una racha de 7 dias consecutivos.",
    type: "daily_streak",
    target: 7,
    rewardPoints: 100,
    icon: "fa-solid fa-fire",
  },
  {
    category: "daily",
    title: "Ver las votaciones del dia",
    description: "Revisa las votaciones disponibles hoy.",
    type: "daily_view_polls",
    target: 1,
    rewardPoints: 10,
    icon: "fa-solid fa-eye",
  },
  {
    category: "daily",
    title: "Participar en una encuesta",
    description: "Participa en una encuesta activa.",
    type: "daily_poll",
    target: 1,
    rewardPoints: 15,
    icon: "fa-solid fa-square-poll-vertical",
  },
];

const emptyForm = {
  title: "",
  description: "",
  category: "social",
  type: "vote_count",
  actionUrl: "",
  target: 1,
  rewardPoints: 25,
  inviteeRewardPoints: 0,
  frequency: "once",
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
const isTypeSelectorOpen = ref(false);
const isMissionModalOpen = ref(false);
const isTemplatesModalOpen = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const selectedMissionTypeKey = ref("");

const formTitle = computed(() =>
  editingMissionId.value ? "Editar mision" : "Crear mision",
);

const typeLabel = (type) =>
  missionTypes.find((missionType) => missionType.value === type)?.label || "Manual";
const categoryLabel = (category) =>
  missionCategories.find((missionCategory) => missionCategory.value === category)?.label || "General";
const selectedCreationType = computed(() =>
  missionCreationTypes.find((missionType) => missionType.key === selectedMissionTypeKey.value),
);
const isReferralSignupMission = computed(() => form.value.type === "referral_signup");
const isShareMission = computed(() => String(form.value.type || "").startsWith("share_"));
const isFollowSocialMission = computed(() => form.value.type === "follow_social");
const shouldShowAdvancedFields = computed(
  () => !selectedCreationType.value || selectedCreationType.value.key === "manual",
);
const shouldShowActionUrl = computed(() => shouldShowAdvancedFields.value || isFollowSocialMission.value);
const targetLabel = computed(() => {
  if (isReferralSignupMission.value) {
    return "Cantidad de amigos";
  }

  if (isFollowSocialMission.value) {
    return "Acciones requeridas";
  }

  if (isShareMission.value) {
    return "Cantidad de compartidos";
  }

  return "Meta";
});
const rewardLabel = computed(() => {
  if (isReferralSignupMission.value) {
    return "Puntos para quien invita";
  }

  return "Puntos";
});
const templateKey = (mission) =>
  `${mission.category || "general"}:${mission.type || "manual"}:${mission.title || ""}:${Number(mission.target || 1)}`;
const isTemplateCreated = (template) =>
  missions.value.some((mission) => templateKey(mission) === templateKey(template));
const missionErrorMessage = (error, fallbackMessage) => {
  if (error?.code === "permission-denied") {
    return "Permiso denegado. Revisa que tu usuario tenga role admin en Firestore o despliega las reglas nuevas.";
  }

  return error?.message ? `${fallbackMessage} (${error.message})` : fallbackMessage;
};

const resetForm = () => {
  editingMissionId.value = "";
  selectedMissionTypeKey.value = "";
  form.value = {
    ...emptyForm,
    order: missions.value.length + 1,
  };
};

const openCreateMission = () => {
  resetForm();
  isTypeSelectorOpen.value = true;
};

const closeTypeSelector = () => {
  isTypeSelectorOpen.value = false;
};

const createMissionFromType = (missionType) => {
  editingMissionId.value = "";
  selectedMissionTypeKey.value = missionType.key;
  form.value = {
    ...emptyForm,
    title: missionType.title,
    description: missionType.description,
    category: missionType.category,
    type: missionType.type,
    actionUrl: missionType.actionUrl || "",
    target: missionType.target,
    rewardPoints: missionType.rewardPoints,
    inviteeRewardPoints: missionType.inviteeRewardPoints || 0,
    icon: missionType.icon,
    order: missions.value.length + 1,
    active: true,
    featured: missionType.type === "referral_signup",
  };
  isTypeSelectorOpen.value = false;
  isTemplatesModalOpen.value = false;
  isMissionModalOpen.value = true;
};

const closeMissionModal = () => {
  isMissionModalOpen.value = false;
  resetForm();
};

const openTemplatesModal = () => {
  isTemplatesModalOpen.value = true;
};

const closeTemplatesModal = () => {
  isTemplatesModalOpen.value = false;
};

const editMission = (mission) => {
  editingMissionId.value = mission.id;
  form.value = {
    title: mission.title || "",
    description: mission.description || "",
    category: mission.category || "general",
    type: mission.type || "manual",
    actionUrl: mission.actionUrl || mission.url || "",
    target: Number(mission.target || 1),
    rewardPoints: Number(mission.rewardPoints || 0),
    inviteeRewardPoints: Number(mission.metadata?.inviteeRewardPoints || 0),
    frequency: mission.metadata?.frequency || "once",
    icon: mission.icon || "fa-solid fa-check",
    order: Number(mission.order || 1),
    active: mission.active !== false,
    featured: Boolean(mission.featured),
  };
  selectedMissionTypeKey.value = mission.type || "";
  isTemplatesModalOpen.value = false;
  isTypeSelectorOpen.value = false;
  isMissionModalOpen.value = true;
};

const missionPayload = () => ({
  title: form.value.title.trim(),
  description: form.value.description.trim(),
  category: form.value.category || "general",
  type: form.value.type,
  actionUrl: form.value.actionUrl.trim(),
  target: Math.max(1, Math.floor(Number(form.value.target || 1))),
  rewardPoints: Math.max(0, Math.floor(Number(form.value.rewardPoints || 0))),
  inviteeRewardPoints: Math.max(0, Math.floor(Number(form.value.inviteeRewardPoints || 0))),
  frequency: form.value.frequency || "once",
  icon: form.value.icon.trim() || "fa-solid fa-check",
  order: Math.max(1, Math.floor(Number(form.value.order || 1))),
  active: Boolean(form.value.active),
  featured: Boolean(form.value.featured),
});

const templatePayload = (template, index) => ({
  title: template.title,
  description: template.description,
  category: template.category,
  type: template.type,
  actionUrl: template.actionUrl || "",
  target: template.target,
  rewardPoints: template.rewardPoints,
  icon: template.icon,
  order: missions.value.length + index + 1,
  active: true,
  featured: false,
});

const useTemplate = (template) => {
  editingMissionId.value = "";
  form.value = {
    ...emptyForm,
    ...template,
    order: missions.value.length + 1,
    active: true,
    featured: false,
  };
  isTemplatesModalOpen.value = false;
  isMissionModalOpen.value = true;
};

const createAllTemplates = async () => {
  errorMessage.value = "";
  successMessage.value = "";

  const missingTemplates = missionTemplates.filter((template) => !isTemplateCreated(template));

  if (!missingTemplates.length) {
    successMessage.value = "Todas las plantillas ya estan creadas.";
    return;
  }

  isSaving.value = true;

  try {
    await Promise.all(
      missingTemplates.map((template, index) => createAdminMission(templatePayload(template, index))),
    );
    successMessage.value = `${missingTemplates.length} misiones creadas.`;
    isTemplatesModalOpen.value = false;
    resetForm();
    missions.value = await getAdminMissions();
  } catch (error) {
    errorMessage.value = missionErrorMessage(error, "No se pudieron crear las plantillas.");
  } finally {
    isSaving.value = false;
  }
};

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
      await updateAdminMission(editingMissionId.value, payload);
      successMessage.value = "Mision actualizada.";
    } else {
      await createAdminMission(payload);
      successMessage.value = "Mision creada.";
    }

    resetForm();
    isMissionModalOpen.value = false;
    missions.value = await getAdminMissions();
  } catch (error) {
    errorMessage.value = missionErrorMessage(error, "No se pudo guardar la mision.");
  } finally {
    isSaving.value = false;
  }
};

const toggleMission = async (mission) => {
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const updated = await updateAdminMission(mission.id, {
      active: mission.active === false,
    });
    mission.active = updated.active;
  } catch (error) {
    errorMessage.value = missionErrorMessage(error, "No se pudo cambiar el estado de la mision.");
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
    await deleteAdminMission(mission.id);
    successMessage.value = "Mision eliminada.";
    missions.value = missions.value.filter((item) => item.id !== mission.id);

    if (editingMissionId.value === mission.id) {
      resetForm();
    }
  } catch (error) {
    errorMessage.value = missionErrorMessage(error, "No se pudo eliminar la mision.");
  }
};

onMounted(async () => {
  try {
      missions.value = await getAdminMissions();
      isLoading.value = false;
  } catch {
    missions.value = [];
    isLoading.value = false;
  }
});
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/30 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Gana puntos extra
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">Sistema de misiones</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            Crea misiones desde un modal y usa plantillas rapidas para redes sociales, referidos y tareas diarias.
          </p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01]"
            @click="openCreateMission"
          >
            Crear mision
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 text-sm font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20"
            @click="openTemplatesModal"
          >
            Plantillas rapidas
          </button>
        </div>
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

    </article>

    <div
      v-if="isTypeSelectorOpen"
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
    >
      <article class="w-full max-w-5xl rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/40 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Crear mision
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">Elige el tipo de mision</h2>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              Primero selecciona que accion debe cumplir el usuario. Luego se abre el modal con los datos correctos para configurar esa mision.
            </p>
          </div>
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Cerrar"
            @click="closeTypeSelector"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-3">
          <button
            v-for="missionType in missionCreationTypes"
            :key="missionType.key"
            type="button"
            class="group rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-fuchsia-300/35 hover:bg-white/10"
            @click="createMissionFromType(missionType)"
          >
            <span class="grid size-12 place-items-center rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-100">
              <i :class="missionType.icon" aria-hidden="true"></i>
            </span>
            <span class="mt-4 block text-lg font-black text-white">{{ missionType.title }}</span>
            <span class="mt-2 block text-sm leading-6 text-slate-400">{{ missionType.description }}</span>
            <span class="mt-4 block rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-xs font-bold leading-5 text-cyan-100">
              {{ missionType.helper }}
            </span>
          </button>
        </div>
      </article>
    </div>

    <div
      v-if="isMissionModalOpen"
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
    >
      <article class="w-full max-w-3xl rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/40 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Gana puntos extra
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">{{ formTitle }}</h2>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              Configura misiones para mostrar en el home. El tipo deja preparado que luego se pueda validar automaticamente.
            </p>
            <p
              v-if="selectedCreationType"
              class="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-100"
            >
              {{ selectedCreationType.title }}
            </p>
          </div>
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Cerrar"
            @click="closeMissionModal"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="saveMission">
        <div
          v-if="isReferralSignupMission"
          class="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4"
        >
          <p class="text-sm font-black text-emerald-100">Mision de referido real</p>
          <p class="mt-1 text-sm leading-6 text-emerald-100/75">
            El usuario comparte su link personal. Cuando el amigo se registra con ese codigo, el sistema puede completar la mision y entregar puntos a ambos.
          </p>
        </div>

        <div
          v-else-if="isShareMission"
          class="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"
        >
          <p class="text-sm font-black text-cyan-100">Mision de compartir</p>
          <p class="mt-1 text-sm leading-6 text-cyan-100/75">
            La web valida el clic en compartir. Sirve para una meta simple como 1 compartir o una meta mayor como 5 compartidos.
          </p>
        </div>

        <div
          v-else-if="isFollowSocialMission"
          class="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"
        >
          <p class="text-sm font-black text-cyan-100">Mision de redes sociales</p>
          <p class="mt-1 text-sm leading-6 text-cyan-100/75">
            El usuario toca el boton de la mision, se abre la red social configurada y puede reclamar los puntos por esa accion.
          </p>
        </div>

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

        <div v-if="shouldShowAdvancedFields" class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Categoria</span>
            <select
              v-model="form.category"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            >
              <option
                v-for="missionCategory in missionCategories"
                :key="missionCategory.value"
                :value="missionCategory.value"
              >
                {{ missionCategory.label }}
              </option>
            </select>
          </label>

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

          <label class="block sm:col-span-2">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Icono</span>
            <input
              v-model="form.icon"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50"
              placeholder="fa-solid fa-check"
            />
          </label>
        </div>

        <label v-if="shouldShowActionUrl" class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
            {{ isFollowSocialMission ? "Enlace de la red social" : "URL de accion" }}
          </span>
          <input
            v-model="form.actionUrl"
            type="url"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50"
            placeholder="https://instagram.com/tu-cuenta"
          />
          <span class="mt-2 block text-xs font-bold leading-5 text-slate-500">
            {{ isFollowSocialMission ? "Pega aqui el enlace oficial de Instagram, X, Facebook, TikTok u otra red." : "Para seguir redes, likes o comentarios, pega aqui la URL oficial que abrira el boton Hacer mision." }}
          </span>
        </label>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ targetLabel }}</span>
            <input
              v-model.number="form.target"
              type="number"
              min="1"
              step="1"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ rewardLabel }}</span>
            <input
              v-model.number="form.rewardPoints"
              type="number"
              min="0"
              step="1"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            />
          </label>

          <label v-if="isReferralSignupMission" class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Puntos amigo</span>
            <input
              v-model.number="form.inviteeRewardPoints"
              type="number"
              min="0"
              step="1"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            />
          </label>

          <label v-if="shouldShowAdvancedFields" class="block" :class="isReferralSignupMission ? 'sm:col-span-3' : ''">
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

        <label class="block">
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Frecuencia</span>
          <select
            v-model="form.frequency"
            class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
          >
            <option value="once">Una sola vez</option>
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
          <span class="mt-2 block text-xs font-bold leading-5 text-slate-500">
            Esto queda guardado en la configuracion de la mision para aplicar el limite cuando activemos la validacion automatica completa.
          </span>
        </label>

        <div class="grid gap-3" :class="shouldShowAdvancedFields ? 'sm:grid-cols-2' : 'sm:grid-cols-1'">
          <label class="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-black text-slate-200">
            <input v-model="form.active" type="checkbox" class="size-4 accent-fuchsia-500" />
            Activa en el home
          </label>
          <label
            v-if="shouldShowAdvancedFields"
            class="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-black text-slate-200"
          >
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
            @click="closeMissionModal"
          >
            Cancelar
          </button>
        </div>
      </form>
      </article>
    </div>

    <div
      v-if="isTemplatesModalOpen"
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
    >
      <article class="w-full max-w-7xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#090b19] p-4 shadow-2xl shadow-cyan-950/30 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Plantillas rapidas</p>
            <h2 class="mt-2 text-2xl font-black text-white">Crear misiones desde plantillas</h2>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              Elige una plantilla para abrir el formulario o crea todas las que falten.
            </p>
          </div>
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Cerrar"
            @click="closeTemplatesModal"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div class="mt-5 flex justify-end">
          <button
            type="button"
            class="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-xs font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
            @click="createAllTemplates"
          >
            Crear todas
          </button>
        </div>

        <div class="mt-5 grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <div
            v-for="missionCategory in missionCategories.filter((category) => category.value !== 'general')"
            :key="missionCategory.value"
            class="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4"
          >
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">{{ missionCategory.label }}</p>
            <div class="mt-3 grid gap-2">
              <button
                v-for="template in missionTemplates.filter((item) => item.category === missionCategory.value)"
                :key="templateKey(template)"
                type="button"
                class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-left text-sm font-bold text-slate-200 transition hover:border-fuchsia-300/30 hover:bg-white/8"
                @click="useTemplate(template)"
              >
                <span class="min-w-0">
                  <span class="block truncate text-white">{{ template.title }}</span>
                  <span class="block text-xs text-slate-500">{{ typeLabel(template.type) }}</span>
                </span>
                <span class="shrink-0 rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs font-black text-fuchsia-100">
                  +{{ template.rewardPoints }} pts
                </span>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

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
                {{ categoryLabel(mission.category) }} · {{ typeLabel(mission.type) }} · Meta {{ mission.target || 1 }} · +{{ mission.rewardPoints || 0 }} pts
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
