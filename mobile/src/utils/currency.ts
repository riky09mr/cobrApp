/**
 * Utilidades de moneda para cobrApp.
 * La moneda oficial del sistema es el Guaraní paraguayo (Gs. / ₲).
 * Usá estas funciones en lugar de repetir `Gs. ${Number(x).toLocaleString('es-PY')}`.
 */

export const CURRENCY_SYMBOL = 'Gs.';

/**
 * Formatea un número como Guaraníes con separador de miles.
 * @example formatGuaranies(1500000) → "Gs. 1.500.000"
 */
export function formatGuaranies(valor: number | string | null | undefined): string {
  const num = Number(valor);
  if (Number.isNaN(num)) return `${CURRENCY_SYMBOL} 0`;
  return `${CURRENCY_SYMBOL} ${num.toLocaleString('es-PY')}`;
}

/**
 * Formatea un número como Guaraníes SIN el símbolo (solo el número con separador).
 * @example formatNumber(1500000) → "1.500.000"
 */
export function formatNumber(valor: number | string | null | undefined): string {
  const num = Number(valor);
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('es-PY');
}

/**
 * Convierte un string ingresado por el usuario (con puntos y/o coma) a número.
 * Acepta formatos "1.500.000", "1500000", "1,5", "1.5".
 * @example parseMonto("1.500.000") → 1500000
 */
export function parseMonto(texto: string): number {
  if (!texto) return 0;
  // Quitar separadores de miles (puntos) y usar coma como decimal
  const limpio = texto.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpio);
  return Number.isNaN(num) ? 0 : num;
}
