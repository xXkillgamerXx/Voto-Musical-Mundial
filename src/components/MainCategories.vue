<script setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getPolls } from "../services/api/pollsApi";
import { applyCategoryLocale } from "../utils/pollLocale";
import { routePath } from "../utils/localizedRoutes";

const { t, locale } = useI18n();
const dbCategories = ref([]);
const isLoadingCategories = ref(true);
const pollsHref = computed(() => routePath("polls", locale.value));
const dragState = ref({
  isDragging: false,
  startX: 0,
  scrollLeft: 0,
  hasMoved: false,
  pointerId: null,
});
const suppressCategoryClickUntil = ref(0);

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
  `${routePath("polls", locale.value)}?categoria=${encodeURIComponent(categoryId)}`;
const wait = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const navigateInternal = (href) => {
  const url = new URL(href, window.location.origin);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  window.history.pushState({}, "", next);
  window.scrollTo({ top: 0, behavior: "instant" });
  // Dispara el router SPA de App.vue
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const startCategoryDrag = (event) => {
  if (event.pointerType !== "mouse" || event.button !== 0) {
    return;
  }

  // No capturar aún: si el usuario solo hace click, el enlace debe funcionar.
  dragState.value = {
    isDragging: true,
    startX: event.pageX,
    scrollLeft: event.currentTarget.scrollLeft,
    hasMoved: false,
    pointerId: event.pointerId,
  };
};

const moveCategoryDrag = (event) => {
  if (!dragState.value.isDragging) {
    return;
  }

  const distance = event.pageX - dragState.value.startX;
  if (Math.abs(distance) <= 10) {
    return;
  }

  if (!dragState.value.hasMoved) {
    dragState.value.hasMoved = true;
    event.currentTarget.classList.add("is-dragging");
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  }

  event.preventDefault();
  event.currentTarget.scrollLeft = dragState.value.scrollLeft - distance;
};

const stopCategoryDrag = (event) => {
  const target = event.currentTarget;
  target?.classList.remove("is-dragging");

  if (dragState.value.hasMoved) {
    suppressCategoryClickUntil.value = Date.now() + 300;
    try {
      target?.releasePointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  }

  dragState.value = {
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
    pointerId: null,
  };
};

const onCategoryClick = (event, href) => {
  // Tras un drag real, bloquea el click fantasma.
  if (Date.now() < suppressCategoryClickUntil.value) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  navigateInternal(href);
};

const onViewAllClick = (event) => {
  event.preventDefault();
  event.stopPropagation();
  navigateInternal(pollsHref.value);
};

const categories = computed(() => {
  if (!dbCategories.value.length) {
    return [];
  }

  return dbCategories.value.slice(0, 10).map((category, index) => ({
    id: category.id,
    title: applyCategoryLocale(category, locale.value).name || t("homeCategories.fallbackName"),
    action: t("homeCategories.viewCategory"),
    pollCountLabel:
      Number(category.pollCount || 0) === 1
        ? t("homeCategories.pollSingular")
        : t("homeCategories.pollPlural", { count: Number(category.pollCount || 0) }),
    href: categoryHref(category.id),
    icon: category.icon || fallbackIcons[index % fallbackIcons.length],
    visual: category.visual || fallbackVisuals[index % fallbackVisuals.length],
  }));
});

const hasCategories = computed(() => categories.value.length > 0);
const showCategoriesSection = computed(
  () => isLoadingCategories.value || hasCategories.value,
);

onMounted(() => {
  const skeletonDelay = wait(700);
  getPolls(100)
    .then((pollRows) => {
      const categoriesById = new Map();
      const pollCounts = new Map();

      pollRows.forEach((poll) => {
        const status = String(poll.status || "");
        if (!["live", "selecting_winners", "closed"].includes(status)) {
          return;
        }

        const categoryId = String(
          poll.categoryId || poll.category?.id || poll.categoryName || "",
        ).trim();
        const categoryName = poll.category?.name || poll.categoryName || "";

        if (!categoryId) {
          return;
        }

        pollCounts.set(categoryId, (pollCounts.get(categoryId) || 0) + 1);

        if (categoriesById.has(categoryId)) {
          return;
        }

        categoriesById.set(categoryId, {
          id: categoryId,
          name: categoryName || t("homeCategories.fallbackName"),
          nameEn: poll.category?.nameEn || poll.category?.metadata?.nameEn || poll.categoryNameEn || "",
          year: poll.year || poll.category?.year || poll.category?.metadata?.year,
          icon: poll.category?.icon || poll.category?.metadata?.icon || poll.config?.categoryIcon || "",
          visual: poll.category?.visual || poll.category?.metadata?.visual || poll.config?.categoryVisual || "",
          metadata: poll.category?.metadata || {},
          pollCount: 0,
        });
      });

      const categoryRows = [...categoriesById.values()]
        .map((category) => ({
          ...category,
          pollCount: pollCounts.get(category.id) || 0,
        }))
        .filter((category) => Number(category.pollCount) > 0)
        .sort(
          (current, next) =>
            Number(next.pollCount || 0) - Number(current.pollCount || 0) ||
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
    v-if="showCategoriesSection"
    class="main-categories-surface mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8"
  >
    <div class="mb-5 flex items-end justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          {{ $t("homeCategories.eyebrow") }}
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          {{ $t("homeCategories.title") }}
        </h2>
      </div>
      <a
        v-if="hasCategories"
        :href="pollsHref"
        class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white"
        @click="onViewAllClick"
      >
        {{ $t("homeCategories.viewAll") }}
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
      v-else-if="categories.length"
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
          @click="onCategoryClick($event, category.href)"
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
          <p class="mt-1 text-[11px] font-bold text-white/55">
            {{ category.pollCountLabel }}
          </p>
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
      v-else-if="categories.length"
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
          @click="onCategoryClick($event, category.href)"
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
          <p class="mt-1 text-[11px] font-bold text-white/55">
            {{ category.pollCountLabel }}
          </p>
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
