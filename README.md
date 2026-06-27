# backend-realtime

Backend en tiempo real para salas de videollamada: **Socket.IO** (chat y presencia) y **señalización WebRTC** (malla P2P). El audio/vídeo no pasa por este servidor; solo reenvía ofertas, respuestas y candidatos ICE entre pares.

## Arranque

```bash
cp .env.example .env   # completar credenciales según necesidad
npm install
npm run dev            # http://localhost:3002
```

Prueba manual del chat:

```bash
node scripts/chat-smoke-test.mjs
```

## Endpoints HTTP

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servicio (`{ status, service }`). |
| `GET` | `/ice-servers` | Configuración ICE (STUN + TURN) para `RTCPeerConnection`. Las credenciales TURN viven en el backend, no en el frontend. |

## Conexión WebSocket

El cliente se conecta con Socket.IO al mismo host/puerto del backend. CORS permite el origen definido en `FRONTEND_URL` (por defecto `http://localhost:5173`).

```js
import { io } from 'socket.io-client'
const socket = io('http://localhost:3002', { transports: ['websocket'] })
```

Al conectar, el servidor registra handlers de **chat/presencia** y **señalización RTC** en el mismo socket.

---

## Eventos WebSocket — Chat y presencia

Contrato detallado en JSDoc de `src/handlers/chatHandlers.ts`.

### Cliente → Servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `room:join` | `{ roomId, userId, username, avatarUrl }` | Une el socket a la sala Socket.IO. Actualiza presencia en memoria y notifica al resto. |
| `room:leave` | `{ roomId, userId }` | Sale de la sala y notifica `room:user_left`. |
| `chat:send` | `{ roomId, senderId, senderUsername, senderAvatarUrl, text }` | Persiste el mensaje (Firestore si está configurado) y lo emite a la sala. |

### Servidor → Cliente

| Evento | Payload | Destinatario |
|--------|---------|--------------|
| `room:joined` | `{ roomId, users }` | Solo quien hizo `room:join` (lista de usuarios sin `socketId`). |
| `chat:history` | `{ roomId, messages }` | Solo quien hizo `room:join` (últimos 50 mensajes si Firestore está activo). |
| `room:user_joined` | `{ user: { userId, username, avatarUrl } }` | Resto de la sala (incluye al que entra). |
| `room:user_left` | `{ userId }` | Resto de la sala. |
| `chat:message` | `{ message: ChatMessage }` | Toda la sala. |
| `chat:error` | `{ error: string }` | Solo el emisor si falla la persistencia. |

### Flujo típico de chat

```
Cliente A                    Servidor                    Cliente B
   |                            |                            |
   |-- room:join -------------->|                            |
   |<-- room:joined ------------|                            |
   |<-- chat:history -----------|  (si hay Firestore)        |
   |                            |<-- room:join --------------|
   |<-- room:user_joined -------|                            |
   |                            |-- room:joined ------------>|
   |                            |-- chat:history ----------->|
   |                            |                            |
   |-- chat:send -------------->|                            |
   |                            |-- chat:message ----------->|
   |<-- chat:message -----------|                            |
```

**Presencia:** vive en memoria del proceso (`Map<roomId, RoomUser[]>`). Si un socket se desconecta sin `room:leave`, el handler de `disconnect` elimina al usuario de todas las salas y emite `room:user_left`.

**Persistencia:** mensajes en Firestore (`rooms/{roomId}/messages`). Sin credenciales Firebase, el chat sigue funcionando en memoria con ids locales y sin historial al reingresar.

---

## Eventos WebSocket — Señalización WebRTC (P2P)

Contrato detallado en JSDoc de `src/handlers/rtcHandlers.ts`.

Este backend **no transcodifica ni reenvía media**. Actúa como **servidor de señalización**: intercambia SDP (offer/answer) y candidatos ICE entre sockets de la misma sala. Cada par de usuarios establece un `RTCPeerConnection` directo (malla).

