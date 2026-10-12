"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Calendar,
  Filter,
  TrendingUp,
  Users,
  Banknote,
  Target,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { reportesApi } from "@/services/api";
import { descargarCSV, fmtNum } from "@/utils/exportCsv";

type PeriodoCobranza = {
  periodo: string;
  cantidad_cobros: number;
  cobradores_activos: number;
  monto_cobrado: number;
  promedio_por_cobro: number;
};

type TotalesPeriodo = {
  total_cobros: number;
  total_cobradores: number;
  total_monto: number;
  promedio_general: number;
};

type CobradorOpcion = {
  id: number;
  nombre: string;
  apellido: string;
};

const AGRUPACIONES = [
  { value: "mensual", label: "Mensual" },
  { value: "semanal", label: "Semanal" },
  { value: "diaria", label: "Diaria" },
] as const;

export default function CobranzaPeriodoPage() {
  useAuth();

  const [data, setData] = useState<PeriodoCobranza[]>([]);
  const [totales, setTotales] = useState<TotalesPeriodo | null>(null);
  const [cobradores, setCobradores] = useState<CobradorOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState(
    new Date(new Date().getFullYear(), 0, 2).toISOString().slice(0, 10)
  );
  const [fechaHasta, setFechaHasta] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [agrupacion, setAgrupacion] = useState<"mensual" | "semanal" | "diaria">("mensual");
  const [cobradorId, setCobradorId] = useState<number | undefined>(undefined);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 15;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const result = await reportesApi.getCobranzaPeriodo({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        agrupacion,
        cobrador_id: cobradorId,
      });
      setData(result.data);
      setTotales(result.totales);
      setCobradores(result.cobradores);
      setPaginaActual(1);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar el reporte";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta, agrupacion, cobradorId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const formatearMonto = (monto: number) =>
    new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto);

  const formatearPeriodo = (periodo: string) => {
    if (agrupacion === "mensual") {
      const [year, month] = periodo.split("-");
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
      ];
      return `${meses[parseInt(month) - 1]} ${year}`;
    }
    if (agrupacion === "semanal") {
      const [year, week] = periodo.split("-");
      return `Semana ${week} - ${year}`;
    }
    // diaria
    return new Date(periodo).toLocaleDateString("es-PY", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const maxMonto = Math.max(...data.map((d) => d.monto_cobrado), 1);

  const totalPaginas = Math.max(1, Math.ceil(data.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const dataPagina = data.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  return (
    <PanelShell title="Cobranza por Período">
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              Cobranza por Período
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Evolución de montos cobrados y cantidad de cobros en el tiempo
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Agrupación
              </label>
              <select
                value={agrupacion}
                onChange={(e) =>
                  setAgrupacion(e.target.value as "mensual" | "semanal" | "diaria")
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {AGRUPACIONES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cobrador
              </label>
              <select
                value={cobradorId ?? ""}
                onChange={(e) =>
                  setCobradorId(e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                {cobradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={cargar}
                disabled={cargando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                <Filter className="w-4 h-4" />
                {cargando ? "Cargando..." : "Filtrar"}
              </button>
              <button
                onClick={() =>
                  descargarCSV({
                    nombreArchivo: `cobranza_periodo_${agrupacion}_${fechaDesde}_a_${fechaHasta}.csv`,
                    titulo: "Cobranza por Período",
                    subtitulos: [
                      `Período: ${fechaDesde} al ${fechaHasta}`,
                      `Agrupación: ${agrupacion}`,
                      `Generado: ${new Date().toLocaleString("es-PY")}`,
                    ],
                    columnas: [
                      { header: "Período", accessor: (r) => (r as PeriodoCobranza).periodo },
                      { header: "Cobros", accessor: (r) => (r as PeriodoCobranza).cantidad_cobros },
                      { header: "Cobradores activos", accessor: (r) => (r as PeriodoCobranza).cobradores_activos },
                      { header: "Monto cobrado (Gs.)", accessor: (r) => fmtNum((r as PeriodoCobranza).monto_cobrado) },
                      { header: "Promedio por cobro (Gs.)", accessor: (r) => fmtNum((r as PeriodoCobranza).promedio_por_cobro) },
                    ],
                    filas: data,
                  })
                }
                disabled={data.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Cargando */}
        {cargando && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {!cargando && !error && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Banknote className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Total Cobrado
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales
                        ? formatearMonto(totales.total_monto)
                        : "Gs. 0"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Cantidad de Cobros
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales?.total_cobros ?? 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Cobradores Activos
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales?.total_cobradores ?? 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Target className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Promedio por Cobro
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales
                        ? formatearMonto(totales.promedio_general)
                        : "Gs. 0"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico de barras horizontal */}
            {data.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Evolución por {agrupacion === "mensual" ? "Mes" : agrupacion === "semanal" ? "Semana" : "Día"}
                  </h2>
                </div>
                <div className="p-6 space-y-3">
                  {data.map((d) => {
                    const pct = (d.monto_cobrado / maxMonto) * 100;
                    return (
                      <div key={d.periodo}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 capitalize">
                            {formatearPeriodo(d.periodo)}
                          </span>
                          <span className="text-gray-900 font-semibold">
                            {formatearMonto(d.monto_cobrado)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            >
                              {pct > 15 && (
                                <span className="text-[10px] text-white font-medium">
                                  {d.cantidad_cobros} cobros
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 w-16 text-right">
                            {d.cobradores_activos} cob.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabla detallada */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Detalle por Período
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Período
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Cobros
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Cobradores
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Monto Cobrado
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Promedio x Cobro
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-gray-400"
                        >
                          No hay datos de cobranza en el período seleccionado
                        </td>
                      </tr>
                    ) : (
                      dataPagina.map((d) => (
                        <tr
                          key={d.periodo}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900 capitalize">
                            {formatearPeriodo(d.periodo)}
                          </td>
                          <td className="px-6 py-4 text-right">{d.cantidad_cobros}</td>
                          <td className="px-6 py-4 text-right">
                            {d.cobradores_activos}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-blue-600">
                            {formatearMonto(d.monto_cobrado)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-600">
                            {formatearMonto(d.promedio_por_cobro)}
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Fila de totales */}
                    {totales && data.length > 0 && (
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-6 py-4 text-gray-700">TOTAL</td>
                        <td className="px-6 py-4 text-right">
                          {totales.total_cobros}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {totales.total_cobradores}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {formatearMonto(totales.total_monto)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {formatearMonto(totales.promedio_general)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                  <button
                    onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                    disabled={paginaSegura <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {paginaSegura} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaSegura >= totalPaginas}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PanelShell>
  );
}
