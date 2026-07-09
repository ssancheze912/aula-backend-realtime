/** Usuario presente en una sala. `socketId` es interno y no se emite a los clientes. */
export interface RoomUser {
  userId: string
  username: string
  avatarUrl: string
  socketId: string
}

/** Mensaje de chat tal como se emite a los clientes y se persiste en Firestore. */
export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderUsername: string
  senderAvatarUrl: string
  text: string
  type: 'text' | 'system'
  createdAt: string // ISO 8601
}

/** Payload que envía el cliente al mandar un mensaje (sin id ni createdAt). */
export interface ChatSendPayload {
  roomId: string
  senderId: string
  senderUsername: string
  senderAvatarUrl: string
  text: string
}
