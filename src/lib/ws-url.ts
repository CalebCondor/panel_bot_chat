// URL del WebSocket del backend NestJS.
// Por defecto apunta al backend local (http://localhost:3001/).
// Para desarrollo local, sobreescribir en .env.local con ws://localhost:3001
const DEFAULT_WS_URL = 'http://localhost:3001/';

const envUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

/**
 * `new WebSocket()` solo acepta ws:// o wss:// — si se le pasa http:// lanza
 * un SyntaxError y la conexión en tiempo real nunca se abre. Por eso
 * convertimos el esquema http/https a ws/wss.
 */
function toWebSocketUrl(url: string): string {
  return url.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
}

const base = envUrl ? envUrl.replace(/\/$/, '') : DEFAULT_WS_URL;

export const WS_URL: string = `${toWebSocketUrl(base)}/`;
