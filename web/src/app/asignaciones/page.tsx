"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, CheckCircle2, User, Map, RefreshCw, ChevronLeft, ChevronRight, Users, FileWarning, AlertTriangle, Building2, ChevronDown } from "lucide-react";

import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { panelApi } from "@/services/api";
import type { Zona, Cobrador, ClienteSinZona, CuotaSinAsignar, Empresa } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

export default function Asignaciones() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selector de empresa para ADMIN
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [autoResult, setAutoResult] = useState<{ asignadas: number; clientesUbicados: number } | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const [reasignandoId, setReasignandoId] = useState<number | null>(null);
  const [confirmReasignar, setConfirmReasignar] = useState<Zona | null>(null);
  const [reasignarResult, setReasignarResult] = useState<{ zonaId: number; asignadas: number; reasignadas: number; clientesUbicados: number } | null>(null);

  // Datos no asignados
  const [noAsignadas, setNoAsignadas] = useState<{ clientesSinZona: ClienteSinZona[]; cuotasSinAsignar: CuotaSinAsignar[] } | null>(null);
  const [cargandoNoAsignadas, setCargandoNoAsignadas] = useState(false);
  const [mostrarNoAsignadas, setMostrarNoAsignadas] = useState(false);

  // Asignación manual de cliente a zona
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Record<number, string>>({});
  const [asignandoClienteId, setAsignandoClienteId] = useState<number | null>(null);
  const [avisoZona, setAvisoZona] = useState<{ clienteId: number; zonaNombre: string; cobradorNombre: string } | null>(null);
  const [mensajeAsignacion, setMensajeAsignacion] = useState<string | null>(null);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 12;

  const zonasActivas = useMemo(
    () => zonas.filter((z) => Number(z.estado) === 1),
    [zonas]
  );

  const totalPaginas = Math.max(1, Math.ceil(zonasActivas.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const zonasPagina = zonasActivas.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

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
      const admin = rol === "ADMIN";
      setIsAdmin(admin);
      if (!admin && u.empresaId) {
        setSelectedEmpresaId(Number(u.empresaId));
      }
      if (admin) {
        void panelApi.getEmpresas().then((data) => {
          setEmpresas(data);
          if (data[0]?.id) setSelectedEmpresaId(data[0].id);
        });
      }
    } catch {
      setError("No se pudo leer la sesión del usuario");
    }
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const empId = isAdmin ? selectedEmpresaId : undefined;
      const [zonasData, cobradoresData] = await Promise.all([
        panelApi.getZonas(empId ?? undefined),
        panelApi.getCobradores(empId ?? undefined),
      ]);
      setZonas(zonasData);
      setCobradores(cobradoresData);
      setPaginaActual(1);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      if (apiError.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError(apiError.message ?? "No se pudieron cargar las zonas");
      }
    } finally {
      setLoading(false);
    }
  }, [router, isAdmin, selectedEmpresaId]);

  useEffect(() => { void cargar(); }, [cargar]);

  function handleAutoAsignar() {
    setMostrarConfirmacion(true);
  }

  async function ejecutarAutoAsignar() {
    setMostrarConfirmacion(false);
    setAutoRunning(true);
    setAutoResult(null);
    setReasignarResult(null);
    try {
      const empId = isAdmin ? selectedEmpresaId : undefined;
      const resp = await panelApi.autoAsignar(empId ?? undefined);
      setAutoResult(resp.data ?? null);
      setMostrarResultado(true);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "Error en auto-asignación");
    } finally {
      setAutoRunning(false);
    }
  }

  function handleReasignarZona(z: Zona) {
    setConfirmReasignar(z);
  }

  async function ejecutarReasignarZona() {
    if (!confirmReasignar) return;
    const z = confirmReasignar;
    setConfirmReasignar(null);
    setReasignandoId(z.id);
    setReasignarResult(null);
    try {
      const resp = await panelApi.reasignarZona(z.id);
      setReasignarResult({
        zonaId: z.id,
        asignadas: resp.data?.asignadas ?? 0,
        reasignadas: resp.data?.reasignadas ?? 0,
        clientesUbicados: resp.data?.clientesUbicados ?? 0,
      });
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "Error al reasignar la zona");
    } finally {
      setReasignandoId(null);
    }
  }

  const cobradorNombre = (id: number | null) => {
    if (!id) return "Sin asignar";
    const c = cobradores.find((c) => c.id === Number(id));
    return c ? `${c.nombre} ${c.apellido ?? ""}`.trim() : "Sin asignar";
  };

  async function cargarNoAsignadas() {
    setCargandoNoAsignadas(true);
    try {
      const empId = isAdmin ? selectedEmpresaId : undefined;
      const data = await panelApi.getNoAsignadas(empId ?? undefined);
      setNoAsignadas(data);
      setMostrarNoAsignadas(true);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "No se pudieron cargar los datos no asignados");
    } finally {
      setCargandoNoAsignadas(false);
    }
  }

  async function ejecutarAsignarCliente(clienteId: number) {
    const zonaId = Number(zonaSeleccionada[clienteId]);
    if (!zonaId) {
      setError("Seleccioná una zona para asignar el cliente");
      return;
    }
    setAsignandoClienteId(clienteId);
    setAvisoZona(null);
    setMensajeAsignacion(null);
    try {
      const resp = await panelApi.asignarClienteZona(clienteId, zonaId);
      if (resp.data?.aviso) {
        setAvisoZona({
          clienteId,
          zonaNombre: resp.data.aviso.zonaNombre,
          cobradorNombre: resp.data.aviso.cobradorNombre,
        });
      }
      setMensajeAsignacion(resp.message ?? "Cliente asignado correctamente");
      // Recargar los no asignados
      const empId = isAdmin ? selectedEmpresaId : undefined;
      const data = await panelApi.getNoAsignadas(empId ?? undefined);
      setNoAsignadas(data);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "No se pudo asignar el cliente");
    } finally {
      setAsignandoClienteId(null);
    }
  }

  return (
    <PanelShell title="Asignaciones" description="Asigná y reasigná cuotas a cobradores según las zonas">
      <div className="space-y-6">

        {/* ── Acciones superiores ── */}
        <div className="flex flex-wrap items-center gap-3">
          {hasPermiso("zonas", "editar") && (
            <button
              onClick={handleAutoAsignar}
              disabled={autoRunning}
              className="rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition"
            >
              {autoRunning ? "Asignando…" : <><Zap size={14} className="inline mr-1" />Auto-asignar cuotas por zona</>}
            </button>
          )}
          {hasPermiso("zonas", "ver") && (
            <button
              onClick={cargarNoAsignadas}
              disabled={cargandoNoAsignadas}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60 transition"
            >
              {cargandoNoAsignadas ? "Cargando…" : "Ver no asignados"}
            </button>
          )}
        </div>

        {/* ── Selector de empresa (solo ADMIN) ── */}
        {isAdmin && (
          <section className="rounded-2xl border border-sky-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-sky-100 px-6 py-4">
              <Building2 size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-blue-900">Empresa</h2>
            </div>
            <div className="px-6 py-4">
              <label className="mb-1 block text-xs font-medium text-blue-700">Empresa activa</label>
              <div className="relative max-w-sm">
                <select
                  className="w-full appearance-none rounded-lg border border-sky-200 bg-white px-3 py-2 pr-8 text-sm text-blue-900 focus:border-blue-400 focus:outline-none"
                  value={selectedEmpresaId ?? ""}
                  onChange={(e) => setSelectedEmpresaId(Number(e.target.value))}
                >
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>{empresa.razon_social}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </section>
        )}

        {/* ── Popup confirmación auto-asignación ── */}
        {mostrarConfirmacion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMostrarConfirmacion(false)}>
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Zap size={22} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-blue-900">Auto-asignar cuotas</h3>
                  <p className="text-xs text-blue-500">Asignación automática por zonas</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-blue-700">
                ¿Asignar cuotas a cobradores según las zonas configuradas?
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setMostrarConfirmacion(false)}
                  className="flex-1 rounded-lg border border-sky-300 bg-white py-2 text-sm font-medium text-blue-700 transition hover:bg-sky-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarAutoAsignar}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Asignar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Popup resultado auto-asignación ── */}
        {mostrarResultado && autoResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMostrarResultado(false)}>
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={22} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-blue-900">Auto-asignación completada</h3>
                  <p className="text-xs text-blue-500">Cuotas asignadas según las zonas configuradas</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{autoResult.asignadas}</p>
                  <p className="text-xs text-emerald-600">Cuota(s) asignadas</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-center">
                  <p className="text-2xl font-bold text-sky-700">{autoResult.clientesUbicados}</p>
                  <p className="text-xs text-sky-600">Cliente(s) en zonas</p>
                </div>
              </div>
              <button
                onClick={() => setMostrarResultado(false)}
                className="mt-5 w-full rounded-lg bg-blue-700 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {/* ── Resultado reasignación individual ── */}
        {reasignarResult && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 flex items-center gap-1">
            <CheckCircle2 size={14} className="shrink-0" /> Zona reasignada:{" "}
            <strong>{reasignarResult.asignadas}</strong> nueva(s) ·{" "}
            <strong>{reasignarResult.reasignadas}</strong> reasignada(s) ·{" "}
            <strong>{reasignarResult.clientesUbicados}</strong> cliente(s) ubicados
          </div>
        )}

        {loading && <p className="text-blue-700">Cargando zonas…</p>}
        {error   && <p className="text-red-600">{error}</p>}

        {/* ── Lista de zonas ── */}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zonasActivas.length === 0 && (
              <p className="col-span-full text-sm text-blue-400">
                No hay zonas activas. Creá zonas en la sección <strong>Zonas</strong> para poder asignar cuotas.
              </p>
            )}
            {zonasPagina.map((z) => (
              <div
                key={z.id}
                className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm"
                style={{ borderLeftColor: z.color, borderLeftWidth: 4 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-blue-900">{z.nombre}</p>
                    {z.descripcion && <p className="mt-0.5 text-xs text-blue-500">{z.descripcion}</p>}
                  </div>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white shadow"
                    style={{ backgroundColor: z.color }}
                  />
                </div>
                <div className="mt-3 space-y-1 text-xs text-blue-600">
                  <p>
                    <User size={11} className="inline mr-1" />Cobrador:{" "}
                    <span className={z.cobrador_id ? "font-medium" : "text-blue-300"}>
                      {cobradorNombre(z.cobrador_id)}
                    </span>
                  </p>
                  <p>
                    <Map size={11} className="inline mr-1" />Polígono:{" "}
                    <span className={z.poligono ? "text-emerald-600" : "text-blue-300"}>
                      {z.poligono ? `${(z.poligono as { lat: number; lng: number }[]).length} puntos` : "No definido"}
                    </span>
                  </p>
                </div>
                <div className="mt-4">
                  {hasPermiso("zonas", "editar") && (
                    <button
                      onClick={() => handleReasignarZona(z)}
                      disabled={reasignandoId === z.id || !z.cobrador_id || !z.poligono}
                      className="w-full rounded-md border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 transition"
                      title={
                        !z.cobrador_id
                          ? "La zona no tiene cobrador asignado"
                          : !z.poligono
                          ? "La zona no tiene polígono definido"
                          : "Reasignar cuotas de esta zona a su cobrador"
                      }
                    >
                      {reasignandoId === z.id ? (
                        "Reasignando…"
                      ) : (
                        <><RefreshCw size={12} className="inline mr-1" />Reasignar cuotas de esta zona</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-sky-100 pt-4">
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

        {/* ── Sección: No asignados ── */}
        {mostrarNoAsignadas && (
          <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-bold text-amber-800">
                <Users size={18} /> No asignados
              </h3>
              <button
                onClick={() => setMostrarNoAsignadas(false)}
                className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 transition"
              >
                Cerrar
              </button>
            </div>

            {!noAsignadas ? (
              <p className="mt-3 text-sm text-amber-600">Cargando…</p>
            ) : (
              <div className="mt-4 space-y-6">
                {/* Clientes sin zona */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <Users size={14} /> Clientes sin zona asignada
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {noAsignadas.clientesSinZona.length}
                    </span>
                  </h4>
                  {noAsignadas.clientesSinZona.length === 0 ? (
                    <p className="mt-2 text-sm text-emerald-600">✓ Todos los clientes tienen zona asignada.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-amber-100">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-amber-50 text-xs uppercase text-amber-700">
                          <tr>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Cédula</th>
                            <th className="px-3 py-2">Teléfono</th>
                            <th className="px-3 py-2">Ubicación</th>
                            {hasPermiso("zonas", "editar") && (
                              <>
                                <th className="px-3 py-2">Zona</th>
                                <th className="px-3 py-2">Acción</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {noAsignadas.clientesSinZona.map((c) => (
                            <tr key={c.cliente_id} className="hover:bg-amber-50/50">
                              <td className="px-3 py-2 font-medium text-blue-900">{c.cliente}</td>
                              <td className="px-3 py-2 text-blue-600">{c.cedula ?? "—"}</td>
                              <td className="px-3 py-2 text-blue-600">{c.telefono ?? "—"}</td>
                              <td className="px-3 py-2 text-blue-600">
                                {c.latitud && c.longitud ? (
                                  <span className="text-emerald-600">✓ Con ubicación</span>
                                ) : (
                                  <span className="text-amber-500">Sin ubicación</span>
                                )}
                              </td>
                              {hasPermiso("zonas", "editar") && (
                                <>
                                  <td className="px-3 py-2">
                                    <select
                                      value={zonaSeleccionada[c.cliente_id] ?? ""}
                                      onChange={(e) =>
                                        setZonaSeleccionada((prev) => ({
                                          ...prev,
                                          [c.cliente_id]: e.target.value,
                                        }))
                                      }
                                      className="w-40 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-blue-900 focus:border-amber-500 focus:outline-none"
                                    >
                                      <option value="">Seleccionar zona…</option>
                                      {zonasActivas.map((z) => (
                                        <option key={z.id} value={z.id}>
                                          {z.nombre}
                                          {z.cobrador_nombre ? ` · ${z.cobrador_nombre}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => ejecutarAsignarCliente(c.cliente_id)}
                                      disabled={asignandoClienteId === c.cliente_id || !zonaSeleccionada[c.cliente_id]}
                                      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition"
                                    >
                                      {asignandoClienteId === c.cliente_id ? "Asignando…" : "Asignar"}
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Aviso de zona de otro vendedor */}
                {avisoZona && (
                  <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange-600" />
                    <div className="text-sm text-orange-800">
                      <p className="font-semibold">Aviso: el cliente está dentro de la zona de otro vendedor</p>
                      <p className="mt-1">
                        El cliente asignado se encuentra dentro de la zona{" "}
                        <strong>"{avisoZona.zonaNombre}"</strong> del cobrador{" "}
                        <strong>{avisoZona.cobradorNombre}</strong>. Se asignó de todas formas.
                      </p>
                      <button
                        onClick={() => setAvisoZona(null)}
                        className="mt-2 text-xs font-medium text-orange-700 underline hover:text-orange-900"
                      >
                        Entendido
                      </button>
                    </div>
                  </div>
                )}

                {/* Mensaje de asignación exitosa */}
                {mensajeAsignacion && (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div className="text-sm text-emerald-800">
                      <p className="font-semibold">Asignación exitosa</p>
                      <p className="mt-1">{mensajeAsignacion}</p>
                      <button
                        onClick={() => setMensajeAsignacion(null)}
                        className="mt-2 text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                {/* Cuotas sin cobrador */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <FileWarning size={14} /> Cobranzas sin cobrador asignado
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {noAsignadas.cuotasSinAsignar.length}
                    </span>
                  </h4>
                  {noAsignadas.cuotasSinAsignar.length === 0 ? (
                    <p className="mt-2 text-sm text-emerald-600">✓ Todas las cobranzas tienen cobrador asignado.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-amber-100">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-amber-50 text-xs uppercase text-amber-700">
                          <tr>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Crédito</th>
                            <th className="px-3 py-2">Cuota</th>
                            <th className="px-3 py-2">Vencimiento</th>
                            <th className="px-3 py-2">Monto</th>
                            <th className="px-3 py-2">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {noAsignadas.cuotasSinAsignar.map((q) => (
                            <tr key={q.id} className="hover:bg-amber-50/50">
                              <td className="px-3 py-2 font-medium text-blue-900">{q.cliente}</td>
                              <td className="px-3 py-2 text-blue-600">{q.numero_credito ?? "—"}</td>
                              <td className="px-3 py-2 text-blue-600">Cuota {q.numero_cuota}</td>
                              <td className="px-3 py-2 text-blue-600">
                                {new Date(q.fecha_vencimiento).toLocaleDateString("es-PY")}
                              </td>
                              <td className="px-3 py-2 text-blue-600">
                                {Number(q.monto_cuota).toLocaleString("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    q.estado === "VENCIDA"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {q.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Confirmación de reasignar zona ── */}
      <ConfirmDialog
        open={!!confirmReasignar}
        title="Reasignar zona"
        message={`¿Reasignar las cuotas de la zona "${confirmReasignar?.nombre ?? ""}" a su cobrador?`}
        confirmLabel="Reasignar"
        tone="warning"
        onConfirm={ejecutarReasignarZona}
        onCancel={() => setConfirmReasignar(null)}
      />
    </PanelShell>
  );
}
