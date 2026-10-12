"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PanelShell from "@/components/PanelShell";
import { panelApi, mediosPagoApi } from "@/services/api";
import type { Cobranza, Cobrador, CreateCobranzaManualPayload, MedioPago } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";
import { Pencil, Check, X, Plus, UserPlus, CalendarCheck, User, Search, ChevronLeft, ChevronRight, Banknote, CreditCard } from "lucide-react";

function getUserRol(): string {
  try {
    const raw = localStorage.getItem("cobrapp_user");
    return raw ? (JSON.parse(raw) as { rol?: string }).rol ?? "" : "";
  } catch { return ""; }
}

type ClienteGroup = {
  cliente_id: number;
  cliente: string;
  cedula: string | null;
  cuotas: Cobranza[];
};

function estadoClasses(estado: string) {
  if (estado === "PAGADO")   return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (estado === "VENCIDA")  return "bg-red-100 text-red-700 border-red-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function rowBg(estado: string) {
  if (estado === "PAGADO")  return "bg-emerald-50";
  if (estado === "VENCIDA") return "bg-red-50";
  return "bg-white";
}

const today = () => new Date().toISOString().split("T")[0];
// Normaliza fecha de MySQL (puede venir como '2026-05-26T00:00:00.000Z' o '2026-05-26 00:00:00')
const fISO = (s: string) => (s ?? '').split('T')[0].split(' ')[0];
const PERIODICIDADES = ["MENSUAL", "SEMANAL", "QUINCENAL"];

const FORM_EMPTY: CreateCobranzaManualPayload = {
  cedula: "", nombre: "", apellido: "", telefono: "",
  descripcion: "", monto_total: 0, cantidad_cuotas: 1,
  periodicidad: "MENSUAL", fecha_vencimiento: today(),
  cobrador_id: undefined,
};

