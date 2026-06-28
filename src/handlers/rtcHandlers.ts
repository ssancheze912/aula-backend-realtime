import { Socket, Server } from 'socket.io'

/** `true` si el valor es una cadena no vacía (destino o sala válidos). */
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Contrato de señalización WebRTC (TS-03 / TS-04 — malla P2P full-mesh).
 *
 * El servidor solo reenvía mensajes de señalización entre pares; no inspecciona ni
 * almacena el contenido multimedia (la sesión SDP/ICE va directa entre navegadores).
 *
 * Cliente → Servidor:
 *   - rtc:offer        { to, offer, userId, username, avatarUrl }   reenvía SDP offer a `to`
 *   - rtc:answer       { to, answer, userId, username, avatarUrl }  reenvía SDP answer a `to`
 *   - rtc:ice          { to, candidate }                            reenvía candidato ICE a `to`
 *   - rtc:ready        { roomId, userId, username, avatarUrl }      anuncia que entró a la malla
 *   - rtc:media_state  { roomId, userId, isMuted, isCameraOff, isScreenSharing }
 *
 * Servidor → Cliente:
 *   - rtc:offer              { from, offer, userId, username, avatarUrl }
 *   - rtc:answer             { from, answer, userId, username, avatarUrl }
 *   - rtc:ice                { from, candidate }
 *   - rtc:peer_ready         { socketId, userId, username, avatarUrl }  (al resto de la sala)
 *   - rtc:media_state_update { userId, isMuted, isCameraOff, isScreenSharing } (al resto)
 *
 * `to` es el socketId del par destino; `from` es el socketId del emisor (lo fija el servidor,
 * nunca el cliente, para que la identidad de origen no sea falsificable).
 */
export function registerRtcHandlers(io: Server, socket: Socket): void {
  // La oferta/respuesta llevan la identidad del emisor: el par que se une no recibe
  // `rtc:peer_ready` de los que ya estaban (eso solo lo reciben los presentes), así que
  // aprende quién es cada cual a partir de la oferta que le llega (US-12 / malla P2P).
  socket.on('rtc:offer', ({ to, offer, userId, username, avatarUrl }) => {
    if (!isId(to) || !offer) return
    console.log('[RTC-BE] offer recibido', { from: socket.id, to })
    io.to(to).emit('rtc:offer', { from: socket.id, offer, userId, username, avatarUrl })
    console.log('[RTC-BE] offer reenviado', { from: socket.id, to })
  })

  socket.on('rtc:answer', ({ to, answer, userId, username, avatarUrl }) => {
    if (!isId(to) || !answer) return
    console.log('[RTC-BE] answer recibido', { from: socket.id, to })
    io.to(to).emit('rtc:answer', { from: socket.id, answer, userId, username, avatarUrl })
    console.log('[RTC-BE] answer reenviado', { from: socket.id, to })
  })

  socket.on('rtc:ice', ({ to, candidate }) => {
    if (!isId(to) || !candidate) return
    console.log('[RTC-BE] ICE recibido', { from: socket.id, to })
    io.to(to).emit('rtc:ice', { from: socket.id, candidate })
    console.log('[RTC-BE] ICE reenviado', { from: socket.id, to })
  })

  socket.on('rtc:ready', ({ roomId, userId, username, avatarUrl }) => {
    if (!isId(roomId)) return
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
    if (!isId(roomId)) return
    socket.to(roomId).emit('rtc:media_state_update', {
      userId,
      isMuted,
      isCameraOff,
      isScreenSharing,
    })
  })
}
