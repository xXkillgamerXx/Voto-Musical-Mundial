import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth'
import { initFirebaseApp } from './firebasePush'

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '927668152816-gko08hdb5upa01a3psav544t0gf9m1a4.apps.googleusercontent.com'

const googleErrorMessage = (error) => {
  const code = String(error?.code || '')
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Inicio con Google cancelado.'
  }
  if (code === 'auth/popup-blocked') {
    return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.'
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este dominio todavía no está autorizado para entrar con Google.'
  }
  return error?.message || 'No se pudo iniciar con Google.'
}

/** Google ID token for www.musicmundial.com and /vote. The OAuth popup uses the Firebase auth domain. */
export const requestGoogleIdToken = async () => {
  const auth = getAuth(initFirebaseApp())
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.addScope('profile')
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    const idToken = credential?.idToken
    if (!idToken) {
      throw new Error('Google no devolvió un token.')
    }
    return idToken
  } catch (error) {
    throw new Error(googleErrorMessage(error))
  }
}
