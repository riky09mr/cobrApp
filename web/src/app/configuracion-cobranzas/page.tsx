"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, RotateCcw, Save, ShieldAlert } from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";
import {
  panelApi,
  cobranzasConfigApi,
  type Empresa,
  type TimbradoV12,
  type EstablecimientoV12,
  type PuntoExpedicionV12,
  type CajaV12,
  type NumeradorV12,
  type Cobrador,
} from "@/services/api";

const sectionCls = "rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden";
const inputCls = "w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
const labelCls = "mb-1 block text-xs font-medium text-blue-800";
const actionBtnCls = "rounded-lg px-3 py-2 text-sm font-medium transition";

type TimbradoForm = {
  numero_timbrado: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: TimbradoV12["estado"];
  es_electronico: boolean;
  observaciones: string;
};

type EstablecimientoForm = {
  timbrado_id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
};

type PuntoForm = {
  timbrado_id: string;
  establecimiento_id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
};

type CajaForm = {
  punto_expedicion_id: string;
  nombre: string;
  estado: CajaV12["estado"];
  cobrador_asignado_id: string;
  saldo_inicial_referencia: string;
};

type NumeradorForm = {
  timbrado_id: string;
  establecimiento_id: string;
  punto_expedicion_id: string;
  tipo_documento: NumeradorV12["tipo_documento"];
  serie: string;
  numero_desde: string;
  numero_hasta: string;
  ultimo_numero_asignado: string;
  activo: boolean;
  bloqueado: boolean;
};

const EMPTY_TIMBRADO: TimbradoForm = {
  numero_timbrado: "",
  fecha_inicio: "",
  fecha_fin: "",
  estado: "BORRADOR",
  es_electronico: false,
  observaciones: "",
};

const EMPTY_ESTABLECIMIENTO: EstablecimientoForm = {
  timbrado_id: "",
  codigo: "001",
  descripcion: "",
  activo: true,
};

const EMPTY_PUNTO: PuntoForm = {
  timbrado_id: "",
  establecimiento_id: "",
  codigo: "001",
  descripcion: "",
  activo: true,
};

const EMPTY_CAJA: CajaForm = {
  punto_expedicion_id: "",
  nombre: "",
  estado: "ACTIVA",
  cobrador_asignado_id: "",
  saldo_inicial_referencia: "0",
};

const EMPTY_NUMERADOR: NumeradorForm = {
  timbrado_id: "",
  establecimiento_id: "",
  punto_expedicion_id: "",
  tipo_documento: "RECIBO_COBRANZA",
  serie: "A1",
  numero_desde: "1",
  numero_hasta: "9999999",
  ultimo_numero_asignado: "0",
  activo: true,
  bloqueado: false,
};

