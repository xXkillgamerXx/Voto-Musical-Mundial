import { apiRequest, getStoredAuth } from './api/client'
import {
  FAN_PLANS as DEFAULT_PLANS,
  POINT_PACKS as DEFAULT_PACKS,
} from '../data/fanStoreCatalog'

export {
  CHECKOUT_COUNTRIES,
  IVA_CO,
  checkoutPath,
  checkoutTotals,
  formatStoreMoney,
  planDurationDays,
  storeDisplayPrice,
  storeItemPrice,
} from '../data/fanStoreCatalog'

const EVENT = 'vmm-fan-store-changed'
const ADMIN_ROLES = new Set(['admin', 'superadmin', 'owner'])

const clone = (value) => JSON.parse(JSON.stringify(value))

const jwtRole = (token) => {
  try {
    const payloadPart = String(token || '').split('.')[1]
    if (!payloadPart) return ''
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(window.atob(padded))
    return String(payload?.role || '').trim()
  } catch {
    return ''
  }
}

export const getFanStoreViewer = () => {
  const auth = getStoredAuth()
  const user = auth?.user && !auth.user.isAnonymous ? auth.user : null
  const role = String(user?.role || jwtRole(auth?.accessToken) || '').trim()
  if (!user && !role) return null
  return { ...(user || {}), role }
}

export const isFanStoreAdmin = (user = getFanStoreViewer()) =>
  ADMIN_ROLES.has(String(user?.role || '').trim().toLowerCase())

export const canSeeFanStore = (user = getFanStoreViewer()) => {
  if (store.visibility === 'public') return true
  return isFanStoreAdmin(user)
}

export const canSeeFanStoreNav = (user = getFanStoreViewer()) => {
  if (store.visibility === 'hidden') return false
  return canSeeFanStore(user)
}

export const waitForFanStore = (ms = 4000) =>
  Promise.race([
    loadFanStore(),
    new Promise((resolve) => window.setTimeout(() => resolve(getFanStore()), ms)),
  ])

const fallback = () => ({
  visibility: 'hidden',
  headline: {
    es: 'Potencia tu voto',
    en: 'Boost your vote',
  },
  subhead: {
    es: 'Multiplica tus votos y aparece en el perfil del artista. Eliges a quién apoyar al pagar.',
    en: 'Multiply your votes and appear on the artist profile. Pick the artist at checkout.',
  },
  plans: clone(DEFAULT_PLANS),
  packs: clone(DEFAULT_PACKS),
})

let store = fallback()
let loadPromise = null

export const getFanStore = () => store

export const getFanPlans = () => (store.plans || []).filter((plan) => plan.enabled !== false)

export const getFanPacks = () => (store.packs || []).filter((pack) => pack.enabled !== false)

export const findStoreItem = (sku) => {
  const key = String(sku || '').trim().toUpperCase()
  const plan = (store.plans || []).find((item) => item.sku === key) || DEFAULT_PLANS.find((item) => item.sku === key)
  if (plan) return { type: 'plan', ...plan }
  const pack = (store.packs || []).find((item) => item.sku === key) || DEFAULT_PACKS.find((item) => item.sku === key)
  if (pack) {
    return {
      type: 'pack',
      ...pack,
      name: `${Number(pack.pts || 0).toLocaleString('es')} puntos`,
      mark: '◆',
      maxArtists: 0,
      welcomePts: pack.pts,
    }
  }
  return { type: 'plan', ...((store.plans || DEFAULT_PLANS)[0] || DEFAULT_PLANS[0]) }
}

const applyPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return store
  store = {
    visibility: payload.visibility === 'admin' || payload.visibility === 'hidden' ? payload.visibility : 'public',
    headline: payload.headline || store.headline,
    subhead: payload.subhead || store.subhead,
    plans: Array.isArray(payload.plans) && payload.plans.length ? payload.plans : store.plans,
    packs: Array.isArray(payload.packs) ? payload.packs : store.packs,
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: store }))
  return store
}

export const applyFanStore = (payload) => {
  const next = applyPayload(payload)
  loadPromise = Promise.resolve(next)
  return next
}

export const loadFanStore = async ({ force = false } = {}) => {
  if (!force && loadPromise) return loadPromise
  loadPromise = apiRequest('/fan-store')
    .then((payload) => applyPayload(payload))
    .catch(() => store)
  return loadPromise
}

export const onFanStoreChange = (handler) => {
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
