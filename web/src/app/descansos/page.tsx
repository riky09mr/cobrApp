"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Coffee, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { descansosApi, panelApi } from "@/services/api";
import type { TipoDescanso, DescansoReporte, Cobrador } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

const EMPTY_FORM = {
  nombre: "",
  esObligatorio: false,
  horaInicio: "",
  horaFinAuto: "",
};

export default function Descansos() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [tab, setTab] = useState<"tipos" | "reporte">("tipos");

  const [tipos, setTipos] = useState<TipoDescanso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDesactivar, setConfirmDesactivar] = useState<{ id: number; nombre: string } | null>(null);

  const [userRol, setUserRol] = useState<string>("");

  // Reporte
  const [reporte, setReporte] = useState<DescansoReporte[]>([]);
  const [reporteLoading, setReporteLoading] = useState(false);
  const [reporteError, setReporteError] = useState<string | null>(null);
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [filtroCobradorId, setFiltroCobradorId] = useState<string>("");
  const [filtroFecha, setFiltroFecha] = useState<string>("");

  // Paginación del reporte
  const [paginaReporte, setPaginaReporte] = useState(1);
  const POR_PAGINA_REPORTE = 15;

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("cobrapp_user") || "{}");
      const rol = u.rol ?? "";
      setUserRol(rol);
      if (rol !== "ADMIN" && rol !== "SUPERVISOR") {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const cargarTipos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await descansosApi.getTipos();
      setTipos(data);
    } catch {
      setError("Error al cargar los tipos de descanso");
    } finally {
      setLoading(false);
    }
  };

  const cargarReporte = useCallback(async () => {
    setReporteLoading(true);
    setReporteError(null);
    try {
      const [data, cobs] = await Promise.all([
        descansosApi.getReporte({
          cobradorId: filtroCobradorId ? Number(filtroCobradorId) : undefined,
          fecha: filtroFecha || undefined,
        }),
        panelApi.getCobradores(),
      ]);
      setReporte(data);
      setCobradores(cobs);
      setPaginaReporte(1);
    } catch {
      setReporteError("Error al cargar el reporte");
    } finally {
      setReporteLoading(false);
    }
  }, [filtroCobradorId, filtroFecha]);

  useEffect(() => {
    cargarTipos();
  }, []);

  useEffect(() => {
    if (tab === "reporte") cargarReporte();
  }, [tab, cargarReporte]);

  const abrirNuevo = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowForm(true);
  };

  const abrirEditar = (t: TipoDescanso) => {
    setEditingId(t.id);
    setForm({
      nombre: t.nombre,
      esObligatorio: Boolean(t.es_obligatorio),
      horaInicio: t.hora_inicio ?? "",
      horaFinAuto: t.hora_fin_auto ?? "",
    });
    setFormError(null);
    setShowForm(true);
  };

  const cancelar = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setFormError("El nombre es requerido");
      return;
    }
    if (form.esObligatorio && form.horaFinAuto && !form.horaInicio) {
      setFormError("Si el descanso es obligatorio con hora de activación automática, también debes definir la hora de inicio.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        esObligatorio: form.esObligatorio,
        horaInicio: form.horaInicio || null,
        horaFinAuto: form.horaFinAuto || null,
      };

      if (editingId) {
        await descansosApi.editarTipo(editingId, payload);
      } else {
        await descansosApi.crearTipo(payload);
      }

      await cargarTipos();
      cancelar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const desactivar = (id: number, nombre: string) => {
    setConfirmDesactivar({ id, nombre });
  };

  const ejecutarDesactivar = async () => {
    if (!confirmDesactivar) return;
    const { id } = confirmDesactivar;
    setConfirmDesactivar(null);
    try {
      await descansosApi.desactivarTipo(id);
      await cargarTipos();
    } catch {
      alert("Error al desactivar");
    }
  };

  const canEdit = hasPermiso("descansos", "editar");

  const totalPaginasReporte = Math.max(1, Math.ceil(reporte.length / POR_PAGINA_REPORTE));
  const paginaReporteSegura = Math.min(paginaReporte, totalPaginasReporte);
  const reportePagina = reporte.slice(
    (paginaReporteSegura - 1) * POR_PAGINA_REPORTE,
    paginaReporteSegura * POR_PAGINA_REPORTE
  );

  const formatDuracion = (min: number | null) => {
    if (min === null) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <PanelShell
      title="Descansos"
      description="Configura los tipos de descanso y consulta el reporte de tu equipo."
    >
      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("tipos")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "tipos"
              ? "border-sky-600 text-sky-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Tipos de descanso
        </button>
        {hasPermiso("descansos", "editar") && (
          <button
            onClick={() => setTab("reporte")}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === "reporte"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Reporte de descansos
          </button>
        )}
      </div>
      {/* ── Tab: Tipos de descanso ── */}
      {tab === "tipos" && (<>
      {/* ── Encabezado ── */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {tipos.length} tipo{tipos.length !== 1 ? "s" : ""} configurado{tipos.length !== 1 ? "s" : ""}
        </p>
        {canEdit && (
          <button
            onClick={abrirNuevo}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            + Nuevo tipo
          </button>
        )}
      </div>

      {/* ── Error global ── */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Formulario ── */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="mb-4 text-base font-semibold text-sky-800">
            {editingId ? "Editar tipo de descanso" : "Nuevo tipo de descanso"}
          </h3>
          <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Almuerzo, Sanitario, Combustible"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* ¿Obligatorio? */}
            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="esObligatorio"
                type="checkbox"
                checked={form.esObligatorio}
                onChange={(e) => setForm({ ...form, esObligatorio: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-sky-600"
              />
              <label htmlFor="esObligatorio" className="text-sm text-gray-700">
                Descanso obligatorio (el sistema puede activarlo automáticamente)
              </label>
            </div>

            {/* Hora inicio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Hora de inicio permitida
              </label>
              <input
                type="time"
                value={form.horaInicio}
                onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Desde cuándo puede activarse (ej: 11:00)</p>
            </div>

            {/* Hora fin auto */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Hora de activación automática
              </label>
              <input
                type="time"
                value={form.horaFinAuto}
                onChange={(e) => setForm({ ...form, horaFinAuto: e.target.value })}
                disabled={!form.esObligatorio}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                Si el cobrador no lo activó a esta hora, el sistema lo activa solo (ej: 14:30)
              </p>
            </div>

            {/* Error de formulario */}
            {formError && (
              <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Crear tipo"}
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Lista ── */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando…</div>
      ) : tipos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-400">No hay tipos de descanso configurados.</p>
          {canEdit && (
            <button
              onClick={abrirNuevo}
              className="mt-3 text-sm text-sky-600 hover:underline"
            >
              + Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Obligatorio</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Hora inicio</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Activación auto</th>
                {canEdit && (
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {tipos.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Coffee size={14} className="mr-2 inline text-amber-700" />
                    {t.nombre}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.es_obligatorio ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Sí
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {t.hora_inicio ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {t.hora_fin_auto ?? <span className="text-gray-400">—</span>}
                  </td>
                  {(hasPermiso("descansos", "editar") || hasPermiso("descansos", "eliminar")) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {hasPermiso("descansos", "editar") && (
                          <button
                            onClick={() => abrirEditar(t)}
                            className="rounded px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
                          >
                            Editar
                          </button>
                        )}
                        {hasPermiso("descansos", "eliminar") && (
                          <button
                            onClick={() => desactivar(t.id, t.nombre)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Info del cron ── */}
      <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <strong><Info size={14} className="inline mr-1" />Activación automática del almuerzo:</strong> El sistema activa automáticamente
        los descansos obligatorios a la hora de &quot;Activación auto&quot; configurada, para los cobradores
        que no lo hayan iniciado manualmente. El cron corre a las 14:30 (hora Paraguay).
      </div>
      </>)}

      {/* ── Tab: Reporte de descansos ── */}
      {tab === "reporte" && (
        <div>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Cobrador</label>
              <select
                value={filtroCobradorId}
                onChange={(e) => setFiltroCobradorId(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">Todos</option>
                {cobradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido ?? ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Fecha</label>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <button
              onClick={cargarReporte}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Filtrar
            </button>
            {(filtroCobradorId || filtroFecha) && (
              <button
                onClick={() => { setFiltroCobradorId(""); setFiltroFecha(""); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Limpiar
              </button>
            )}
          </div>

          {reporteError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{reporteError}</div>
          )}

          {reporteLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
          ) : reporte.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-gray-400 text-sm">
              No hay descansos finalizados con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <p className="px-4 pt-3 text-xs text-gray-400">
                Mostrando {reportePagina.length} de {reporte.length} registros
              </p>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Cobrador</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Inicio</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Fin</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Duración</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Auto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportePagina.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {r.cobrador_nombre} {r.cobrador_apellido ?? ""}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.tipo_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{r.fecha}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(r.hora_inicio_real).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(r.hora_fin_real).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          (r.duracion_minutos ?? 0) > 60
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {formatDuracion(r.duracion_minutos)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.activado_auto ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Auto</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Manual</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPaginasReporte > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                  <button
                    onClick={() => setPaginaReporte((p) => Math.max(1, p - 1))}
                    disabled={paginaReporteSegura <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {paginaReporteSegura} de {totalPaginasReporte}
                  </span>
                  <button
                    onClick={() => setPaginaReporte((p) => Math.min(totalPaginasReporte, p + 1))}
                    disabled={paginaReporteSegura >= totalPaginasReporte}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Confirmación de desactivación ── */}
      <ConfirmDialog
        open={!!confirmDesactivar}
        title="Desactivar tipo de descanso"
        message={`¿Desactivar el tipo de descanso "${confirmDesactivar?.nombre ?? ""}"?`}
        confirmLabel="Desactivar"
        tone="danger"
        onConfirm={ejecutarDesactivar}
        onCancel={() => setConfirmDesactivar(null)}
      />
    </PanelShell>
  );
}
