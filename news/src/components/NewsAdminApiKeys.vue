<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  createAdminNewsApiKey,
  deleteAdminNewsApiKey,
  getAdminNewsApiKeys,
  updateAdminNewsApiKey,
} from '../../../src/services/api/adminApi'

type ApiKeyRow = {
  id: string
  name: string
  keyPrefix: string
  active: boolean
  special: boolean
  expiresAt?: string | null
  lastUsedAt?: string | null
  createdAt?: string
  apiKey?: string
}

const keys = ref<ApiKeyRow[]>([])
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const notice = ref('')
const createdKey = ref('')
const name = ref('')
const special = ref(false)
const expiresAt = ref('')

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const rows = await getAdminNewsApiKeys()
    keys.value = Array.isArray(rows) ? rows : []
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron cargar las API keys.'
    keys.value = []
  } finally {
    loading.value = false
  }
}

const createKey = async () => {
  saving.value = true
  errorMessage.value = ''
  notice.value = ''
  createdKey.value = ''
  try {
    const created = await createAdminNewsApiKey({
      name: name.value.trim() || 'CRM',
      special: special.value,
      expiresAt: expiresAt.value ? new Date(expiresAt.value).toISOString() : null,
    })
    createdKey.value = String(created?.apiKey || '')
    notice.value = 'API key creada. Cópiala ahora: no se vuelve a mostrar.'
    name.value = ''
    special.value = false
    expiresAt.value = ''
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo crear la API key.'
  } finally {
    saving.value = false
  }
}

const toggleActive = async (row: ApiKeyRow) => {
  errorMessage.value = ''
  notice.value = ''
  try {
    await updateAdminNewsApiKey(row.id, { active: !row.active })
    notice.value = row.active ? 'API key desactivada.' : 'API key activada.'
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo actualizar.'
  }
}

const toggleSpecial = async (row: ApiKeyRow) => {
  errorMessage.value = ''
  notice.value = ''
  try {
    await updateAdminNewsApiKey(row.id, { special: !row.special })
    notice.value = 'Permiso especial actualizado.'
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo actualizar.'
  }
}

const removeKey = async (row: ApiKeyRow) => {
  if (!window.confirm(`¿Borrar la API key “${row.name}”?`)) return
  errorMessage.value = ''
  notice.value = ''
  try {
    await deleteAdminNewsApiKey(row.id)
    notice.value = 'API key eliminada.'
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo eliminar.'
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-ES')
}

onMounted(() => load())
</script>

<template>
  <section class="na-keys">
    <div class="na-keys-toolbar">
      <div>
        <p class="na-keys-kicker">Integraciones</p>
        <h2>API keys</h2>
        <p class="na-help">
          Para CRM / herramientas externas.
          Endpoint: <code>GET /api/news/tags?locale=es</code> con header <code>X-API-Key</code>.
        </p>
      </div>
      <button type="button" class="na-btn" @click="load">Actualizar</button>
    </div>

    <form class="na-keys-create" @submit.prevent="createKey">
      <input v-model="name" type="text" maxlength="80" placeholder="Nombre (ej. CRM artículos)" />
      <label class="na-check">
        <input v-model="special" type="checkbox" />
        Especial (hasta 500 tags por página)
      </label>
      <label>
        Expira (opcional)
        <input v-model="expiresAt" type="datetime-local" />
      </label>
      <button type="submit" class="na-btn solid" :disabled="saving">
        {{ saving ? 'Creando…' : 'Crear API key' }}
      </button>
    </form>

    <p v-if="errorMessage" class="na-error">{{ errorMessage }}</p>
    <p v-else-if="notice" class="na-ok">{{ notice }}</p>
    <div v-if="createdKey" class="na-keys-secret">
      <strong>Guarda esta key ahora:</strong>
      <code>{{ createdKey }}</code>
    </div>

    <p v-if="loading" class="na-empty">Cargando…</p>
    <div v-else class="na-keys-list">
      <article v-for="row in keys" :key="row.id" class="na-keys-row">
        <div>
          <b>{{ row.name }}</b>
          <small>{{ row.keyPrefix }}…</small>
          <small>Creada {{ formatDate(row.createdAt) }} · Último uso {{ formatDate(row.lastUsedAt) }}</small>
          <small>Expira {{ formatDate(row.expiresAt) }}</small>
        </div>
        <div class="na-keys-actions">
          <span class="na-pill" :data-tone="row.active ? 'active' : 'blocked'">
            {{ row.active ? 'Activa' : 'Off' }}
          </span>
          <span v-if="row.special" class="na-pill" data-tone="special">Especial</span>
          <button type="button" class="na-btn" @click="toggleActive(row)">
            {{ row.active ? 'Desactivar' : 'Activar' }}
          </button>
          <button type="button" class="na-btn" @click="toggleSpecial(row)">
            {{ row.special ? 'Quitar especial' : 'Hacer especial' }}
          </button>
          <button type="button" class="na-btn danger" @click="removeKey(row)">Borrar</button>
        </div>
      </article>
      <p v-if="!keys.length" class="na-empty">Todavía no hay API keys. Crea una arriba.</p>
    </div>
  </section>
</template>

<style scoped>
.na-keys {
  display: grid;
  gap: 14px;
}
.na-keys-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}
.na-keys-kicker {
  margin: 0;
  color: var(--blue);
  font: 800 11px/1 Manrope, sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.na-keys-toolbar h2 {
  margin: 4px 0 4px;
  font: 800 22px/1.1 Manrope, sans-serif;
}
.na-help {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.na-help code {
  font-size: 12px;
}
.na-keys-create {
  display: grid;
  grid-template-columns: 1.4fr auto auto auto;
  gap: 8px;
  align-items: end;
}
.na-keys-create input[type='text'],
.na-keys-create input[type='datetime-local'] {
  min-height: 36px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
}
.na-check {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--ink);
  font: 700 12px/1 Manrope, sans-serif;
}
.na-btn {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font: 800 12px/1 Manrope, sans-serif;
  cursor: pointer;
}
.na-btn.solid {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}
.na-btn.danger {
  border-color: color-mix(in srgb, #ef4444 45%, var(--line));
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
}
.na-error,
.na-ok,
.na-empty,
.na-keys-secret {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  font: 700 13px/1.4 Manrope, sans-serif;
}
.na-error {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
}
.na-ok {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #059669;
}
.na-empty {
  background: color-mix(in srgb, var(--ink) 4%, var(--card));
  color: var(--sub);
}
.na-keys-secret {
  display: grid;
  gap: 6px;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #b45309;
  word-break: break-all;
}
.na-keys-list {
  display: grid;
  gap: 8px;
}
.na-keys-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
}
.na-keys-row small {
  display: block;
  margin-top: 2px;
  color: var(--sub);
  font-size: 12px;
}
.na-keys-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.na-pill {
  padding: 4px 8px;
  border-radius: 999px;
  font: 800 10px/1 Manrope, sans-serif;
  text-transform: uppercase;
}
.na-pill[data-tone='active'] {
  background: color-mix(in srgb, #10b981 14%, transparent);
  color: #059669;
}
.na-pill[data-tone='blocked'] {
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: #ef4444;
}
.na-pill[data-tone='special'] {
  background: color-mix(in srgb, #6366f1 14%, transparent);
  color: #4f46e5;
}
@media (max-width: 900px) {
  .na-keys-create {
    grid-template-columns: 1fr;
  }
}
</style>
