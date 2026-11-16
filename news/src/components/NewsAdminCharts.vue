<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type Pack = {
  chart?: string
  source?: string
  date?: string | null
  week?: string | null
  scrapedAt?: string | null
  publishedAt?: string | null
  count?: number
  tracks?: unknown[]
  note?: string
}

type CountryRow = { code: string; country: string; date?: string | null; count?: number }

const loading = ref(true)
const errorMessage = ref('')
const data = ref<Record<string, Pack> | null>(null)
const countries = ref<CountryRow[]>([])
const fetchedAt = ref('')

const boards = computed(() => {
  const pack = data.value || {}
  const rows: Array<{ id: string; label: string; pack: Pack; href: string }> = [
    { id: 'radio', label: 'Radio Airplay', pack: pack.radio || {}, href: '/charts/radio/' },
    { id: 'daily', label: 'Spotify Daily (Global)', pack: pack.daily || {}, href: '/charts/spotify-daily/' },
    { id: 'listeners', label: 'Spotify Listeners', pack: pack.listeners || {}, href: '/charts/listeners/' },
    { id: 'latest', label: 'YouTube Latest', pack: pack.latest || {}, href: '/charts/youtube/' },
    { id: 'trending', label: 'YouTube Trending', pack: pack.trending || {}, href: '/charts/trending/' },
    { id: 'insights', label: 'YouTube Insights', pack: pack.insights || {}, href: '/charts/countries/' },
  ]
  return rows
})

const newestScraped = computed(() => {
  const times = boards.value
    .map((row) => row.pack.publishedAt || row.pack.scrapedAt)
    .filter(Boolean)
    .map((iso) => new Date(String(iso)).getTime())
    .filter((n) => Number.isFinite(n))
  if (!times.length) return ''
  return new Date(Math.max(...times)).toISOString()
})

