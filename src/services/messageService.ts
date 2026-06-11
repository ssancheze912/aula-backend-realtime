import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../config/firebase'
import type { ChatMessage, ChatSendPayload } from '../types'

const HISTORY_LIMIT = 50
const MAX_TEXT_LENGTH = 2000

/** Subcolección de mensajes de una sala. */
function messagesCol(roomId: string) {
  return adminDb!.collection('rooms').doc(roomId).collection('messages')
}

/**
 * Persiste un mensaje y devuelve su forma final (con id y createdAt).
 * Si Firestore no está habilitado, devuelve un mensaje efímero con id local.
 */
export async function saveMessage(payload: ChatSendPayload): Promise<ChatMessage> {
  const text = payload.text.trim().slice(0, MAX_TEXT_LENGTH)
  const base = {
    roomId: payload.roomId,
    senderId: payload.senderId,
    senderUsername: payload.senderUsername,
    senderAvatarUrl: payload.senderAvatarUrl,
    text,
    type: 'text' as const,
  }

  if (!adminDb) {
    return { ...base, id: `local-${Date.now()}`, createdAt: new Date().toISOString() }
  }

  const ref = await messagesCol(payload.roomId).add({
    ...base,
    createdAt: FieldValue.serverTimestamp(),
  })
  return { ...base, id: ref.id, createdAt: new Date().toISOString() }
}

/**
 * Devuelve los últimos mensajes de una sala, en orden cronológico ascendente.
 * Si Firestore no está habilitado, devuelve una lista vacía.
 */
export async function getRecentMessages(roomId: string): Promise<ChatMessage[]> {
  if (!adminDb) return []

  const snap = await messagesCol(roomId).orderBy('createdAt', 'desc').limit(HISTORY_LIMIT).get()

  return snap.docs
    .map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        roomId,
        senderId: d.senderId as string,
        senderUsername: d.senderUsername as string,
        senderAvatarUrl: d.senderAvatarUrl as string,
        text: d.text as string,
        type: (d.type as 'text' | 'system') ?? 'text',
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? new Date(0).toISOString(),
      }
    })
    .reverse()
}
