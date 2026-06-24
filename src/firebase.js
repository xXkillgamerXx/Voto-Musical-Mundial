import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDkPn1mXsJ0h32uwdImbv5gR9XpD9sgQWE',
  authDomain: 'votos-3420a.firebaseapp.com',
  projectId: 'votos-3420a',
  storageBucket: 'votos-3420a.firebasestorage.app',
  messagingSenderId: '927668152816',
  appId: '1:927668152816:web:73205cba757f9553acd535',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
