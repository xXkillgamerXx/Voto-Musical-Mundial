<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAdminNewsCategories } from '../../../src/services/api/adminApi'

type Category = {
  id: string
  slug: string
  name: string
  postCount?: number
  nav?: boolean
  href?: string
}

const items = ref<Category[]>([])
const locale = ref<'es' | 'en'>('es')
const loading = ref(true)
const errorMessage = ref('')

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const rows = await getAdminNewsCategories(locale.value)
    items.value = (Array.isArray(rows) ? rows : []).sort(
      (a: Category, b: Category) => Number(b.postCount || 0) - Number(a.postCount || 0),
    )
  } catch {
    errorMessage.value = 'No se pudieron cargar las categorías.'
    items.value = []
  } finally {
    loading.value = false
  }
}

const setLocale = (next: 'es' | 'en') => {
  if (locale.value === next) return
  locale.value = next
  load()
}

onMounted(load)
</script>

<template>
  <section>
    <div class="na-toolbar">
      <div class="na-ranges" role="group" aria-label="Idioma">
        <button type="button" :class="{ on: locale === 'en' }" @click="setLocale('en')">EN</button>
        <button type="button" :class="{ on: locale === 'es' }" @click="setLocale('es')">ES</button>
      </div>
    </div>
    <p class="na-count">{{ items.length.toLocaleString('es') }} categorías · {{ locale === 'en' ? 'English' : 'Español' }}</p>
    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="na-empty">Cargando categorías…</p>
    <div v-else class="na-cat-table">
      <article v-for="cat in items" :key="cat.id || cat.slug" class="na-cat-row">
        <div>
          <h3>{{ cat.name }}</h3>
          <small>{{ locale === 'es' ? `/es/categoria/${cat.slug}` : `/categoria/${cat.slug}` }}</small>
        </div>
        <span class="na-chip">{{ Number(cat.postCount || 0).toLocaleString('es') }} notas</span>
        <a class="na-btn" :href="cat.href || (locale === 'es' ? `/es/categoria/${cat.slug}` : `/categoria/${cat.slug}`)" target="_blank">Ver</a>
      </article>
    </div>
  </section>
</template>
