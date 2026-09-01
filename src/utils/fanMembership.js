import { findStoreItem, getFanStore, planDurationDays } from '../services/fanStore'

const MEMBERSHIP_KEY = 'vmm-fan-membership'
const INVOICE_KEY = 'vmm-fan-last-invoice'

const pad = (value) => String(value).padStart(2, '0')

export const makeInvoiceId = (date = new Date()) => {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const serial = pad(Math.floor(Math.random() * 90) + 10)
  return `VMM-${stamp}-${serial}`
}

export const membershipDaysLeft = (record) => {
  const expiresAt = record?.expiresAt
  if (!expiresAt) return 0
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
}

export const hydrateMembership = (record) => {
  if (!record?.sku || record.type === 'pack') return null
  if (record.status === 'cancelled') {
    return { ...record, daysLeft: 0, expired: true }
  }
  let expiresAt = record.expiresAt
  if (!expiresAt) {
    const start = record.startedAt ? new Date(record.startedAt) : null
    const days = Number(record.durationDays || (record.yearly ? 365 : 30))
    if (start && !Number.isNaN(start.getTime()) && days > 0) {
      expiresAt = new Date(start.getTime() + days * 86400000).toISOString()
    }
  }
  const daysLeft = membershipDaysLeft({ ...record, expiresAt })
  return {
    ...record,
    expiresAt: expiresAt || record.expiresAt || null,
    daysLeft,
    expired: daysLeft <= 0,
  }
}

export const membershipTone = (record) => {
  if (record?.sku === 'MEGA' || record?.mega) return 'text-amber-200'
  if (record?.sku === 'SUPER' || record?.featured) return 'text-fuchsia-200'
  return 'text-violet-200'
}

export const membershipAccent = (record) => {
  if (record?.sku === 'MEGA' || record?.mega) return 'from-amber-400 to-orange-500'
  if (record?.sku === 'SUPER' || record?.featured) return 'from-violet-500 via-fuchsia-500 to-pink-500'
  return 'from-violet-500 to-fuchsia-500'
}

export const membershipShell = (record) => {
  if (record?.sku === 'MEGA' || record?.mega) {
    return 'border-amber-300/40 bg-[#08060c] shadow-amber-950/40'
  }
  if (record?.sku === 'SUPER' || record?.featured) {
    return 'border-fuchsia-300/40 bg-[#0c0714] shadow-fuchsia-950/40'
  }
  return 'border-violet-300/35 bg-[#080a18] shadow-violet-950/40'
}

export const getFanMembership = () => {
  try {
    const raw = window.localStorage.getItem(MEMBERSHIP_KEY)
    if (!raw) return null
    return hydrateMembership(JSON.parse(raw))
  } catch {
    return null
  }
}

export const resolveFanPlan = (user = null) => {
  const candidates = [getFanMembership(), hydrateMembership(getLastFanInvoice()), hydrateMembership(user?.fanMembership)]
  for (const plan of candidates) {
    if (!plan || plan.expired) continue
    if (
      user &&
      (plan.buyerEmail || plan.buyerName) &&
      plan !== user.fanMembership &&
      !membershipMatchesUser(plan, user)
    ) {
      continue
    }
    return plan
  }
  return null
}

const identityKeys = (source) =>
  [source?.email, source?.username, source?.name, source?.displayName, source?.buyerEmail, source?.buyerName]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

export const membershipMatchesUser = (membership, user) => {
  if (!membership || !user) return false
  const userKeys = identityKeys(user)
  const membershipKeys = identityKeys(membership)
  return userKeys.some((key) => membershipKeys.includes(key))
}

export const isMegaFanIdentity = (user) => {
  if (!user) return false
  if (
    user.fanMembership &&
    !user.fanMembership.expired &&
    (user.fanMembership.sku === 'MEGA' || user.fanMembership.mega)
  ) {
    return true
  }
  const membership = getFanMembership()
  if (
    membership &&
    !membership.expired &&
    (membership.sku === 'MEGA' || membership.mega) &&
    membershipMatchesUser(membership, user)
  ) {
    return true
  }

  const keys = identityKeys(user)
  if (!keys.length) return false
  const all = readArtistSupports()
  return Object.values(all).some((list) =>
    (list || []).some((row) => {
      if (row?.tier !== 'mega') return false
      if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return false
      const rowKeys = identityKeys({ name: row.name, email: String(row.id || '').split(':')[0] })
      return keys.some((key) => rowKeys.includes(key) || String(row.id || '').toLowerCase().startsWith(`${key}:`))
    }),
  )
}

export const persistFanMembership = (record) => {
  const hydrated = record ? hydrateMembership(record) : null
  const next = !hydrated || hydrated.expired || hydrated.status === 'cancelled' ? null : hydrated
  const currentRaw = window.localStorage.getItem(MEMBERSHIP_KEY)
  const nextRaw = next ? JSON.stringify(next) : null
  if (currentRaw === nextRaw) return next
  if (!next) window.localStorage.removeItem(MEMBERSHIP_KEY)
  else window.localStorage.setItem(MEMBERSHIP_KEY, nextRaw)
  window.dispatchEvent(new CustomEvent('vmm-fan-membership-changed', { detail: next }))
  return next
}

