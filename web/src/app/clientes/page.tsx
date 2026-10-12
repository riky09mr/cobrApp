"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, User, Map, Pencil, X, Save, Link2, AlertTriangle, CheckCircle2, Search, ChevronLeft, ChevronRight } from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Cliente, ClienteSinUbicacion, Empresa, CreateClientePayload } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

type Tab = "todos" | "sin-ubicacion";
type ModoUbicacion = "url" | "coordenadas";

export default function Clientes() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  // ── Datos ──────────────────────────────────────────────────
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sinUbicacion, setSinUbicacion] = useState<ClienteSinUbicacion[]>([]);
  const [tabActiva, setTabActiva] = useState<Tab>("todos");
  const [loading, setLoading] = useState(true);
  const [loadingSin, setLoadingSin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Búsqueda, filtros y paginación ─────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activo" | "inactivo">("todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 10;

  // ── Modal nuevo cliente ────────────────────────────────────
  const [showNuevo, setShowNuevo] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [currentUserRol, setCurrentUserRol] = useState<string | null>(null);
  const [currentUserEmpresaId, setCurrentUserEmpresaId] = useState<number>(0);
  const [nuevoForm, setNuevoForm] = useState<CreateClientePayload>({
    cedula: "", nombre: "", apellido: "", telefono: "", email: "", direccion: "", empresa_id: 0,
  });
  // ── Crédito en el modal nuevo cliente ──────────────────────
  const [conCredito, setConCredito] = useState(false);
  const [creditoForm, setCreditoForm] = useState({
    numero_credito: "", descripcion: "", precio_contado: "", entrega_inicial: "",
    monto_total: "", cantidad_cuotas: "", cuotas_pagadas: "", monto_cuota: "",
    dia_pago: "", periodicidad: "MENSUAL", tasa_interes: "", fecha_otorgamiento: "",
  });
  const [savingNuevo, setSavingNuevo] = useState(false);
  const [nuevoError, setNuevoError] = useState<string | null>(null);

  // ── Modal editar cliente ──────────────────────────────────
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", apellido: "", cedula: "", telefono: "", email: "", direccion: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Modal ubicación ────────────────────────────────────────
  const [clienteUbicacion, setClienteUbicacion] = useState<ClienteSinUbicacion | null>(null);
  const [modoUbicacion, setModoUbicacion] = useState<ModoUbicacion>("url");
  const [urlMaps, setUrlMaps] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [savingUbicacion, setSavingUbicacion] = useState(false);
  const [ubicacionError, setUbicacionError] = useState<string | null>(null);
  const [ubicacionSuccess, setUbicacionSuccess] = useState<string | null>(null);

  // ── Carga inicial ──────────────────────────────────────────
  const handleApiError = useCallback((err: unknown) => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      localStorage.removeItem("cobrapp_token");
      localStorage.removeItem("cobrapp_user");
      router.push("/login");
    }
  }, [router]);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await panelApi.getClientes();
      setClientes(data);
    } catch (err) {
      handleApiError(err);
      setError("No se pudo cargar la lista de clientes");
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  const loadSinUbicacion = useCallback(async () => {
    setLoadingSin(true);
    try {
      const data = await panelApi.getClientesSinUbicacion();
      setSinUbicacion(data);
    } catch (err) {
      handleApiError(err);
      setError("No se pudo cargar la lista de clientes sin ubicación");
    } finally {
      setLoadingSin(false);
    }
  }, [handleApiError]);

  // ── Filtrado y paginación ──────────────────────────────────
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes.filter((c) => {
      // Búsqueda por nombre, apellido o CI
      if (q) {
        const nombreCompleto = `${c.nombre} ${c.apellido ?? ""}`.toLowerCase();
        const ci = (c.cedula ?? "").toLowerCase();
        if (!nombreCompleto.includes(q) && !ci.includes(q)) return false;
      }
      // Filtro por estado
      if (filtroEstado === "activo" && !c.estado) return false;
      if (filtroEstado === "inactivo" && c.estado) return false;
      return true;
    });
  }, [clientes, busqueda, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const clientesPagina = clientesFiltrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  // Reiniciar a página 1 cuando cambian búsqueda o filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroEstado]);

  useEffect(() => {
    const userStr = localStorage.getItem("cobrapp_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr) as { rol?: string; empresaId?: number };
        setCurrentUserRol(u.rol ?? null);
        setCurrentUserEmpresaId(u.empresaId ?? 0);
      } catch {
        setError("No se pudo leer la sesión del usuario");
      }
    }
    void loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    if (tabActiva === "sin-ubicacion") void loadSinUbicacion();
  }, [tabActiva, loadSinUbicacion]);

  const abrirModalNuevo = async () => {
    const defaultEmpresaId = currentUserRol !== "ADMIN" ? currentUserEmpresaId : 0;
    setNuevoForm({ cedula: "", nombre: "", apellido: "", telefono: "", email: "", direccion: "", empresa_id: defaultEmpresaId });
    setConCredito(false);
    setCreditoForm({
      numero_credito: "", descripcion: "", precio_contado: "", entrega_inicial: "",
      monto_total: "", cantidad_cuotas: "", cuotas_pagadas: "", monto_cuota: "",
      dia_pago: "", periodicidad: "MENSUAL", tasa_interes: "", fecha_otorgamiento: "",
    });
    setNuevoError(null);
    if (empresas.length === 0) {
      try {
        setEmpresas(await panelApi.getEmpresas());
      } catch (err) {
        handleApiError(err);
        setNuevoError("No se pudo cargar la lista de empresas");
      }
    }
    setShowNuevo(true);
  };

  const handleCrearCliente = async () => {
    if (!nuevoForm.cedula.trim() || !nuevoForm.nombre.trim()) {
      setNuevoError("CI/RUC y Nombre son obligatorios");
      return;
    }
    if (currentUserRol === "ADMIN" && !nuevoForm.empresa_id) {
      setNuevoError("Seleccioná una empresa");
      return;
    }
    if (conCredito) {
      if (!creditoForm.monto_total.trim() || !creditoForm.cantidad_cuotas.trim()) {
        setNuevoError("Para registrar el crédito, monto total y cantidad de cuotas son obligatorios");
        return;
      }
      const cant = Number(creditoForm.cantidad_cuotas);
      if (Number.isNaN(cant) || cant <= 0 || cant > 1000) {
        setNuevoError("Cantidad de cuotas inválida (1 a 1000)");
        return;
      }
    }
    setSavingNuevo(true);
    setNuevoError(null);
    try {
      // Construir payload: cliente + crédito opcional
      const payload: CreateClientePayload = { ...nuevoForm };
      if (conCredito) {
        const num = (v: string) => {
          const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
          return Number.isNaN(n) ? undefined : n;
        };
        payload.credito = {
          numero_credito: creditoForm.numero_credito.trim() || undefined,
          descripcion: creditoForm.descripcion.trim() || undefined,
          precio_contado: num(creditoForm.precio_contado),
          entrega_inicial: num(creditoForm.entrega_inicial),
          monto_total: num(creditoForm.monto_total) ?? 0,
          cantidad_cuotas: num(creditoForm.cantidad_cuotas) ?? 0,
          cuotas_pagadas: num(creditoForm.cuotas_pagadas) ?? 0,
          monto_cuota: num(creditoForm.monto_cuota),
          dia_pago: num(creditoForm.dia_pago),
          periodicidad: (creditoForm.periodicidad as "SEMANAL" | "QUINCENAL" | "MENSUAL") || "MENSUAL",
          tasa_interes: num(creditoForm.tasa_interes) ?? 0,
          fecha_otorgamiento: creditoForm.fecha_otorgamiento || undefined,
        };
      }
      await panelApi.crearCliente(payload);
      setShowNuevo(false);
      void loadClientes();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setNuevoError(e?.response?.data?.message ?? "No se pudo crear el cliente");
    } finally {
      setSavingNuevo(false);
    }
  };

  // ── Editar cliente ─────────────────────────────────────────
  const abrirModalEditar = (c: Cliente) => {
    setEditingCliente(c);
    setEditForm({
      nombre: c.nombre,
      apellido: c.apellido ?? "",
      cedula: c.cedula ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      direccion: c.direccion ?? "",
    });
    setEditError(null);
  };

  const handleGuardarEditar = async () => {
    if (!editingCliente) return;
    if (!editForm.nombre.trim()) { setEditError("El nombre es obligatorio"); return; }
    setSavingEdit(true);
    setEditError(null);
    try {
      await panelApi.updateCliente(editingCliente.id, {
        nombre: editForm.nombre.trim(),
        apellido: editForm.apellido.trim() || undefined,
        cedula: editForm.cedula.trim() || undefined,
        telefono: editForm.telefono.trim() || undefined,
        email: editForm.email.trim() || undefined,
        direccion: editForm.direccion.trim() || undefined,
      });
      setEditingCliente(null);
      void loadClientes();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setEditError(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Asignar ubicación ──────────────────────────────────────
  const abrirModalUbicacion = (cliente: ClienteSinUbicacion) => {
    setClienteUbicacion(cliente);
    setModoUbicacion("url");
    setUrlMaps("");
    setLatitud("");
    setLongitud("");
    setUbicacionError(null);
    setUbicacionSuccess(null);
  };

  const handleGuardarUbicacion = async () => {
    if (!clienteUbicacion) return;
    setSavingUbicacion(true);
    setUbicacionError(null);
    setUbicacionSuccess(null);
    try {
      const payload =
        modoUbicacion === "url"
          ? { url_maps: urlMaps.trim() }
          : { latitud: parseFloat(latitud), longitud: parseFloat(longitud) };

      await panelApi.updateUbicacionCliente(clienteUbicacion.id, payload);
      setUbicacionSuccess("Ubicación guardada correctamente");
      setSinUbicacion((prev) => prev.filter((c) => c.id !== clienteUbicacion.id));
      setTimeout(() => setClienteUbicacion(null), 1200);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setUbicacionError(e?.response?.data?.message ?? "No se pudo guardar la ubicación");
    } finally {
      setSavingUbicacion(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <PanelShell title="Clientes" description="Listado de clientes registrados">

      {/* Botón nuevo cliente */}
      {hasPermiso("clientes", "crear") && (
        <div className="mb-5">
          <button
            onClick={abrirModalNuevo}
            className="flex items-center gap-2 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-cyan-500/30 transition hover:from-cyan-700 hover:to-blue-700"
          >
            <Plus size={14} /> Nuevo Cliente
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-sky-200">
        <button
          onClick={() => setTabActiva("todos")}
          className={`rounded-t-lg px-5 py-2.5 text-sm font-medium transition ${
            tabActiva === "todos"
              ? "border border-b-white border-sky-200 bg-white text-blue-900"
              : "text-blue-600 hover:bg-sky-50"
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setTabActiva("sin-ubicacion")}
          className={`flex items-center gap-2 rounded-t-lg px-5 py-2.5 text-sm font-medium transition ${
            tabActiva === "sin-ubicacion"
              ? "border border-b-white border-sky-200 bg-white text-blue-900"
              : "text-blue-600 hover:bg-sky-50"
          }`}
        >
          <MapPin size={14} /> Sin Ubicación
          {sinUbicacion.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {sinUbicacion.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Todos */}
      {tabActiva === "todos" && (
        <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          {/* Barra de búsqueda y filtros */}
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, apellido o CI..."
                className="w-full rounded-lg border border-sky-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as "todos" | "activo" | "inactivo")}
                className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>

          {loading && <p className="text-blue-700">Cargando clientes...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && !error && clientes.length === 0 && (
            <p className="text-blue-500">
              No hay clientes registrados. Usá{" "}
              <a href="/importar" className="font-medium underline text-blue-700">
                Importar Excel
              </a>{" "}
              para cargar clientes masivamente.
            </p>
          )}
          {!loading && !error && clientes.length > 0 && clientesFiltrados.length === 0 && (
            <p className="text-blue-500">
              No se encontraron clientes que coincidan con la búsqueda o los filtros.
            </p>
          )}
          {!loading && !error && clientesFiltrados.length > 0 && (
            <>
              <p className="mb-3 text-xs text-blue-400">
                Mostrando {clientesPagina.length} de {clientesFiltrados.length} clientes
              </p>
              <ul className="space-y-3">
                {clientesPagina.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/30 p-4 transition hover:bg-sky-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-blue-900">
                        <User size={14} className="inline mr-1" />{c.nombre} {c.apellido ?? ""}
                      </p>
                      <p className="mt-0.5 text-sm text-cyan-600">
                        {c.empresa}
                        {c.cedula ? ` · CI: ${c.cedula}` : ""}
                        {c.telefono ? ` · ${c.telefono}` : ""}
                      </p>
                      {c.direccion && (
                        <p className="mt-0.5 text-xs text-blue-400"><MapPin size={12} className="inline mr-0.5" />{c.direccion}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.estado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {c.estado ? "Activo" : "Inactivo"}
                      </span>
                      <div className="flex gap-2">
                        {c.latitud && c.longitud && (
                          <a
                            href={`https://maps.google.com/?q=${c.latitud},${c.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                          >
                            <Map size={13} /> Ver mapa
                          </a>
                        )}
                        {hasPermiso("clientes", "editar") && (
                          <button
                            onClick={() => abrirModalEditar(c)}
                            className="rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-sky-50 transition inline-flex items-center gap-1"
                          >
                            <Pencil size={13} /> Editar
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="mt-5 flex items-center justify-between border-t border-sky-100 pt-4">
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
            </>
          )}
        </section>
      )}

      {/* Tab: Sin Ubicación */}
      {tabActiva === "sin-ubicacion" && (
        <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-semibold"><MapPin size={14} className="inline mr-1" />Clientes sin coordenadas de ubicación</p>
            <p className="mt-1 text-xs">
              Asigná la ubicación pegando el link de Google Maps o ingresando coordenadas manualmente.
              El cobrador también puede cargar la ubicación desde la app al realizar la primera visita.
            </p>
          </div>
          {loadingSin && <p className="text-blue-700">Cargando...</p>}
          {!loadingSin && sinUbicacion.length === 0 && (
            <p className="text-green-600"><CheckCircle2 size={14} className="inline mr-1" />Todos los clientes tienen ubicación registrada.</p>
          )}
          {!loadingSin && sinUbicacion.length > 0 && (
            <ul className="space-y-3">
              {sinUbicacion.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/40 p-4"
                >
                  <div>
                    <p className="font-semibold text-blue-900">
                      <User size={14} className="inline mr-1" />{c.nombre} {c.apellido ?? ""}
                    </p>
                    <p className="mt-0.5 text-sm text-cyan-600">
                      {c.empresa}
                      {c.cedula ? ` · CI: ${c.cedula}` : ""}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                    </p>
                    {c.direccion && (
                      <p className="mt-0.5 text-xs text-blue-500"><MapPin size={12} className="inline mr-0.5" />{c.direccion}</p>
                    )}
                  </div>
                  {hasPermiso("clientes", "editar") && (
                    <button
                      onClick={() => abrirModalUbicacion(c)}
                      className="ml-4 shrink-0 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-sky-100 inline-flex items-center gap-1"
                    >
                      <MapPin size={13} /> Asignar ubicación
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ════ MODAL — Nuevo Cliente ════ */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-sky-200 bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-blue-900"><Plus size={16} className="inline mr-1" />Nuevo Cliente</h3>
              <button onClick={() => setShowNuevo(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Empresa *</label>
                <select
                  value={nuevoForm.empresa_id}
                  onChange={(e) => setNuevoForm((f) => ({ ...f, empresa_id: parseInt(e.target.value, 10) }))}
                  disabled={currentUserRol !== "ADMIN"}
                  className={`w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    currentUserRol !== "ADMIN" ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  {currentUserRol === "ADMIN" && <option value={0}>Seleccioná una empresa</option>}
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
                  ))}
                </select>
                {currentUserRol !== "ADMIN" && (
                  <p className="mt-1 text-xs text-blue-500">Se asignará a la empresa de tu cuenta</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">CI / RUC *</label>
                  <input
                    type="text"
                    value={nuevoForm.cedula}
                    onChange={(e) => setNuevoForm((f) => ({ ...f, cedula: e.target.value }))}
                    placeholder="1234567"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Nombre *</label>
                  <input
                    type="text"
                    value={nuevoForm.nombre}
                    onChange={(e) => setNuevoForm((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Juan"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Apellido</label>
                  <input
                    type="text"
                    value={nuevoForm.apellido ?? ""}
                    onChange={(e) => setNuevoForm((f) => ({ ...f, apellido: e.target.value }))}
                    placeholder="Pérez"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Teléfono</label>
                  <input
                    type="text"
                    value={nuevoForm.telefono ?? ""}
                    onChange={(e) => setNuevoForm((f) => ({ ...f, telefono: e.target.value }))}
                    placeholder="0981123456"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Email</label>
                <input
                  type="email"
                  value={nuevoForm.email ?? ""}
                  onChange={(e) => setNuevoForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="juan@ejemplo.com"
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Dirección</label>
                <input
                  type="text"
                  value={nuevoForm.direccion ?? ""}
                  onChange={(e) => setNuevoForm((f) => ({ ...f, direccion: e.target.value }))}
                  placeholder="Calle Principal 123"
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Latitud</label>
                  <input
                    type="text"
                    value={nuevoForm.latitud ?? ""}
                    onChange={(e) => setNuevoForm((f) => ({ ...f, latitud: e.target.value }))}
                    placeholder="-25.2867"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Longitud</label>
                  <input
                    type="text"
                    value={nuevoForm.longitud ?? ""}
                    onChange={(e) => setNuevoForm((f) => ({ ...f, longitud: e.target.value }))}
                    placeholder="-57.6478"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* ════ Sección crédito (opcional) ════ */}
            <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-900">
                <input
                  type="checkbox"
                  checked={conCredito}
                  onChange={(e) => setConCredito(e.target.checked)}
                  className="h-4 w-4 accent-cyan-600"
                />
                Registrar crédito y generar cuotas
              </label>
              <p className="mt-1 text-xs text-blue-500">
                Opcional: cargá los mismos datos del Excel de importación para crear el crédito y sus cuotas automáticamente.
              </p>

              {conCredito && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">N° Crédito</label>
                      <input
                        type="text"
                        value={creditoForm.numero_credito}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, numero_credito: e.target.value }))}
                        placeholder="CRED-001"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Descripción</label>
                      <input
                        type="text"
                        value={creditoForm.descripcion}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, descripcion: e.target.value }))}
                        placeholder='Tele Samsung 55"'
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Monto total *</label>
                      <input
                        type="text"
                        value={creditoForm.monto_total}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, monto_total: e.target.value }))}
                        placeholder="2500000"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Cantidad de cuotas *</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={creditoForm.cantidad_cuotas}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, cantidad_cuotas: e.target.value }))}
                        placeholder="10"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Cuotas pagadas</label>
                      <input
                        type="number"
                        min={0}
                        value={creditoForm.cuotas_pagadas}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, cuotas_pagadas: e.target.value }))}
                        placeholder="0"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Monto por cuota</label>
                      <input
                        type="text"
                        value={creditoForm.monto_cuota}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, monto_cuota: e.target.value }))}
                        placeholder="250000 (si se deja vacío se calcula)"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Día de pago</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={creditoForm.dia_pago}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, dia_pago: e.target.value }))}
                        placeholder="10"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Periodicidad</label>
                      <select
                        value={creditoForm.periodicidad}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, periodicidad: e.target.value }))}
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="MENSUAL">Mensual</option>
                        <option value="QUINCENAL">Quincenal</option>
                        <option value="SEMANAL">Semanal</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Tasa de interés (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={creditoForm.tasa_interes}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, tasa_interes: e.target.value }))}
                        placeholder="5.5"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Fecha de otorgamiento</label>
                      <input
                        type="date"
                        value={creditoForm.fecha_otorgamiento}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, fecha_otorgamiento: e.target.value }))}
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Precio contado</label>
                      <input
                        type="text"
                        value={creditoForm.precio_contado}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, precio_contado: e.target.value }))}
                        placeholder="1800000"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">Entrega inicial</label>
                      <input
                        type="text"
                        value={creditoForm.entrega_inicial}
                        onChange={(e) => setCreditoForm((f) => ({ ...f, entrega_inicial: e.target.value }))}
                        placeholder="500000"
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {nuevoError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {nuevoError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowNuevo(false)}
                className="flex-1 rounded-lg border border-sky-300 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearCliente}
                disabled={savingNuevo}
                className="flex-1 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingNuevo ? "Guardando..." : <><Save size={14} className="inline mr-1" />Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL — Asignar Ubicación ════ */}
      {clienteUbicacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-200 bg-white p-7 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-blue-900"><MapPin size={16} className="inline mr-1" />Asignar Ubicación</h3>
              <button
                onClick={() => setClienteUbicacion(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mb-4 text-sm text-blue-700">
              Cliente:{" "}
              <span className="font-semibold">
                {clienteUbicacion.nombre} {clienteUbicacion.apellido ?? ""}
              </span>
            </p>

            <div className="mb-4 flex rounded-lg border border-sky-200 p-1">
              <button
                onClick={() => setModoUbicacion("url")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  modoUbicacion === "url"
                    ? "bg-linear-to-r from-cyan-600 to-blue-600 text-white shadow"
                    : "text-blue-600 hover:bg-sky-50"
                }`}
              >
                <Link2 size={14} className="inline mr-1" />URL de Google Maps
              </button>
              <button
                onClick={() => setModoUbicacion("coordenadas")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  modoUbicacion === "coordenadas"
                    ? "bg-linear-to-r from-cyan-600 to-blue-600 text-white shadow"
                    : "text-blue-600 hover:bg-sky-50"
                }`}
              >
                <Map size={14} className="inline mr-1" />Coordenadas
              </button>
            </div>

            {modoUbicacion === "url" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-blue-900">
                  Pegá el link de Google Maps
                </label>
                <input
                  type="text"
                  value={urlMaps}
                  onChange={(e) => setUrlMaps(e.target.value)}
                  placeholder="https://maps.google.com/?q=-25.28,-57.64"
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-xs text-blue-400">
                  <AlertTriangle size={13} className="inline mr-1" />Usá el link completo (no goo.gl). En Google Maps: Compartir → Copiar enlace.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={latitud}
                    onChange={(e) => setLatitud(e.target.value)}
                    placeholder="-25.2867"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={longitud}
                    onChange={(e) => setLongitud(e.target.value)}
                    placeholder="-57.6478"
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            {ubicacionError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {ubicacionError}
              </p>
            )}
            {ubicacionSuccess && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {ubicacionSuccess}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setClienteUbicacion(null)}
                className="flex-1 rounded-lg border border-sky-300 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarUbicacion}
                disabled={
                  savingUbicacion ||
                  (modoUbicacion === "url" && !urlMaps.trim()) ||
                  (modoUbicacion === "coordenadas" && (!latitud || !longitud))
                }
                className="flex-1 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingUbicacion ? "Guardando..." : <><Save size={14} className="inline mr-1" />Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ════ MODAL — Editar Cliente ════ */}
      {editingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-sky-200 bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-blue-900"><Pencil size={16} className="inline mr-1" />Editar Cliente</h3>
              <button onClick={() => setEditingCliente(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Nombre *</label>
                  <input
                    type="text"
                    value={editForm.nombre}
                    onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Apellido</label>
                  <input
                    type="text"
                    value={editForm.apellido}
                    onChange={(e) => setEditForm((f) => ({ ...f, apellido: e.target.value }))}
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">CI / RUC</label>
                  <input
                    type="text"
                    value={editForm.cedula}
                    onChange={(e) => setEditForm((f) => ({ ...f, cedula: e.target.value }))}
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Teléfono</label>
                  <input
                    type="text"
                    value={editForm.telefono}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Dirección</label>
                <input
                  type="text"
                  value={editForm.direccion}
                  onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))}
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Acceso rápido a ubicación */}
              <div className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                {editingCliente.latitud && editingCliente.longitud ? (
                  <>
                    <span className="text-xs text-emerald-600"><CheckCircle2 size={13} className="inline mr-1" />Tiene coordenadas</span>
                    <a
                      href={`https://maps.google.com/?q=${editingCliente.latitud},${editingCliente.longitud}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs font-medium text-blue-600 underline inline-flex items-center gap-1"
                    >
                      <Map size={13} /> Ver en mapa
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-amber-600"><AlertTriangle size={13} className="inline mr-1" />Sin coordenadas — asignalo desde la pestaña &quot;Sin Ubicación&quot;</span>
                )}
              </div>
            </div>

            {editError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{editError}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setEditingCliente(null)}
                className="flex-1 rounded-lg border border-sky-300 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEditar}
                disabled={savingEdit}
                className="flex-1 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingEdit ? "Guardando..." : <><Save size={14} className="inline mr-1" />Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </PanelShell>
  );
}
