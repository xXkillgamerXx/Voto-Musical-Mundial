import { computed, ref } from 'vue'
import { getFanMe, importFanPlan } from '../services/api/fanApi'
import { getStoredAuth } from '../services/api/client'
import { getFanMembership, getLastFanInvoice, hydrateMembership, persistFanMembership } from './fanMembership'

const state = ref({
  loaded: false,
  membership: null,
  purchases: [],
  adsFree: false,
  packDiscount: 0,
})

export const fanMembershipState = state

export const fanAdsFree = computed(() => Boolean(state.value.adsFree))
export const fanPackDiscount = computed(() => Number(state.value.packDiscount || 0))
export const isMegaVoter = computed(() =>
  Boolean(state.value.membership && !state.value.membership.expired && (state.value.membership.sku === 'MEGA' || state.value.membership.mega)),
)

const localPlanForImport = () =>
  hydrateMembership(getFanMembership()) || hydrateMembership(getLastFanInvoice())

const importLocalPlanIfNeeded = async (payload) => {
  if (payload?.membership && !payload.membership.expired) return payload
  const local = localPlanForImport()
  if (!local || local.expired || local.type === 'pack' || !local.sku) return payload
  const artists = (local.artists || [])
    .map((row) => ({
      id: String(row.id || ''),
      name: row.name,
      image: row.image,
      slug: row.slug,
    }))
    .filter((row) => row.id || row.name)
  if (!artists.length) return payload
  try {
    await importFanPlan({
      sku: local.sku,
      yearly: Boolean(local.yearly),
      currency: local.currency || 'USD',
      country: local.country || 'CO',
      countryName: local.countryName,
      method: local.method || 'card',
      phone: local.phone,
      artists,
    })
    return getFanMe()
  } catch {
    return payload
  }
}

export const applyFanMePayload = (payload) => {
  if (!payload) return state.value
  if (payload.membership) persistFanMembership(payload.membership)
  state.value = {
    loaded: true,
    membership: payload.membership || null,
    purchases: payload.purchases || [],
    adsFree: Boolean(payload.adsFree),
    packDiscount: Number(payload.packDiscount || 0),
  }
  return state.value
}

export const loadFanMe = async () => {
  if (!getStoredAuth()?.accessToken) {
    const local = getFanMembership()
    state.value = {
      loaded: true,
      membership: local,
      purchases: local ? [local] : [],
      adsFree: Boolean(local && !local.expired && (local.sku === 'SUPER' || local.sku === 'MEGA' || local.featured)),
      packDiscount: local && !local.expired && (local.sku === 'SUPER' || local.sku === 'MEGA' || local.featured) ? 0.1 : 0,
    }
    return state.value
  }
  try {
    const payload = await importLocalPlanIfNeeded(await getFanMe())
    return applyFanMePayload(payload)
  } catch {
    const local = getFanMembership()
    state.value = {
      loaded: true,
      membership: local,
      purchases: local ? [local] : [],
      adsFree: false,
      packDiscount: 0,
    }
    return state.value
  }
}

export const clearFanMe = () => {
  persistFanMembership(null)
  state.value = {
    loaded: false,
    membership: null,
    purchases: [],
    adsFree: false,
    packDiscount: 0,
  }
}
