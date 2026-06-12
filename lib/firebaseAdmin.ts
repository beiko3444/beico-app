import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function getFirebasePrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY || ''
  return raw.replace(/\\n/g, '\n')
}

export function getFirebaseMessaging() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = getFirebasePrivateKey()

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin 환경변수가 설정되지 않았습니다.')
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }

  return getMessaging()
}
