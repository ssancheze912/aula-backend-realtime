import { Socket, Server } from 'socket.io'

export function registerRtcHandlers(io: Server, socket: Socket): void {
  socket.on('rtc:offer', ({ to, offer }) => {
    io.to(to).emit('rtc:offer', { from: socket.id, offer })
  })

  socket.on('rtc:answer', ({ to, answer }) => {
    io.to(to).emit('rtc:answer', { from: socket.id, answer })
  })

  socket.on('rtc:ice', ({ to, candidate }) => {
    io.to(to).emit('rtc:ice', { from: socket.id, candidate })
  })

  socket.on('rtc:ready', ({ roomId, userId, username }) => {
    socket.to(roomId).emit('rtc:peer_ready', {
      socketId: socket.id,
      userId,
      username,
    })
  })

  socket.on('rtc:media_state', ({ roomId, userId, isMuted, isCameraOff, isScreenSharing }) => {
    socket.to(roomId).emit('rtc:media_state_update', {
      userId,
      isMuted,
      isCameraOff,
      isScreenSharing,
    })
  })
}
