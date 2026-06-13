// Carga el .env ANTES que cualquier otro import: los imports se elevan (hoisting)
// y se ejecutan antes que cualquier sentencia, así que config/firebase.ts (cargado
// indirectamente vía chatHandlers) leería process.env vacío si dotenv corriera después.
import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import { registerChatHandlers } from './handlers/chatHandlers'
import { registerRtcHandlers } from './handlers/rtcHandlers'
import { getIceServers, isTurnConfigured } from './config/iceServers'

// Inicializa Firebase Admin (persistencia de chat) si hay credenciales.
import './config/firebase'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3002

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'backend-realtime' })
})

// El cliente WebRTC pide esta config antes de crear el RTCPeerConnection.
// Mantener las credenciales TURN en el backend evita exponerlas en el bundle del frontend.
app.get('/ice-servers', (_req, res) => {
  res.json({ iceServers: getIceServers() })
})

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`)

  registerChatHandlers(io, socket)
  registerRtcHandlers(io, socket)

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`backend-realtime corriendo en puerto ${PORT}`)
  console.log(
    isTurnConfigured()
      ? `TURN habilitado (${process.env.TURN_URL || 'relay1.expressturn.com'}): WebRTC podrá atravesar NAT estricto.`
      : 'TURN deshabilitado: WebRTC usará solo STUN (puede fallar bajo NAT estricto).',
  )
})
