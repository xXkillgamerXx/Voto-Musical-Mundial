<script setup>
import { computed, onMounted, ref } from "vue";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const dbCategories = ref([]);
const isLoadingCategories = ref(true);
const dragState = ref({
  isDragging: false,
  startX: 0,
  scrollLeft: 0,
  hasMoved: false,
});
const suppressCategoryClickUntil = ref(0);

const fallbackCategories = [
  {
    id: "artist-of-year",
    title: "Artista del Ano",
    action: "Votar",
    icon: "fa-solid fa-star",
    visual: "from-violet-950 via-fuchsia-700 to-indigo-950",
  },
  {
    id: "group-of-year",
    title: "Grupo del Ano",
    action: "Votar",
    icon: "fa-solid fa-crown",
    visual: "from-slate-800 via-violet-700 to-slate-950",
  },
  {
    id: "song-of-year",
    title: "Cancion del Ano",
    action: "Votar",
    icon: "fa-solid fa-microphone-lines",
    visual: "from-fuchsia-900 via-pink-700 to-slate-950",
  },
  {
    id: "album-of-year",
    title: "Album del Ano",
    action: "Votar",
    icon: "fa-solid fa-trophy",
    visual: "from-indigo-950 via-purple-700 to-fuchsia-900",
  },
  {
    id: "rookie-of-year",
    title: "Rookie del Ano",
    action: "Votar",
    icon: "fa-solid fa-fire",
    visual: "from-violet-900 via-slate-800 to-indigo-950",
  },
];

const fallbackVisuals = [
  "from-violet-950 via-fuchsia-700 to-indigo-950",
  "from-slate-800 via-violet-700 to-slate-950",
  "from-fuchsia-900 via-pink-700 to-slate-950",
  "from-indigo-950 via-purple-700 to-fuchsia-900",
  "from-emerald-950 via-cyan-700 to-slate-950",
  "from-amber-900 via-rose-700 to-fuchsia-950",
];
const fallbackIcons = [
  "fa-solid fa-star",
  "fa-solid fa-crown",
  "fa-solid fa-trophy",
  "fa-solid fa-microphone-lines",
  "fa-solid fa-heart",
  "fa-solid fa-fire",
  "fa-solid fa-bolt",
];
const isFontAwesomeIcon = (icon) => String(icon || "").startsWith("fa-");
const categoryHref = (categoryId) =>
  `/votaciones?categoria=${encodeURIComponent(categoryId)}`;
const wait = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const startCategoryDrag = (event) => {
  if (event.pointerType !== "mouse" || event.button !== 0) {
    return;
  }

  dragState.value = {
    isDragging: true,
    startX: event.pageX,
    scrollLeft: event.currentTarget.scrollLeft,
    hasMoved: false,
  };
  event.currentTarget.classList.add("is-dragging");
  event.currentTarget.setPointerCapture?.(event.pointerId);
};

const moveCategoryDrag = (event) => {
  if (!dragState.value.isDragging) {
    return;
  }

  event.preventDefault();
  const distance = event.pageX - dragState.value.startX;

  if (Math.abs(distance) > 5) {
    dragState.value.hasMoved = true;
  }

  event.currentTarget.scrollLeft = dragState.value.scrollLeft - distance;
};

const stopCategoryDrag = (event) => {
  event.currentTarget?.classList.remove("is-dragging");
  event.currentTarget?.releasePointerCapture?.(event.pointerId);

  if (dragState.value.hasMoved) {
    suppressCategoryClickUntil.value = Date.now() + 250;
  }

  dragState.value.isDragging = false;

  window.setTimeout(() => {
    dragState.value.hasMoved = false;
  }, 250);
};

const preventClickAfterDrag = (event) => {
  if (!dragState.value.hasMoved && Date.now() > suppressCategoryClickUntil.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
};

const categories = computed(() => {
  if (!dbCategories.value.length) {
    return fallbackCategories.map((category) => ({
      ...category,
      action: "Ver categoria",
      href: categoryHref(category.id),
    }));
  }

  return dbCategories.value.slice(0, 10).map((category, index) => ({
    id: category.id,
    title: category.name || "Categoria",
    action: "Ver categoria",
    href: categoryHref(category.id),
    icon: category.icon || fallbackIcons[index % fallbackIcons.length],
    visual: category.visual || fallbackVisuals[index % fallbackVisuals.length],
  }));
});

onMounted(() => {
  const skeletonDelay = wait(700);
  getDocs(collection(db, "pollCategories"))
    .then((categoriesSnap) => {
      const categoryRows = categoriesSnap.docs
        .map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        }))
        .sort(
          (current, next) =>
            Number(next.year || 0) - Number(current.year || 0) ||
            String(current.name || "").localeCompare(String(next.name || "")),
        );

      skeletonDelay.then(() => {
        dbCategories.value = categoryRows;
        isLoadingCategories.value = false;
      });
    })
    .catch(() => {
      isLoadingCategories.value = false;
    });
});
</script>

