<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  points: { type: Array, default: () => [] },
  type: { type: String, default: 'area' },
  color: { type: String, default: '#f0abfc' },
  height: { type: Number, default: 160 },
})

const WIDTH = 600
const PADDING_Y = 12

const hovered = ref(null)

const values = computed(() => props.points.map((point) => Number(point.value || 0)))
const maxValue = computed(() => Math.max(1, ...values.value))
const total = computed(() => values.value.reduce((sum, value) => sum + value, 0))
const peak = computed(() => Math.max(0, ...values.value))
const average = computed(() =>
  values.value.length ? Math.round(total.value / values.value.length) : 0,
)

const plotHeight = computed(() => props.height - PADDING_Y * 2)
const stepX = computed(() =>
  props.points.length > 1 ? WIDTH / (props.points.length - 1) : WIDTH,
)

const coords = computed(() =>
  props.points.map((point, index) => {
    const ratio = Number(point.value || 0) / maxValue.value
    return {
      ...point,
      x: props.points.length > 1 ? index * stepX.value : WIDTH / 2,
      y: PADDING_Y + plotHeight.value * (1 - ratio),
    }
  }),
)

const linePath = computed(() =>
  coords.value.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
)

const areaPath = computed(() => {
  if (!coords.value.length) return ''
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${linePath.value} L${last.x.toFixed(1)},${props.height} L${first.x.toFixed(1)},${props.height} Z`
})

const barWidth = computed(() =>
  Math.max(2, (WIDTH / Math.max(1, props.points.length)) * 0.62),
)

const gradientId = computed(() => `trend-${Math.random().toString(36).slice(2, 9)}`)

/** Mantiene el tooltip dentro del contenedor en los extremos de la serie. */
const tooltipLeft = computed(() => {
  if (!hovered.value) return '50%'
  const percent = (hovered.value.x / WIDTH) * 100
  return `${Math.min(88, Math.max(12, percent))}%`
})

const formatNumber = (value) => Number(value || 0).toLocaleString('es')

const formatDay = (date) => {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

const axisLabels = computed(() => {
  if (props.points.length < 2) return props.points.map((point) => formatDay(point.date))
  const middle = props.points[Math.floor(props.points.length / 2)]
  return [
    formatDay(props.points[0].date),
    formatDay(middle.date),
    formatDay(props.points[props.points.length - 1].date),
  ]
})

defineExpose({ total, peak, average })
</script>

<template>
  <div class="w-full">
    <div v-if="!points.length" class="rounded-2xl border border-white/10 bg-slate-950/45 p-6 text-center text-sm font-bold text-slate-400">
      {{ $t('admin.dashboard.noData') }}
    </div>

    <template v-else>
      <div class="relative">
        <svg
          :viewBox="`0 0 ${WIDTH} ${height}`"
          :style="{ height: `${height}px` }"
          class="w-full"
          preserveAspectRatio="none"
          role="img"
        >
          <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="color" stop-opacity="0.42" />
              <stop offset="100%" :stop-color="color" stop-opacity="0" />
            </linearGradient>
          </defs>

          <line
            v-for="ratio in [0.25, 0.5, 0.75]"
            :key="ratio"
            x1="0"
            :y1="PADDING_Y + plotHeight * ratio"
            :x2="WIDTH"
            :y2="PADDING_Y + plotHeight * ratio"
            stroke="rgba(255,255,255,0.07)"
            stroke-width="1"
          />

          <template v-if="type === 'bars'">
            <rect
              v-for="point in coords"
              :key="point.date"
              :x="point.x - barWidth / 2"
              :y="point.y"
              :width="barWidth"
              :height="Math.max(2, height - PADDING_Y - point.y)"
              :fill="color"
              :opacity="hovered && hovered.date !== point.date ? 0.35 : 0.85"
              rx="2"
            />
          </template>

          <template v-else>
            <path :d="areaPath" :fill="`url(#${gradientId})`" />
            <path
              :d="linePath"
              fill="none"
              :stroke="color"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
            <circle
              v-if="hovered"
              :cx="hovered.x"
              :cy="hovered.y"
              r="4"
              :fill="color"
              vector-effect="non-scaling-stroke"
            />
          </template>

          <rect
            v-for="point in coords"
            :key="`hit-${point.date}`"
            :x="point.x - stepX / 2"
            y="0"
            :width="stepX"
            :height="height"
            fill="transparent"
            @mouseenter="hovered = point"
            @mouseleave="hovered = null"
          />
        </svg>

        <div
          v-if="hovered"
          class="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/90 px-3 py-1.5 text-xs font-black text-white shadow-lg"
          :style="{ left: tooltipLeft }"
        >
          {{ formatDay(hovered.date) }} · {{ formatNumber(hovered.value) }}
        </div>
      </div>

      <div class="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span v-for="label in axisLabels" :key="label">{{ label }}</span>
      </div>

      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-400">
        <span>{{ $t('admin.dashboard.peak', { value: formatNumber(peak) }) }}</span>
        <span>{{ $t('admin.dashboard.average', { value: formatNumber(average) }) }}</span>
      </div>
    </template>
  </div>
</template>
