"use client";

import { useState, useCallback } from "react";
import {
  Calendar,
  Filter,
  Trophy,
  Banknote,
  Medal,
  Download,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { reportesApi } from "@/services/api";
import type { RankingCobrador } from "@/services/api";
import { descargarCSV, fmtNum } from "@/utils/exportCsv";

const MEDALLA: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-800 border-yellow-300",
  2: "bg-gray-100 text-gray-700 border-gray-300",
  3: "bg-orange-100 text-orange-800 border-orange-300",
};

export default function RankingCobradoresPage() {
  useAuth();

  const [data, setData] = useState<RankingCobrador[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const result = await reportesApi.getRankingCobradores({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      setData(result.data);
      setConsultado(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar el reporte";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta]);

  const formatearMonto = (monto: number) =>
    new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto);

  return (
    <PanelShell title="Ranking de Cobradores">
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-teal-500" />
              Ranking de Cobradores
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Top de cobradores por monto cobrado, eficiencia y visitas
              efectivas
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                title="Fecha desde"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <span className="text-gray-400 text-sm">a</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                title="Fecha hasta"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <button
              onClick={() => cargar()}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              {cargando ? "Cargando..." : "Consultar"}
            </button>
            <button
              onClick={() =>
                descargarCSV({
                  nombreArchivo: `ranking_cobradores_${fechaDesde || "todo"}_a_${fechaHasta || "todo"}.csv`,
                  titulo: "Ranking de Cobradores",
                  subtitulos: [
                    fechaDesde || fechaHasta
                      ? `Período: ${fechaDesde || "inicio"} al ${fechaHasta || "hoy"}`
                      : "Período: todo",
                    `Generado: ${new Date().toLocaleString("es-PY")}`,
                  ],
                  columnas: [
                    { header: "Posición", accessor: (r) => (r as RankingCobrador).posicion },
                    { header: "Cobrador", accessor: (r) => (r as RankingCobrador).cobrador },
                    { header: "Empresa", accessor: (r) => (r as RankingCobrador).empresa },
                    { header: "Asignaciones", accessor: (r) => (r as RankingCobrador).total_asignaciones },
                    { header: "Completadas", accessor: (r) => (r as RankingCobrador).completadas },
                    { header: "Pendientes", accessor: (r) => (r as RankingCobrador).pendientes },
                    { header: "Monto cobrado (Gs.)", accessor: (r) => fmtNum((r as RankingCobrador).monto_cobrado) },
                    { header: "Visitas", accessor: (r) => (r as RankingCobrador).visitas_realizadas },
                    { header: "Cobradas", accessor: (r) => (r as RankingCobrador).visitas_cobradas },
                    { header: "Efectividad (%)", accessor: (r) => (r as RankingCobrador).tasa_efectividad_visitas },
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        )}

        {/* Empty state */}
        {!cargando && !error && !consultado && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <Filter className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Presiona <strong>Consultar</strong> para generar el ranking de
              cobradores.
              <br />
              Dejá las fechas vacías para ver el ranking histórico completo.
            </p>
          </div>
        )}

        {!cargando && !error && consultado && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Cobradores Ordenados por Monto Cobrado
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">
                      #
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">
                      Cobrador
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">
                      Empresa
                    </th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-600">
                      Monto Cobrado
                    </th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-600">
                      Visitas Cobradas
                    </th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-600">
                      Efectividad
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
                        No hay cobradores con actividad en el período
                        seleccionado
                      </td>
                    </tr>
                  ) : (
                    data.map((c) => (
                      <tr
                        key={c.cobrador_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3">
                          {c.posicion <= 3 ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${MEDALLA[c.posicion]}`}
                            >
                              <Medal className="w-3 h-3" />
                              {c.posicion}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-medium">
                              {c.posicion}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {c.cobrador}
                        </td>
                        <td className="px-6 py-3 text-gray-500">
                          {c.empresa}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-teal-600">
                          <span className="inline-flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5" />
                            {formatearMonto(c.monto_cobrado)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {c.visitas_cobradas} / {c.visitas_realizadas}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              c.tasa_efectividad_visitas >= 70
                                ? "bg-emerald-100 text-emerald-800"
                                : c.tasa_efectividad_visitas >= 40
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {c.tasa_efectividad_visitas}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
