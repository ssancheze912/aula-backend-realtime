import { Socket, Server } from 'socket.io'

export function registerRtcHandlers(io: Server, socket: Socket): void {
  // La oferta/respuesta llevan la identidad del emisor: el par que se une no recibe
  // `rtc:peer_ready` de los que ya estaban (eso solo lo reciben los presentes), así que
  // aprende quién es cada cual a partir de la oferta que le llega (US-12 / malla P2P).
  socket.on('rtc:offer', ({ to, offer, userId, username, avatarUrl }) => {
    console.log('[RTC-BE] offer recibido', { from: socket.id, to })
    io.to(to).emit('rtc:offer', { from: socket.id, offer, userId, username, avatarUrl })
    console.log('[RTC-BE] offer reenviado', { from: socket.id, to })
  })

  socket.on('rtc:answer', ({ to, answer, userId, username, avatarUrl }) => {
    console.log('[RTC-BE] answer recibido', { from: socket.id, to })
    io.to(to).emit('rtc:answer', { from: socket.id, answer, userId, username, avatarUrl })
    console.log('[RTC-BE] answer reenviado', { from: socket.id, to })
  })

  socket.on('rtc:ice', ({ to, candidate }) => {
    console.log('[RTC-BE] ICE recibido', { from: socket.id, to })
    io.to(to).emit('rtc:ice', { from: socket.id, candidate })
    console.log('[RTC-BE] ICE reenviado', { from: socket.id, to })
  })

  socket.on('rtc:ready', ({ roomId, userId, username, avatarUrl }) => {
    console.log('[RTC-BE] ready recibido', { socketId: socket.id, roomId })
    socket.to(roomId).emit('rtc:peer_ready', {
      socketId: socket.id,
      userId,
      username,
      avatarUrl,
    })
    console.log('[RTC-BE] ready reenviado', { socketId: socket.id, roomId })
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
