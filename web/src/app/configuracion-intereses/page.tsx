"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarX2, Check, ChevronDown, Cross, Percent, Pencil, Plus, RefreshCcw, Save, ShieldAlert, Trash2, X } from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";
import {
  panelApi,
  interesesConfigApi,
  type Empresa,
  type EmpresaInteresesConfig,
  type FeriadoEmpresa,
} from "@/services/api";

const sectionCls = "rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden";
const inputCls = "w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
const labelCls = "mb-1 block text-xs font-medium text-blue-800";
const actionBtnCls = "rounded-lg px-3 py-2 text-sm font-medium transition";

const toBool = (value: boolean | number | null | undefined) => value === true || value === 1;
const parseApiError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const EMPTY_CONFIG: EmpresaInteresesConfig = {
  empresa_id: 0,
  generar_interes: false,
  dias_gracia: 0,
  porcentaje_interes_diario: 0,
  contar_domingos: false,
  contar_feriados: false,
};

export default function ConfiguracionInteresesPage() {
  useAuth();
  const { hasPermiso } = usePermisos();

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [config, setConfig] = useState<EmpresaInteresesConfig>(EMPTY_CONFIG);
  const [feriados, setFeriados] = useState<FeriadoEmpresa[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevaAplicarTodas, setNuevaAplicarTodas] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editFecha, setEditFecha] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editAplicarTodas, setEditAplicarTodas] = useState(false);

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
  }, []);

  const withEmpresa = <T extends Record<string, unknown>>(payload: T) =>
    isAdmin ? { ...payload, empresa_id: selectedEmpresaId } : payload;

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
    try {
      const { config: cfg, feriados: fer } = await interesesConfigApi.getConfiguracion(empresaId);
      setConfig({
        ...EMPTY_CONFIG,
        ...cfg,
        generar_interes: toBool(cfg.generar_interes),
        contar_domingos: toBool(cfg.contar_domingos),
        contar_feriados: toBool(cfg.contar_feriados),
      });
      setFeriados(fer);
    } catch (err: unknown) {
      setError(parseApiError(err, "No se pudo cargar la configuración de intereses"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmpresaId) void cargarTodo(selectedEmpresaId);
  }, [selectedEmpresaId, cargarTodo]);

  const saveConfig = async () => {
    if (!selectedEmpresaId) return;
    setSaving(true);
    try {
      await interesesConfigApi.updateConfiguracion(
        withEmpresa({
          generar_interes: config.generar_interes ? 1 : 0,
          dias_gracia: Number(config.dias_gracia) || 0,
          porcentaje_interes_diario: Number(config.porcentaje_interes_diario) || 0,
          contar_domingos: config.contar_domingos ? 1 : 0,
          contar_feriados: config.contar_feriados ? 1 : 0,
        })
      );
      notifySuccess("Configuración de intereses guardada.");
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const agregarFeriado = async () => {
    if (!selectedEmpresaId) return;
    if (!nuevaFecha) {
      setError("Selecciona una fecha para el feriado.");
      return;
    }
    setSaving(true);
    try {
      const resp = await interesesConfigApi.crearFeriado(
        withEmpresa({
          fecha: nuevaFecha,
          descripcion: nuevaDescripcion.trim() || undefined,
          aplicar_a_todas: nuevaAplicarTodas,
        })
      );
      notifySuccess(resp.message || "Feriado agregado.");
      setNuevaFecha("");
      setNuevaDescripcion("");
      setNuevaAplicarTodas(false);
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo agregar el feriado");
    } finally {
      setSaving(false);
    }
  };

  const eliminarFeriado = async (feriado: FeriadoEmpresa) => {
    if (!selectedEmpresaId) return;
    setSaving(true);
    try {
      await interesesConfigApi.eliminarFeriado(feriado.id, selectedEmpresaId);
      notifySuccess(`Feriado ${feriado.fecha} eliminado.`);
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo eliminar el feriado");
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicion = (feriado: FeriadoEmpresa) => {
    setEditandoId(feriado.id);
    setEditFecha(feriado.fecha);
    setEditDescripcion(feriado.descripcion ?? "");
    setEditAplicarTodas(false);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditFecha("");
    setEditDescripcion("");
    setEditAplicarTodas(false);
  };

  const guardarEdicion = async () => {
    if (!selectedEmpresaId || editandoId === null) return;
    if (!editFecha) {
      setError("Selecciona una fecha para el feriado.");
      return;
    }
    setSaving(true);
    try {
      const resp = await interesesConfigApi.actualizarFeriado(
        editandoId,
        withEmpresa({
          fecha: editFecha,
          descripcion: editDescripcion.trim() || undefined,
          aplicar_a_todas: editAplicarTodas,
        })
      );
      notifySuccess(resp.message || "Feriado actualizado.");
      cancelarEdicion();
      await cargarTodo(selectedEmpresaId);
    } catch (err: unknown) {
      handleFailure(err, "No se pudo actualizar el feriado");
    } finally {
      setSaving(false);
    }
  };

  const recalcular = async () => {
    if (!selectedEmpresaId) return;
    setSaving(true);
    try {
      const response = await interesesConfigApi.recalcular(withEmpresa({}));
      notifySuccess(
        `Intereses recalculados: ${response.data.procesadas} cuotas procesadas, ${response.data.actualizadas} actualizadas.`
      );
    } catch (err: unknown) {
      handleFailure(err, "No se pudo recalcular los intereses");
    } finally {
      setSaving(false);
    }
  };

  const feriadosOrdenados = [...feriados].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const interesActivo = toBool(config.generar_interes);
  const decretoCount = feriados.filter((f) => f.origen === "DECRETO").length;

  return (
    <PanelShell
      title={isAdmin ? "Feriados" : "Configuración de Intereses"}
      description={
        isAdmin
          ? "Configura los feriados locales de la empresa: fijos, Semana Santa y feriados por decreto presidencial."
          : "Define los días de luz y el interés por mora de cada empresa (generación, días de gracia, porcentaje diario, domingos y feriados)."
      }
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

        <section className={`grid gap-4 ${isAdmin ? "md:grid-cols-1 md:max-w-xs" : "md:grid-cols-3"}`}>
          {!isAdmin && (
            <>
              <div className={`rounded-xl border px-5 py-4 shadow-sm ${interesActivo ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Interés por mora</p>
                <p className="mt-2 text-lg font-bold text-blue-900">{interesActivo ? "Activo" : "Desactivado"}</p>
                <p className="mt-1 text-xs text-slate-500">La empresa {interesActivo ? "genera" : "no genera"} intereses.</p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-500">Días de luz</p>
                <p className="mt-2 text-lg font-bold text-blue-900">{Number(config.dias_gracia) || 0}</p>
                <p className="mt-1 text-xs text-slate-500">Después del vencimiento, sin interés.</p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-500">Interés diario</p>
                <p className="mt-2 text-lg font-bold text-blue-900">{Number(config.porcentaje_interes_diario) || 0}%</p>
                <p className="mt-1 text-xs text-slate-500">Por día de retraso, sobre saldo.</p>
              </div>
            </>
          )}
          {isAdmin && (
            <div className="rounded-xl border border-sky-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-500">Feriados locales</p>
              <p className="mt-2 text-lg font-bold text-blue-900">{feriados.length}</p>
              <p className="mt-1 text-xs text-slate-500">Registrados para la empresa.</p>
            </div>
          )}
        </section>

        {error && <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">{error}</div>}
        {success && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-sm rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-xl">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Check size={22} className="text-emerald-600" />
              </div>
              <p className="text-sm text-blue-900">{success}</p>
              <button
                className={`${actionBtnCls} mt-5 w-full bg-sky-600 text-white hover:bg-sky-700`}
                onClick={() => setSuccess(null)}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
        {loading && <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-700">Cargando configuración…</div>}

        {!isAdmin && (
        <section className={sectionCls}>
          <div className="flex items-center gap-2 border-b border-sky-100 px-6 py-4">
            <Percent size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-blue-900">Reglas de generación de intereses</h2>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-blue-900">
                <input type="checkbox" checked={interesActivo} onChange={(e) => setConfig({ ...config, generar_interes: e.target.checked })} />
                Generar interés por mora para esta empresa
              </label>
              <p className="mt-1 text-xs text-slate-500">Si está desactivado, las cuotas vencidas no acumulan intereses y los acumulados anteriores se limpian al recalcular.</p>
            </div>
            <div>
              <label className={labelCls}>Días de luz (gracia)</label>
              <input type="number" min={0} className={inputCls} value={Number(config.dias_gracia) || 0}
                onChange={(e) => setConfig({ ...config, dias_gracia: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-slate-500">Días después del vencimiento en los que no corre interés.</p>
            </div>
            <div>
              <label className={labelCls}>% interés por día de retraso</label>
              <input type="number" min={0} max={100} step={0.01} className={inputCls} value={Number(config.porcentaje_interes_diario) || 0}
                onChange={(e) => setConfig({ ...config, porcentaje_interes_diario: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-slate-500">Porcentaje diario aplicado sobre el saldo de la cuota.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-blue-900">
              <input type="checkbox" checked={toBool(config.contar_domingos)} onChange={(e) => setConfig({ ...config, contar_domingos: e.target.checked })} />
              Contar los domingos como días de retraso
            </label>
            <label className="flex items-center gap-2 text-sm text-blue-900">
              <input type="checkbox" checked={toBool(config.contar_feriados)} onChange={(e) => setConfig({ ...config, contar_feriados: e.target.checked })} />
              Contar los feriados como días de retraso
            </label>
            <div className="flex items-end md:col-span-2">
              {hasPermiso("configuracion", "editar") && (
                <button disabled={saving} className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} onClick={saveConfig}>
                  <Save size={15} className="mr-1 inline" />Guardar configuración
                </button>
              )}
              {hasPermiso("configuracion", "intereses") && (
                <button disabled={saving} className={`${actionBtnCls} ml-2 border border-sky-200 bg-white text-blue-700 hover:bg-sky-50 disabled:opacity-50`} onClick={recalcular}>
                  <RefreshCcw size={15} className="mr-1 inline" />Recalcular intereses
                </button>
              )}
            </div>
          </div>
        </section>
        )}

        {isAdmin && (
        <section className={sectionCls}>
          <div className="flex items-center gap-2 border-b border-sky-100 px-6 py-4">
            <CalendarX2 size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-blue-900">Feriados locales de la empresa</h2>
          </div>
          <div className="border-b border-sky-100 bg-sky-50 px-6 py-3 text-xs leading-relaxed text-sky-800">
            Al comenzar cada año, los feriados vuelven a sus fechas originales y la Semana Santa se recalcula
            automáticamente. También se pueden agregar hasta <strong>2 feriados por decreto presidencial</strong>,
            y solo esos se pueden eliminar.
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
            <div>
              <label className={labelCls}>Fecha</label>
              <input type="date" className={inputCls} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Descripción (opcional)</label>
              <input className={inputCls} value={nuevaDescripcion} onChange={(e) => setNuevaDescripcion(e.target.value)} placeholder="Ej: Día de la Virgen de Caacupé" />
            </div>
            <div className="flex items-end">
              <button
                disabled={saving || decretoCount >= 2}
                className={`${actionBtnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`}
                onClick={agregarFeriado}
              >
                <Plus size={15} className="mr-1 inline" />Agregar feriado por decreto ({decretoCount}/2)
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-blue-900 md:col-span-4">
              <input type="checkbox" checked={nuevaAplicarTodas} onChange={(e) => setNuevaAplicarTodas(e.target.checked)} />
              Aplicar a todas las empresas
            </label>
          </div>
          <div className="overflow-x-auto px-6 pb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-sky-100 text-left text-blue-700">
                  <th className="py-2">Fecha</th>
                  <th>Descripción</th>
                  <th>Origen</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {feriadosOrdenados.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">Sin feriados registrados.</td></tr>
                )}
                {feriadosOrdenados.map((item) => {
                  const esSemanaSanta = item.origen === "jueves_santo" || item.origen === "viernes_santo";
                  const esDecreto = item.origen === "DECRETO";
                  const editando = editandoId === item.id;
                  return (
                    <tr key={item.id} className="border-b border-sky-50 text-slate-700 last:border-b-0">
                      <td className="py-3 font-medium text-blue-900">
                        {editando ? (
                          <input type="date" className={`${inputCls} max-w-37.5`} value={editFecha} onChange={(e) => setEditFecha(e.target.value)} />
                        ) : (
                          (item.fecha || "").slice(0, 10)
                        )}
                      </td>
                      <td>
                        {editando ? (
                          <input className={`${inputCls} max-w-65`} value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} placeholder="Descripción (opcional)" />
                        ) : item.descripcion ? (
                          item.descripcion
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        {esSemanaSanta ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                            <Cross size={11} className="inline" />
                            Semana Santa
                          </span>
                        ) : esDecreto ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Decreto</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Fijo</span>
                        )}
                      </td>
                      <td>
                        {editando ? (
                          <span className="flex flex-col gap-1">
                            <span className="flex items-center gap-3">
                              <button className="text-emerald-600 hover:underline" onClick={() => void guardarEdicion()}>
                                <Check size={14} className="mr-1 inline" />Guardar
                              </button>
                              <button className="text-slate-500 hover:underline" onClick={cancelarEdicion}>
                                <X size={14} className="mr-1 inline" />Cancelar
                              </button>
                            </span>
                            <label className="flex items-center gap-1.5 text-xs text-blue-900">
                              <input type="checkbox" checked={editAplicarTodas} onChange={(e) => setEditAplicarTodas(e.target.checked)} />
                              Aplicar a todas las empresas
                            </label>
                          </span>
                        ) : (
                          <span className="flex items-center gap-3">
                            {!esSemanaSanta && (
                              <button className="text-blue-600 hover:underline" onClick={() => iniciarEdicion(item)}>
                                <Pencil size={14} className="mr-1 inline" />Editar
                              </button>
                            )}
                            {esDecreto && (
                              <button className="text-red-600 hover:underline" onClick={() => void eliminarFeriado(item)}>
                                <Trash2 size={14} className="mr-1 inline" />Eliminar
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </PanelShell>
  );
}
