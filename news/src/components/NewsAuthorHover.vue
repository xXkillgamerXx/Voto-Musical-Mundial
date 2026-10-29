<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { t } from '../lib/copy'

const props = defineProps<{
  locale: 'es' | 'en'
  name: string
  href?: string
  photoUrl?: string
  bio?: string
  postCount?: number
}>()

const open = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const initial = computed(() => (props.name || 'A').trim().charAt(0).toUpperCase() || 'A')
const countLabel = computed(() => {
  const n = Number(props.postCount || 0)
  if (!n) return ''
  return `${n.toLocaleString(loc.value === 'en' ? 'en' : 'es')} ${t(loc.value, 'authorStories')}`
})

const show = () => {
  if (!window.matchMedia('(hover: hover)').matches) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    open.value = true
  }, 220)
}

const hide = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    open.value = false
  }, 160)
}

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <span class="author-hover" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide">
    <a v-if="href" class="author-hover-link" :href="href">{{ name }}</a>
    <span v-else>{{ name }}</span>
    <div v-if="open && href" class="author-hover-card" role="tooltip">
      <a class="author-hover-head" :href="href">
        <img v-if="photoUrl" :src="photoUrl" :alt="name" />
        <span v-else class="ph">{{ initial }}</span>
        <div>
          <b>{{ name }}</b>
          <small>{{ countLabel || t(loc, 'authorAt') }}</small>
        </div>
      </a>
      <p v-if="bio">{{ bio }}</p>
    </div>
  </span>
</template>
