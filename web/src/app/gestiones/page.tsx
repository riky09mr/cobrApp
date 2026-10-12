"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Gestion, Cobrador } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Download, FileText, ChevronLeft, ChevronRight, Eye } from "lucide-react";

const RESULTADO_LABEL: Record<string, string> = {
  cobrado:    "Cobrado",
  ausente:    "Ausente",
  reagendado: "Reagendado",
};

const RESULTADO_CLASSES: Record<string, string> = {
  cobrado:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  ausente:    "bg-red-100 text-red-700 border-red-200",
  reagendado: "bg-amber-100 text-amber-700 border-amber-200",
};

function getUserRol(): string {
  try {
    const raw = localStorage.getItem("cobrapp_user");
    return raw ? (JSON.parse(raw) as { rol?: string }).rol ?? "" : "";
  } catch { return ""; }
}

export default function GestionesPage() {
  useAuth();
  const router = useRouter();

  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rol, setRol] = useState("");

  // Filtros
  const [filtroCobrador, setFiltroCobrador] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(
    () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Asuncion" })
  );
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(
    () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Asuncion" })
  );
  const [filtroResultado, setFiltroResultado] = useState("");
  const [errorRango, setErrorRango] = useState<string | null>(null);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 15;

  useEffect(() => { setRol(getUserRol()); }, []);

  const cargar = useCallback(async () => {
    // Validación del rango de fechas (máximo 31 días)
    if (filtroFechaDesde && filtroFechaHasta) {
      const desde = new Date(filtroFechaDesde + "T00:00:00");
      const hasta = new Date(filtroFechaHasta + "T00:00:00");
      if (hasta < desde) {
        setErrorRango("La fecha 'Hasta' no puede ser anterior a 'Desde'.");
        return;
      }
      const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1;
      if (dias > 31) {
        setErrorRango("El rango de fechas no puede superar los 31 días.");
        return;
      }
    }
    setErrorRango(null);
    setLoading(true);
    setError(null);
    try {
      const [data, cobs] = await Promise.all([
        panelApi.getGestiones({
          cobradorId: filtroCobrador ? Number(filtroCobrador) : undefined,
          fechaDesde: filtroFechaDesde || undefined,
          fechaHasta: filtroFechaHasta || undefined,
          resultado: filtroResultado || undefined,
        }),
        panelApi.getCobradores(),
      ]);
      setGestiones(data);
      setCobradores(cobs);
      setPaginaActual(1);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e.response?.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError("No se pudo cargar las gestiones");
      }
    } finally {
      setLoading(false);
    }
  }, [filtroCobrador, filtroFechaDesde, filtroFechaHasta, filtroResultado, router]);

  useEffect(() => { void cargar(); }, [cargar]);

  function descargarCSV() {
    if (gestiones.length === 0) return;
    const encabezados = [
      "Fecha/Hora", "Cobrador", "Cliente", "Cédula",
      "Crédito", "Cuota #", "Resultado", "Monto Cobrado",
      "Medio de Pago", "Reagendado Hora", "Observación",
    ];
    const filas = gestiones.map((g) => [
      new Date(g.fecha_hora).toLocaleString("es-PY"),
      g.cobrador,
      `${g.cliente_nombre} ${g.cliente_apellido ?? ""}`.trim(),
      g.cedula ?? "",
      g.numero_credito ?? "",
      g.numero_cuota,
      RESULTADO_LABEL[g.resultado] ?? g.resultado,
      g.monto_cobrado ? Number(g.monto_cobrado).toLocaleString("es-PY") : "",
      g.medio_pago ?? "",
      g.nueva_hora ?? "",
      (g.comentario ?? "").replace(/"/g, "'"),
    ]);
    const bom = "\uFEFF";
    const csvContent =
      bom +
      [encabezados, ...filas]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestiones_${filtroFechaDesde || "todas"}_a_${filtroFechaHasta || "todas"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function descargarPDF(id: number) {
    try {
      const token = localStorage.getItem("cobrapp_token");
      // En la web se usa el comprobante en formato A4 (más presentable),
      // distinto al ticket térmico 80mm que usa la app móvil.
      const res = await fetch(
        `http://localhost:5000/api/gestiones/${id}/comprobante-a4`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } }
      );
      if (!res.ok) { alert("Error al generar el comprobante"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el comprobante");
    }
  }

  async function verPDF(id: number) {
    try {
      const token = localStorage.getItem("cobrapp_token");
      const res = await fetch(
        `http://localhost:5000/api/gestiones/${id}/comprobante-a4`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } }
      );
      if (!res.ok) { alert("Error al generar el comprobante"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      alert("Error al ver el comprobante");
    }
  }

  // Totales
  const totalCobrado = gestiones
    .filter((g) => g.resultado === "cobrado")
    .reduce((s, g) => s + Number(g.monto_cobrado ?? 0), 0);
  const countCobrado    = gestiones.filter((g) => g.resultado === "cobrado").length;
  const countAusente    = gestiones.filter((g) => g.resultado === "ausente").length;
  const countReagendado = gestiones.filter((g) => g.resultado === "reagendado").length;

  const totalPaginas = Math.max(1, Math.ceil(gestiones.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const gestionesPagina = gestiones.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  return (
    <PanelShell title="Gestiones" description="Historial de visitas realizadas por los cobradores">
      <div className="space-y-4">

        {/* ── Filtros ── */}
        <section className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            {rol !== "COBRADOR" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-blue-700">Cobrador</label>
                <select
                  value={filtroCobrador}
                  onChange={(e) => setFiltroCobrador(e.target.value)}
                  className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  <option value="">Todos</option>
                  {cobradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido ?? ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-blue-700">Desde</label>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-blue-700">Hasta</label>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-blue-700">Resultado</label>
              <select
                value={filtroResultado}
                onChange={(e) => setFiltroResultado(e.target.value)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="">Todos</option>
                <option value="cobrado">Cobrado</option>
                <option value="ausente">Ausente</option>
                <option value="reagendado">Reagendado</option>
              </select>
            </div>

            <button
              onClick={() => { setFiltroFechaDesde(""); setFiltroFechaHasta(""); setFiltroCobrador(""); setFiltroResultado(""); setErrorRango(null); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
            >
              Limpiar
            </button>

            <button
              onClick={descargarCSV}
              disabled={gestiones.length === 0}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40"
            >
              <Download size={15} />
              Descargar CSV
            </button>
          </div>
        </section>

        {errorRango && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorRango}
          </div>
        )}

        {/* ── Resumen ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-600">Cobros</p>
            <p className="text-2xl font-bold text-emerald-700">{countCobrado}</p>
            <p className="text-xs text-emerald-500 mt-0.5">
              Gs. {totalCobrado.toLocaleString("es-PY")}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-600">Ausentes</p>
            <p className="text-2xl font-bold text-red-700">{countAusente}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-600">Reagendados</p>
            <p className="text-2xl font-bold text-amber-700">{countReagendado}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs text-sky-600">Total visitas</p>
            <p className="text-2xl font-bold text-sky-700">{gestiones.length}</p>
          </div>
        </div>

        {/* ── Tabla ── */}
        <section className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
          {loading && (
            <p className="p-6 text-sm text-blue-600">Cargando gestiones…</p>
          )}
          {error && (
            <p className="p-6 text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && gestiones.length === 0 && (
            <p className="p-6 text-sm text-slate-400">No hay gestiones para los filtros seleccionados.</p>
          )}
          {!loading && !error && gestiones.length > 0 && (
            <div className="overflow-x-auto">
              <p className="px-4 pt-3 text-xs text-blue-400">
                Mostrando {gestionesPagina.length} de {gestiones.length} gestiones
              </p>
              <table className="w-full text-sm">
                <thead className="bg-sky-50 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Fecha / Hora</th>
                    {rol !== "COBRADOR" && <th className="px-4 py-3">Cobrador</th>}
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Cuota</th>
                    <th className="px-4 py-3">Resultado</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Observación</th>
                    <th className="px-4 py-3">Foto</th>
                    <th className="px-4 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-50">
                  {gestionesPagina.map((g) => (
                    <tr key={g.id} className="hover:bg-sky-50/50 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-blue-800">
                        {new Date(g.fecha_hora).toLocaleString("es-PY", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      {rol !== "COBRADOR" && (
                        <td className="px-4 py-3 text-blue-900 font-medium">{g.cobrador}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-medium text-blue-900">
                          {g.cliente_nombre} {g.cliente_apellido ?? ""}
                        </span>
                        {g.cedula && (
                          <span className="ml-1 text-xs text-blue-400">CI: {g.cedula}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-blue-600">
                        #{g.numero_cuota}
                        {g.numero_credito && (
                          <span className="ml-1 text-xs text-blue-400">· {g.numero_credito}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RESULTADO_CLASSES[g.resultado] ?? ""}`}
                        >
                          {RESULTADO_LABEL[g.resultado] ?? g.resultado}
                          {g.resultado === "reagendado" && g.nueva_hora && (
                            <span className="ml-1">· {g.nueva_hora}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-900">
                        {g.monto_cobrado
                          ? `Gs. ${Number(g.monto_cobrado).toLocaleString("es-PY")}`
                          : <span className="text-slate-400">—</span>
                        }
                        {g.medio_pago && (
                          <span className="ml-1 text-xs text-blue-400">({g.medio_pago})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-55">
                        {g.comentario
                          ? <span className="text-slate-600 text-xs">{g.comentario}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {g.foto_path ? (
                          <a
                            href={`http://localhost:5000/uploads/${g.foto_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 hover:underline text-xs"
                          >
                            Ver foto
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {g.resultado === "cobrado" ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void verPDF(g.id)}
                              title="Ver comprobante PDF"
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 border border-sky-200"
                            >
                              <Eye size={13} />
                              Ver
                            </button>
                            <button
                              onClick={() => void descargarPDF(g.id)}
                              title="Descargar comprobante PDF"
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200"
                            >
                              <FileText size={13} />
                              PDF
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-sky-100 px-4 py-3">
              <button
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                disabled={paginaSegura <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span className="text-sm text-blue-600">
                Página {paginaSegura} de {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura >= totalPaginas}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>
    </PanelShell>
  );
}
