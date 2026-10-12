"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Calendar,
  Download,
  Filter,
  Search,
  Users,
  CreditCard,
  Banknote,
  Clock,
  Building2,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { reportesApi } from "@/services/api";
import { descargarCSV, fmtNum } from "@/utils/exportCsv";

type RangoCartera = {
  rango: string;
  cantidad_cuotas: number;
  cantidad_creditos: number;
  cantidad_clientes: number;
  monto_total: number;
};

type TotalesCartera = {
  total_cuotas: number;
  total_creditos: number;
  total_clientes: number;
  total_monto: number;
};

type DetalleDeudor = {
  cliente_id: number;
  cedula: string | null;
  nombre: string;
  apellido: string | null;
  cuotas_vencidas: number;
  total_adeudado: number;
  max_dias_atraso: number;
  fecha_vencimiento_mas_antigua: string;
};

const RANGO_COLORS: Record<string, string> = {
  "1-30 días": "bg-yellow-50 border-yellow-200 text-yellow-800",
  "31-60 días": "bg-orange-50 border-orange-200 text-orange-800",
  "61-90 días": "bg-red-50 border-red-200 text-red-800",
  "90+ días": "bg-rose-50 border-rose-200 text-rose-800",
};

const RANGO_BADGE: Record<string, string> = {
  "1-30 días": "bg-yellow-100 text-yellow-800",
  "31-60 días": "bg-orange-100 text-orange-800",
  "61-90 días": "bg-red-100 text-red-800",
  "90+ días": "bg-rose-100 text-rose-800",
};

export default function CarteraVencidaPage() {
  useAuth();

  const [data, setData] = useState<RangoCartera[]>([]);
  const [totales, setTotales] = useState<TotalesCartera | null>(null);
  const [detalle, setDetalle] = useState<DetalleDeudor[]>([]);
  const [fechaCorte, setFechaCorte] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const result = await reportesApi.getCarteraVencida({
        fecha_corte: fechaCorte,
      });
      setData(result.data);
      setTotales(result.totales);
      setDetalle(result.detalle);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar el reporte";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [fechaCorte]);

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

  return (
    <PanelShell title="Cartera Vencida por Antigüedad">
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Cartera Vencida por Antigüedad
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Distribución de cuotas vencidas agrupadas por rango de días de
              atraso
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <button
              onClick={cargar}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              {cargando ? "Cargando..." : "Filtrar"}
            </button>
            <button
              onClick={() =>
                descargarCSV({
                  nombreArchivo: `cartera_vencida_${fechaCorte}.csv`,
                  titulo: "Cartera Vencida por Antigüedad",
                  subtitulos: [`Fecha de corte: ${fechaCorte}`, `Generado: ${new Date().toLocaleString("es-PY")}`],
                  columnas: [
                    { header: "Rango", accessor: (r) => (r as RangoCartera).rango },
                    { header: "Cuotas", accessor: (r) => (r as RangoCartera).cantidad_cuotas },
                    { header: "Créditos", accessor: (r) => (r as RangoCartera).cantidad_creditos },
                    { header: "Clientes", accessor: (r) => (r as RangoCartera).cantidad_clientes },
                    { header: "Monto Total (Gs.)", accessor: (r) => fmtNum((r as RangoCartera).monto_total) },
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        )}

        {!cargando && !error && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <Banknote className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Total Adeudado
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
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">
                      Créditos en Mora
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {totales?.total_creditos ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla por rangos */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Distribución por Antigüedad
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">
                        Rango
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Cuotas
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Créditos
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Clientes
                      </th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-600">
                        Monto Total
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
                          No hay cuotas vencidas en la fecha seleccionada
                        </td>
                      </tr>
                    ) : (
                      data.map((r) => (
                        <tr
                          key={r.rango}
                          className={`${RANGO_COLORS[r.rango] || ""} hover:bg-opacity-80 transition-colors`}
                        >
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${RANGO_BADGE[r.rango] || "bg-gray-100 text-gray-800"}`}
                            >
                              {r.rango}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            {r.cantidad_cuotas}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.cantidad_creditos}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.cantidad_clientes}
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            {formatearMonto(r.monto_total)}
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Fila de totales */}
                    {totales && data.length > 0 && (
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-6 py-4 text-gray-700">TOTAL</td>
                        <td className="px-6 py-4 text-right">
                          {totales.total_cuotas}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {totales.total_creditos}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {totales.total_clientes}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {formatearMonto(totales.total_monto)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top deudores */}
            {detalle.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    Principales Deudores
                  </h2>
                  <span className="text-xs text-gray-400">
                    Top {detalle.length} clientes
                  </span>
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
                        <th className="text-right px-6 py-3 font-semibold text-gray-600">
                          Cuotas Vencidas
                        </th>
                        <th className="text-right px-6 py-3 font-semibold text-gray-600">
                          Total Adeudado
                        </th>
                        <th className="text-right px-6 py-3 font-semibold text-gray-600">
                          Máx. Días Atraso
                        </th>
                        <th className="text-right px-6 py-3 font-semibold text-gray-600">
                          Venc. más Antiguo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detalle.map((d) => (
                        <tr
                          key={d.cliente_id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {d.nombre} {d.apellido || ""}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {d.cedula || "—"}
                          </td>
                          <td className="px-6 py-3 text-right">{d.cuotas_vencidas}</td>
                          <td className="px-6 py-3 text-right font-medium text-red-600">
                            {formatearMonto(d.total_adeudado)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                d.max_dias_atraso > 90
                                  ? "bg-rose-100 text-rose-800"
                                  : d.max_dias_atraso > 60
                                    ? "bg-red-100 text-red-800"
                                    : d.max_dias_atraso > 30
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {d.max_dias_atraso} días
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-gray-500">
                            {new Date(
                              d.fecha_vencimiento_mas_antigua
                            ).toLocaleDateString("es-PY")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PanelShell>
  );
}
