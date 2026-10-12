"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PanelShell from "@/components/PanelShell";
import { panelApi, horariosApi } from "@/services/api";
import type { Cobrador, HorarioCobrador, ExcepcionHorario } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";
import { Trash2, Plus } from "lucide-react";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function HorariosPage() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [selectedCobrador, setSelectedCobrador] = useState<number | null>(null);
  const [horarios, setHorarios] = useState<HorarioCobrador[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionHorario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form horario
  const [formHorario, setFormHorario] = useState({ diaSemana: "1", horaInicio: "08:00", horaFin: "17:00" });
  const [savingHorario, setSavingHorario] = useState(false);

  // Form excepción
  const [formExc, setFormExc] = useState({ fecha: "", tipo: "LIBRE", horaInicio: "", horaFin: "", motivo: "" });
  const [savingExc, setSavingExc] = useState(false);
  const [formExcError, setFormExcError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("cobrapp_user") || "{}");
      if (!["ADMIN", "SUPERVISOR"].includes(u.rol ?? "")) {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    panelApi.getCobradores().then(setCobradores).catch(() => {});
  }, []);

  const cargar = useCallback(async (cobradorId: number) => {
    setLoading(true);
    setError(null);
    try {
      const [h, e] = await Promise.all([
        horariosApi.getHorarios(cobradorId),
        horariosApi.getExcepciones(cobradorId),
      ]);
      setHorarios(h);
      setExcepciones(e);
    } catch {
      setError("Error al cargar los datos del cobrador");
    } finally {
      setLoading(false);
    }
  }, []);

  const seleccionarCobrador = (id: number) => {
    setSelectedCobrador(id);
    cargar(id);
  };

  const guardarHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCobrador) return;
    setSavingHorario(true);
    try {
      await horariosApi.guardarHorario({
        cobradorId: selectedCobrador,
        diaSemana: Number(formHorario.diaSemana),
        horaInicio: formHorario.horaInicio,
        horaFin: formHorario.horaFin,
      });
      await cargar(selectedCobrador);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Error al guardar el horario");
    } finally {
      setSavingHorario(false);
    }
  };

  const eliminarHorario = async (id: number) => {
    if (!selectedCobrador) return;
    await horariosApi.eliminarHorario(id);
    await cargar(selectedCobrador);
  };

  const guardarExcepcion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCobrador) return;
    setFormExcError(null);
    if (!formExc.fecha) { setFormExcError("La fecha es requerida"); return; }
    if (formExc.tipo === "HORARIO_ESPECIAL" && (!formExc.horaInicio || !formExc.horaFin)) {
      setFormExcError("Indica horario de inicio y fin para el horario especial"); return;
    }
    setSavingExc(true);
    try {
      await horariosApi.crearExcepcion(selectedCobrador, {
        fecha: formExc.fecha,
        tipo: formExc.tipo,
        horaInicio: formExc.horaInicio || undefined,
        horaFin: formExc.horaFin || undefined,
        motivo: formExc.motivo || undefined,
      });
      setFormExc({ fecha: "", tipo: "LIBRE", horaInicio: "", horaFin: "", motivo: "" });
      await cargar(selectedCobrador);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormExcError(msg ?? "Error al guardar la excepción");
    } finally {
      setSavingExc(false);
    }
  };

  const eliminarExcepcion = async (id: number) => {
    if (!selectedCobrador) return;
    await horariosApi.eliminarExcepcion(id);
    await cargar(selectedCobrador);
  };

  const cobrador = cobradores.find((c) => c.id === selectedCobrador);

  return (
    <PanelShell title="Horarios de cobradores" description="Configura el horario semanal y excepciones de cada cobrador">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Lista de cobradores */}
        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 uppercase tracking-wide">Cobradores</h2>
          {cobradores.length === 0 ? (
            <p className="text-xs text-slate-400">Sin cobradores</p>
          ) : (
            <ul className="space-y-1">
              {cobradores.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => seleccionarCobrador(c.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedCobrador === c.id
                        ? "bg-sky-600 text-white"
                        : "text-slate-700 hover:bg-sky-50"
                    }`}
                  >
                    {c.nombre} {c.apellido ?? ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Panel derecho */}
        <div className="space-y-6 lg:col-span-3">
          {!selectedCobrador ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-sky-200 text-slate-400">
              Selecciona un cobrador para configurar su horario
            </div>
          ) : loading ? (
            <div className="flex h-40 items-center justify-center text-slate-400">Cargando...</div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              {/* Horario semanal */}
              <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-slate-700">
                  Horario semanal — {cobrador?.nombre} {cobrador?.apellido ?? ""}
                </h2>

                {/* Tabla de horarios existentes */}
                {horarios.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                          <th className="pb-2 pr-4">Día</th>
                          <th className="pb-2 pr-4">Inicio</th>
                          <th className="pb-2 pr-4">Fin</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {horarios.map((h) => (
                          <tr key={h.id} className="border-b border-slate-50">
                            <td className="py-2 pr-4 font-medium text-slate-700">{DIAS[h.dia_semana]}</td>
                            <td className="py-2 pr-4 text-slate-600">{h.hora_inicio.slice(0, 5)}</td>
                            <td className="py-2 pr-4 text-slate-600">{h.hora_fin.slice(0, 5)}</td>
                            <td className="py-2">
                              {hasPermiso("horarios", "eliminar") && (
                                <button
                                  onClick={() => eliminarHorario(h.id)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Formulario agregar día */}
                {hasPermiso("horarios", "editar") && (
                <form onSubmit={guardarHorario} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Día</label>
                    <select
                      value={formHorario.diaSemana}
                      onChange={(e) => setFormHorario((p) => ({ ...p, diaSemana: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      {DIAS.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Inicio</label>
                    <input
                      type="time"
                      value={formHorario.horaInicio}
                      onChange={(e) => setFormHorario((p) => ({ ...p, horaInicio: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Fin</label>
                    <input
                      type="time"
                      value={formHorario.horaFin}
                      onChange={(e) => setFormHorario((p) => ({ ...p, horaFin: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingHorario}
                    className="flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    <Plus size={14} />
                    {savingHorario ? "Guardando..." : "Agregar día"}
                  </button>
                </form>
                )}
              </div>

              {/* Excepciones */}
              <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-slate-700">Excepciones de horario</h2>

                {excepciones.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                          <th className="pb-2 pr-4">Fecha</th>
                          <th className="pb-2 pr-4">Tipo</th>
                          <th className="pb-2 pr-4">Horario</th>
                          <th className="pb-2 pr-4">Motivo</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {excepciones.map((ex) => (
                          <tr key={ex.id} className="border-b border-slate-50">
                            <td className="py-2 pr-4 font-medium text-slate-700">{ex.fecha}</td>
                            <td className="py-2 pr-4">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                ex.tipo === "LIBRE"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}>
                                {ex.tipo === "LIBRE" ? "Libre" : "Especial"}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-slate-500 text-xs">
                              {ex.tipo === "HORARIO_ESPECIAL" && ex.hora_inicio && ex.hora_fin
                                ? `${ex.hora_inicio.slice(0, 5)} – ${ex.hora_fin.slice(0, 5)}`
                                : "—"}
                            </td>
                            <td className="py-2 pr-4 text-slate-500">{ex.motivo ?? "—"}</td>
                            <td className="py-2">
                              {hasPermiso("horarios", "eliminar") && (
                                <button
                                  onClick={() => eliminarExcepcion(ex.id)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {hasPermiso("horarios", "editar") && (
                <form onSubmit={guardarExcepcion} className="space-y-3">
                  {formExcError && (
                    <p className="text-sm text-red-600">{formExcError}</p>
                  )}
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Fecha</label>
                      <input
                        type="date"
                        value={formExc.fecha}
                        onChange={(e) => setFormExc((p) => ({ ...p, fecha: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Tipo</label>
                      <select
                        value={formExc.tipo}
                        onChange={(e) => setFormExc((p) => ({ ...p, tipo: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <option value="LIBRE">Día libre</option>
                        <option value="HORARIO_ESPECIAL">Horario especial</option>
                      </select>
                    </div>
                    {formExc.tipo === "HORARIO_ESPECIAL" && (
                      <>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Inicio</label>
                          <input
                            type="time"
                            value={formExc.horaInicio}
                            onChange={(e) => setFormExc((p) => ({ ...p, horaInicio: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Fin</label>
                          <input
                            type="time"
                            value={formExc.horaFin}
                            onChange={(e) => setFormExc((p) => ({ ...p, horaFin: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex-1 min-w-40">
                      <label className="mb-1 block text-xs text-slate-500">Motivo (opcional)</label>
                      <input
                        type="text"
                        value={formExc.motivo}
                        onChange={(e) => setFormExc((p) => ({ ...p, motivo: e.target.value }))}
                        placeholder="Ej: Feriado nacional"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingExc}
                      className="flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      <Plus size={14} />
                      {savingExc ? "Guardando..." : "Agregar excepción"}
                    </button>
                  </div>
                </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
