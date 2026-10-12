/**
 * Utilidad compartida para exportar reportes a CSV compatible con Excel
 * (separador ";" y BOM UTF-8 para es-PY / decimales con coma).
 */

type Celda = string | number | null | undefined;

export type ColumnaCSV = {
  header: string;
  /** Función que extrae/formatea el valor de la fila */
  accessor: (fila: unknown) => Celda;
};

export type ExportCSVParams = {
  nombreArchivo: string;
  titulo?: string;
  subtitulos?: string[];
  columnas: ColumnaCSV[];
  filas: unknown[];
};

function escapar(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function aTexto(v: Celda): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Descarga un CSV con encabezado + filas.
 * Uso:
 *   descargarCSV({
 *     nombreArchivo: `cartera_${fecha}.csv`,
 *     titulo: "Cartera Vencida",
 *     subtitulos: [`Fecha de corte: ${fecha}`],
 *     columnas: [
 *       { header: "Rango", accessor: (r) => (r as RangoCartera).rango },
 *       { header: "Cuotas", accessor: (r) => (r as RangoCartera).cantidad_cuotas },
 *     ],
 *     filas: data,
 *   });
 */
export function descargarCSV({
  nombreArchivo,
  titulo,
  subtitulos = [],
  columnas,
  filas,
}: ExportCSVParams) {
  if (filas.length === 0) return;

  const sep = ";";
  const lineas: string[] = [];

  if (titulo) lineas.push(escapar(titulo));
  for (const s of subtitulos) lineas.push(escapar(s));
  if (titulo || subtitulos.length > 0) lineas.push("");

  lineas.push(columnas.map((c) => escapar(c.header)).join(sep));

  for (const fila of filas) {
    const valores = columnas.map((c) => aTexto(c.accessor(fila)));
    lineas.push(valores.map(escapar).join(sep));
  }

  const bom = "\uFEFF";
  const blob = new Blob([bom + lineas.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Formatea un número como entero/moneda local (2.500.000) */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
  return Math.round(Number(n)).toLocaleString("es-PY");
}