export default function Cobranzas() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [grupos, setGrupos] = useState<ClienteGroup[]>([]);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoFecha, setEditandoFecha] = useState<{ id: number; valor: string } | null>(null);
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [rolUsuario, setRolUsuario] = useState("");
  const esSupervisorOAdmin = hasPermiso("cobranzas", "editar");

  // Cobradores para formularios
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);

  // Medios de pago
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);

  // ── Filtros ──────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "PENDIENTE" | "VENCIDA" | "PAGADO">("");
  const [filtroCobrador, setFiltroCobrador] = useState("");

  // ── Paginación ───────────────────────────────────────────
  const POR_PAGINA = 10;
  const [pagina, setPagina] = useState(1);

  // ── Modal nueva cobranza ─────────────────────────────────
  const [modalNueva, setModalNueva] = useState(false);
  const [formNueva, setFormNueva] = useState<CreateCobranzaManualPayload>(FORM_EMPTY);
  const [guardandoNueva, setGuardandoNueva] = useState(false);
  const [errNueva, setErrNueva] = useState<string | null>(null);

  // ── Modal asignar cobrador ───────────────────────────────
  const [modalAsignar, setModalAsignar] = useState<{ cuotaId: number } | null>(null);
  const [formAsignar, setFormAsignar] = useState({ cobradorId: "", fecha: today() });
  const [guardandoAsignar, setGuardandoAsignar] = useState(false);
  const [errAsignar, setErrAsignar] = useState<string | null>(null);

  // ── Modal registrar cobro ────────────────────────────────
  const [modalCobro, setModalCobro] = useState<{ cuotaId: number; montoCuota: number } | null>(null);
  const [formCobro, setFormCobro] = useState({ monto: "", medioPagoId: "", nroComprobante: "" });
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const [errCobro, setErrCobro] = useState<string | null>(null);
  const medioPagoSeleccionado = mediosPago.find(m => m.id === Number(formCobro.medioPagoId));


  useEffect(() => { setRolUsuario(getUserRol()); }, []);
  const cargar = useCallback(async () => {
    try {
      const data = await panelApi.getCobranzas();
      const map = new Map<number, ClienteGroup>();
      for (const c of data) {
        if (!map.has(c.cliente_id)) {
          map.set(c.cliente_id, { cliente_id: c.cliente_id, cliente: c.cliente, cedula: c.cedula, cuotas: [] });
        }
        map.get(c.cliente_id)!.cuotas.push(c);
      }
      setGrupos(Array.from(map.values()));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e.response?.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError("No se pudo cargar cobranzas");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    if (esSupervisorOAdmin) {
      panelApi
        .getCobradores()
        .then(setCobradores)
        .catch(() => setError("No se pudo cargar la lista de cobradores"));
      mediosPagoApi
        .getAll()
        .then(mp => setMediosPago(mp.filter(m => m.activo)))
        .catch(() => setError("No se pudo cargar la lista de medios de pago"));
    }
  }, [esSupervisorOAdmin]);
  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado, filtroCobrador]);

  function toggleCliente(id: number) {
    setAbiertos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function guardarFecha() {
    if (!editandoFecha) return;
    setGuardandoFecha(true);
    try {
      const res = await panelApi.updateFechaVencimiento(editandoFecha.id, editandoFecha.valor);
      actualizarCuota(editandoFecha.id, { fecha_vencimiento: editandoFecha.valor, estado: res.data?.estado ?? "" });
      setEditandoFecha(null);
    } catch {
      // silencioso
    } finally {
      setGuardandoFecha(false);
    }
  }

  async function programarHoy(cuotaId: number) {
    setGuardandoFecha(true);
    try {
      const hoy = today();
      const res = await panelApi.updateFechaVencimiento(cuotaId, hoy);
      actualizarCuota(cuotaId, { fecha_vencimiento: hoy, estado: res.data?.estado ?? "" });
    } catch {
      // silencioso
    } finally {
      setGuardandoFecha(false);
    }
  }

  function actualizarCuota(cuotaId: number, cambios: Partial<Cobranza>) {
    setGrupos(prev =>
      prev.map(g => ({
        ...g,
        cuotas: g.cuotas.map(c => c.id === cuotaId ? { ...c, ...cambios } : c),
      }))
    );
  }

  async function registrarCobro(cuotaId: number) {
    // Solo el supervisor puede registrar cobros
    if (rolUsuario !== "SUPERVISOR") return;
    // Abre el modal de cobro con los datos de la cuota
    const cuota = grupos.flatMap(g => g.cuotas).find(c => c.id === cuotaId);
    setFormCobro({ monto: String(cuota?.monto_cuota ?? ""), medioPagoId: mediosPago[0]?.id ? String(mediosPago[0].id) : "", nroComprobante: "" });
    setErrCobro(null);
    setModalCobro({ cuotaId, montoCuota: Number(cuota?.monto_cuota ?? 0) });
  }

  async function submitCobro(e: React.FormEvent) {
    e.preventDefault();
    if (!modalCobro) return;
    // Solo el supervisor puede registrar cobros
    if (rolUsuario !== "SUPERVISOR") {
      setModalCobro(null);
      return;
    }
    setErrCobro(null);
    setGuardandoCobro(true);
    try {
      await panelApi.registrarCobro(modalCobro.cuotaId, {
        medio_pago_id: Number(formCobro.medioPagoId) || undefined,
        monto_cobrado: Number(formCobro.monto) || undefined,
        nro_comprobante: formCobro.nroComprobante || undefined,
      });
      actualizarCuota(modalCobro.cuotaId, { estado: "PAGADO", saldo_cuota: "0.00" });
      setModalCobro(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrCobro(e.response?.data?.message ?? "Error al registrar cobro");
    } finally {
      setGuardandoCobro(false);
    }
  }

  // ── Métricas globales (sobre todos los grupos, sin filtros) ──
  const metricas = useMemo(() => {
    let vencidas = 0, pendientes = 0, pagadas = 0;
    let montoVencido = 0, montoPendiente = 0, montoCobrado = 0;
    for (const g of grupos) {
      for (const c of g.cuotas) {
        if (c.estado === "VENCIDA") { vencidas++; montoVencido += Number(c.saldo_cuota ?? c.monto_cuota ?? 0); }
        else if (c.estado === "PENDIENTE") { pendientes++; montoPendiente += Number(c.saldo_cuota ?? c.monto_cuota ?? 0); }
        else if (c.estado === "PAGADO") { pagadas++; montoCobrado += Number(c.monto_cuota ?? 0); }
      }
    }
    return { vencidas, pendientes, pagadas, montoVencido, montoPendiente, montoCobrado };
  }, [grupos]);

  // ── Grupos filtrados y paginados ─────────────────────────
  // Cuando hay filtro de estado o cobrador, se filtran las cuotas individuales
  // dentro de cada grupo (no solo el grupo completo).
  const gruposFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    const hayFiltroCuota = Boolean(filtroEstado || filtroCobrador);
    const cobId = filtroCobrador ? Number(filtroCobrador) : null;

    return grupos
      .map(g => {
        // Filtro búsqueda a nivel de grupo
        if (q && !g.cliente.toLowerCase().includes(q) && !(g.cedula ?? "").toLowerCase().includes(q)) return null;

        // Si hay filtro de cuota, filtrar las cuotas individuales
        let cuotas = g.cuotas;
        if (hayFiltroCuota) {
          cuotas = cuotas.filter(c => {
            if (filtroEstado && c.estado !== filtroEstado) return false;
            if (cobId && c.cobrador_asignado_id !== cobId) return false;
            return true;
          });
          if (cuotas.length === 0) return null;
        }

        return { ...g, cuotas };
      })
      .filter((g): g is ClienteGroup => g !== null);
  }, [grupos, busqueda, filtroEstado, filtroCobrador]);

  // Ordenar por urgencia: vencidas primero, luego pendientes, luego pagadas.
  // Dentro de cada grupo, prioriza por la cuota más urgente.
  // Las cuotas dentro de cada grupo se ordenan por fecha de vencimiento (más próxima primero).
  const gruposOrdenados = useMemo(() => {
    const prioridad = (g: ClienteGroup) => {
      const v = g.cuotas.filter(c => c.estado === "VENCIDA").length;
      const p = g.cuotas.filter(c => c.estado === "PENDIENTE").length;
      // 0 = tiene vencidas, 1 = solo pendientes, 2 = solo pagadas
      if (v > 0) return 0;
      if (p > 0) return 1;
      return 2;
    };
    return [...gruposFiltrados]
      .map(g => ({
        ...g,
        cuotas: [...g.cuotas].sort((a, b) => {
          // No pagadas primero, luego por fecha de vencimiento
          const aPag = a.estado === "PAGADO" ? 1 : 0;
          const bPag = b.estado === "PAGADO" ? 1 : 0;
          if (aPag !== bPag) return aPag - bPag;
          return new Date(fISO(a.fecha_vencimiento) + "T00:00:00").getTime() -
                 new Date(fISO(b.fecha_vencimiento) + "T00:00:00").getTime();
        }),
      }))
      .sort((a, b) => {
        const pa = prioridad(a), pb = prioridad(b);
        if (pa !== pb) return pa - pb;
        // Dentro de la misma prioridad, la cuota más próxima a vencer primero
        const minFecha = (g: ClienteGroup) =>
          Math.min(...g.cuotas.filter(c => c.estado !== "PAGADO").map(c => new Date(fISO(c.fecha_vencimiento) + "T00:00:00").getTime()));
        const fa = minFecha(a), fb = minFecha(b);
        if (isFinite(fa) && isFinite(fb) && fa !== fb) return fa - fb;
        return a.cliente.localeCompare(b.cliente);
      });
  }, [gruposFiltrados]);

  const totalPaginas = Math.max(1, Math.ceil(gruposOrdenados.length / POR_PAGINA));
  const gruposPagina = gruposOrdenados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);


  async function submitNueva(e: React.FormEvent) {
    e.preventDefault();
    setErrNueva(null);
    setGuardandoNueva(true);
    try {
      await panelApi.crearCobranzaManual(formNueva);
      setModalNueva(false);
      setFormNueva(FORM_EMPTY);
      setLoading(true);
      await cargar();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrNueva(e.response?.data?.message ?? "Error al crear cobranza");
    } finally {
      setGuardandoNueva(false);
    }
  }

  async function submitAsignar(e: React.FormEvent) {
    e.preventDefault();
    if (!modalAsignar) return;
    setErrAsignar(null);
    setGuardandoAsignar(true);
    try {
      const res = await panelApi.asignarCobranza(modalAsignar.cuotaId, {
        cobrador_id: Number(formAsignar.cobradorId),
        fecha_limite: formAsignar.fecha,
      });
      const cobNombre = cobradores.find(c => c.id === Number(formAsignar.cobradorId));
      actualizarCuota(modalAsignar.cuotaId, {
        cobrador_asignado_id: Number(formAsignar.cobradorId),
        cobrador_asignado: cobNombre ? `${cobNombre.nombre} ${cobNombre.apellido ?? ""}`.trim() : "",
        asignacion_id: res.data?.asignacion_id ?? null,
        fecha_limite_asignacion: formAsignar.fecha,
      });
      setModalAsignar(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrAsignar(e.response?.data?.message ?? "Error al asignar");
    } finally {
      setGuardandoAsignar(false);
    }
  }

  return (
    <PanelShell title="Cobranzas" description="Seguimiento de cuotas por cliente">

      {/* â”€â”€ Barra superior â”€â”€ */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3">
          {/* Tarjetas de resumen */}
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
            <span className="text-2xl font-bold text-red-600">{metricas.vencidas}</span>
            <div className="leading-tight">
              <p className="text-xs font-medium text-red-700">Vencidas</p>
              <p className="text-[11px] text-red-500">Gs. {metricas.montoVencido.toLocaleString("es-PY")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-2xl font-bold text-amber-600">{metricas.pendientes}</span>
            <div className="leading-tight">
              <p className="text-xs font-medium text-amber-700">Pendientes</p>
              <p className="text-[11px] text-amber-500">Gs. {metricas.montoPendiente.toLocaleString("es-PY")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
            <span className="text-2xl font-bold text-emerald-600">{metricas.pagadas}</span>
            <div className="leading-tight">
              <p className="text-xs font-medium text-emerald-700">Pagadas</p>
              <p className="text-[11px] text-emerald-500">Gs. {metricas.montoCobrado.toLocaleString("es-PY")}</p>
            </div>
          </div>
        </div>
        {hasPermiso("cobranzas", "crear") && (
          <button
            onClick={() => { setFormNueva(FORM_EMPTY); setErrNueva(null); setModalNueva(true); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700"
          >
            <Plus size={16} /> Nueva cobranza manual
          </button>
        )}
      </div>

      <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-blue-900">Cuotas por cliente</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-300" />
              <input
                type="text"
                placeholder="Buscar cliente / cédula…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="rounded-lg border border-sky-200 py-1.5 pl-8 pr-3 text-sm text-blue-900 placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 w-52"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
              className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="VENCIDA">Vencida</option>
              <option value="PAGADO">Pagado</option>
            </select>
            {hasPermiso("cobranzas", "editar") && cobradores.length > 0 && (
              <select
                value={filtroCobrador}
                onChange={e => setFiltroCobrador(e.target.value)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Todos los cobradores</option>
                {cobradores.map(cb => (
                  <option key={cb.id} value={cb.id}>{cb.nombre} {cb.apellido ?? ""}</option>
                ))}
              </select>
            )}
            {(busqueda || filtroEstado || filtroCobrador) && (
              <button
                onClick={() => { setBusqueda(""); setFiltroEstado(""); setFiltroCobrador(""); }}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 flex items-center gap-1"
              >
                <X size={12} />Limpiar
              </button>
            )}
          </div>
        </div>

        {!loading && !error && (
          <p className="mb-3 text-xs text-blue-400">
            {gruposOrdenados.length} cliente{gruposOrdenados.length !== 1 ? "s" : ""}
            {gruposOrdenados.length !== grupos.length && ` (de ${grupos.length})`}
            {" · pág. "}{pagina}/{totalPaginas}
          </p>
        )}

        {loading && <p className="text-blue-700">Cargando cobranzas...</p>}
        {error   && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="space-y-3">
            {gruposPagina.length === 0 && (
              <p className="text-sm text-blue-400">No hay cuotas que coincidan con los filtros.</p>
            )}
            {gruposPagina.map(g => {
              const vencidas   = g.cuotas.filter(c => c.estado === "VENCIDA").length;
              const pendientes = g.cuotas.filter(c => c.estado === "PENDIENTE").length;
              const pagadas    = g.cuotas.filter(c => c.estado === "PAGADO").length;
              const abierto    = abiertos.has(g.cliente_id);

              return (
                <div key={g.cliente_id} className="overflow-hidden rounded-lg border border-sky-200">

                  {/* â”€â”€ Cabecera cliente â”€â”€ */}
                  <button
                    onClick={() => toggleCliente(g.cliente_id)}
                    className="flex w-full items-center justify-between bg-sky-50 px-4 py-3 text-left transition hover:bg-sky-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-blue-900">{g.cliente}</span>
                      {g.cedula && (
                        <span className="text-xs text-blue-400">CI: {g.cedula}</span>
                      )}
                      {/* Saldo total pendiente del cliente */}
                      {(() => {
                        const saldoPendiente = g.cuotas
                          .filter(c => c.estado !== "PAGADO")
                          .reduce((acc, c) => acc + Number(c.saldo_cuota ?? c.monto_cuota ?? 0), 0);
                        if (saldoPendiente > 0) {
                          return (
                            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Debe: Gs. {saldoPendiente.toLocaleString("es-PY")}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {vencidas > 0 && (
                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-red-700">
                          {vencidas} vencida{vencidas > 1 ? "s" : ""}
                        </span>
                      )}
                      {pendientes > 0 && (
                        <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-amber-700">
                          {pendientes} pendiente{pendientes > 1 ? "s" : ""}
                        </span>
                      )}
                      {pagadas > 0 && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-emerald-700">
                          {pagadas} pagada{pagadas > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="ml-1 text-blue-400">{abierto ? "▾" : "▸"}</span>
                    </div>
                  </button>

                  {/* â”€â”€ Listado de cuotas â”€â”€ */}
                  {abierto && (
                    <div className="divide-y divide-sky-100">
                      {g.cuotas.map(c => (
                        <div
                          key={c.id}
                          className={`flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 text-sm transition ${rowBg(c.estado)}`}
                        >
                          {/* Columna izquierda */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${estadoClasses(c.estado)}`}>
                              {c.estado}
                            </span>
                            <span className="text-blue-800">
                              Cuota #{c.numero_cuota}
                              {c.numero_credito && (
                                <span className="ml-1 text-blue-400">· {c.numero_credito}</span>
                              )}
                            </span>
                            {c.descripcion && (
                              <span className="text-xs text-slate-400 italic truncate max-w-45" title={c.descripcion}>
                                {c.descripcion}
                              </span>
                            )}

                            {/* Fecha con edición / atajo Hoy */}
                            {hasPermiso("cobranzas", "editar") && editandoFecha?.id === c.id ? (
                              <span className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={editandoFecha.valor}
                                  onChange={e => setEditandoFecha({ id: c.id, valor: e.target.value })}
                                  className="rounded border border-sky-300 px-1 py-0 text-xs text-blue-900"
                                />
                                <button
                                  onClick={() => void guardarFecha()}
                                  disabled={guardandoFecha}
                                  className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                                  title="Guardar"
                                ><Check size={14} /></button>
                                <button
                                  onClick={() => setEditandoFecha(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                  title="Cancelar"
                                ><X size={14} /></button>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-blue-400">
                                Vence: {new Date(fISO(c.fecha_vencimiento) + "T00:00:00").toLocaleDateString("es-PY")}
                                {hasPermiso("cobranzas", "editar") && c.estado !== "PAGADO" && (
                                  <>
                                    <button
                                      onClick={() => setEditandoFecha({ id: c.id, valor: c.fecha_vencimiento.split("T")[0] })}
                                      className="text-blue-300 hover:text-blue-500"
                                      title="Editar fecha"
                                    ><Pencil size={12} /></button>
                                    <button
                                      onClick={() => void programarHoy(c.id)}
                                      disabled={guardandoFecha}
                                      className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 hover:bg-amber-200 disabled:opacity-40"
                                      title="Programar para hoy"
                                    >
                                      <CalendarCheck size={11} /> Hoy
                                    </button>
                                  </>
                                )}
                              </span>
                            )}

                            {c.fecha_pago && (
                              <span className="text-emerald-600">
                                Pagado: {new Date(fISO(c.fecha_pago) + "T00:00:00").toLocaleDateString("es-PY")}
                              </span>
                            )}

                            {/* Cobrador asignado */}
                            {hasPermiso("cobranzas", "editar") && (
                              <span className="flex items-center gap-1 text-xs">
                                {c.cobrador_asignado ? (
                                  <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-700 inline-flex items-center gap-1">
                                    <User size={12} />{c.cobrador_asignado}
                                  </span>
                                ) : (
                                  c.estado !== "PAGADO" && (
                                    <span className="text-slate-400 italic">Sin cobrador</span>
                                  )
                                )}
                                {c.estado !== "PAGADO" && (
                                  <button
                                    onClick={() => {
                                      setFormAsignar({ cobradorId: String(c.cobrador_asignado_id ?? ""), fecha: today() });
                                      setErrAsignar(null);
                                      setModalAsignar({ cuotaId: c.id });
                                    }}
                                    className="flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
                                    title="Asignar cobrador"
                                  >
                                    <UserPlus size={11} />
                                    {c.cobrador_asignado ? "Reasignar" : "Asignar"}
                                  </button>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Columna derecha */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-semibold text-blue-900">
                                Gs.{" "}{Number(c.monto_cuota).toLocaleString("es-PY")}
                              </span>
                              {c.estado !== "PAGADO" && (
                                <p className={`text-xs ${Number(c.saldo_cuota ?? c.monto_cuota) < Number(c.monto_cuota) ? "text-amber-600" : "text-blue-400"}`}>
                                  Saldo: Gs. {Number(c.saldo_cuota ?? c.monto_cuota).toLocaleString("es-PY")}
                                </p>
                              )}
                            </div>
                            {c.estado !== "PAGADO" && rolUsuario === "SUPERVISOR" && (
                              <button
                                onClick={() => void registrarCobro(c.id)}
                                className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                              >
                                <Banknote size={12} /> Registrar cobro
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Paginación ── */}
        {!loading && !error && totalPaginas > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-sky-100 pt-4">
            <span className="text-xs text-blue-400">
              Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, gruposOrdenados.length)} de {gruposOrdenados.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="flex items-center gap-0.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-sky-50 disabled:opacity-40"
              >
                <ChevronLeft size={13} /> Anterior
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`e${i}`} className="px-1 text-blue-300 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPagina(p as number)}
                      className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs transition ${
                        p === pagina
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-sky-200 text-blue-700 hover:bg-sky-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="flex items-center gap-0.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-sky-50 disabled:opacity-40"
              >
                Siguiente <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          Modal: Nueva cobranza manual
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
              <h3 className="text-base font-semibold text-blue-900">Nueva cobranza manual</h3>
              <button onClick={() => setModalNueva(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void submitNueva(e)} className="space-y-4 overflow-y-auto p-6" style={{ maxHeight: "70vh" }}>
              {errNueva && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{errNueva}</p>}

              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 flex flex-col gap-1 text-xs text-blue-700">
                  Cédula *
                  <input required value={formNueva.cedula} onChange={e => setFormNueva(p => ({ ...p, cedula: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Nombre *
                  <input required value={formNueva.nombre} onChange={e => setFormNueva(p => ({ ...p, nombre: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Apellido
                  <input value={formNueva.apellido ?? ""} onChange={e => setFormNueva(p => ({ ...p, apellido: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Teléfono
                  <input value={formNueva.telefono ?? ""} onChange={e => setFormNueva(p => ({ ...p, telefono: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Dirección
                  <input value={formNueva.direccion ?? ""} onChange={e => setFormNueva(p => ({ ...p, direccion: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="col-span-2 flex flex-col gap-1 text-xs text-blue-700">
                  Descripción del crédito
                  <input value={formNueva.descripcion ?? ""} onChange={e => setFormNueva(p => ({ ...p, descripcion: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Monto total *
                  <input required type="number" min={1} value={formNueva.monto_total || ""} onChange={e => setFormNueva(p => ({ ...p, monto_total: Number(e.target.value) }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Cantidad de cuotas
                  <input type="number" min={1} max={60} value={formNueva.cantidad_cuotas ?? 1} onChange={e => setFormNueva(p => ({ ...p, cantidad_cuotas: Number(e.target.value) }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Periodicidad
                  <select value={formNueva.periodicidad ?? "MENSUAL"} onChange={e => setFormNueva(p => ({ ...p, periodicidad: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {PERIODICIDADES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Fecha primera cuota *
                  <input required type="date" value={formNueva.fecha_vencimiento} onChange={e => setFormNueva(p => ({ ...p, fecha_vencimiento: e.target.value }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </label>
                {cobradores.length > 0 && (
                  <label className="col-span-2 flex flex-col gap-1 text-xs text-blue-700">
                    Asignar cobrador (opcional)
                    <select value={formNueva.cobrador_id ?? ""} onChange={e => setFormNueva(p => ({ ...p, cobrador_id: e.target.value ? Number(e.target.value) : undefined }))}
                      className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Sin asignar</option>
                      {cobradores.map(cb => (
                        <option key={cb.id} value={cb.id}>{cb.nombre} {cb.apellido ?? ""}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-sky-100 pt-4">
                <button type="button" onClick={() => setModalNueva(false)}
                  className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-blue-700 hover:bg-sky-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoNueva}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {guardandoNueva ? "Guardando…" : "Crear cobranza"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          Modal: Asignar cobrador
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {modalAsignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
              <h3 className="text-base font-semibold text-blue-900">Asignar cobrador</h3>
              <button onClick={() => setModalAsignar(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void submitAsignar(e)} className="space-y-4 p-6">
              {errAsignar && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{errAsignar}</p>}
              <label className="flex flex-col gap-1 text-xs text-blue-700">
                Cobrador *
                <select required value={formAsignar.cobradorId} onChange={e => setFormAsignar(p => ({ ...p, cobradorId: e.target.value }))}
                  className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Seleccionar cobrador…</option>
                  {cobradores.map(cb => (
                    <option key={cb.id} value={cb.id}>{cb.nombre} {cb.apellido ?? ""}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-blue-700">
                Fecha límite *
                <input required type="date" value={formAsignar.fecha} onChange={e => setFormAsignar(p => ({ ...p, fecha: e.target.value }))}
                  className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </label>
              <div className="flex justify-end gap-3 border-t border-sky-100 pt-4">
                <button type="button" onClick={() => setModalAsignar(null)}
                  className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-blue-700 hover:bg-sky-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoAsignar}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {guardandoAsignar ? "Guardando…" : "Asignar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          Modal: Registrar cobro
      ───────────────────────────────────────────────────────── */}
      {modalCobro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-blue-900">
                <Banknote size={16} className="text-emerald-600" /> Registrar cobro
              </h3>
              <button onClick={() => setModalCobro(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void submitCobro(e)} className="space-y-4 p-6">
              {errCobro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{errCobro}</p>}

              <label className="flex flex-col gap-1 text-xs text-blue-700">
                Monto cobrado (Gs.) *
                <input
                  required
                  type="number"
                  min={1}
                  value={formCobro.monto}
                  onChange={e => setFormCobro(p => ({ ...p, monto: e.target.value }))}
                  className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <span className="text-blue-300">Cuota: Gs. {modalCobro.montoCuota.toLocaleString("es-PY")}</span>
              </label>

              {mediosPago.length > 0 && (
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  <span className="flex items-center gap-1"><CreditCard size={12} /> Medio de pago *</span>
                  <select
                    required
                    value={formCobro.medioPagoId}
                    onChange={e => setFormCobro(p => ({ ...p, medioPagoId: e.target.value, nroComprobante: "" }))}
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">Seleccionar…</option>
                    {mediosPago.map(mp => (
                      <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                    ))}
                  </select>
                </label>
              )}

              {medioPagoSeleccionado?.requiere_comprobante && (
                <label className="flex flex-col gap-1 text-xs text-blue-700">
                  Nro. de comprobante *
                  <input
                    required
                    type="text"
                    value={formCobro.nroComprobante}
                    onChange={e => setFormCobro(p => ({ ...p, nroComprobante: e.target.value }))}
                    placeholder="Ej: TRF-00123"
                    className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </label>
              )}

              <div className="flex justify-end gap-3 border-t border-sky-100 pt-4">
                <button type="button" onClick={() => setModalCobro(null)}
                  className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-blue-700 hover:bg-sky-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoCobro}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {guardandoCobro ? "Guardando…" : <><Check size={14} /> Confirmar cobro</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PanelShell>
  );
}
