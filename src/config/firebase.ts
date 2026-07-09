import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env

let db: Firestore | null = null

// La persistencia de mensajes es opcional: si faltan credenciales (p. ej. en
// desarrollo de señalización pura) el servidor sigue funcionando como relay de
// WebSockets, solo que sin guardar/leer historial en Firestore.
if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      })
    }
    db = getFirestore()
    console.log('Firestore habilitado: el historial de chat se persistirá.')
  } catch (err) {
    console.warn(
      `No se pudo inicializar Firebase Admin; el chat funcionará sin persistencia: ${(err as Error).message}`
    )
    db = null
  }
} else {
  console.warn(
    'Credenciales de Firebase ausentes: el chat funcionará sin persistencia (solo relay en tiempo real).'
  )
}

/** Cliente de Firestore, o `null` si no hay credenciales (chat sin persistencia). */
export const adminDb = db
/** `true` si Firestore está inicializado y el historial de chat se persistirá. */
export const isFirestoreEnabled = db !== null
