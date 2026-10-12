"use client";

import { useState, useCallback } from "react";
import {
  CalendarCheck,
  Calendar,
  Filter,
  Users,
  Banknote,
  Activity,
  Download,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { reportesApi } from "@/services/api";
import type { CobradorDelDia } from "@/services/api";
import { descargarCSV, fmtNum } from "@/utils/exportCsv";

function hoyLocal(): string {
  const d = new Date();
  const año = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const día = String(d.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
}

export default function CobradoresDelDiaPage() {
  useAuth();

  const [data, setData] = useState<CobradorDelDia[]>([]);
  const [fecha, setFecha] = useState(hoyLocal());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const result = await reportesApi.getCobradoresDia({ fecha });
      setData(result.data);
      setConsultado(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar el reporte";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  const formatearMonto = (monto: number) =>
    new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto);

  const totales = data.reduce(
    (acc, r) => ({
      asignaciones: acc.asignaciones + r.asignaciones_dia,
      cobros: acc.cobros + r.cobros_dia,
      monto: acc.monto + r.monto_cobrado_dia,
      visitas: acc.visitas + r.visitas_dia,
    }),
    { asignaciones: 0, cobros: 0, monto: 0, visitas: 0 }
  );

  return (
    <PanelShell title="Cobradores del Día">
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-indigo-500" />
              Cobradores del Día
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Cobradores en actividad hoy: asignaciones del día, cobros en
              tiempo real
            </p>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => cargar()}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              {cargando ? "Cargando..." : "Consultar"}
            </button>
            <button
              onClick={() =>
                descargarCSV({
                  nombreArchivo: `cobradores_dia_${fecha}.csv`,
                  titulo: "Cobradores del Día",
                  subtitulos: [`Fecha: ${fecha}`, `Generado: ${new Date().toLocaleString("es-PY")}`],
                  columnas: [
                    { header: "Cobrador", accessor: (r) => (r as CobradorDelDia).cobrador },
                    { header: "Empresa", accessor: (r) => (r as CobradorDelDia).empresa },
                    { header: "Asignaciones del día", accessor: (r) => (r as CobradorDelDia).asignaciones_dia },
                    { header: "Cobros del día", accessor: (r) => (r as CobradorDelDia).cobros_dia },
                    { header: "Monto cobrado (Gs.)", accessor: (r) => fmtNum((r as CobradorDelDia).monto_cobrado_dia) },
                    { header: "Visitas", accessor: (r) => (r as CobradorDelDia).visitas_dia },
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        )}

        {/* Empty state */}
        {!cargando && !error && !consultado && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <Filter className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Presiona <strong>Consultar</strong> para ver la actividad de los
              cobradores.
            </p>
          </div>
        )}

        {!cargando && !error && consultado && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Asignaciones
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales.asignaciones}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Activity className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Visitas del Día
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales.visitas}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <CalendarCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Cobros del Día
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales.cobros}
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
                      Monto Cobrado
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatearMonto(totales.monto)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de cobradores */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Actividad por Cobrador
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Cobrador
                      </th>
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Empresa
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Asignaciones
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Visitas
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Cobros
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Monto Cobrado
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
                          No hay cobradores con actividad en la fecha
                          seleccionada
                        </td>
                      </tr>
                    ) : (
                      data.map((c) => (
                        <tr
                          key={c.cobrador_id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {c.cobrador}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {c.empresa}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {c.asignaciones_dia}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {c.visitas_dia}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {c.cobros_dia}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-emerald-600">
                            {formatearMonto(c.monto_cobrado_dia)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PanelShell>
  );
}
