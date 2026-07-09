# backend-realtime — Socket.io + WebRTC signaling (StudyRoom)

Backend de tiempo real del [Salón de Estudio Colaborativo](https://github.com/ssancheze912/aula-frontend). Gestiona la
**presencia en salas, el chat en vivo (persistido en Firestore) y la señalización WebRTC**
para audio/video y compartición de pantalla en malla P2P (full-mesh).

- **Stack:** Node.js + TypeScript + Express + Socket.io + Firebase Admin SDK
- **Despliegue:** Render — https://aula-backend-realtime.onrender.com

## Endpoints HTTP

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check: `{ "status": "ok", "service": "backend-realtime" }` |
| `GET` | `/ice-servers` | Config de servidores ICE (STUN + TURN) para WebRTC. Mantiene las credenciales TURN fuera del bundle del frontend |

## Contrato de eventos Socket.io

### Chat y presencia (TS-02)

**Cliente → Servidor**

| Evento | Payload | Efecto |
|--------|---------|--------|
| `room:join`  | `{ roomId, userId, username, avatarUrl }` | Une el socket a la sala y devuelve presencia + historial |
| `room:leave` | `{ roomId, userId }` | Saca al usuario de la sala |
| `chat:send`  | `{ roomId, senderId, senderUsername, senderAvatarUrl, text }` | Persiste y difunde el mensaje |

**Servidor → Cliente**

| Evento | Payload | Destino |
|--------|---------|---------|
| `room:joined`      | `{ roomId, users }`   | Solo al que entra |
| `chat:history`     | `{ roomId, messages }`| Solo al que entra (últimos 50) |
| `room:user_joined` | `{ user }`            | Resto de la sala |
| `room:user_left`   | `{ userId }`          | Resto de la sala |
| `chat:message`     | `{ message }`         | Toda la sala |
| `chat:error`       | `{ error }`           | Solo al emisor (fallo al guardar) |

### Señalización WebRTC (TS-03 / TS-04 — malla P2P)

El servidor solo **reenvía** señalización entre pares; no inspecciona ni almacena el
contenido multimedia (la sesión SDP/ICE va directa entre navegadores). `to` es el
`socketId` destino; `from` lo fija el servidor (no es falsificable por el cliente).

**Cliente → Servidor**

| Evento | Payload |
|--------|---------|
| `rtc:ready`       | `{ roomId, userId, username, avatarUrl }` |
| `rtc:offer`       | `{ to, offer, userId, username, avatarUrl }` |
| `rtc:answer`      | `{ to, answer, userId, username, avatarUrl }` |
| `rtc:ice`         | `{ to, candidate }` |
| `rtc:media_state` | `{ roomId, userId, isMuted, isCameraOff, isScreenSharing }` |

**Servidor → Cliente**

| Evento | Payload | Destino |
|--------|---------|---------|
| `rtc:peer_ready`         | `{ socketId, userId, username, avatarUrl }` | Resto de la sala |
| `rtc:offer`              | `{ from, offer, userId, username, avatarUrl }` | Par `to` |
| `rtc:answer`             | `{ from, answer, userId, username, avatarUrl }` | Par `to` |
| `rtc:ice`                | `{ from, candidate }` | Par `to` |
| `rtc:media_state_update` | `{ userId, isMuted, isCameraOff, isScreenSharing }` | Resto de la sala |

## Seguridad y hardening

- **Helmet** y **CORS** restringido a `FRONTEND_URL` (HTTP y handshake de Socket.io).
- **Validación de payloads:** se descartan eventos sin `roomId`/`to`/`userId` válidos o
  sin contenido (`offer`/`answer`/`candidate`); el texto de chat se recorta a 2000 caracteres.
- **Credenciales TURN** servidas desde `/ice-servers`, nunca embebidas en el frontend.
- La membresía viva se mantiene en memoria; el historial de chat sí se persiste en Firestore.

## Variables de entorno

Copia `.env.example` a `.env`:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (default 3002) |
| `NODE_ENV` | `development` / `production` |
| `FRONTEND_URL` | Origen permitido por CORS y Socket.io |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Admin SDK (persistencia de chat). Si faltan, el chat funciona efímero |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | Servidor TURN (ExpressTURN). Sin TURN, WebRTC usa solo STUN |

## Desarrollo

```bash
npm install
npm run dev      # hot-reload en http://localhost:3002
npm run build    # compila TypeScript a dist/
npm start        # ejecuta la versión compilada
```

## Despliegue (Render)

Se despliega como *Web Service* en Render desde este repositorio:

| Ajuste | Valor |
|--------|-------|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Variables de entorno en el dashboard de Render (**Environment**) — las mismas de la tabla
de arriba. `PORT` la inyecta Render automáticamente; define `NODE_ENV=production`,
`FRONTEND_URL` con la URL de Vercel (`https://aula-weld.vercel.app`), las `FIREBASE_*`
(persistencia de chat; con los `\n` escapados) y las `TURN_*` de
[ExpressTURN](https://www.expressturn.com) (sin ellas WebRTC usa solo STUN).

Tras el deploy, verifica:
`curl https://aula-backend-realtime.onrender.com/health` →
`{"status":"ok","service":"backend-realtime"}`.

## Estructura

```
src/
├── index.ts                  # Express + Socket.io, /health y /ice-servers
├── config/
│   ├── firebase.ts           # init del Admin SDK (persistencia de chat)
│   └── iceServers.ts         # STUN + TURN
├── handlers/
│   ├── chatHandlers.ts       # presencia + chat (contrato documentado)
│   └── rtcHandlers.ts        # señalización WebRTC (contrato documentado)
├── services/
│   └── messageService.ts     # persistencia/lectura de mensajes en Firestore
└── types/index.ts
```