export const clearFanMembership = () => {
  persistFanMembership(null)
  try {
    const invoice = getLastFanInvoice()
    if (invoice && invoice.type !== 'pack') {
      window.localStorage.setItem(INVOICE_KEY, JSON.stringify({ ...invoice, status: 'cancelled' }))
    }
  } catch {
    // ignore
  }
}

export const getLastFanInvoice = () => {
  try {
    const raw = window.localStorage.getItem(INVOICE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const SUPPORT_KEY = 'vmm-artist-supporters'

export const resolveFanPhoto = (source) =>
  String(
    source?.buyerPhoto ||
      source?.photoUrl ||
      source?.photoURL ||
      source?.photo ||
      source?.avatar ||
      '',
  ).trim()

const readArtistSupports = () => {
  try {
    return JSON.parse(window.localStorage.getItem(SUPPORT_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export const getMySupportedArtists = (user) => {
  const fromPlan = (resolveFanPlan(user)?.artists || []).filter((row) => row?.id)
  if (fromPlan.length) return fromPlan
  const keys = identityKeys(user)
  if (!keys.length) return []
  const artists = []
  Object.entries(readArtistSupports()).forEach(([artistId, list]) => {
    const mine = (list || []).find((row) => {
      if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return false
      const rowKeys = identityKeys({ name: row.name, email: String(row.id || '').split(':')[0] })
      return keys.some(
        (key) => rowKeys.includes(key) || String(row.id || '').toLowerCase().startsWith(`${key}:`),
      )
    })
    if (mine) {
      artists.push({
        id: String(artistId),
        name: mine.artistName || '',
        image: mine.artistImage || '',
        sku: mine.sku,
        tier: mine.tier,
      })
    }
  })
  return artists
}

const supporterTier = (record) => {
  if (record?.sku === 'MEGA' || record?.mega) return 'mega'
  if (record?.sku === 'SUPER' || record?.featured) return 'super'
  return 'fan'
}

export const recordArtistSupport = (record) => {
  if (!record || record.type === 'pack' || !record.artists?.length) return
  const all = readArtistSupports()
  const userKey = record.buyerEmail || record.buyerName || 'guest'
  const photo = resolveFanPhoto(record)
  const nowIso = record.startedAt || new Date().toISOString()
  record.artists.forEach((artist) => {
    const artistId = String(artist.id || '')
    if (!artistId) return
    const list = all[artistId] || []
    const id = `${userKey}:${artistId}`
    const row = {
      id,
      name: record.buyerName || 'Fan',
      photo,
      sku: record.sku,
      tier: supporterTier(record),
      points: Number(record.welcomePts || 0),
      at: nowIso,
      startedAt: nowIso,
      expiresAt: record.expiresAt || null,
      pinnedUntil:
        record.pinnedUntil
        || (supporterTier(record) === 'mega'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null),
    }
    const index = list.findIndex((item) => item.id === id)
    if (index >= 0) {
      const previous = list[index]
      list[index] = {
        ...previous,
        ...row,
        photo: photo || previous.photo || '',
        points: Number(previous.points || 0) + Number(row.points || 0),
        startedAt: previous.startedAt || row.startedAt,
      }
    } else {
      list.unshift(row)
    }
    all[artistId] = list
  })
  window.localStorage.setItem(SUPPORT_KEY, JSON.stringify(all))
}

const artistStorageKeys = (artist) => {
  if (artist == null || artist === '') return []
  if (typeof artist !== 'object') return [String(artist)].filter(Boolean)
  return [...new Set(
    [artist.id, artist.artistId, artist.firebaseId, artist.slug, artist.slugEn]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )]
}

const isActiveSupportRow = (row) => !row?.expiresAt || new Date(row.expiresAt).getTime() > Date.now()

export const mergeArtistSupporters = (...lists) => {
  const map = new Map()
  lists.flat().filter(Boolean).forEach((row) => {
    if (!isActiveSupportRow(row)) return
    const key = String(row.userId || row.id || '')
    if (!key) return
    const previous = map.get(key)
    if (!previous) {
      map.set(key, row)
      return
    }
    map.set(key, {
      ...previous,
      ...row,
      photo: row.photo || previous.photo || '',
      points: Math.max(Number(previous.points || 0), Number(row.points || 0)),
      pinnedUntil: row.pinnedUntil || previous.pinnedUntil || null,
      startedAt: previous.startedAt || row.startedAt,
    })
  })
  return [...map.values()]
}

export const syncMembershipSupportForArtist = (artist, user = null) => {
  const plan = resolveFanPlan(user)
  if (!plan || plan.expired || plan.type === 'pack') return
  const keys = artistStorageKeys(artist)
  const name = String(artist?.name || artist?.artistName || '').trim().toLowerCase()
  const matched = (plan.artists || []).filter((row) => {
    const id = String(row.id || '')
    const rowName = String(row.name || '').trim().toLowerCase()
    return (id && keys.includes(id)) || (name && rowName && name === rowName)
  })
  if (!matched.length) return
  const canonicalId = String(artist?.id || matched[0].id || '')
  if (!canonicalId) return
  const userKey = plan.buyerEmail || plan.buyerName || 'guest'
  const existing = (readArtistSupports()[canonicalId] || []).find(
    (row) => row.id === `${userKey}:${canonicalId}` && isActiveSupportRow(row),
  )
  if (existing) return
  recordArtistSupport({
    ...plan,
    artists: matched.map((row) => ({
      ...row,
      id: canonicalId,
      name: row.name || artist?.name || '',
      image: row.image || artist?.image || '',
    })),
  })
}

export const getArtistSupporters = (artistId) => {
  const keys = artistStorageKeys(artistId)
  const membership = getFanMembership()
  const name = typeof artistId === 'object' ? String(artistId?.name || artistId?.artistName || '').trim().toLowerCase() : ''
  if (
    membership &&
    !membership.expired &&
    (membership.artists || []).some((artist) =>
      keys.includes(String(artist.id || '')) ||
      (name && String(artist.name || '').trim().toLowerCase() === name),
    )
  ) {
    syncMembershipSupportForArtist(typeof artistId === 'object' ? artistId : { id: artistId })
  }
  const all = readArtistSupports()
  return mergeArtistSupporters(...keys.map((key) => all[key] || [])).filter(isActiveSupportRow)
}

export const applyLiveSupporterPhoto = (artistId, user) => {
  const photo = resolveFanPhoto(user)
  const membership = getFanMembership()
  const membershipPhoto = resolveFanPhoto(membership)
  const nextPhoto = photo || membershipPhoto
  const id = String(artistId || '')
  if (!id || !nextPhoto) return getArtistSupporters(id)

  const keys = [
    user?.email,
    user?.displayName,
    user?.name,
    membership?.buyerEmail,
    membership?.buyerName,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  const all = readArtistSupports()
  const list = all[id] || []
  let changed = false
  const next = list.map((row) => {
    const isMine =
      keys.some((key) => row.id === `${key}:${id}`) ||
      keys.some((key) => String(row.name || '').trim().toLowerCase() === key.toLowerCase())
    if (!isMine || row.photo === nextPhoto) return row
    changed = true
    return { ...row, photo: nextPhoto }
  })

  if (changed) {
    all[id] = next
    window.localStorage.setItem(SUPPORT_KEY, JSON.stringify(all))
  }

  if (membership && nextPhoto && membership.buyerPhoto !== nextPhoto) {
    const updated = { ...membership, buyerPhoto: nextPhoto }
    window.localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(updated))
  }

  return getArtistSupporters(id)
}

export const saveFanPurchase = (order, buyer = null) => {
  const catalog = findStoreItem(order.sku) || {}
  const now = new Date()
  const durationDays = catalog.type === 'plan' || order.type === 'plan'
    ? planDurationDays(order.yearly)
    : 0
  const expiresAt = order.expiresAt
    || (durationDays ? new Date(now.getTime() + durationDays * 86400000).toISOString() : null)
  const plan = getFanStore().plans.find((item) => item.sku === (order.sku || catalog.sku))

  const record = {
    id: order.id || null,
    invoiceId: order.invoiceId || makeInvoiceId(now),
    sku: order.sku || catalog.sku,
    name: order.name || catalog.name,
    type: order.type || catalog.type,
    icon: order.icon || catalog.icon || 'fa-solid fa-bolt',
    featured: Boolean(order.featured ?? plan?.featured),
    mega: Boolean(order.mega ?? plan?.mega),
    multiplier: Number(order.multiplier || catalog.multiplier || 1),
    welcomePts: Number(order.welcomePts || order.pointsAwarded || catalog.welcomePts || 0),
    maxArtists: Number(order.maxArtists || catalog.maxArtists || 1),
    yearly: Boolean(order.yearly),
    durationDays,
    status: order.status || 'paid',
    method: order.method,
    country: order.countryName || order.country,
    countryName: order.countryName || '',
    currency: order.currency,
    base: order.base,
    tax: order.tax,
    total: order.total,
    phone: order.phone,
    artists: order.artists || [],
    buyerName: order.buyerName || buyer?.displayName || buyer?.name || '',
    buyerEmail: order.buyerEmail || buyer?.email || '',
    startedAt: order.startedAt || now.toISOString(),
    expiresAt,
    cancelledAt: order.cancelledAt || null,
    buyerPhoto: order.buyerPhoto || resolveFanPhoto(buyer),
  }

  window.localStorage.setItem(INVOICE_KEY, JSON.stringify(record))
  if (record.type === 'plan') {
    persistFanMembership(record)
    recordArtistSupport(record)
  }
  return { ...record, daysLeft: Number(order.daysLeft ?? durationDays) }
}