const formatWhen = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const trackCount = (pack: Pack) => Number(pack.count || pack.tracks?.length || 0)

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [chartsRes, countriesRes] = await Promise.all([
      fetch('/charts/data.json', { cache: 'no-store' }),
      fetch('/charts/spotify/countries.json', { cache: 'no-store' }),
    ])
    if (!chartsRes.ok) throw new Error(`charts/data.json → ${chartsRes.status}`)
    data.value = await chartsRes.json()
    if (countriesRes.ok) {
      const meta = await countriesRes.json()
      countries.value = Array.isArray(meta.packed) ? meta.packed : []
    } else {
      countries.value = []
    }
    fetchedAt.value = new Date().toISOString()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cargar Charts.'
    data.value = null
    countries.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="na-charts">
    <div class="na-charts-head">
      <div>
        <p class="na-charts-kicker">Charts bot</p>
        <h2>Tiempo de actualización</h2>
        <p class="na-charts-lead">
          Cron cada 30 min en el servidor. Aquí ves cuándo se actualizó cada tablero.
        </p>
      </div>
      <div class="na-charts-actions">
        <button class="na-btn" type="button" :disabled="loading" @click="load">Refrescar</button>
        <a class="na-btn solid" href="/charts/radio/" target="_blank" rel="noopener">Ver Charts</a>
      </div>
    </div>

    <p v-if="errorMessage" class="na-msg error">{{ errorMessage }}</p>

    <div v-if="loading" class="na-empty">Cargando tiempos de Charts…</div>

    <template v-else-if="data">
      <div class="na-charts-summary">
        <article>
          <small>Última publicación</small>
          <b>{{ formatWhen(newestScraped) }}</b>
        </article>
        <article>
          <small>Países Spotify</small>
          <b>{{ countries.length }}</b>
        </article>
        <article>
          <small>Consultado</small>
          <b>{{ formatWhen(fetchedAt) }}</b>
        </article>
        <article>
          <small>Bot</small>
          <b>*/30 cron</b>
        </article>
      </div>

      <div class="na-charts-table-wrap">
        <table class="na-charts-table">
          <thead>
            <tr>
              <th>Tablero</th>
              <th>Fecha chart</th>
              <th>Scraped / published</th>
              <th>Tracks</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in boards" :key="row.id">
              <td>
                <a :href="row.href" target="_blank" rel="noopener">{{ row.label }}</a>
              </td>
              <td>
                <span v-if="row.pack.week">{{ row.pack.week }}</span>
                <span v-else>{{ row.pack.date || '—' }}</span>
              </td>
              <td>
                <div>{{ formatWhen(row.pack.publishedAt || row.pack.scrapedAt) }}</div>
                <small v-if="row.pack.publishedAt && row.pack.scrapedAt && row.pack.publishedAt !== row.pack.scrapedAt">
                  scraped {{ formatWhen(row.pack.scrapedAt) }}
                </small>
              </td>
              <td>{{ trackCount(row.pack) || '—' }}</td>
              <td>{{ row.pack.source || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-if="countries.length" class="na-charts-countries">
        <h3>Spotify por país ({{ countries.length }})</h3>
        <div class="na-charts-country-grid">
          <a
            v-for="c in countries"
            :key="c.code"
            class="na-charts-country"
            :href="`/charts/spotify-daily/?country=${encodeURIComponent(c.code)}`"
            target="_blank"
            rel="noopener"
          >
            <strong>{{ c.country }}</strong>
            <span>{{ String(c.code || '').toUpperCase() }}</span>
            <small>{{ c.date || '—' }} · {{ c.count || '—' }}</small>
          </a>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.na-charts-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.na-charts-kicker {
  margin: 0;
  color: var(--blue, #225df5);
  font: 800 11px/1 Manrope, sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.na-charts-head h2 {
  margin: 8px 0 0;
  font: 800 28px/1.1 Manrope, sans-serif;
  letter-spacing: -0.04em;
}

.na-charts-lead {
  margin: 8px 0 0;
  max-width: 54ch;
  color: var(--sub, #64748b);
  line-height: 1.45;
}

.na-charts-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.na-charts-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.na-charts-summary article {
  padding: 16px 18px;
  border: 1px solid var(--line, #e2e8f0);
  border-radius: 18px;
  background: var(--card, #fff);
}

.na-charts-summary small {
  display: block;
  color: var(--sub, #64748b);
  font: 800 11px/1 Manrope, sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.na-charts-summary b {
  display: block;
  margin-top: 10px;
  font: 800 18px/1.2 Manrope, sans-serif;
  letter-spacing: -0.03em;
}

.na-charts-table-wrap {
  overflow: auto;
  border: 1px solid var(--line, #e2e8f0);
  border-radius: 18px;
  background: var(--card, #fff);
}

.na-charts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.na-charts-table th,
.na-charts-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--line, #e2e8f0);
  text-align: left;
  vertical-align: top;
}

.na-charts-table th {
  color: var(--sub, #64748b);
  font: 800 11px/1 Manrope, sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.na-charts-table td small {
  display: block;
  margin-top: 4px;
  color: var(--sub, #64748b);
  font-size: 12px;
}

.na-charts-table a {
  color: inherit;
  font-weight: 800;
  text-decoration: none;
}

.na-charts-table a:hover {
  color: var(--blue, #225df5);
}

.na-charts-countries {
  margin-top: 22px;
}

.na-charts-countries h3 {
  margin: 0 0 12px;
  font: 800 18px/1.2 Manrope, sans-serif;
}

.na-charts-country-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.na-charts-country {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line, #e2e8f0);
  border-radius: 14px;
  background: var(--card, #fff);
  color: inherit;
  text-decoration: none;
}

.na-charts-country:hover {
  border-color: var(--blue, #225df5);
}

.na-charts-country strong {
  font: 800 14px/1.2 Manrope, sans-serif;
}

.na-charts-country span,
.na-charts-country small {
  color: var(--sub, #64748b);
  font-size: 12px;
}

@media (max-width: 720px) {
  .na-charts-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