### Cliente → Servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `rtc:ready` | `{ roomId, userId, username, avatarUrl }` | Aviso de que el cliente está listo para WebRTC. El servidor notifica a **los demás** en la sala. |
| `rtc:offer` | `{ to, offer, userId, username, avatarUrl }` | Reenvía la oferta SDP al socket destino (`to` = `socket.id` del par). |
| `rtc:answer` | `{ to, answer, userId, username, avatarUrl }` | Reenvía la respuesta SDP al par. |
| `rtc:ice` | `{ to, candidate }` | Reenvía un candidato ICE al par. |
| `rtc:media_state` | `{ roomId, userId, isMuted, isCameraOff, isScreenSharing }` | Estado de micrófono/cámara/pantalla; se difunde en la sala. |

### Servidor → Cliente

| Evento | Payload | Destinatario |
|--------|---------|--------------|
| `rtc:peer_ready` | `{ socketId, userId, username, avatarUrl }` | Resto de la sala (quien ya estaba cuando otro hace `rtc:ready`). |
| `rtc:offer` | `{ from, offer, userId, username, avatarUrl }` | Socket `to` indicado por el emisor. |
| `rtc:answer` | `{ from, answer, userId, username, avatarUrl }` | Socket `to` indicado por el emisor. |
| `rtc:ice` | `{ from, candidate }` | Socket `to` indicado por el emisor. |
| `rtc:media_state_update` | `{ userId, isMuted, isCameraOff, isScreenSharing }` | Resto de la sala. |

### Lógica P2P en malla

En una sala con **N** usuarios, cada cliente mantiene hasta **N − 1** conexiones `RTCPeerConnection` (una con cada par). El backend solo enruta mensajes de señalización por `socket.id`.

**Quién inicia la negociación:** cuando un usuario nuevo entra, los que ya estaban reciben `rtc:peer_ready` con su `socketId`. El recién llegado **no** recibe `rtc:peer_ready` de los presentes (ese evento solo lo escuchan quienes ya estaban en la sala). Por eso:

1. Los **usuarios existentes** crean offer hacia el `socketId` del recién llegado (tras `rtc:peer_ready`).
2. El **recién llegado** aprende la identidad de cada par desde el payload de cada `rtc:offer` entrante (`userId`, `username`, `avatarUrl`) y responde con `rtc:answer`.

Así se cubre el caso US-12: unirse a una sala con actividad previa sin perder el mapeo socket ↔ usuario.

### Secuencia P2P (dos usuarios)

```
Usuario A (ya en sala)              Servidor              Usuario B (recién entra)
        |                              |                            |
        |                              |<-- rtc:ready (B) ----------|
        |<-- rtc:peer_ready (B) -------|                            |
        |                              |                            |
        |-- rtc:offer { to: B } ------>|-- rtc:offer -------------->|
        |                              |                            |
        |                              |<-- rtc:answer { to: A } ---|
        |<-- rtc:answer ---------------|                            |
        |                              |                            |
        |-- rtc:ice { to: B } -------->|-- rtc:ice ---------------->|
        |<-- rtc:ice ------------------|<-- rtc:ice { to: A } -----|
        |                              |                            |
        |=========== RTCPeerConnection P2P (audio/vídeo) ===========|
```

### ICE y TURN

Antes de crear conexiones, el frontend debe llamar a `GET /ice-servers`. El backend devuelve:

- STUN público de Google (siempre).
- TURN de ExpressTURN (solo si `TURN_USERNAME` y `TURN_CREDENTIAL` están en `.env`).

Sin TURN, WebRTC puede fallar bajo NAT estricto; la señalización por Socket.IO seguirá funcionando.

---

## Variables de entorno

Ver `.env.example`. Resumen:

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto HTTP/WebSocket (default `3002`). |
| `FRONTEND_URL` | Origen CORS del frontend. |
| `FIREBASE_*` | Persistencia de mensajes (opcional). |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Relay TURN para WebRTC (opcional). |

## Estructura relevante

```
src/
  index.ts              # Express, Socket.IO, rutas HTTP
  handlers/
    chatHandlers.ts     # Chat, presencia, historial
    rtcHandlers.ts      # Señalización WebRTC P2P
  config/
    iceServers.ts       # STUN/TURN para clientes
    firebase.ts         # Admin SDK (opcional)
  types/index.ts        # Tipos de chat
  services/messageService.ts
```
