<script setup>
import { ref } from 'vue'

const navItems = ['Inicio', 'Votaciones', 'Rankings', 'Misiones', 'Noticias']
const isMenuOpen = ref(false)
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-violet-400/15 bg-slate-950/85 backdrop-blur-xl">
    <nav class="mx-auto flex max-w-352 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:py-4">
      <a href="#" class="group flex items-center gap-3">
        <span class="grid h-10 w-14 shrink-0 place-items-center sm:h-12 sm:w-16">
          <img src="/logo-votos.png" alt="Votos Musica Mundial logo" class="h-full w-full object-contain" />
        </span>
        <span>
          <span class="block text-base font-black uppercase leading-none tracking-wide sm:text-lg">
            Votos Musica Mundial
          </span>
          <span class="mt-1 hidden text-[10px] uppercase tracking-[0.28em] text-violet-200/70 sm:block">
            Awards globales
          </span>
        </span>
      </a>

      <div class="hidden items-center gap-1 rounded-full border border-white/10 bg-white/3 p-1 lg:flex">
        <a
          v-for="item in navItems"
          :key="item"
          href="#"
          class="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {{ item }}
        </a>
      </div>

      <div class="flex items-center gap-2">
        <div
          class="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 md:flex"
        >
          <span class="text-amber-300">◆</span>
          <span>2,450 pts</span>
        </div>

        <a
          href="#"
          class="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white lg:inline-flex"
        >
          Iniciar sesion
        </a>

        <a
          href="#"
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
          {{ isMenuOpen ? '×' : '☰' }}
        </button>
      </div>
    </nav>

    <div v-if="isMenuOpen" class="border-t border-white/10 px-4 pb-4 lg:hidden">
      <div class="mx-auto max-w-352 rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl shadow-violet-950/30">
        <a
          v-for="item in navItems"
          :key="item"
          href="#"
          class="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          @click="isMenuOpen = false"
        >
          {{ item }}
        </a>

        <div class="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-3">
          <div
            class="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100"
          >
            <span class="text-amber-300">◆</span>
            <span>2,450 pts</span>
          </div>
          <a
            href="#"
            class="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200"
          >
            Iniciar sesion
          </a>
          <a
            href="#"
            class="rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-center text-sm font-bold"
          >
            Registrarse
          </a>
        </div>
      </div>
    </div>
  </header>
</template>
