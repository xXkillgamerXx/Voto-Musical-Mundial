import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseMeasurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-TPJGWP4Q2X'

const firebaseConfig = {
  apiKey: 'AIzaSyDkPn1mXsJ0h32uwdImbv5gR9XpD9sgQWE',
  authDomain: 'votos-3420a.firebaseapp.com',
  projectId: 'votos-3420a',
  storageBucket: 'votos-3420a.firebasestorage.app',
  messagingSenderId: '927668152816',
  appId: '1:927668152816:web:73205cba757f9553acd535',
  ...(firebaseMeasurementId ? { measurementId: firebaseMeasurementId } : {}),
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
export const analyticsPromise = firebaseMeasurementId
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null)).catch(() => null)
  : Promise.resolve(null)

export const trackAnalyticsEvent = async (eventName, eventParams = {}) => {
  const analytics = await analyticsPromise

  if (analytics) {
    logEvent(analytics, eventName, eventParams)
  }
}
