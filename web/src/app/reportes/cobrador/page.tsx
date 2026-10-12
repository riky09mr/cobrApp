"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, TrendingUp, User, Building2, CheckCircle2,
  Clock, XCircle, Banknote, Target, Eye, Filter, RotateCcw, Calendar, Download,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { reportesApi } from "@/services/api";
import type { ReporteEficienciaCobrador, ReporteMensual } from "@/services/api";
import { descargarCSV, fmtNum } from "@/utils/exportCsv";
import { useAuth } from "@/hooks/useAuth";

function gs(n: number) {
  return "Gs. " + Math.round(n).toLocaleString("es-PY");
}

export default function ReporteCobradorPage() {
  useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReporteEficienciaCobrador[]>([]);
  const [mensual, setMensual] = useState<ReporteMensual[]>([]);

  // Filtros
  const [filtroCobrador, setFiltroCobrador] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroEficienciaMin, setFiltroEficienciaMin] = useState("");

  const cargar = useCallback(async (filtros?: {
    cobrador_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    eficiencia_min?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportesApi.getEficienciaCobradores(filtros);
      setData(result.data);
      setMensual(result.mensual);
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError("No se pudo cargar el reporte");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const aplicarFiltros = () => {
    const f: Record<string, string | number> = {};
    if (filtroCobrador) f.cobrador_id = Number(filtroCobrador);
    if (filtroFechaDesde) f.fecha_desde = filtroFechaDesde;
    if (filtroFechaHasta) f.fecha_hasta = filtroFechaHasta;
    if (filtroEficienciaMin) f.eficiencia_min = Number(filtroEficienciaMin);
    void cargar(Object.keys(f).length ? f : undefined);
  };

  const limpiarFiltros = () => {
    setFiltroCobrador("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroEficienciaMin("");
    void cargar();
  };

  // Totales agrupados
  const totales = data.reduce(
    (acc, r) => ({
      asignaciones: acc.asignaciones + r.total_asignaciones,
      completadas: acc.completadas + r.completadas,
      pendientes: acc.pendientes + r.pendientes,
      monto: acc.monto + r.monto_cobrado,
      visitas: acc.visitas + r.visitas_realizadas,
      cobradas: acc.cobradas + r.visitas_cobradas,
    }),
    { asignaciones: 0, completadas: 0, pendientes: 0, monto: 0, visitas: 0, cobradas: 0 }
  );

  const eficienciaGlobal =
    totales.asignaciones > 0
      ? Math.round((totales.completadas / totales.asignaciones) * 100)
      : 0;

  return (
    <PanelShell title="Reportes" description="Eficiencia por cobrador">
      {/* Loading */}
      {loading && <p className="text-blue-700">Cargando reporte…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          {/* ── Filtros ── */}
          <section className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cobrador ID</label>
                <input
                  type="number"
                  value={filtroCobrador}
                  onChange={(e) => setFiltroCobrador(e.target.value)}
                  placeholder="Ej: 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha desde</label>
                <input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha hasta</label>
                <input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Eficiencia mín. (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filtroEficienciaMin}
                  onChange={(e) => setFiltroEficienciaMin(e.target.value)}
                  placeholder="Ej: 70"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={aplicarFiltros}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Aplicar
                </button>
                <button
                  onClick={limpiarFiltros}
                  className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    descargarCSV({
                      nombreArchivo: `eficiencia_cobradores_${new Date().toISOString().slice(0, 10)}.csv`,
                      titulo: "Reporte de Eficiencia por Cobrador",
                      subtitulos: [`Generado: ${new Date().toLocaleString("es-PY")}`],
                      columnas: [
                        { header: "Cobrador", accessor: (r) => (r as ReporteEficienciaCobrador).cobrador },
                        { header: "Empresa", accessor: (r) => (r as ReporteEficienciaCobrador).empresa },
                        { header: "Asignaciones", accessor: (r) => (r as ReporteEficienciaCobrador).total_asignaciones },
                        { header: "Completadas", accessor: (r) => (r as ReporteEficienciaCobrador).completadas },
                        { header: "Pendientes", accessor: (r) => (r as ReporteEficienciaCobrador).pendientes },
                        { header: "Eficiencia (%)", accessor: (r) => (r as ReporteEficienciaCobrador).eficiencia },
                        { header: "Monto Cobrado (Gs.)", accessor: (r) => fmtNum((r as ReporteEficienciaCobrador).monto_cobrado) },
                        { header: "Visitas", accessor: (r) => (r as ReporteEficienciaCobrador).visitas_realizadas },
                        { header: "Efectividad (%)", accessor: (r) => (r as ReporteEficienciaCobrador).tasa_efectividad_visitas },
                      ],
                      filas: data,
                    })
                  }
                  disabled={data.length === 0}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>
          </section>

          {/* ── Tarjetas de resumen ── */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
              <div className="flex items-center gap-2 text-cyan-600">
                <BarChart3 size={15} />
                <p className="text-sm font-medium">Asignaciones totales</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-900">{totales.asignaciones}</p>
            </article>
            <article className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={15} />
                <p className="text-sm font-medium">Completadas</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-700">{totales.completadas}</p>
            </article>
            <article className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Clock size={15} />
                <p className="text-sm font-medium">Pendientes</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-600">{totales.pendientes}</p>
            </article>
            <article className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
              <div className="flex items-center gap-2 text-cyan-600">
                <Target size={15} />
                <p className="text-sm font-medium">Eficiencia global</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-900">{eficienciaGlobal}%</p>
            </article>
          </section>

          {/* ── Tabla de cobradores ── */}
          <section className="rounded-xl border border-sky-200 bg-white shadow-md shadow-sky-100">
            <div className="border-b border-sky-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-blue-800">
                <User size={18} />
                Rendimiento por cobrador
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-xs font-semibold uppercase tracking-wider text-blue-500">
                    <th className="px-6 py-3">Cobrador</th>
                    <th className="px-6 py-3">Empresa</th>
                    <th className="px-6 py-3 text-center">Asignaciones</th>
                    <th className="px-6 py-3 text-center">Completadas</th>
                    <th className="px-6 py-3 text-center">Pendientes</th>
                    <th className="px-6 py-3 text-center">Eficiencia</th>
                    <th className="px-6 py-3 text-right">Monto cobrado</th>
                    <th className="px-6 py-3 text-center">Visitas</th>
                    <th className="px-6 py-3 text-center">Efectividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-blue-400">
                        No hay datos disponibles
                      </td>
                    </tr>
                  )}
                  {data.map((row) => (
                    <tr key={row.cobrador_id} className="transition hover:bg-sky-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white">
                            {row.cobrador.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-blue-900">{row.cobrador}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-blue-600">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} />
                          {row.empresa}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-blue-900">
                        {row.total_asignaciones}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-emerald-700">
                        {row.completadas}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-amber-600">
                        {row.pendientes}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.eficiencia >= 70
                              ? "bg-emerald-100 text-emerald-800"
                              : row.eficiencia >= 40
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          <TrendingUp size={12} />
                          {row.eficiencia}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-blue-900">
                        {gs(row.monto_cobrado)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-blue-600">
                          <Eye size={14} />
                          {row.visitas_realizadas}
                        </div>
                        <div className="mt-0.5 text-[11px] text-blue-400">
                          {row.visitas_cobradas} cobradas · {row.visitas_ausentes} ausentes · {row.visitas_reagendadas} reagend.
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.tasa_efectividad_visitas >= 70
                              ? "bg-emerald-100 text-emerald-800"
                              : row.tasa_efectividad_visitas >= 40
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {row.tasa_efectividad_visitas}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Totales ── */}
            <section className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <Banknote size={16} />
                  <span className="text-sm font-medium">Total cobrado:</span>
                  <span className="text-lg font-bold text-emerald-700">{gs(totales.monto)}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Eye size={16} />
                  <span className="text-sm font-medium">Visitas totales:</span>
                  <span className="text-lg font-bold text-blue-900">{totales.visitas}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-medium">Cobros efectivos:</span>
                  <span className="text-lg font-bold text-emerald-700">{totales.cobradas}</span>
                </div>
              </div>
            </section>
          </section>

          {/* ── Desglose mensual ── */}
          {mensual.length > 0 && (
            <section className="rounded-xl border border-sky-200 bg-white shadow-md shadow-sky-100">
              <div className="border-b border-sky-100 px-6 py-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-blue-800">
                  <Calendar size={18} />
                  Monto cobrado por mes
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-xs font-semibold uppercase tracking-wider text-blue-500">
                      <th className="px-6 py-3">Mes</th>
                      <th className="px-6 py-3 text-right">Cantidad de cobros</th>
                      <th className="px-6 py-3 text-right">Monto cobrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {mensual.map((r) => {
                      const [anio, mes] = r.mes.split("-");
                      const nombreMes = new Date(Number(anio), Number(mes) - 1).toLocaleDateString("es-PY", {
                        month: "long",
                        year: "numeric",
                      });
                      return (
                        <tr key={r.mes} className="transition hover:bg-sky-50/50">
                          <td className="px-6 py-3 font-medium text-blue-900 capitalize">{nombreMes}</td>
                          <td className="px-6 py-3 text-right text-blue-700">{r.cantidad_cobros}</td>
                          <td className="px-6 py-3 text-right font-semibold text-emerald-700">{gs(r.monto_mes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-sky-200 bg-sky-50/80 font-semibold text-blue-900">
                      <td className="px-6 py-3">Total</td>
                      <td className="px-6 py-3 text-right">
                        {mensual.reduce((s, r) => s + r.cantidad_cobros, 0)}
                      </td>
                      <td className="px-6 py-3 text-right text-emerald-700">
                        {gs(mensual.reduce((s, r) => s + r.monto_mes, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </PanelShell>
  );
}
