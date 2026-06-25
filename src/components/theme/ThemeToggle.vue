<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '../../theme'

const props = defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
})

const { t } = useI18n()
const { activeTheme, isLightTheme, toggleTheme } = useTheme()

const label = computed(() =>
  isLightTheme.value ? t('common.theme.switchToDark') : t('common.theme.switchToLight'),
)
</script>

<template>
  <button
    type="button"
    class="theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-3 text-xs font-black uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-(--theme-bg)"
    :class="compact ? 'size-10 px-0' : 'px-4'"
    :aria-label="label"
    :title="label"
    :aria-pressed="activeTheme === 'light'"
    @click="toggleTheme"
  >
    <i
      class="fa-solid"
      :class="isLightTheme ? 'fa-moon' : 'fa-sun'"
      aria-hidden="true"
    ></i>
    <span v-if="!compact">{{ isLightTheme ? $t('common.theme.dark') : $t('common.theme.light') }}</span>
  </button>
</template>
