// Configuración de servidores ICE (STUN + TURN) para WebRTC.
// El backend la sirve al cliente para no exponer las credenciales TURN en el bundle
// del frontend. Las credenciales del TURN provienen de ExpressTURN y se leen del .env
// (TURN_USERNAME / TURN_CREDENTIAL); en producción se configuran en el dashboard de Render.

/** Entrada de servidor ICE tal como la espera RTCPeerConnection en el navegador. */
export interface IceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

const TURN_HOST = process.env.TURN_URL || 'relay1.expressturn.com'

/**
 * Devuelve la lista de servidores ICE. Siempre incluye un STUN público de Google;
 * añade el TURN de ExpressTURN solo si hay credenciales configuradas (sin ellas el
 * servicio TURN rechazaría la conexión, así que es mejor omitirlo).
 *
 * Se exponen tres URLs del TURN para maximizar la conectividad bajo NAT/firewall
 * estrictos: UDP y TCP en el puerto estándar 3478, y TURNS (TLS) en el 443, que suele
 * estar abierto incluso en redes corporativas restrictivas.
 */
export function getIceServers(): IceServer[] {
  const iceServers: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

  const username = process.env.TURN_USERNAME
  const credential = process.env.TURN_CREDENTIAL

  if (username && credential) {
    iceServers.push({
      urls: [
        `turn:${TURN_HOST}:3478?transport=udp`,
        `turn:${TURN_HOST}:3478?transport=tcp`,
        `turns:${TURN_HOST}:443?transport=tcp`,
      ],
      username,
      credential,
    })
  } else {
    console.warn(
      'TURN no configurado (faltan TURN_USERNAME/TURN_CREDENTIAL): WebRTC usará solo STUN. ' +
        'Las conexiones pueden fallar bajo NAT estricto.',
    )
  }

  return iceServers
}

/** True si hay un TURN configurado (útil para logging de arranque). */
export function isTurnConfigured(): boolean {
  return Boolean(process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL)
}
