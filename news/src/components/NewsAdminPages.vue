<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getAdminNewsPage, getAdminNewsPages, updateAdminNewsPage } from '../../../src/services/api/adminApi'
import NewsRichEditor from './NewsRichEditor.vue'

type PageRow = {
  key: string
  id?: string
  title: string
  slug: string
  status?: string
  href?: string
  updatedAt?: string | null
}

const locale = ref<'es' | 'en'>('es')
const items = ref<PageRow[]>([])
const selectedKey = ref('')
const loading = ref(true)
const loadingPage = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const notice = ref('')
const form = ref({ title: '', content: '', status: 'publish', href: '', slug: '' })

const selected = computed(() => items.value.find((item) => item.key === selectedKey.value) || null)

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale.value === 'en' ? 'en' : 'es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const humanError = (error: unknown) => {
  if (!(error instanceof Error)) return 'No se pudieron cargar las páginas.'
  const msg = String(error.message || '')
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'No hay conexión con la API. Revisa que el backend esté en localhost:4000.'
  }
  return msg || 'No se pudieron cargar las páginas.'
}

const loadList = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminNewsPages(locale.value)
    items.value = Array.isArray(payload?.items) ? payload.items : []
    if (selectedKey.value && !items.value.some((item) => item.key === selectedKey.value)) {
      selectedKey.value = ''
      form.value = { title: '', content: '', status: 'publish', href: '', slug: '' }
    }
  } catch (error) {
    errorMessage.value = humanError(error)
    items.value = []
  } finally {
    loading.value = false
  }
}

const pick = async (key: string) => {
  if (selectedKey.value === key && form.value.title) return
  selectedKey.value = key
  notice.value = ''
  errorMessage.value = ''
  loadingPage.value = true
  try {
    const page = await getAdminNewsPage(key, locale.value)
    form.value = {
      title: page.title || '',
      content: page.content || '',
      status: page.status === 'draft' ? 'draft' : 'publish',
      href: page.href || '',
      slug: page.slug || '',
    }
  } catch (error) {
    errorMessage.value = humanError(error)
    selectedKey.value = ''
  } finally {
    loadingPage.value = false
  }
}

const setLocale = async (next: 'es' | 'en') => {
  if (locale.value === next) return
  const keepKey = selectedKey.value
  locale.value = next
  selectedKey.value = ''
  form.value = { title: '', content: '', status: 'publish', href: '', slug: '' }
  await loadList()
  if (keepKey && items.value.some((item) => item.key === keepKey)) {
    await pick(keepKey)
  }
}

const insertContactTag = () => {
  if (/\[contact-form\]/i.test(form.value.content)) {
    notice.value = 'La etiqueta [contact-form] ya está en el contenido.'
    return
  }
  form.value.content = `${String(form.value.content || '').trim()}\n<p>[contact-form]</p>`
  notice.value = 'Etiqueta [contact-form] añadida al final.'
}

const save = async () => {
  if (!selectedKey.value) return
  saving.value = true
  errorMessage.value = ''
  notice.value = ''
  try {
    const saved = await updateAdminNewsPage(selectedKey.value, {
      locale: locale.value,
      title: form.value.title,
      content: form.value.content,
      status: form.value.status,
    })
    form.value.href = saved.href || form.value.href
    form.value.slug = saved.slug || form.value.slug
    notice.value = 'Página guardada.'
    await loadList()
  } catch (error) {
    errorMessage.value = humanError(error)
  } finally {
    saving.value = false
  }
}

onMounted(loadList)
</script>

