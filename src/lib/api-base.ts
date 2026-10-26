// URL base del backend NestJS para las llamadas REST.
//
// Apunta al backend local por defecto (http://localhost:3001/api). El
// prefijo `/api` es obligatorio: el backend lo define con
// `app.setGlobalPrefix('api')` en main.ts.
//
// Para apuntar a otro destino (producción), sobreescribir en .env.local con:
//   NEXT_PUBLIC_API_BASE=<URL_DEL_BACKEND>/api
const DEFAULT_API_BASE = 'https://retinacare-agenteretina-9ufpsd-4311df-187-77-15-77.sslip.io/api';

const envUrl = process.env.NEXT_PUBLIC_API_BASE?.trim();

export const API_BASE: string = envUrl
  ? envUrl.replace(/\/$/, '')
  : DEFAULT_API_BASE;
