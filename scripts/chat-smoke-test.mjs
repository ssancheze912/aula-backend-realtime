/**
 * Prueba manual del chat en tiempo real (TS-02).
 *
 * Uso:
 *   1. En una terminal:  npm run dev   (levanta el servidor en :3002)
 *   2. En otra terminal: node scripts/chat-smoke-test.mjs
 *
 * Simula dos usuarios en la misma sala: Bruno se une y escucha; Ana se une y
 * envía un mensaje. Deberías ver que Bruno recibe `chat:message`. Si Firestore
 * está habilitado (credenciales en .env), al unirse también llega `chat:history`
 * con los mensajes previos: corré el script dos veces y la segunda debería
 * mostrar el mensaje de la corrida anterior en el historial.
 */
import { io } from 'socket.io-client'

const URL = process.env.RT_URL || 'http://localhost:3002'
const ROOM = process.env.ROOM || 'sala-demo'

function connect(name) {
  const socket = io(URL, { transports: ['websocket'] })
  socket.on('connect', () => console.log(`[${name}] conectado (${socket.id})`))
  socket.on('connect_error', (e) => console.error(`[${name}] error de conexión:`, e.message))
  return socket
}

const bruno = connect('Bruno')
const ana = connect('Ana')

// Bruno escucha todo lo que pasa en la sala.
bruno.on('chat:history', ({ messages }) =>
  console.log(`[Bruno] historial recibido (${messages.length}):`, messages.map((m) => m.text))
)
bruno.on('room:joined', ({ users }) =>
  console.log(`[Bruno] entró a la sala. Usuarios:`, users.map((u) => u.username))
)
bruno.on('room:user_joined', ({ user }) => console.log(`[Bruno] se unió: ${user.username}`))
bruno.on('chat:message', ({ message }) =>
  console.log(`[Bruno] 📩 ${message.senderUsername}: ${message.text}  (id=${message.id})`)
)
bruno.on('chat:error', ({ error }) => console.error('[Bruno] chat:error:', error))

bruno.on('connect', () => {
  bruno.emit('room:join', {
    roomId: ROOM,
    userId: 'u-bruno',
    username: 'bruno',
    avatarUrl: '',
  })
})

// Ana se une un instante después y manda un mensaje.
ana.on('connect', () => {
  setTimeout(() => {
    ana.emit('room:join', { roomId: ROOM, userId: 'u-ana', username: 'ana', avatarUrl: '' })
    setTimeout(() => {
      const text = `Hola desde Ana — ${new Date().toLocaleTimeString()}`
      console.log(`[Ana] enviando: "${text}"`)
      ana.emit('chat:send', {
        roomId: ROOM,
        senderId: 'u-ana',
        senderUsername: 'ana',
        senderAvatarUrl: '',
        text,
      })
    }, 400)
  }, 600)
})

// Cierre limpio a los 3 segundos.
setTimeout(() => {
  console.log('--- fin de la prueba ---')
  bruno.close()
  ana.close()
  process.exit(0)
}, 3000)