const toBool = (value: boolean | number | null | undefined) => value === true || value === 1;
const toCode3 = (value: string) => value.replace(/\D/g, "").slice(0, 3).padStart(3, "0");
const toCode3Draft = (value: string) => value.replace(/\D/g, "").slice(0, 3);
const parseApiError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export default function ConfiguracionCobranzasPage() {
  useAuth();
  const { hasPermiso } = usePermisos();
  const cajasSectionRef = useRef<HTMLElement | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);

  const [timbrados, setTimbrados] = useState<TimbradoV12[]>([]);
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoV12[]>([]);
  const [puntos, setPuntos] = useState<PuntoExpedicionV12[]>([]);
  const [cajas, setCajas] = useState<CajaV12[]>([]);
  const [numeradores, setNumeradores] = useState<NumeradorV12[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingTimbradoId, setEditingTimbradoId] = useState<number | null>(null);
  const [editingEstablecimientoId, setEditingEstablecimientoId] = useState<number | null>(null);
  const [editingPuntoId, setEditingPuntoId] = useState<number | null>(null);
  const [editingCajaId, setEditingCajaId] = useState<number | null>(null);
  const [editingNumeradorId, setEditingNumeradorId] = useState<number | null>(null);

  const [timbradoForm, setTimbradoForm] = useState<TimbradoForm>(EMPTY_TIMBRADO);
  const [establecimientoForm, setEstablecimientoForm] = useState<EstablecimientoForm>(EMPTY_ESTABLECIMIENTO);
  const [puntoForm, setPuntoForm] = useState<PuntoForm>(EMPTY_PUNTO);
  const [cajaForm, setCajaForm] = useState<CajaForm>(EMPTY_CAJA);
  const [numeradorForm, setNumeradorForm] = useState<NumeradorForm>(EMPTY_NUMERADOR);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("cobrapp_user") || "{}");
    const admin = user.rol === "ADMIN";
    setIsAdmin(admin);
    if (!admin && user.empresaId) {
      setSelectedEmpresaId(Number(user.empresaId));
    }
    if (admin) {
      void panelApi.getEmpresas().then((data) => {
        setEmpresas(data);
        if (data[0]?.id) setSelectedEmpresaId(data[0].id);
      });
    }
    void panelApi.getCobradores().then(setCobradores).catch(() => undefined);
  }, []);

  const timbradosVigentes = timbrados.filter((item) => item.estado === "VIGENTE");
  const cajasActivas = cajas.filter((item) => item.estado === "ACTIVA");
  const numeradoresActivos = numeradores.filter((item) => toBool(item.activo) && !toBool(item.bloqueado));
  const configuracionCompleta = timbrados.length > 0 && establecimientos.length > 0 && puntos.length > 0 && cajas.length > 0 && numeradores.length > 0;

  const filteredEstablecimientos = establecimientos.filter((item) => (
    !puntoForm.timbrado_id || String(item.timbrado_id ?? "") === puntoForm.timbrado_id
  ));

  const filteredPuntosForNumerador = puntos.filter((item) => {
    if (numeradorForm.establecimiento_id && String(item.establecimiento_id) !== numeradorForm.establecimiento_id) return false;
    if (numeradorForm.timbrado_id && String(item.timbrado_id) !== numeradorForm.timbrado_id) return false;
    return true;
  });

  const withEmpresa = <T extends Record<string, unknown>>(payload: T) => isAdmin ? { ...payload, empresa_id: selectedEmpresaId } : payload;

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const notifySuccess = (message: string) => {
    setSuccess(message);
    setError(null);
  };

  const handleFailure = (err: unknown, fallback: string) => {
    setError(parseApiError(err, fallback));
    setSuccess(null);
  };

  const cargarTodo = useCallback(async (empresaId: number) => {
    setLoading(true);
    resetMessages();
    try {
      const [t, e, p, c, n] = await Promise.all([
        cobranzasConfigApi.getTimbrados(empresaId),
        cobranzasConfigApi.getEstablecimientos(empresaId),
        cobranzasConfigApi.getPuntosExpedicion(empresaId),
        cobranzasConfigApi.getCajas(empresaId),
        cobranzasConfigApi.getNumeradores(empresaId),
      ]);
      setTimbrados(t);
      setEstablecimientos(e);
      setPuntos(p);
      setCajas(c);
      setNumeradores(n);
    } catch (err: unknown) {
      setError(parseApiError(err, "No se pudo cargar la configuración de cobranzas"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmpresaId) void cargarTodo(selectedEmpresaId);
  }, [selectedEmpresaId, cargarTodo]);

  const startEditTimbrado = (item: TimbradoV12) => {
    setEditingTimbradoId(item.id);
    setTimbradoForm({
      numero_timbrado: item.numero_timbrado,
      fecha_inicio: String(item.fecha_inicio).slice(0, 10),
      fecha_fin: String(item.fecha_fin).slice(0, 10),
      estado: item.estado,
      es_electronico: toBool(item.es_electronico),
      observaciones: item.observaciones ?? "",
    });
    resetMessages();
  };

  const startEditEstablecimiento = (item: EstablecimientoV12) => {
    setEditingEstablecimientoId(item.id);
    setEstablecimientoForm({
      timbrado_id: item.timbrado_id ? String(item.timbrado_id) : "",
      codigo: item.codigo,
      descripcion: item.descripcion,
      activo: toBool(item.activo),
    });
    resetMessages();
  };

  const startEditPunto = (item: PuntoExpedicionV12) => {
    setEditingPuntoId(item.id);
    setPuntoForm({
      timbrado_id: String(item.timbrado_id),
      establecimiento_id: String(item.establecimiento_id),
      codigo: item.codigo,
      descripcion: item.descripcion ?? "",
      activo: toBool(item.activo),
    });
    resetMessages();
  };

  const startEditCaja = (item: CajaV12) => {
    setEditingCajaId(item.id);
    setCajaForm({
      punto_expedicion_id: String(item.punto_expedicion_id),
      nombre: item.nombre,
      estado: item.estado,
      cobrador_asignado_id: item.cobrador_asignado_id ? String(item.cobrador_asignado_id) : "",
      saldo_inicial_referencia: String(item.saldo_inicial_referencia),
    });
    resetMessages();
  };

  const startEditNumerador = (item: NumeradorV12) => {
    setEditingNumeradorId(item.id);
    setNumeradorForm({
      timbrado_id: String(item.timbrado_id),
      establecimiento_id: String(item.establecimiento_id),
      punto_expedicion_id: String(item.punto_expedicion_id),
      tipo_documento: item.tipo_documento,
      serie: item.serie,
      numero_desde: String(item.numero_desde),
      numero_hasta: String(item.numero_hasta),
      ultimo_numero_asignado: String(item.ultimo_numero_asignado),
      activo: toBool(item.activo),
      bloqueado: toBool(item.bloqueado),
    });
    resetMessages();
  };

  const cancelTimbrado = () => { setEditingTimbradoId(null); setTimbradoForm(EMPTY_TIMBRADO); };
  const cancelEstablecimiento = () => { setEditingEstablecimientoId(null); setEstablecimientoForm(EMPTY_ESTABLECIMIENTO); };
  const cancelPunto = () => { setEditingPuntoId(null); setPuntoForm(EMPTY_PUNTO); };
  const cancelCaja = () => { setEditingCajaId(null); setCajaForm(EMPTY_CAJA); };
  const cancelNumerador = () => { setEditingNumeradorId(null); setNumeradorForm(EMPTY_NUMERADOR); };

  const saveTimbrado = async () => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    if (!timbradoForm.numero_timbrado.trim() || !timbradoForm.fecha_inicio || !timbradoForm.fecha_fin) {
      setError("Completa número, fecha de inicio y fecha de fin del timbrado.");
      return;
    }
    setSaving(true);
    try {
      const payload = withEmpresa({
        ...timbradoForm,
        numero_timbrado: timbradoForm.numero_timbrado.trim(),
        observaciones: timbradoForm.observaciones.trim() || null,
      });
      if (editingTimbradoId) {
        await cobranzasConfigApi.updateTimbrado(editingTimbradoId, payload);
        notifySuccess("Timbrado actualizado.");
      } else {
        await cobranzasConfigApi.createTimbrado(payload);
        notifySuccess("Timbrado creado.");
      }
      cancelTimbrado();
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo guardar el timbrado");
    } finally {
      setSaving(false);
    }
  };

  const saveEstablecimiento = async () => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    if (!establecimientoForm.timbrado_id || !establecimientoForm.descripcion.trim()) {
      setError("Selecciona un timbrado y escribe la descripción del establecimiento.");
      return;
    }
    setSaving(true);
    try {
      const payload = withEmpresa({
        timbrado_id: Number(establecimientoForm.timbrado_id),
        codigo: toCode3(establecimientoForm.codigo),
        descripcion: establecimientoForm.descripcion.trim(),
        activo: establecimientoForm.activo,
      });
      if (editingEstablecimientoId) {
        await cobranzasConfigApi.updateEstablecimiento(editingEstablecimientoId, payload);
        notifySuccess("Establecimiento actualizado.");
      } else {
        await cobranzasConfigApi.createEstablecimiento(payload);
        notifySuccess("Establecimiento creado.");
      }
      cancelEstablecimiento();
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo guardar el establecimiento");
    } finally {
      setSaving(false);
    }
  };

  const savePunto = async () => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    if (!puntoForm.timbrado_id || !puntoForm.establecimiento_id) {
      setError("Selecciona timbrado y establecimiento para el punto de expedición.");
      return;
    }
    setSaving(true);
    try {
      const payload = withEmpresa({
        timbrado_id: Number(puntoForm.timbrado_id),
        establecimiento_id: Number(puntoForm.establecimiento_id),
        codigo: toCode3(puntoForm.codigo),
        descripcion: puntoForm.descripcion.trim() || null,
        activo: puntoForm.activo,
      });
      if (editingPuntoId) {
        await cobranzasConfigApi.updatePuntoExpedicion(editingPuntoId, payload);
        notifySuccess("Punto de expedición actualizado.");
      } else {
        await cobranzasConfigApi.createPuntoExpedicion(payload);
        notifySuccess("Punto de expedición creado.");
      }
      cancelPunto();
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo guardar el punto de expedición");
    } finally {
      setSaving(false);
    }
  };

  const saveCaja = async () => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    if (!cajaForm.punto_expedicion_id || !cajaForm.nombre.trim()) {
      setError("Selecciona un punto y define el nombre de la caja.");
      return;
    }
    setSaving(true);
    try {
      const payload = withEmpresa({
        punto_expedicion_id: Number(cajaForm.punto_expedicion_id),
        nombre: cajaForm.nombre.trim(),
        estado: cajaForm.estado,
        cobrador_asignado_id: cajaForm.cobrador_asignado_id ? Number(cajaForm.cobrador_asignado_id) : null,
        saldo_inicial_referencia: Number(cajaForm.saldo_inicial_referencia || 0),
      });
      if (editingCajaId) {
        await cobranzasConfigApi.updateCaja(editingCajaId, payload);
        notifySuccess("Caja actualizada.");
      } else {
        await cobranzasConfigApi.createCaja(payload);
        notifySuccess("Caja creada.");
      }
      cancelCaja();
      await cargarTodo(selectedEmpresaId);
      cajasSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err: unknown) {
      handleFailure(err, "No se pudo guardar la caja");
    } finally {
      setSaving(false);
    }
  };

  const saveNumerador = async () => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    if (!numeradorForm.timbrado_id || !numeradorForm.establecimiento_id || !numeradorForm.punto_expedicion_id) {
      setError("Completa timbrado, establecimiento y punto del numerador.");
      return;
    }
    setSaving(true);
    try {
      const payload = withEmpresa({
        timbrado_id: Number(numeradorForm.timbrado_id),
        establecimiento_id: Number(numeradorForm.establecimiento_id),
        punto_expedicion_id: Number(numeradorForm.punto_expedicion_id),
        tipo_documento: numeradorForm.tipo_documento,
        serie: numeradorForm.serie.trim() || "A1",
        numero_desde: Number(numeradorForm.numero_desde),
        numero_hasta: Number(numeradorForm.numero_hasta),
        ultimo_numero_asignado: Number(numeradorForm.ultimo_numero_asignado),
        activo: numeradorForm.activo,
        bloqueado: numeradorForm.bloqueado,
      });
      if (editingNumeradorId) {
        await cobranzasConfigApi.updateNumerador(editingNumeradorId, payload);
        notifySuccess("Numerador actualizado.");
      } else {
        await cobranzasConfigApi.createNumerador(payload);
        notifySuccess("Numerador creado.");
      }
      cancelNumerador();
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo guardar el numerador");
    } finally {
      setSaving(false);
    }
  };

  const quickUpdateTimbrado = async (item: TimbradoV12, estado: TimbradoV12["estado"]) => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    setSaving(true);
    try {
      await cobranzasConfigApi.updateTimbrado(item.id, withEmpresa({ estado }));
      notifySuccess(`Timbrado ${item.numero_timbrado} actualizado a ${estado}.`);
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo actualizar el timbrado");
    } finally {
      setSaving(false);
    }
  };

  const quickUpdateCaja = async (item: CajaV12, estado: CajaV12["estado"]) => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    setSaving(true);
    try {
      await cobranzasConfigApi.updateCaja(item.id, withEmpresa({ estado }));
      notifySuccess(`Caja ${item.nombre} actualizada a ${estado}.`);
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo actualizar la caja");
    } finally {
      setSaving(false);
    }
  };

  const quickUpdateNumerador = async (item: NumeradorV12, patch: Partial<NumeradorV12>) => {
    if (!selectedEmpresaId) return;
    if (!hasPermiso("configuracion", "editar")) { setError("No tenés permiso para editar la configuración de cobranzas."); return; }
    setSaving(true);
    try {
      await cobranzasConfigApi.updateNumerador(item.id, withEmpresa(patch));
      notifySuccess("Numerador actualizado.");
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo actualizar el numerador");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelShell
      title="Configuración de Cobranzas"
      description="Administra timbrados, establecimientos, puntos de expedición, cajas y numeradores del modelo V12."
    >
      <div className="space-y-6">
        {isAdmin && (
          <section className={sectionCls}>
            <div className="flex items-center gap-2 border-b border-sky-100 px-6 py-4">
              <ShieldAlert size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-blue-900">Empresa</h2>
            </div>
            <div className="px-6 py-4">
              <label className={labelCls}>Empresa activa</label>
              <div className="relative">
                <select className={`${inputCls} appearance-none pr-8`} value={selectedEmpresaId ?? ""} onChange={(e) => setSelectedEmpresaId(Number(e.target.value))}>
                  {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.razon_social}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-sky-500">Timbrados</p><p className="mt-2 text-2xl font-bold text-blue-900">{timbrados.length}</p><p className="mt-1 text-xs text-slate-500">Vigentes: {timbradosVigentes.length}</p></div>
          <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-sky-500">Establecimientos</p><p className="mt-2 text-2xl font-bold text-blue-900">{establecimientos.length}</p><p className="mt-1 text-xs text-slate-500">Puntos: {puntos.length}</p></div>
          <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-sky-500">Cajas</p><p className="mt-2 text-2xl font-bold text-blue-900">{cajas.length}</p><p className="mt-1 text-xs text-slate-500">Activas: {cajasActivas.length}</p></div>
          <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-sky-500">Numeradores</p><p className="mt-2 text-2xl font-bold text-blue-900">{numeradores.length}</p><p className="mt-1 text-xs text-slate-500">Disponibles: {numeradoresActivos.length}</p></div>
          <div className={`rounded-xl border px-5 py-4 shadow-sm ${configuracionCompleta ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Estado</p><p className="mt-2 text-sm font-semibold text-slate-900">{configuracionCompleta ? "Lista para pruebas" : "Configuración incompleta"}</p><p className="mt-1 text-xs text-slate-600">{configuracionCompleta ? "La empresa ya puede completar pruebas operativas." : "Faltan catálogos mínimos para operar en V12."}</p></div>
        </section>

        {error && <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">{error}</div>}
        {success && <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg">{success}</div>}
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        {loading && <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-700">Cargando configuración…</div>}

        <section className={sectionCls}>
          <div className="border-b border-sky-100 px-6 py-4"><h2 className="text-sm font-semibold text-blue-900">Timbrados</h2><p className="mt-1 text-xs text-slate-500">Carga, edita y activa el timbrado que habilita la secuencia fiscal.</p></div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-6">
            <div className="md:col-span-2"><label className={labelCls}>Número</label><input className={inputCls} value={timbradoForm.numero_timbrado} onChange={(e) => setTimbradoForm({ ...timbradoForm, numero_timbrado: e.target.value })} placeholder="12345678" /></div>
            <div><label className={labelCls}>Inicio</label><input type="date" className={inputCls} value={timbradoForm.fecha_inicio} onChange={(e) => setTimbradoForm({ ...timbradoForm, fecha_inicio: e.target.value })} /></div>
            <div><label className={labelCls}>Fin</label><input type="date" className={inputCls} value={timbradoForm.fecha_fin} onChange={(e) => setTimbradoForm({ ...timbradoForm, fecha_fin: e.target.value })} /></div>
            <div><label className={labelCls}>Estado</label><select className={inputCls} value={timbradoForm.estado} onChange={(e) => setTimbradoForm({ ...timbradoForm, estado: e.target.value as TimbradoV12["estado"] })}><option value="BORRADOR">BORRADOR</option><option value="VIGENTE">VIGENTE</option><option value="VENCIDO">VENCIDO</option><option value="ANULADO">ANULADO</option><option value="INACTIVO">INACTIVO</option></select></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-blue-900"><input type="checkbox" checked={timbradoForm.es_electronico} onChange={(e) => setTimbradoForm({ ...timbradoForm, es_electronico: e.target.checked })} /> Electrónico</label></div>
            <div className="md:col-span-4"><label className={labelCls}>Observaciones</label><input className={inputCls} value={timbradoForm.observaciones} onChange={(e) => setTimbradoForm({ ...timbradoForm, observaciones: e.target.value })} placeholder="Comentarios operativos o legales" /></div>
            <div className="flex items-end gap-2 md:col-span-2"><button disabled={saving} className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} onClick={saveTimbrado}><Save size={15} className="mr-1 inline" />{editingTimbradoId ? "Actualizar" : "Guardar"}</button>{editingTimbradoId && <button className={`${actionBtnCls} border border-sky-200 bg-white text-blue-700 hover:bg-sky-50`} onClick={cancelTimbrado}><RotateCcw size={15} className="mr-1 inline" />Cancelar</button>}</div>
          </div>
          <div className="overflow-x-auto px-6 pb-6"><table className="min-w-full text-sm"><thead><tr className="border-b border-sky-100 text-left text-blue-700"><th className="py-2">Número</th><th>Vigencia</th><th>Estado</th><th>Tipo</th><th>Acciones</th></tr></thead><tbody>{timbrados.map((item) => <tr key={item.id} className="border-b border-sky-50 text-slate-700 last:border-b-0"><td className="py-3 font-medium text-blue-900">{item.numero_timbrado}</td><td>{String(item.fecha_inicio).slice(0, 10)} - {String(item.fecha_fin).slice(0, 10)}</td><td>{item.estado}</td><td>{toBool(item.es_electronico) ? "Electrónico" : "Impreso"}</td><td><div className="flex flex-wrap gap-2"><button className="text-sky-700 hover:underline" onClick={() => startEditTimbrado(item)}><Pencil size={14} className="mr-1 inline" />Editar</button>{item.estado !== "VIGENTE" && <button className="text-emerald-700 hover:underline" onClick={() => void quickUpdateTimbrado(item, "VIGENTE")}>Activar</button>}{item.estado === "VIGENTE" && <button className="text-amber-700 hover:underline" onClick={() => void quickUpdateTimbrado(item, "INACTIVO")}>Desactivar</button>}</div></td></tr>)}</tbody></table></div>
        </section>

        <section className={sectionCls}>
          <div className="border-b border-sky-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-blue-900">Establecimientos y Puntos de Expedición</h2>
            <p className="mt-1 text-xs text-slate-500">Define la estructura fiscal establecimiento hacia punto de expedición que usarán las cajas.</p>
          </div>
          <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-sky-100 p-4"><h3 className="text-sm font-semibold text-blue-800">{editingEstablecimientoId ? "Editar establecimiento" : "Nuevo establecimiento"}</h3><div><label className={labelCls}>Timbrado</label><select className={inputCls} value={establecimientoForm.timbrado_id} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, timbrado_id: e.target.value })}><option value="">Selecciona timbrado</option>{timbrados.map((item) => <option key={item.id} value={item.id}>{item.numero_timbrado}</option>)}</select></div><div><label className={labelCls}>Código</label><input className={inputCls} inputMode="numeric" maxLength={3} value={establecimientoForm.codigo} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, codigo: toCode3Draft(e.target.value) })} placeholder="001" /></div><div><label className={labelCls}>Descripción</label><input className={inputCls} value={establecimientoForm.descripcion} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, descripcion: e.target.value })} placeholder="Casa matriz administrativa" /></div><label className="flex items-center gap-2 text-sm text-blue-900"><input type="checkbox" checked={establecimientoForm.activo} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, activo: e.target.checked })} /> Activo</label><div className="flex gap-2"><button disabled={saving} className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} onClick={saveEstablecimiento}>{editingEstablecimientoId ? "Actualizar" : "Guardar"}</button>{editingEstablecimientoId && <button className={`${actionBtnCls} border border-sky-200 bg-white text-blue-700 hover:bg-sky-50`} onClick={cancelEstablecimiento}>Cancelar</button>}</div></div>
            <div className="space-y-3 rounded-xl border border-sky-100 p-4"><h3 className="text-sm font-semibold text-blue-800">{editingPuntoId ? "Editar punto" : "Nuevo punto"}</h3><div><label className={labelCls}>Timbrado</label><select className={inputCls} value={puntoForm.timbrado_id} onChange={(e) => setPuntoForm({ ...puntoForm, timbrado_id: e.target.value, establecimiento_id: "" })}><option value="">Selecciona timbrado</option>{timbrados.map((item) => <option key={item.id} value={item.id}>{item.numero_timbrado}</option>)}</select></div><div><label className={labelCls}>Establecimiento</label><select className={inputCls} value={puntoForm.establecimiento_id} onChange={(e) => setPuntoForm({ ...puntoForm, establecimiento_id: e.target.value })}><option value="">Selecciona establecimiento</option>{filteredEstablecimientos.map((item) => <option key={item.id} value={item.id}>{item.codigo} - {item.descripcion}</option>)}</select></div><div><label className={labelCls}>Código</label><input className={inputCls} inputMode="numeric" maxLength={3} value={puntoForm.codigo} onChange={(e) => setPuntoForm({ ...puntoForm, codigo: toCode3Draft(e.target.value) })} placeholder="001" /></div><div><label className={labelCls}>Descripción</label><input className={inputCls} value={puntoForm.descripcion} onChange={(e) => setPuntoForm({ ...puntoForm, descripcion: e.target.value })} placeholder="Caja móvil principal" /></div><label className="flex items-center gap-2 text-sm text-blue-900"><input type="checkbox" checked={puntoForm.activo} onChange={(e) => setPuntoForm({ ...puntoForm, activo: e.target.checked })} /> Activo</label><div className="flex gap-2"><button disabled={saving} className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} onClick={savePunto}>{editingPuntoId ? "Actualizar" : "Guardar"}</button>{editingPuntoId && <button className={`${actionBtnCls} border border-sky-200 bg-white text-blue-700 hover:bg-sky-50`} onClick={cancelPunto}>Cancelar</button>}</div></div>
          </div>
          <div className="grid gap-6 px-6 pb-6 lg:grid-cols-2"><div><h4 className="mb-2 text-sm font-semibold text-blue-800">Establecimientos</h4><div className="space-y-2">{establecimientos.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-3 text-sm"><div><p className="font-medium text-blue-900">{item.codigo} - {item.descripcion}</p><p className="text-xs text-slate-500">Timbrado: {timbrados.find((t) => t.id === item.timbrado_id)?.numero_timbrado || "Sin vínculo"}</p></div><button className="text-sky-700 hover:underline" onClick={() => startEditEstablecimiento(item)}>Editar</button></div>)}</div></div><div><h4 className="mb-2 text-sm font-semibold text-blue-800">Puntos</h4><div className="space-y-2">{puntos.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-3 text-sm"><div><p className="font-medium text-blue-900">{item.establecimiento_codigo}-{item.codigo}</p><p className="text-xs text-slate-500">{item.descripcion || "Sin descripción"}</p></div><button className="text-sky-700 hover:underline" onClick={() => startEditPunto(item)}>Editar</button></div>)}</div></div></div>
        </section>

        <section ref={cajasSectionRef} className={sectionCls}>
          <div className="border-b border-sky-100 px-6 py-4"><h2 className="text-sm font-semibold text-blue-900">Cajas</h2><p className="mt-1 text-xs text-slate-500">Cada caja debe quedar asociada a un único punto de expedición y opcionalmente a un cobrador.</p></div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-5"><div><label className={labelCls}>Punto</label><select className={inputCls} value={cajaForm.punto_expedicion_id} onChange={(e) => setCajaForm({ ...cajaForm, punto_expedicion_id: e.target.value })}><option value="">Selecciona punto</option>{puntos.map((item) => <option key={item.id} value={item.id}>{item.establecimiento_codigo}-{item.codigo} {item.descripcion ? `· ${item.descripcion}` : ""}</option>)}</select></div><div><label className={labelCls}>Nombre</label><input className={inputCls} value={cajaForm.nombre} onChange={(e) => setCajaForm({ ...cajaForm, nombre: e.target.value })} placeholder="Caja móvil 001-001" /></div><div><label className={labelCls}>Estado</label><select className={inputCls} value={cajaForm.estado} onChange={(e) => setCajaForm({ ...cajaForm, estado: e.target.value as CajaV12["estado"] })}><option value="ACTIVA">ACTIVA</option><option value="BLOQUEADA">BLOQUEADA</option><option value="INACTIVA">INACTIVA</option></select></div><div><label className={labelCls}>Cobrador</label><select className={inputCls} value={cajaForm.cobrador_asignado_id} onChange={(e) => setCajaForm({ ...cajaForm, cobrador_asignado_id: e.target.value })}><option value="">Sin cobrador</option>{cobradores.map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.apellido ?? ""}</option>)}</select></div><div><label className={labelCls}>Saldo inicial de referencia</label><input className={inputCls} value={cajaForm.saldo_inicial_referencia} onChange={(e) => setCajaForm({ ...cajaForm, saldo_inicial_referencia: e.target.value })} placeholder="0" /></div><div className="md:col-span-5 flex gap-2"><button disabled={saving} className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} onClick={saveCaja}>{editingCajaId ? "Actualizar" : "Guardar caja"}</button>{editingCajaId && <button className={`${actionBtnCls} border border-sky-200 bg-white text-blue-700 hover:bg-sky-50`} onClick={cancelCaja}>Cancelar</button>}</div></div>
          <div className="overflow-x-auto px-6 pb-6"><table className="min-w-full text-sm"><thead><tr className="border-b border-sky-100 text-left text-blue-700"><th className="py-2">Caja</th><th>Punto</th><th>Cobrador</th><th>Estado</th><th>Saldo</th><th>Acciones</th></tr></thead><tbody>{cajas.map((item) => <tr key={item.id} className="border-b border-sky-50 last:border-b-0"><td className="py-3 font-medium text-blue-900">{item.nombre}</td><td>{item.establecimiento_codigo}-{item.punto_codigo}</td><td>{item.cobrador_nombre || "Sin asignar"}</td><td>{item.estado}</td><td>{item.saldo_actual}</td><td><div className="flex flex-wrap gap-2"><button className="text-sky-700 hover:underline" onClick={() => startEditCaja(item)}><Pencil size={14} className="mr-1 inline" />Editar</button>{item.estado !== "BLOQUEADA" && <button className="text-amber-700 hover:underline" onClick={() => void quickUpdateCaja(item, "BLOQUEADA")}>Bloquear</button>}{item.estado !== "ACTIVA" && <button className="text-emerald-700 hover:underline" onClick={() => void quickUpdateCaja(item, "ACTIVA")}>Activar</button>}</div></td></tr>)}</tbody></table></div>
        </section>

        <section className={sectionCls}>
          <div className="border-b border-sky-100 px-6 py-4"><h2 className="text-sm font-semibold text-blue-900">Numeradores</h2><p className="mt-1 text-xs text-slate-500">Controla las secuencias por punto de expedición. Nunca se reutilizan números anulados.</p></div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-8"><div><label className={labelCls}>Timbrado</label><select className={inputCls} value={numeradorForm.timbrado_id} onChange={(e) => setNumeradorForm({ ...numeradorForm, timbrado_id: e.target.value, establecimiento_id: "", punto_expedicion_id: "" })}><option value="">Selecciona timbrado</option>{timbrados.map((item) => <option key={item.id} value={item.id}>{item.numero_timbrado}</option>)}</select></div><div><label className={labelCls}>Establecimiento</label><select className={inputCls} value={numeradorForm.establecimiento_id} onChange={(e) => setNumeradorForm({ ...numeradorForm, establecimiento_id: e.target.value, punto_expedicion_id: "" })}><option value="">Selecciona establecimiento</option>{establecimientos.filter((item) => !numeradorForm.timbrado_id || String(item.timbrado_id ?? "") === numeradorForm.timbrado_id).map((item) => <option key={item.id} value={item.id}>{item.codigo}</option>)}</select></div><div><label className={labelCls}>Punto</label><select className={inputCls} value={numeradorForm.punto_expedicion_id} onChange={(e) => setNumeradorForm({ ...numeradorForm, punto_expedicion_id: e.target.value })}><option value="">Selecciona punto</option>{filteredPuntosForNumerador.map((item) => <option key={item.id} value={item.id}>{item.establecimiento_codigo}-{item.codigo}</option>)}</select></div><div><label className={labelCls}>Documento</label><select className={inputCls} value={numeradorForm.tipo_documento} onChange={(e) => setNumeradorForm({ ...numeradorForm, tipo_documento: e.target.value as NumeradorV12["tipo_documento"] })}><option value="RECIBO_COBRANZA">RECIBO_COBRANZA</option><option value="FACTURA_CONTADO">FACTURA_CONTADO</option><option value="FACTURA_CREDITO">FACTURA_CREDITO</option><option value="NOTA_CREDITO">NOTA_CREDITO</option></select></div><div><label className={labelCls}>Serie</label><input className={inputCls} value={numeradorForm.serie} onChange={(e) => setNumeradorForm({ ...numeradorForm, serie: e.target.value })} placeholder="A1" /></div><div><label className={labelCls}>Desde</label><input className={inputCls} value={numeradorForm.numero_desde} onChange={(e) => setNumeradorForm({ ...numeradorForm, numero_desde: e.target.value })} placeholder="1" /></div><div><label className={labelCls}>Hasta</label><input className={inputCls} value={numeradorForm.numero_hasta} onChange={(e) => setNumeradorForm({ ...numeradorForm, numero_hasta: e.target.value })} placeholder="9999999" /></div><div><label className={labelCls}>Último asignado</label><input className={inputCls} value={numeradorForm.ultimo_numero_asignado} onChange={(e) => setNumeradorForm({ ...numeradorForm, ultimo_numero_asignado: e.target.value })} placeholder="0" /></div><div className="md:col-span-3 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm text-blue-900"><input type="checkbox" checked={numeradorForm.activo} onChange={(e) => setNumeradorForm({ ...numeradorForm, activo: e.target.checked })} /> Activo</label><label className="flex items-center gap-2 text-sm text-blue-900"><input type="checkbox" checked={numeradorForm.bloqueado} onChange={(e) => setNumeradorForm({ ...numeradorForm, bloqueado: e.target.checked })} /> Bloqueado</label></div><div className="md:col-span-5 flex gap-2"><button disabled={saving} className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} onClick={saveNumerador}>{editingNumeradorId ? "Actualizar" : "Guardar numerador"}</button>{editingNumeradorId && <button className={`${actionBtnCls} border border-sky-200 bg-white text-blue-700 hover:bg-sky-50`} onClick={cancelNumerador}>Cancelar</button>}</div></div>
          <div className="overflow-x-auto px-6 pb-6"><table className="min-w-full text-sm"><thead><tr className="border-b border-sky-100 text-left text-blue-700"><th className="py-2">Punto</th><th>Documento</th><th>Serie</th><th>Rango</th><th>Último</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{numeradores.map((item) => <tr key={item.id} className="border-b border-sky-50 last:border-b-0"><td className="py-3">{item.establecimiento_codigo}-{item.punto_codigo}</td><td>{item.tipo_documento}</td><td>{item.serie}</td><td>{item.numero_desde} - {item.numero_hasta}</td><td>{item.ultimo_numero_asignado}</td><td>{toBool(item.activo) ? (toBool(item.bloqueado) ? "Bloqueado" : "Activo") : "Inactivo"}</td><td><div className="flex flex-wrap gap-2"><button className="text-sky-700 hover:underline" onClick={() => startEditNumerador(item)}><Pencil size={14} className="mr-1 inline" />Editar</button>{!toBool(item.bloqueado) && <button className="text-amber-700 hover:underline" onClick={() => void quickUpdateNumerador(item, { bloqueado: true })}>Bloquear</button>}{toBool(item.bloqueado) && <button className="text-emerald-700 hover:underline" onClick={() => void quickUpdateNumerador(item, { bloqueado: false, activo: true })}>Desbloquear</button>}</div></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </PanelShell>
  );
}