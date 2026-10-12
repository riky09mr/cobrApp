"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Users,
  MapPin,
  Phone,
  CreditCard,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  FileText,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Cobrador, AsignacionCobrador, ResumenAsignacionesCobrador } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

const POR_PAGINA = 15;

export default function Cobradores() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [cobradorId, setCobradorId] = useState<number | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionCobrador[]>([]);
  const [resumen, setResumen] = useState<ResumenAsignacionesCobrador | null>(null);
  const [cobradorSel, setCobradorSel] = useState<{ id: number; nombre: string; apellido: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroZona, setFiltroZona] = useState<string>("TODAS");
  const [busqueda, setBusqueda] = useState("");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);

  const getApiErrorData = (err: unknown): { status?: number; message?: string } => {
    const apiError = err as { response?: { status?: number; data?: { message?: string } } };
    return {
      status: apiError.response?.status,
      message: apiError.response?.data?.message,
    };
  };

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("cobrapp_user") || "{}");
      const rol = u.rol ?? "";
      if (rol !== "ADMIN" && rol !== "SUPERVISOR") {
        router.replace("/dashboard");
      }
    } catch {
      setError("No se pudo leer la sesión del usuario");
    }
  }, [router]);

  const cargarCobradores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await panelApi.getCobradores();
      setCobradores(data);
      if (data.length > 0) {
        setCobradorId(data[0].id);
      }
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      if (apiError.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError(apiError.message ?? "No se pudieron cargar los cobradores");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void cargarCobradores(); }, [cargarCobradores]);

  const cargarAsignaciones = useCallback(async (id: number) => {
    try {
      setLoadingAsignaciones(true);
      setError(null);
      const resp = await panelApi.getAsignacionesCobrador(id);
      setAsignaciones(resp.data ?? []);
      setResumen(resp.resumen ?? null);
      setCobradorSel(resp.cobrador ?? null);
      setPaginaActual(1);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "No se pudieron cargar las asignaciones");
    } finally {
      setLoadingAsignaciones(false);
    }
  }, []);

  useEffect(() => {
    if (cobradorId != null) {
      void cargarAsignaciones(cobradorId);
    }
  }, [cobradorId, cargarAsignaciones]);

  const zonasDisponibles = useMemo(
    () => [...new Set(asignaciones.map((a) => a.zona_nombre).filter(Boolean))] as string[],
    [asignaciones]
  );

  const asignacionesFiltradas = useMemo(() => {
    let lista = asignaciones;
    if (filtroEstado !== "TODOS") {
      lista = lista.filter((a) => a.asignacion_estado === filtroEstado);
    }
    if (filtroZona !== "TODAS") {
      lista = lista.filter((a) => a.zona_nombre === filtroZona);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(
        (a) =>
          `${a.nombre} ${a.apellido ?? ""}`.toLowerCase().includes(q) ||
          (a.cedula ?? "").toLowerCase().includes(q) ||
          (a.numero_credito ?? "").toLowerCase().includes(q)
      );
    }
    return lista;
  }, [asignaciones, filtroEstado, filtroZona, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(asignacionesFiltradas.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const asignacionesPagina = asignacionesFiltradas.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  const badgeEstado = (estado: string) => {
    const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";
    if (estado === "PENDIENTE") return `${base} bg-amber-100 text-amber-700`;
    if (estado === "COMPLETADO") return `${base} bg-emerald-100 text-emerald-700`;
    return `${base} bg-gray-100 text-gray-600`;
  };

  const badgeCuota = (estado: string) => {
    const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";
    if (estado === "PAGADO") return `${base} bg-emerald-100 text-emerald-700`;
    if (estado === "VENCIDO") return `${base} bg-red-100 text-red-700`;
    if (estado === "PENDIENTE") return `${base} bg-amber-100 text-amber-700`;
    return `${base} bg-gray-100 text-gray-600`;
  };

  const formatMonto = (n: number | null | undefined) =>
    new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(Number(n ?? 0));

  const formatFecha = (f: string | null | undefined) => {
    if (!f) return "—";
    const d = new Date(f);
    if (isNaN(d.getTime())) return f;
    return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <PanelShell title="Cobradores" subtitle="Gestión de asignaciones por cobrador">
      <div className="space-y-6">
        {/* Selector de cobrador */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <UserCheck className="h-4 w-4 text-indigo-600" />
            Seleccionar cobrador
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={cobradorId ?? ""}
              onChange={(e) => setCobradorId(e.target.value ? Number(e.target.value) : null)}
              className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {cobradores.length === 0 && <option value="">Sin cobradores</option>}
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido ?? ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => cobradorId != null && void cargarAsignaciones(cobradorId)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refrescar
            </button>
          </div>
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <Users className="h-4 w-4 text-indigo-500" /> Asignaciones
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{resumen.total_asignaciones}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <Clock className="h-4 w-4 text-amber-500" /> Pendientes
              </div>
              <p className="mt-1 text-2xl font-bold text-amber-600">{resumen.pendientes}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Completadas
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{resumen.completadas}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <Wallet className="h-4 w-4 text-emerald-500" /> Cobrado
              </div>
              <p className="mt-1 text-lg font-bold text-emerald-600">{formatMonto(resumen.monto_cobrado)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <TrendingUp className="h-4 w-4 text-red-500" /> Pendiente cobrar
              </div>
              <p className="mt-1 text-lg font-bold text-red-600">{formatMonto(resumen.monto_pendiente)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <MapPin className="h-4 w-4 text-sky-500" /> Zonas
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{resumen.zonas.length}</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            placeholder="Buscar por cliente, cédula o crédito..."
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="TODOS">Estado: Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="COMPLETADO">Completado</option>
          </select>
          <select
            value={filtroZona}
            onChange={(e) => { setFiltroZona(e.target.value); setPaginaActual(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="TODAS">Zona: Todas</option>
            {zonasDisponibles.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loadingAsignaciones ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Cargando asignaciones...
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center text-sm text-red-600">{error}</div>
          ) : asignacionesFiltradas.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No hay asignaciones para este cobrador con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Cédula</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Teléfono</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Zona</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Crédito</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Cuota</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Monto</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Saldo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimiento</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asignacionesPagina.map((a) => (
                    <tr key={a.asignacion_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {a.nombre} {a.apellido ?? ""}
                        </div>
                        {a.direccion && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3 w-3" /> {a.direccion}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.cedula ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.telefono ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" /> {a.telefono}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {a.zona_nombre ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: a.zona_color ? `${a.zona_color}22` : "#f3f4f6",
                              color: a.zona_color ?? "#374151",
                            }}
                          >
                            <MapPin className="h-3 w-3" /> {a.zona_nombre}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-700">
                          <FileText className="h-3 w-3 text-gray-400" /> {a.numero_credito}
                        </div>
                        {a.descripcion && (
                          <div className="text-xs text-gray-500">{a.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          <CreditCard className="h-3 w-3 text-gray-400" /> Cuota {a.numero_cuota}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMonto(a.monto_cuota)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMonto(a.saldo_cuota)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <CalendarDays className="h-3 w-3 text-gray-400" /> {formatFecha(a.fecha_vencimiento)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={badgeEstado(a.asignacion_estado)}>{a.asignacion_estado}</span>
                          <span className={badgeCuota(a.cuota_estado)}>{a.cuota_estado}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {!loadingAsignaciones && !error && asignacionesFiltradas.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">
                Mostrando {asignacionesPagina.length} de {asignacionesFiltradas.length} asignaciones
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaSegura <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura >= totalPaginas}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
