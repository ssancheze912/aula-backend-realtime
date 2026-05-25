import { Socket, Server } from 'socket.io'
import { RoomUser } from '../types'

const roomUsers = new Map<string, RoomUser[]>()

export function registerChatHandlers(io: Server, socket: Socket): void {
  socket.on('room:join', ({ roomId, userId, username, avatarUrl }) => {
    socket.join(roomId)

    if (!roomUsers.has(roomId)) roomUsers.set(roomId, [])
    const users = roomUsers.get(roomId)!
    const existing = users.findIndex((u) => u.userId === userId)
    if (existing >= 0) users.splice(existing, 1)
    users.push({ userId, username, avatarUrl, socketId: socket.id })

    io.to(roomId).emit('room:user_joined', { user: { userId, username, avatarUrl } })
    socket.emit('room:joined', {
      roomId,
      users: users.map(({ socketId: _, ...u }) => u),
    })
  })

  socket.on('room:leave', ({ roomId, userId }) => {
    socket.leave(roomId)
    const users = roomUsers.get(roomId) ?? []
    const idx = users.findIndex((u) => u.userId === userId)
    if (idx >= 0) users.splice(idx, 1)
    io.to(roomId).emit('room:user_left', { userId })
  })

  socket.on('chat:send', (payload) => {
    io.to(payload.roomId).emit('chat:message', {
      message: {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      },
    })
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
