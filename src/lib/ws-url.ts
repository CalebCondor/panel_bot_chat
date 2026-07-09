// URL del WebSocket del backend NestJS.
// Por defecto apunta al dominio público de producción.
// Para desarrollo local, sobreescribir en .env.local con ws://localhost:3000
const DEFAULT_WS_URL = '/api/proxy"';

const envUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

export const WS_URL: string = envUrl
  ? `${envUrl.replace(/\/$/, '')}/`
  : DEFAULT_WS_URL