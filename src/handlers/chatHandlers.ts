import { Socket, Server } from 'socket.io'
import { RoomUser, ChatSendPayload } from '../types'
import { saveMessage, getRecentMessages } from '../services/messageService'

// Presencia en memoria por sala. La fuente de verdad de la membresía viva es el
// servidor de WebSockets; el historial de mensajes sí se persiste en Firestore.
const roomUsers = new Map<string, RoomUser[]>()

/**
 * Contrato de eventos de chat y presencia (TS-02):
 *
 * Cliente → Servidor:
 *   - room:join   { roomId, userId, username, avatarUrl }
 *   - room:leave  { roomId, userId }
 *   - chat:send   { roomId, senderId, senderUsername, senderAvatarUrl, text }
 *
 * Servidor → Cliente:
 *   - room:joined       { roomId, users }   (solo al que entra)
 *   - chat:history      { roomId, messages } (solo al que entra)
 *   - room:user_joined  { user }            (al resto de la sala)
 *   - room:user_left    { userId }          (al resto de la sala)
 *   - chat:message      { message }         (a toda la sala)
 *   - chat:error        { error }           (solo al emisor, si falla al guardar)
 */
export function registerChatHandlers(io: Server, socket: Socket): void {
  socket.on('room:join', async ({ roomId, userId, username, avatarUrl }) => {
    if (typeof roomId !== 'string' || !roomId || typeof userId !== 'string' || !userId) return
    socket.join(roomId)

    if (!roomUsers.has(roomId)) roomUsers.set(roomId, [])
    const users = roomUsers.get(roomId)!
    const existing = users.findIndex((u) => u.userId === userId)
    if (existing >= 0) users.splice(existing, 1)
    users.push({ userId, username, avatarUrl, socketId: socket.id })

    io.to(roomId).emit('room:user_joined', { user: { userId, username, avatarUrl } })
    socket.emit('room:joined', {
      roomId,
      users: users.map(({ socketId: _socketId, ...u }) => u),
    })

    // Historial previo de la sala (US-12: ingresar a una sala con actividad previa).
    try {
      const messages = await getRecentMessages(roomId)
      socket.emit('chat:history', { roomId, messages })
    } catch (err) {
      console.error(`Error al cargar historial de ${roomId}:`, (err as Error).message)
    }
  })

  socket.on('room:leave', ({ roomId, userId }) => {
    if (typeof roomId !== 'string' || !roomId) return
    socket.leave(roomId)
    const users = roomUsers.get(roomId) ?? []
    const idx = users.findIndex((u) => u.userId === userId)
    if (idx >= 0) users.splice(idx, 1)
    io.to(roomId).emit('room:user_left', { userId })
  })

  socket.on('chat:send', async (payload: ChatSendPayload) => {
    if (!payload?.roomId || !payload?.text?.trim()) return
    try {
      // Persistir en Firestore y luego emitir la versión final (con id y fecha).
      const message = await saveMessage(payload)
      io.to(payload.roomId).emit('chat:message', { message })
    } catch (err) {
      console.error('Error al guardar el mensaje:', (err as Error).message)
      socket.emit('chat:error', { error: 'No se pudo enviar el mensaje.' })
    }
  })

  socket.on('disconnect', () => {
    for (const [roomId, users] of roomUsers.entries()) {
      const idx = users.findIndex((u) => u.socketId === socket.id)
      if (idx >= 0) {
        const [removed] = users.splice(idx, 1)
        io.to(roomId).emit('room:user_left', { userId: removed.userId })
      }
    }
  })
}
