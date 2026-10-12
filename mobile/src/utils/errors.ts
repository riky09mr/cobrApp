/**
 * Utilidades de manejo de errores para la app.
 */

/**
 * Extrae un mensaje legible de un error de Axios u otro error desconocido.
 *
 * @param e        El error capturado (unknown)
 * @param fallback Mensaje por defecto si no se puede extraer uno mejor
 * @returns Mensaje de error legible para mostrar al usuario
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { message?: string; detail?: string } };
    message?: string;
  };

  const msg = err?.response?.data?.message;
  if (msg) return msg;

  const raw = err?.message;
  if (raw?.includes('Network') || raw?.includes('timeout')) {
    return 'No se pudo conectar al servidor. Verificá tu conexión e IP.';
  }

  return raw ?? fallback;
}

/**
 * Extrae un mensaje de error incluyendo el detalle (si existe).
 * Útil para errores de validación del backend que traen `detail`.
 */
export function getErrorMessageWithDetail(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { message?: string; detail?: string } };
    message?: string;
  };

  const msg = err?.response?.data?.message;
  const detail = err?.response?.data?.detail;
  if (msg && detail) return `${msg}\n\n${detail}`;
  if (msg) return msg;

  const raw = err?.message;
  if (raw?.includes('Network') || raw?.includes('timeout')) {
    return 'No se pudo conectar al servidor. Verificá tu conexión e IP.';
  }

  return raw ?? fallback;
}
