<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const rewards = [
  { day: 1, points: 10, status: 'claimed' },
  { day: 2, points: 15, status: 'today' },
  { day: 3, points: 20, status: 'locked' },
  { day: 4, points: 25, status: 'locked' },
  { day: 5, points: 30, status: 'locked' },
  { day: 6, points: 40, status: 'locked' },
  { day: 7, points: 50, status: 'locked', crown: true },
]

const isOpen = ref(true)
const claimed = ref(false)

const closeModal = () => {
  isOpen.value = false
}

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    closeModal()
  }
}

const claimReward = () => {
  claimed.value = true
  closeModal()
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6"
      @click.self="closeModal"
    >
      <div class="daily-modal relative w-full max-w-4xl overflow-hidden rounded-3xl border border-violet-300/25 bg-[#090b19] p-4 text-white shadow-2xl shadow-fuchsia-950/40 sm:p-7">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(236,72,153,0.24),transparent_32%),radial-gradient(circle_at_95%_100%,rgba(124,58,237,0.35),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(24,8,45,0.96))]"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-20 left-1/4 size-56 rounded-full bg-cyan-400/10 blur-3xl"></div>

        <button
          type="button"
          class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar modal"
          @click="closeModal"
        >
          ×
        </button>

        <div class="relative z-10">
          <div class="flex flex-col gap-4 pr-10 sm:flex-row sm:items-start sm:justify-between sm:pr-0">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.32em] text-pink-300">
                Recompensa diaria
              </p>
              <h2 class="mt-3 text-2xl font-black leading-tight sm:text-4xl">
                Racha de 7 días
              </h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Entra cada día y reclama puntos gratis para apoyar a tu artista favorito.
                Si saltas un día, la racha reinicia.
              </p>
            </div>

            <div class="self-start rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-left">
              <p class="text-[10px] font-black uppercase tracking-widest text-emerald-300">Hoy</p>
              <p class="mt-1 text-lg font-black text-emerald-100">
                {{ claimed ? '✓ Reclamado' : '+15 pts' }}
              </p>
            </div>
          </div>

          <div class="daily-rewards-slider mt-6 flex snap-x gap-3 overflow-x-auto pb-2 pl-4 pr-4 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
            <article
              v-for="reward in rewards"
              :key="reward.day"
              class="relative min-w-28 snap-start overflow-hidden rounded-2xl border p-4 text-center transition sm:min-w-0"
              :class="[
                reward.status === 'claimed' && 'border-emerald-300/50 bg-emerald-400/10',
                reward.status === 'today' && 'daily-today border-fuchsia-300/70 bg-fuchsia-400/25 shadow-lg shadow-fuchsia-950/40',
                reward.status === 'locked' && 'border-white/10 bg-black/20 opacity-70',
              ]"
            >
              <span
                v-if="reward.status === 'claimed'"
                class="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-emerald-400 text-xs font-black text-slate-950"
              >
                ✓
              </span>

              <div
                class="mx-auto grid size-14 place-items-center rounded-full border text-2xl"
                :class="reward.status === 'locked' ? 'border-white/10 bg-white/5 text-slate-500' : 'border-white/20 bg-white/10 text-white'"
              >
                {{ reward.crown ? '♛' : '☆' }}
              </div>

              <p class="mt-3 text-xs font-black uppercase tracking-widest text-slate-400">
                Día {{ reward.day }}
              </p>
              <p
                class="mt-1 text-2xl font-black"
                :class="reward.status === 'today' ? 'text-pink-200' : reward.status === 'claimed' ? 'text-emerald-200' : 'text-slate-400'"
              >
                +{{ reward.points }}
              </p>
              <p class="text-xs font-bold uppercase text-slate-500">pts</p>
            </article>
          </div>

          <div class="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3">
                <span class="grid size-12 place-items-center rounded-full bg-emerald-400/15 text-2xl text-emerald-300 ring-1 ring-emerald-300/30">
                  ✓
                </span>
                <div>
                  <p class="font-black text-emerald-100">
                    {{ claimed ? 'Reclamaste +15 pts hoy' : 'Tu recompensa de hoy está lista' }}
                  </p>
                  <p class="mt-1 text-sm text-slate-300">Vuelve mañana por <span class="font-black text-white">+20 pts</span> · Día 3</p>
                </div>
              </div>

              <button
                type="button"
                class="min-h-12 w-full rounded-2xl bg-linear-to-r from-cyan-400 to-violet-500 px-6 text-sm font-black uppercase text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] sm:w-auto"
                @click="claimReward"
              >
                {{ claimed ? 'Reclamado' : 'Reclamar ahora' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.daily-modal {
  animation: daily-modal-enter 0.32s ease-out both;
}

.daily-rewards-slider::-webkit-scrollbar {
  display: none;
}

.daily-rewards-slider {
  scrollbar-width: none;
}

.daily-today {
  isolation: isolate;
}

.daily-today::before {
  content: "";
  position: absolute;
  inset: -40%;
  z-index: 0;
  border-radius: inherit;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.42) 42deg,
    rgba(244, 114, 182, 0.5) 78deg,
    rgba(168, 85, 247, 0.34) 118deg,
    transparent 165deg,
    transparent 360deg
  );
  filter: blur(0.5px) drop-shadow(0 0 14px rgba(244, 114, 182, 0.55));
  animation: daily-shine 3.2s linear infinite;
  pointer-events: none;
}

.daily-today::after {
  content: "";
  position: absolute;
  inset: 2px;
  z-index: 1;
  border-radius: calc(1rem - 2px);
  background: linear-gradient(180deg, rgba(88, 28, 135, 0.72), rgba(25, 8, 43, 0.88));
  box-shadow: inset 0 0 24px rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.daily-today > * {
  position: relative;
  z-index: 2;
}

@keyframes daily-modal-enter {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes daily-shine {
  to {
    rotate: 360deg;
  }
}
</style>
