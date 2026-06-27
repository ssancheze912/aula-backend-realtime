import { Socket, Server } from 'socket.io'

/**
 * Registra la señalización WebRTC (relay de SDP e ICE) en un socket conectado.
 *
 * El backend no transporta audio/vídeo: cada cliente abre RTCPeerConnections P2P en malla
 * (una conexión por par en la sala). Este módulo solo reenvía mensajes al socket destino
 * indicado por `to` (socket.id del par). Ver README.md § "Señalización WebRTC (P2P)".
 *
 * Cliente → Servidor:
 *   - rtc:ready       { roomId, userId, username, avatarUrl }
 *                     El cliente está listo para negociar. El servidor emite rtc:peer_ready
 *                     al resto de la sala (no al emisor).
 *   - rtc:offer       { to, offer, userId, username, avatarUrl }
 *                     Reenvía la oferta SDP a `to`. Incluye identidad del emisor para que
 *                     el receptor mapee socketId ↔ usuario.
 *   - rtc:answer      { to, answer, userId, username, avatarUrl }
 *                     Reenvía la respuesta SDP a `to`.
 *   - rtc:ice         { to, candidate }
 *                     Reenvía un candidato ICE a `to`.
 *   - rtc:media_state { roomId, userId, isMuted, isCameraOff, isScreenSharing }
 *                     Difunde el estado de medios como rtc:media_state_update en la sala.
 *
 * Servidor → Cliente:
 *   - rtc:peer_ready         { socketId, userId, username, avatarUrl }  (resto de la sala)
 *   - rtc:offer              { from, offer, userId, username, avatarUrl }
 *   - rtc:answer             { from, answer, userId, username, avatarUrl }
 *   - rtc:ice                { from, candidate }
 *   - rtc:media_state_update { userId, isMuted, isCameraOff, isScreenSharing }
 *
 * Lógica P2P (malla):
 *   - Quien ya está en la sala recibe rtc:peer_ready cuando entra otro y debe crear la offer
 *     hacia el socketId del recién llegado.
 *   - El recién llegado no recibe rtc:peer_ready de los presentes; descubre cada par por el
 *     payload de rtc:offer entrante (userId, username, avatarUrl) y responde con rtc:answer.
 *   - Tras el intercambio offer/answer/ice, el media fluye directo entre navegadores.
 *   - GET /ice-servers (fuera de este handler) provee STUN/TURN antes de RTCPeerConnection.
 */
export function registerRtcHandlers(io: Server, socket: Socket): void {
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
