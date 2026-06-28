import { initializeApp, getApps } from 'firebase/app'
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics'
import { deleteToken, getMessaging, getToken, isSupported as isMessagingSupported, onMessage } from 'firebase/messaging'
import { registerPushToken } from './api/notificationsApi'

const firebaseConfig = {
  apiKey: 'AIzaSyDkPn1mXsJ0h32uwdImbv5gR9XpD9sgQWE',
  authDomain: 'votos-3420a.firebaseapp.com',
  databaseURL: 'https://votos-3420a-default-rtdb.firebaseio.com',
  projectId: 'votos-3420a',
  storageBucket: 'votos-3420a.firebasestorage.app',
  messagingSenderId: '927668152816',
  appId: '1:927668152816:web:73205cba757f9553acd535',
  measurementId: 'G-TPJGWP4Q2X',
}

const tokenStorageKey = 'vmm_fcm_token'
let app = null
let messaging = null
let analyticsStarted = false
let supportPromise = null

export const initFirebaseApp = () => {
  if (app) return app
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

  if (!analyticsStarted && typeof window !== 'undefined') {
    analyticsStarted = true
    isAnalyticsSupported()
      .then((supported) => {
        if (supported) getAnalytics(app)
      })
      .catch(() => {})
  }

  return app
}

export const isPushSupported = () => {
  if (!supportPromise) {
    supportPromise = Promise.resolve()
      .then(() =>
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        window.isSecureContext,
      )
      .then((browserSupported) => (browserSupported ? isMessagingSupported() : false))
      .catch(() => false)
  }

  return supportPromise
}

const getMessagingInstance = async () => {
  const supported = await isPushSupported()
  if (!supported) return null
  initFirebaseApp()
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

const registerMessagingWorker = async () => {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  await registration.update().catch(() => {})
  return registration
}

export const requestAndRegisterPushToken = async () => {
  const currentPermission = Notification.permission
  const permission = currentPermission === 'granted'
    ? currentPermission
    : await Notification.requestPermission()

  if (permission !== 'granted') {
    return { ok: false, permission }
  }

  const instance = await getMessagingInstance()
  if (!instance) {
    return { ok: false, permission, reason: 'unsupported' }
  }

  const registration = await registerMessagingWorker()
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined
  let token = ''
  try {
    token = await getToken(instance, {
      ...(vapidKey ? { vapidKey } : {}),
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    })
  } catch (error) {
    await deleteToken(instance).catch(() => {})
    const details = {
      ok: false,
      permission,
      reason: 'token_error',
      code: error?.code || '',
      message: error?.message || 'Registration failed - push service error',
    }
    console.error('[push] Firebase token registration failed', details)
    return details
  }

  if (!token) {
    return { ok: false, permission, reason: 'missing_token' }
  }

  window.localStorage.setItem(tokenStorageKey, token)
  await registerPushToken(token, permission)

  return { ok: true, token, permission }
}

export const listenForegroundPushMessages = async (callback) => {
  const instance = await getMessagingInstance()
  if (!instance) return () => {}
  return onMessage(instance, callback)
}

export const getStoredPushToken = () => {
  try {
    return window.localStorage.getItem(tokenStorageKey) || ''
  } catch {
    return ''
  }
}