<template>
  <section class="na-pages">
    <div class="na-lang-tabs" role="tablist" aria-label="Idioma de páginas">
      <button
        type="button"
        role="tab"
        :aria-selected="locale === 'es'"
        :class="{ on: locale === 'es' }"
        @click="setLocale('es')"
      >
        <strong>Español</strong>
        <span>Páginas en ES</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="locale === 'en'"
        :class="{ on: locale === 'en' }"
        @click="setLocale('en')"
      >
        <strong>English</strong>
        <span>Pages in EN</span>
      </button>
    </div>

    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-if="notice" class="na-ok">{{ notice }}</p>
    <p v-if="loading" class="na-empty">Cargando páginas…</p>

    <div v-else class="na-pages-grid">
      <aside class="na-card na-pages-side">
        <ul class="na-page-list">
          <li v-for="item in items" :key="item.key">
            <button type="button" :class="{ on: selectedKey === item.key }" @click="pick(item.key)">
              <span class="na-page-copy">
                <b>{{ item.title }}</b>
                <small>/{{ item.slug }}</small>
              </span>
            </button>
          </li>
        </ul>
        <p v-if="!items.length" class="na-empty">Sin páginas todavía.</p>
      </aside>

      <article v-if="selectedKey" class="na-card na-page-editor na-form">
        <div class="na-page-editor-head">
          <div>
            <h2>{{ selected?.title || form.title || 'Editar página' }}</h2>
            <p v-if="selected?.updatedAt">Actualizada {{ formatDate(selected.updatedAt) }}</p>
          </div>
          <a v-if="form.href" class="na-btn" :href="form.href" target="_blank" rel="noopener">Ver en sitio</a>
        </div>

        <p v-if="loadingPage" class="na-empty">Abriendo editor…</p>
        <template v-else>
          <div class="na-page-fields">
            <label>
              Título
              <input v-model="form.title" class="na-page-title-input" maxlength="180" required />
            </label>
            <label>
              Estado
              <select v-model="form.status" class="na-page-status-select">
                <option value="publish">Publicada</option>
                <option value="draft">Borrador</option>
              </select>
            </label>
          </div>

          <div class="na-page-tips">
            <p>
              URL:
              <a :href="form.href" target="_blank" rel="noopener">{{ form.href }}</a>
            </p>
            <p>
              Formulario de contacto:
              <code>[contact-form]</code>
              <button class="na-linkish" type="button" @click="insertContactTag">Insertar</button>
            </p>
          </div>

          <NewsRichEditor v-model="form.content" :default-alt="form.title" />
          <div class="na-actions">
            <button class="na-btn solid" type="button" :disabled="saving" @click="save">
              {{ saving ? 'Guardando…' : 'Guardar página' }}
            </button>
          </div>
        </template>
      </article>

      <article v-else class="na-card na-pages-empty">
        <h3>Elige una página</h3>
        <p>About, términos, cookies, privacidad, DMCA o contacto. Cada idioma se edita por separado.</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.na-pages {
  display: grid;
  gap: 16px;
}

.na-pages-grid {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.na-page-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.na-page-list button {
  width: 100%;
  display: grid;
  gap: 2px;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--panel);
  color: var(--text);
  padding: 11px 12px;
  cursor: pointer;
}

.na-page-list button.on,
.na-page-list button:hover {
  border-color: color-mix(in srgb, #225df5 45%, var(--line));
  background: color-mix(in srgb, #225df5 12%, var(--panel));
}

.na-page-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.na-page-copy b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 800 13.5px/1.2 Manrope, sans-serif;
}

.na-page-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sub);
  font-size: 11.5px;
}

.na-page-editor,
.na-pages-empty {
  display: grid;
  gap: 14px;
}

.na-page-editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.na-page-editor-head h2 {
  margin: 0;
  font: 800 22px/1.15 Manrope, sans-serif;
  letter-spacing: -0.03em;
}

.na-page-editor-head p {
  margin: 6px 0 0;
  color: var(--sub);
  font-size: 12.5px;
}

.na-page-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(160px, 0.55fr);
  gap: 14px;
  align-items: end;
}

.na-page-fields label {
  margin-top: 0;
}

.na-page-fields :deep(.na-page-title-input),
.na-page-fields :deep(.na-page-status-select) {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--input);
  color: var(--ink);
  box-shadow: none;
  outline: none;
}

.na-page-fields :deep(.na-page-status-select) {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 40px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2390a0b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 12px 8px;
  cursor: pointer;
}

.na-page-fields :deep(.na-page-title-input:focus),
.na-page-fields :deep(.na-page-status-select:focus) {
  border-color: color-mix(in srgb, #225df5 55%, var(--line));
}

.na-page-tips {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: color-mix(in srgb, #225df5 8%, var(--panel));
  color: var(--sub);
  font-size: 12.5px;
}

.na-page-tips a,
.na-linkish {
  color: #8eb6ff;
  font-weight: 700;
}

.na-linkish {
  margin-left: 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.na-page-tips code {
  padding: 2px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, #000 25%, transparent);
  color: #dce7ff;
  font-size: 12px;
}

.na-pages-empty {
  place-items: center;
  text-align: center;
  min-height: 240px;
  padding: 36px 20px;
}

.na-pages-empty h3 {
  margin: 0;
  font: 800 20px/1.2 Manrope, sans-serif;
}

.na-pages-empty p {
  margin: 0;
  max-width: 36ch;
  color: var(--sub);
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .na-pages-grid,
  .na-page-fields {
    grid-template-columns: 1fr;
  }
}
</style>
