<script setup>
import { onMounted } from 'vue'
import { getAppDownloadConfig } from '../services/api/appDownloadApi'

const DEFAULT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=vote.musicmundial.com'

const isAndroid = () => /Android/i.test(navigator.userAgent || '')

onMounted(async () => {
  if (!isAndroid()) return

  let playStoreUrl = DEFAULT_PLAY_URL

  try {
    const payload = await getAppDownloadConfig()
    if (payload?.enabled === false || payload?.visible === false) return
    const url = String(payload?.playStoreUrl || '').trim()
    if (url) playStoreUrl = url
  } catch {
    // keep default
  }

  // Android: ir directo a Google Play al entrar en la web.
  window.location.replace(playStoreUrl)
})
</script>

<template>
  <!-- Sin UI: solo redirección en Android -->
</template>