<template>
  <section
    class="main-categories-surface mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8"
  >
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2
        class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl"
      >
        <i class="fa-solid fa-star text-fuchsia-300" aria-hidden="true"></i>
        Categorias principales
      </h2>
      <a
        href="/votaciones"
        class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white"
      >
        Ver todas
      </a>
    </div>

    <div
      v-if="isLoadingCategories"
      class="mobile-categories-slider flex snap-x gap-3 overflow-x-auto pb-2 pl-4 pr-4 sm:pl-6 lg:hidden"
    >
      <article
        v-for="index in 4"
        :key="`mobile-category-skeleton-${index}`"
        class="min-w-[52%] snap-start overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 sm:min-w-[36%]"
      >
        <div
          class="relative h-52 overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950"
        >
          <div class="absolute inset-0 animate-pulse bg-white/8"></div>
          <div
            class="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-white/15"
          ></div>
          <div
            class="absolute left-[24%] top-[24%] size-3 animate-pulse rounded-full bg-amber-200/40"
          ></div>
          <div
            class="absolute bottom-[24%] right-[23%] size-3 animate-pulse rounded-full bg-cyan-100/40"
          ></div>
        </div>
        <div class="px-4 py-4">
          <div class="h-6 w-8 animate-pulse rounded-xl bg-white/15"></div>
          <div
            class="mt-3 h-4 w-32 animate-pulse rounded-full bg-white/15"
          ></div>
          <div
            class="mt-3 h-3 w-16 animate-pulse rounded-full bg-fuchsia-300/20"
          ></div>
        </div>
      </article>
    </div>

    <div
      v-else
      class="mobile-categories-slider flex snap-x gap-3 overflow-x-auto pb-2 pl-4 pr-4 sm:pl-6 lg:hidden"
    >
      <article
        v-for="category in categories"
        :key="category.title"
        class="group min-w-[52%] snap-start cursor-pointer overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition sm:min-w-[36%]"
      >
        <a
          :href="category.href"
          class="block"
          draggable="false"
          @click="preventClickAfterDrag"
          @dragstart.prevent
        >
        <div
          class="relative h-52 overflow-hidden bg-linear-to-br shadow-lg shadow-violet-950/30"
          :class="category.visual"
        >
          <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"
          ></div>
          <div
            class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"
          ></div>
          <div
            class="absolute inset-x-6 bottom-3 h-10 rounded-full bg-fuchsia-300/20 blur-xl"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 h-28 w-36 -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/35 backdrop-blur"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 h-24 w-32 translate-x-[-62%] translate-y-[-58%] -rotate-12 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/15 shadow-2xl shadow-fuchsia-500/25"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/25 bg-black/25 shadow-[0_0_70px_rgba(217,70,239,0.5)]"
          ></div>
          <div
            class="category-icon-orb absolute left-1/2 top-1/2 z-10 grid size-20 place-items-center rounded-full border border-white/25 bg-black/35 text-center shadow-2xl shadow-fuchsia-500/30 backdrop-blur"
          >
            <i
              v-if="isFontAwesomeIcon(category.icon)"
              class="text-4xl text-white/90"
              :class="category.icon"
              aria-hidden="true"
            ></i>
            <span v-else class="text-4xl text-white/90">{{
              category.icon
            }}</span>
          </div>
          <i
            class="fa-solid fa-star absolute left-[24%] top-[24%] text-xs text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
            aria-hidden="true"
          ></i>
          <i
            class="fa-solid fa-music absolute bottom-[24%] right-[23%] text-sm text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            aria-hidden="true"
          ></i>
        </div>

        <div class="px-4 py-4">
          <p class="mb-2 text-2xl leading-none text-fuchsia-200">
            <i
              v-if="isFontAwesomeIcon(category.icon)"
              :class="category.icon"
              aria-hidden="true"
            ></i>
            <span v-else>{{ category.icon }}</span>
          </p>
          <h3 class="text-sm font-black uppercase leading-tight text-white">
            {{ category.title }}
          </h3>
          <span
            class="mt-2 inline-flex text-xs font-black uppercase tracking-wide text-fuchsia-300 transition group-hover:text-white"
          >
            {{ category.action }}
          </span>
        </div>
        </a>
      </article>
    </div>

    <div
      v-if="isLoadingCategories"
      class="categories-slider hidden snap-x gap-3 overflow-x-auto pb-3 lg:flex"
    >
      <article
        v-for="index in 6"
        :key="`desktop-category-skeleton-${index}`"
        class="min-w-60 snap-start overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 xl:min-w-64"
      >
        <div
          class="relative h-52 overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950 sm:h-60"
        >
          <div class="absolute inset-0 animate-pulse bg-white/8"></div>
          <div
            class="absolute left-1/2 top-1/2 h-28 w-36 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-3xl bg-white/10"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-white/15"
          ></div>
          <div
            class="absolute left-[24%] top-[24%] size-3 animate-pulse rounded-full bg-amber-200/40"
          ></div>
          <div
            class="absolute bottom-[24%] right-[23%] size-3 animate-pulse rounded-full bg-cyan-100/40"
          ></div>
        </div>
        <div class="px-4 py-4">
          <div class="h-6 w-8 animate-pulse rounded-xl bg-white/15"></div>
          <div
            class="mt-3 h-4 w-36 animate-pulse rounded-full bg-white/15"
          ></div>
          <div
            class="mt-3 h-3 w-16 animate-pulse rounded-full bg-fuchsia-300/20"
          ></div>
        </div>
      </article>
    </div>

    <div
      v-else
      class="categories-slider hidden cursor-grab snap-x gap-3 overflow-x-auto pb-3 select-none lg:flex"
      @pointerdown="startCategoryDrag"
      @pointermove="moveCategoryDrag"
      @pointerup="stopCategoryDrag"
      @pointercancel="stopCategoryDrag"
      @pointerleave="stopCategoryDrag"
    >
      <article
        v-for="category in categories"
        :key="category.title"
        class="group min-w-60 snap-start cursor-pointer overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30 hover:bg-[#101226] xl:min-w-64"
      >
        <a
          :href="category.href"
          class="block"
          draggable="false"
          @click="preventClickAfterDrag"
          @dragstart.prevent
        >
        <div
          class="relative h-52 overflow-hidden bg-linear-to-br shadow-lg shadow-violet-950/30 sm:h-60"
          :class="category.visual"
        >
          <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"
          ></div>
          <div
            class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"
          ></div>
          <div
            class="absolute inset-x-6 bottom-3 h-10 rounded-full bg-fuchsia-300/20 blur-xl"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 h-28 w-36 -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/35 backdrop-blur"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 h-24 w-32 translate-x-[-62%] translate-y-[-58%] -rotate-12 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/15 shadow-2xl shadow-fuchsia-500/25"
          ></div>
          <div
            class="absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/25 bg-black/25 shadow-[0_0_70px_rgba(217,70,239,0.5)]"
          ></div>
          <div
            class="category-icon-orb absolute left-1/2 top-1/2 z-10 grid size-20 place-items-center rounded-full border border-white/25 bg-black/35 text-center shadow-2xl shadow-fuchsia-500/30 backdrop-blur"
          >
            <i
              v-if="isFontAwesomeIcon(category.icon)"
              class="text-4xl text-white/90"
              :class="category.icon"
              aria-hidden="true"
            ></i>
            <span v-else class="text-4xl text-white/90">{{
              category.icon
            }}</span>
          </div>
          <i
            class="fa-solid fa-star absolute left-[24%] top-[24%] text-xs text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
            aria-hidden="true"
          ></i>
          <i
            class="fa-solid fa-music absolute bottom-[24%] right-[23%] text-sm text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            aria-hidden="true"
          ></i>
        </div>

        <div class="px-4 py-4">
          <p class="mb-2 text-2xl leading-none text-fuchsia-200">
            <i
              v-if="isFontAwesomeIcon(category.icon)"
              :class="category.icon"
              aria-hidden="true"
            ></i>
            <span v-else>{{ category.icon }}</span>
          </p>
          <h3 class="text-sm font-black uppercase leading-tight text-white">
            {{ category.title }}
          </h3>
          <span
            class="mt-2 inline-flex text-xs font-black uppercase tracking-wide text-fuchsia-300 transition group-hover:text-white"
          >
            {{ category.action }}
          </span>
        </div>
        </a>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mobile-categories-slider {
  scrollbar-width: none;
}

.mobile-categories-slider::-webkit-scrollbar {
  display: none;
}

.categories-slider {
  scrollbar-width: none;
}

.categories-slider::-webkit-scrollbar {
  display: none;
}

.categories-slider.is-dragging {
  cursor: grabbing;
  scroll-snap-type: none;
}

.category-icon-orb {
  animation: category-icon-orb 2.8s ease-in-out infinite;
  transform: translate(-50%, -50%);
  transform-origin: center;
}

@keyframes category-icon-orb {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: 0 20px 45px rgba(217, 70, 239, 0.22);
  }

  50% {
    transform: translate(-50%, -50%) scale(1.08);
    box-shadow: 0 0 64px rgba(217, 70, 239, 0.48);
  }
}
</style>
