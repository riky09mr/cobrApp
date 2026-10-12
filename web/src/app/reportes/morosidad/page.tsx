"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Calendar,
  Filter,
  Users,
  CreditCard,
  Banknote,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { reportesApi } from "@/services/api";
import type { ClienteMoroso, TotalesMorosidadCliente } from "@/services/api";
import { descargarCSV, fmtNum } from "@/utils/exportCsv";

function hoyLocal(): string {
  const d = new Date();
  const año = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const día = String(d.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
}

export default function MorosidadClientePage() {
  useAuth();

  const [data, setData] = useState<ClienteMoroso[]>([]);
  const [totales, setTotales] = useState<TotalesMorosidadCliente | null>(null);
  const [fechaCorte, setFechaCorte] = useState(hoyLocal());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 15;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const result = await reportesApi.getMorosidadCliente({
        fecha_corte: fechaCorte,
      });
      setData(result.data);
      setTotales(result.totales);
      setConsultado(true);
      setPaginaActual(1);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar el reporte";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [fechaCorte]);

  const formatearMonto = (monto: number) =>
    new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto);

  const totalPaginas = Math.max(1, Math.ceil(data.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const dataPagina = data.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  return (
    <PanelShell title="Morosidad por Cliente">
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-rose-500" />
              Morosidad por Cliente
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Clientes con cuotas vencidas, montos adeudados y días de atraso
            </p>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
            <button
              onClick={() => cargar()}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              {cargando ? "Cargando..." : "Consultar"}
            </button>
            <button
              onClick={() =>
                descargarCSV({
                  nombreArchivo: `morosidad_clientes_${fechaCorte}.csv`,
                  titulo: "Morosidad por Cliente",
                  subtitulos: [`Fecha de corte: ${fechaCorte}`, `Generado: ${new Date().toLocaleString("es-PY")}`],
                  columnas: [
                    { header: "Cédula", accessor: (r) => (r as ClienteMoroso).cedula ?? "" },
                    { header: "Cliente", accessor: (r) => `${(r as ClienteMoroso).nombre} ${(r as ClienteMoroso).apellido ?? ""}`.trim() },
                    { header: "Teléfono", accessor: (r) => (r as ClienteMoroso).telefono ?? "" },
                    { header: "Dirección", accessor: (r) => (r as ClienteMoroso).direccion ?? "" },
                    { header: "Cuotas vencidas", accessor: (r) => (r as ClienteMoroso).cuotas_vencidas },
                    { header: "Créditos vencidos", accessor: (r) => (r as ClienteMoroso).creditos_vencidos },
                    { header: "Total adeudado (Gs.)", accessor: (r) => fmtNum((r as ClienteMoroso).total_adeudado) },
                    { header: "Máx. días atraso", accessor: (r) => (r as ClienteMoroso).max_dias_atraso },
                    { header: "Venc. más antiguo", accessor: (r) => (r as ClienteMoroso).fecha_vencimiento_mas_antigua },
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

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Cargando */}
        {cargando && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
          </div>
        )}

        {/* Empty state */}
        {!cargando && !error && !consultado && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <Filter className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Presiona <strong>Consultar</strong> para generar el reporte de
              morosidad.
            </p>
          </div>
        )}

        {!cargando && !error && consultado && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-lg">
                    <Banknote className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Total Adeudado
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales
                        ? formatearMonto(totales.total_adeudado)
                        : "Gs. 0"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <CreditCard className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Cuotas Vencidas
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales?.total_cuotas ?? 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Clientes en Mora
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales?.total_clientes ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de clientes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Clientes con Cuotas Vencidas
                </h2>
                {data.length > 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Mostrando {dataPagina.length} de {data.length} clientes
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Cliente
                      </th>
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Cédula
                      </th>
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Teléfono
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Cuotas Vencidas
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Total Adeudado
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Días de Atraso
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-400"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-gray-300" />
                            No hay clientes morosos en la fecha seleccionada
                          </div>
                        </td>
                      </tr>
                    ) : (
                      dataPagina.map((c) => (
                        <tr
                          key={c.cliente_id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {c.nombre} {c.apellido || ""}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {c.cedula || "—"}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {c.telefono || "—"}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-gray-500">
                            {c.cuotas_vencidas}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-rose-600">
                            {formatearMonto(c.total_adeudado)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                c.max_dias_atraso > 90
                                  ? "bg-rose-100 text-rose-800"
                                  : c.max_dias_atraso > 60
                                    ? "bg-red-100 text-red-800"
                                    : c.max_dias_atraso > 30
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {c.max_dias_atraso} días
                            </span>
                          </td>
                        </tr>
                      ))
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
