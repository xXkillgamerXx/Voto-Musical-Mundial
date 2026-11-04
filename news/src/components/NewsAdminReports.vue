<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  getAdminNewsCommentReportOptions,
  getAdminNewsCommentReports,
  saveAdminNewsCommentReportOptions,
  updateAdminNewsCommentReport,
} from '../../../src/services/api/adminApi'

type ReportOption = {
  key: string
  labelEs: string
  labelEn: string
  enabled: boolean
  sort: number
}

type ReportItem = {
  id: string
  commentId: string
  postSlug: string
  reasonLabel: string
  details: string
  status: string
  createdAt?: string
  commentBody: string
  authorName: string
  reporterUserId: string
}

const locale = ref<'es' | 'en'>('es')
const status = ref('open')
const tab = ref<'inbox' | 'options'>('inbox')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const okMessage = ref('')
const reports = ref<ReportItem[]>([])
const options = ref<ReportOption[]>([])

const loadReports = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminNewsCommentReports(locale.value, status.value)
    reports.value = payload.items || []
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron cargar los reportes.'
  } finally {
    loading.value = false
  }
}

const loadOptions = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getAdminNewsCommentReportOptions(locale.value)
    options.value = payload.items || []
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron cargar las opciones.'
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  okMessage.value = ''
  if (tab.value === 'inbox') await loadReports()
  else await loadOptions()
}

watch([locale, status, tab], () => {
  void refresh()
})

onMounted(() => {
  void refresh()
})

const setStatus = async (id: string, next: string, deleteComment = false) => {
  errorMessage.value = ''
  okMessage.value = ''
  try {
    await updateAdminNewsCommentReport(id, { status: next, deleteComment }, locale.value)
    okMessage.value = deleteComment ? 'Comentario eliminado y reporte actualizado.' : 'Reporte actualizado.'
    await loadReports()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo actualizar el reporte.'
  }
}

const addOption = () => {
  const n = options.value.length + 1
  options.value = [
    ...options.value,
    { key: `motivo_${n}`, labelEs: `Motivo ${n}`, labelEn: `Reason ${n}`, enabled: true, sort: n },
  ]
}

const removeOption = (index: number) => {
  options.value = options.value.filter((_, i) => i !== index).map((item, i) => ({ ...item, sort: i + 1 }))
}

const saveOptions = async () => {
  saving.value = true
  errorMessage.value = ''
  okMessage.value = ''
  try {
    const payload = await saveAdminNewsCommentReportOptions(
      options.value.map((item, index) => ({ ...item, sort: index + 1 })),
      locale.value,
    )
    options.value = payload.items || options.value
    okMessage.value = 'Opciones de reporte guardadas.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron guardar las opciones.'
  } finally {
    saving.value = false
  }
}

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(locale.value === 'en' ? 'en' : 'es')
}
</script>

<template>
  <section class="na-reports">
    <div class="na-toolbar">
      <div class="na-tabs" role="tablist">
        <button type="button" :class="{ on: tab === 'inbox' }" @click="tab = 'inbox'">Bandeja</button>
        <button type="button" :class="{ on: tab === 'options' }" @click="tab = 'options'">Opciones del modal</button>
      </div>
      <div class="na-filters">
        <select v-model="locale" aria-label="Idioma">
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <select v-if="tab === 'inbox'" v-model="status" aria-label="Estado">
          <option value="open">Abiertos</option>
          <option value="reviewed">Revisados</option>
          <option value="resolved">Resueltos</option>
          <option value="dismissed">Descartados</option>
          <option value="all">Todos</option>
        </select>
        <button type="button" class="na-btn" @click="refresh">Actualizar</button>
      </div>
    </div>

    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-else-if="okMessage" class="na-ok">{{ okMessage }}</p>
    <p v-if="loading" class="na-empty">Cargando…</p>

    <template v-else-if="tab === 'inbox'">
      <p v-if="!reports.length" class="na-empty">No hay reportes en este filtro.</p>
      <ul v-else class="na-report-list">
        <li v-for="item in reports" :key="item.id" class="na-card na-report-card">
          <div class="na-report-head">
            <b>{{ item.reasonLabel }}</b>
            <span class="na-pill">{{ item.status }}</span>
          </div>
          <p class="na-report-body">{{ item.commentBody || '(comentario eliminado)' }}</p>
          <p class="na-report-meta">
            <span>{{ item.authorName || 'Usuario' }}</span>
            <span>·</span>
            <span>{{ formatDate(item.createdAt) }}</span>
            <span v-if="item.postSlug">·</span>
            <a v-if="item.postSlug" :href="`/${locale}/${item.postSlug}`" target="_blank" rel="noopener">Ver nota</a>
          </p>
          <p v-if="item.details" class="na-report-details">{{ item.details }}</p>
          <div class="na-report-actions">
            <button type="button" @click="setStatus(item.id, 'reviewed')">Marcar revisado</button>
            <button type="button" @click="setStatus(item.id, 'dismissed')">Descartar</button>
            <button type="button" class="danger" @click="setStatus(item.id, 'resolved', true)">Borrar comentario</button>
          </div>
        </li>
      </ul>
    </template>

    <template v-else>
      <p class="na-help">Estas opciones aparecen en el modal de “Reportar” para los usuarios. Se guardan por idioma (ES/EN).</p>
      <div class="na-option-list">
        <article v-for="(option, index) in options" :key="`${option.key}-${index}`" class="na-card na-option-card">
          <label>
            Clave
            <input v-model="option.key" type="text" />
          </label>
          <label>
            Texto ES
            <input v-model="option.labelEs" type="text" />
          </label>
          <label>
            Texto EN
            <input v-model="option.labelEn" type="text" />
          </label>
          <label class="na-check">
            <input v-model="option.enabled" type="checkbox" />
            Activa
          </label>
          <button type="button" class="danger" @click="removeOption(index)">Quitar</button>
        </article>
      </div>
      <div class="na-option-bar">
        <button type="button" class="na-btn" @click="addOption">Agregar opción</button>
        <button type="button" class="na-btn solid" :disabled="saving" @click="saveOptions">
          {{ saving ? 'Guardando…' : 'Guardar opciones' }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.na-reports {
  display: grid;
  gap: 16px;
}
.na-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}
.na-tabs,
.na-filters,
.na-report-actions,
.na-option-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.na-tabs button,
.na-filters select,
.na-report-actions button,
.na-option-card button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  cursor: pointer;
}
.na-tabs button.on,
.na-btn.solid {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}
.na-report-list,
.na-option-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.na-report-card,
.na-option-card {
  display: grid;
  gap: 10px;
}
.na-report-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.na-pill {
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--blue) 14%, transparent);
  color: var(--blue);
  font: 800 11px/1 Manrope, sans-serif;
  text-transform: uppercase;
}
.na-report-body {
  margin: 0;
  white-space: pre-wrap;
}
.na-report-meta,
.na-report-details,
.na-help,
.na-ok {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.na-ok {
  color: #12b76a;
}
.na-option-card {
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  align-items: end;
}
.na-option-card label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--sub);
}
.na-option-card input[type='text'] {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--input);
  color: var(--ink);
}
.na-check {
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
}
.danger {
  color: #c62828 !important;
  border-color: color-mix(in srgb, #c62828 35%, var(--line)) !important;
}
@media (max-width: 900px) {
  .na-option-card {
    grid-template-columns: 1fr;
  }
}
</style>
