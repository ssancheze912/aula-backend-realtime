import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

dotenv.config()

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

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`backend-realtime corriendo en puerto ${PORT}`)
})
