// Firebase fue removido del proyecto.
// Este modulo es un reemplazo temporal para que el panel admin siga compilando.
// Las LECTURAS devuelven vacio y las ESCRITURAS avisan que falta configurar el backend.
// Cuando migres el admin a tu backend (NestJS), borra este archivo y estos imports.

const NOT_CONFIGURED =
  'Firebase fue removido. Configura el backend para administrar este modulo.'

export const db = null
export const storage = null

const emptyRef = () => ({})

export const collection = emptyRef
export const doc = emptyRef
export const query = emptyRef
export const where = emptyRef
export const orderBy = emptyRef
export const limit = emptyRef
export const ref = emptyRef

export const serverTimestamp = () => null
export const increment = (value = 0) => value

export const Timestamp = {
  now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
  fromMillis: (ms = 0) => ({ toDate: () => new Date(ms), toMillis: () => ms }),
  fromDate: (date = new Date()) => ({ toDate: () => date, toMillis: () => date.getTime() }),
}

export const getDoc = async () => ({ exists: () => false, data: () => ({}), id: '' })
export const getDocs = async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })

export const addDoc = async () => {
  throw new Error(NOT_CONFIGURED)
}
export const setDoc = async () => {
  throw new Error(NOT_CONFIGURED)
}
export const updateDoc = async () => {
  throw new Error(NOT_CONFIGURED)
}
export const deleteDoc = async () => {
  throw new Error(NOT_CONFIGURED)
}

export const writeBatch = () => ({
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: async () => {
    throw new Error(NOT_CONFIGURED)
  },
})

export const getDownloadURL = async () => {
  throw new Error(NOT_CONFIGURED)
}
export const uploadBytes = async () => {
  throw new Error(NOT_CONFIGURED)
}
