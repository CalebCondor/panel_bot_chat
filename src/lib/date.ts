// Helpers de fecha tolerantes a los formatos que devuelve el backend.
//
// El backend puede enviar timestamps en dos formatos distintos:
//
//   1. PostgreSQL / ISO-8601 : "2026-10-26T15:08:01.677Z"
//   2. SQL Server             : "2026-10-25 15:43:50.829571"
//
// El formato 2 NO es un ISO-8601 válido y `new Date()` lo interpreta de forma
// inconsistente entre navegadores (Chrome lo acepta como hora local, Safari
// devuelve Invalid Date). Por eso normalizamos antes de construir la Date.

// "2026-10-25 15:43:50.829571" -> "2026-10-25T15:43:50.829571"
// Deja intactas las fechas que ya vienen en ISO-8601.
function toIsoLike(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Solo el espacio entre fecha y hora es el problema; conserva la "Z" final.
  return trimmed.replace(' ', 'T');
}

// Devuelve la fechaParseable de un timestamp del backend, o null si no es válido.
export function parseBackendDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(toIsoLike(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Formatea una fecha "YYYY-MM-DD" (sin hora) como texto en español.
// Devuelve "" en vez de "Invalid Date" si la entrada no es válida.
export function formatFecha(dateStr?: string | null, withYear = false): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return "";
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

// Igual que formatFecha pero corto: "26 oct".
export function formatFechaShort(dateStr?: string | null): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return "";
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Formatea un timestamp del backend. Devuelve "" si es inválido.
export function formatTimestamp(
  raw: string | undefined | null,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = parseBackendDate(raw);
  if (!d) return "";
  return d.toLocaleString("es-MX", opts ?? { dateStyle: "short", timeStyle: "short" });
}

// Hora del timestamp en hora de Puerto Rico. Devuelve "" si es inválido.
export function formatHoraPR(raw?: string | null): string {
  const d = parseBackendDate(raw);
  if (!d) return "";
  return d.toLocaleTimeString("es-PR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Puerto_Rico",
  });
}

// Hora del timestamp en la zona horaria del navegador. Devuelve "" si es inválido.
export function formatHora(
  raw?: string | null,
  locale = "es-MX",
): string {
  const d = parseBackendDate(raw);
  if (!d) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
