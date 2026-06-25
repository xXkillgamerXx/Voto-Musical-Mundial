<script setup>
import { computed, ref } from "vue";

const commentText = ref("");
const comments = ref([
  {
    id: 1,
    user: "@ronnycorrea5",
    country: "República Dominicana",
    time: "2 jun",
    text: "Me encanta esta votación.",
    initial: "R",
  },
  {
    id: 2,
    user: "@Pruebitas",
    country: "Colombia",
    time: "2 d",
    text: "Vamos con todo.",
    initial: "P",
  },
]);

const remainingCharacters = computed(() => 500 - commentText.value.length);

const publishComment = () => {
  const text = commentText.value.trim();
  if (!text) return;

  comments.value.unshift({
    id: Date.now(),
    user: "@invitado",
    country: "Comunidad",
    time: "",
    text,
    initial: "I",
  });
  commentText.value = "";
};

const removeComment = (id) => {
  comments.value = comments.value.filter((comment) => comment.id !== id);
};
</script>

<template>
  <section class="mx-auto mt-10 max-w-5xl">
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
        <div class="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-fuchsia-500 to-violet-500 text-sm font-black shadow-lg shadow-fuchsia-500/25">
          I
        </div>
        <textarea
          v-model="commentText"
          maxlength="500"
          class="min-h-24 flex-1 resize-none rounded-2xl border border-violet-300/15 bg-[#050817]/95 p-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50 focus:shadow-[0_0_24px_rgba(217,70,239,0.12)]"
          :placeholder="$t('widgets.comments.placeholder')"
        ></textarea>
      </div>
      <div class="mt-3 flex items-center justify-between pl-13">
        <p class="text-[10px] font-bold text-slate-500">
          {{ remainingCharacters }}/500
        </p>
        <button
          class="rounded-full bg-linear-to-r from-pink-500 to-fuchsia-600 px-7 py-3 text-xs font-black uppercase text-white shadow-lg shadow-fuchsia-500/25 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          type="button"
          :disabled="!commentText.trim()"
          @click="publishComment"
        >
          {{ $t('widgets.comments.publish') }}
        </button>
      </div>
    </div>

    <p class="mt-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
      {{ $t('widgets.comments.count', { count: comments.length }) }}
    </p>

    <div class="mt-4 space-y-4">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="grid grid-cols-[3rem_1fr] gap-3"
      >
        <div class="grid size-10 place-items-center rounded-full border border-cyan-300/10 bg-linear-to-br from-slate-700 to-slate-900 text-sm font-black text-white shadow-lg shadow-black/20">
          {{ comment.initial }}
        </div>
        <div class="rounded-2xl border border-white/8 bg-white/7 p-4 shadow-lg shadow-black/10">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-black text-white">
              {{ comment.user }}
              <span class="ml-2 text-[10px] font-bold text-slate-500">
                {{ comment.country }} · {{ comment.time }}
              </span>
            </p>
            <button
              class="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-200 transition hover:bg-red-500/20"
              type="button"
              @click="removeComment(comment.id)"
            >
              × Eliminar
            </button>
          </div>
          <p class="mt-4 text-sm font-bold text-slate-200">{{ comment.text }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
