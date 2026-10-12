"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Map, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";

import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { panelApi } from "@/services/api";
import type { Zona, Cobrador, PoligonoPoint } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

const MapPolygonPicker = dynamic(() => import("@/components/MapPolygonPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-400">
      Cargando mapa…
    </div>
  ),
});

const COLORES_PRESET = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  color: "#3B82F6",
  cobrador_id: "" as number | "",
  poligono: [] as PoligonoPoint[],
};

export default function Zonas() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reasignandoId, setReasignandoId] = useState<number | null>(null);
  const [activandoId, setActivandoId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmReasignar, setConfirmReasignar] = useState<Zona | null>(null);
  const [reasignarResult, setReasignarResult] = useState<{ zonaId: number; asignadas: number; reasignadas: number; clientesUbicados: number } | null>(null);
  const [reasignarAlGuardar, setReasignarAlGuardar] = useState(false);
  const [desactivarResult, setDesactivarResult] = useState<{ clientesDesasignados: number; cuotasDesasignadas: number } | null>(null);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 12;

  const zonasActivas = useMemo(
    () => zonas.filter((z) => Number(z.estado) === 1),
    [zonas]
  );

  const cobradoresOcupados = useMemo(() => {
    const usados = new Set<number>();
    zonasActivas.forEach((z) => {
      if (z.cobrador_id && z.id !== editingId) usados.add(Number(z.cobrador_id));
    });
    return usados;
  }, [zonasActivas, editingId]);

  const cobradoresDisponibles = useMemo(() => {
    return cobradores.filter((c) => {
      if (form.cobrador_id !== "" && c.id === Number(form.cobrador_id)) return true;
      return !cobradoresOcupados.has(c.id);
    });
  }, [cobradores, cobradoresOcupados, form.cobrador_id]);

  const totalPaginas = Math.max(1, Math.ceil(zonas.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const zonasPagina = zonas.slice(
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
    } catch {
      setError("No se pudo leer la sesión del usuario");
    }
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [zonasData, cobradoresData] = await Promise.all([
        panelApi.getZonas(),
        panelApi.getCobradores(),
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
  }, [router]);

  useEffect(() => { void cargar(); }, [cargar]);

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setReasignarAlGuardar(false);
    setShowForm(true);
  }

  function openEdit(z: Zona) {
    setEditingId(z.id);
    setForm({
      nombre: z.nombre,
      descripcion: z.descripcion ?? "",
      color: z.color ?? "#3B82F6",
      cobrador_id: z.cobrador_id ?? "",
      poligono: (z.poligono as PoligonoPoint[]) ?? [],
    });
    setFormError(null);
    setReasignarAlGuardar(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError(null);
    const nombreNormalizado = form.nombre.trim();
    if (!nombreNormalizado) { setFormError("El nombre es obligatorio"); return; }

    const zonaConMismoNombre = zonasActivas.find(
      (z) => z.id !== editingId && z.nombre.trim().toLowerCase() === nombreNormalizado.toLowerCase()
    );
    if (zonaConMismoNombre) {
      setFormError("Ya existe una zona activa con ese nombre");
      return;
    }

    if (form.cobrador_id !== "") {
      const zonaConMismoCobrador = zonasActivas.find(
        (z) => z.id !== editingId && Number(z.cobrador_id) === Number(form.cobrador_id)
      );
      if (zonaConMismoCobrador) {
        setFormError("Ese cobrador ya esta asignado a otra zona activa");
        return;
      }
    }

    const poligono: PoligonoPoint[] | null =
      form.poligono.length >= 3 ? form.poligono : null;

    const payload = {
      nombre: nombreNormalizado,
      descripcion: form.descripcion.trim() || null,
      color: form.color,
      cobrador_id: form.cobrador_id !== "" ? Number(form.cobrador_id) : null,
      poligono,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await panelApi.updateZona(editingId, payload);
        // Si el usuario marcó "reasignar al guardar", reasignar las cuotas de la zona
        if (reasignarAlGuardar) {
          const resp = await panelApi.reasignarZona(editingId);
          setReasignarResult({
            zonaId: editingId,
            asignadas: resp.data?.asignadas ?? 0,
            reasignadas: resp.data?.reasignadas ?? 0,
            clientesUbicados: resp.data?.clientesUbicados ?? 0,
          });
        }
      } else {
        await panelApi.createZona(payload);
      }
      setShowForm(false);
      void cargar();
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setFormError(apiError.message ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: number) {
    setConfirmDelete(id);
  }

  async function ejecutarActivar(id: number) {
    setActivandoId(id);
    try {
      await panelApi.updateZona(id, { estado: 1 });
      void cargar();
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "No se pudo activar la zona");
    } finally {
      setActivandoId(null);
    }
  }

  async function ejecutarDelete() {
    if (confirmDelete === null) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    try {
      const resp = await panelApi.deleteZona(id);
      setDesactivarResult({
        clientesDesasignados: resp.data?.clientesDesasignados ?? 0,
        cuotasDesasignadas: resp.data?.cuotasDesasignadas ?? 0,
      });
      void cargar();
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "No se pudo desactivar la zona");
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

  return (
    <PanelShell title="Zonas" description="Definí zonas geográficas y asigná cobradores">
      <div className="space-y-6">

        {/* ── Acciones superiores ── */}
        <div className="flex flex-wrap items-center gap-3">
          {hasPermiso("zonas", "crear") && (
            <button
              onClick={openNew}
              className="rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:from-cyan-700 hover:to-blue-700 transition"
            >
              + Nueva zona
            </button>
          )}
        </div>

        {/* ── Resultado reasignación ── */}
        {reasignarResult && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 flex items-center gap-1">
            <CheckCircle2 size={14} className="shrink-0" /> Zona reasignada:{" "}
            <strong>{reasignarResult.asignadas}</strong> nueva(s) ·{" "}
            <strong>{reasignarResult.reasignadas}</strong> reasignada(s) ·{" "}
            <strong>{reasignarResult.clientesUbicados}</strong> cliente(s) ubicados
          </div>
        )}

        {/* ── Resultado desactivación ── */}
        {desactivarResult && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Zona desactivada. Se desasignaron:</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                <li>
                  <strong>{desactivarResult.clientesDesasignados}</strong> cliente(s) sin zona asignada
                </li>
                <li>
                  <strong>{desactivarResult.cuotasDesasignadas}</strong> cuota(s) sin cobrador asignado
                </li>
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-amber-600">
                  Podés verlos en la sección "No asignados" de la página de Asignaciones.
                </p>
                <button
                  onClick={() => router.push("/asignaciones")}
                  className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                >
                  Ir
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <p className="text-blue-700">Cargando zonas…</p>}
        {error   && <p className="text-red-600">{error}</p>}

        {/* ── Lista de zonas ── */}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zonas.length === 0 && (
              <p className="col-span-full text-sm text-blue-400">No hay zonas creadas aún.</p>
            )}
            {zonasPagina.map((z) => {
              const inactiva = Number(z.estado) === 0;
              return (
                <div
                  key={z.id}
                  className={`rounded-xl border bg-white p-5 shadow-sm ${
                    inactiva ? "border-gray-200 opacity-70" : "border-sky-200"
                  }`}
                  style={{ borderLeftColor: z.color, borderLeftWidth: 4 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-semibold ${inactiva ? "text-gray-500" : "text-blue-900"}`}>
                        {z.nombre}
                      </p>
                      {z.descripcion && <p className="mt-0.5 text-xs text-blue-500">{z.descripcion}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-white shadow"
                        style={{ backgroundColor: z.color }}
                      />
                      {inactiva && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                          Inactiva
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-blue-600">
                    <p>
                      <User size={11} className="inline mr-1" />Cobrador:{" "}
                      <span className={z.cobrador_nombre?.trim() ? "font-medium" : "text-blue-300"}>
                        {z.cobrador_nombre?.trim() || "Sin asignar"}
                      </span>
                    </p>
                    <p>
                      <Map size={11} className="inline mr-1" />Polígono:{" "}
                      <span className={z.poligono ? "text-emerald-600" : "text-blue-300"}>
                        {z.poligono ? `${(z.poligono as PoligonoPoint[]).length} puntos` : "No definido"}
                      </span>
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {inactiva ? (
                      hasPermiso("zonas", "editar") && (
                        <button
                          onClick={() => ejecutarActivar(z.id)}
                          disabled={activandoId === z.id}
                          className="flex-1 rounded-md border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 transition"
                        >
                          {activandoId === z.id ? "Activando…" : "Activar"}
                        </button>
                      )
                    ) : (
                      <>
                        {hasPermiso("zonas", "editar") && (
                          <button
                            onClick={() => openEdit(z)}
                            className="flex-1 rounded-md border border-sky-300 py-1.5 text-xs font-medium text-blue-700 hover:bg-sky-50 transition"
                          >
                            Editar
                          </button>
                        )}
                        {hasPermiso("zonas", "editar") && (
                          <button
                            onClick={() => handleReasignarZona(z)}
                            disabled={reasignandoId === z.id || !z.cobrador_id || !z.poligono}
                            className="flex-1 rounded-md border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 transition"
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
                              <><RefreshCw size={12} className="inline mr-1" />Reasignar</>
                            )}
                          </button>
                        )}
                        {hasPermiso("zonas", "eliminar") && (
                          <button
                            onClick={() => handleDelete(z.id)}
                            className="flex-1 rounded-md border border-red-200 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                          >
                            Desactivar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
      </div>

      {/* ── Modal formulario ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-blue-900">
              {editingId ? "Editar zona" : "Nueva zona"}
            </h3>

            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Ej: Zona Norte"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full rounded-lg border border-sky-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Color */}
              <div>
                <label className="mb-2 block text-sm font-medium text-blue-900">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_PRESET.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        form.color === c ? "border-blue-900 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Cobrador */}
              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">Cobrador asignado</label>
                <select
                  value={form.cobrador_id}
                  onChange={(e) => setForm({ ...form, cobrador_id: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Sin asignar</option>
                  {cobradoresDisponibles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido ?? ""}
                    </option>
                  ))}
                </select>
                {cobradoresDisponibles.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No hay cobradores disponibles: cada cobrador activo ya tiene una zona.
                  </p>
                )}
              </div>

              {/* Reasignar al guardar (solo al editar) */}
              {editingId && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reasignarAlGuardar}
                      onChange={(e) => setReasignarAlGuardar(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-emerald-800">
                      <strong>Reasignar cuotas al guardar</strong>
                      <span className="block text-xs text-emerald-600 mt-0.5">
                        Reasigna las cuotas de los clientes dentro del nuevo polígono al cobrador de esta zona.
                        Útil si el cobrador tiene demasiados clientes o cambiaste los límites de la zona.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Polígono — mapa interactivo */}
              <div>
                <label className="mb-2 block text-sm font-medium text-blue-900">
                  Polígono de la zona
                </label>
                <MapPolygonPicker
                  value={form.poligono}
                  onChange={(pts) => setForm({ ...form, poligono: pts })}
                  color={form.color}
                />
              </div>

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-sky-300 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:from-cyan-700 hover:to-blue-700 transition"
              >
                {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Crear zona"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de desactivar zona ── */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Desactivar zona"
        message="¿Desactivar esta zona? Se desasignarán los clientes y las cobranzas pendientes de esta zona."
        confirmLabel="Desactivar"
        tone="danger"
        onConfirm={ejecutarDelete}
        onCancel={() => setConfirmDelete(null)}
      />

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
