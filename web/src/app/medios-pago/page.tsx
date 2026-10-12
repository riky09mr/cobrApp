"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { mediosPagoApi } from "@/services/api";
import type { MedioPago } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

const EMPTY_FORM = { nombre: "", requiere_comprobante: false };

export default function MediosPagoPage() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [medios, setMedios] = useState<MedioPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ medio: MedioPago; accion: string } | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("cobrapp_user") || "{}");
      const rol = u.rol ?? "";
      if (rol !== "ADMIN" && rol !== "SUPERVISOR") {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const cargar = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mediosPagoApi.getAll();
      setMedios(data);
    } catch {
      setError("Error al cargar los métodos de pago");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowForm(true);
  };

  const abrirEditar = (m: MedioPago) => {
    setEditingId(m.id);
    setForm({ nombre: m.nombre, requiere_comprobante: Boolean(m.requiere_comprobante) });
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
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        await mediosPagoApi.actualizar(editingId, {
          nombre: form.nombre.trim(),
          requiere_comprobante: form.requiere_comprobante,
        });
      } else {
        await mediosPagoApi.crear({
          nombre: form.nombre.trim(),
          requiere_comprobante: form.requiere_comprobante,
        });
      }
      await cargar();
      cancelar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActivo = (m: MedioPago) => {
    const accion = m.activo ? "desactivar" : "activar";
    setConfirmToggle({ medio: m, accion });
  };

  const ejecutarToggleActivo = async () => {
    if (!confirmToggle) return;
    const { medio } = confirmToggle;
    const accion = medio.activo ? "desactivar" : "activar";
    setConfirmToggle(null);
    try {
      await mediosPagoApi.actualizar(medio.id, { activo: !medio.activo });
      await cargar();
    } catch {
      alert(`Error al ${accion} el método de pago`);
    }
  };

  return (
    <PanelShell
      title="Métodos de pago"
      description="Configura los métodos de pago disponibles para los cobradores de tu empresa."
    >
      {/* ── Encabezado ── */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {medios.length} método{medios.length !== 1 ? "s" : ""} configurado{medios.length !== 1 ? "s" : ""}
        </p>
        {hasPermiso("medios_pago", "crear") && (
          <button
            onClick={abrirNuevo}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            + Nuevo método
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
            {editingId ? "Editar método de pago" : "Nuevo método de pago"}
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
                placeholder="Ej: Efectivo, Transferencia, QR, Cheque"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Requiere comprobante */}
            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="requiere_comprobante"
                type="checkbox"
                checked={form.requiere_comprobante}
                onChange={(e) => setForm({ ...form, requiere_comprobante: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-sky-600"
              />
              <label htmlFor="requiere_comprobante" className="text-sm text-gray-700">
                Requiere comprobante (el cobrador deberá adjuntar foto del comprobante)
              </label>
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
                {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Crear método"}
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
      ) : medios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-400">No hay métodos de pago configurados.</p>
          {hasPermiso("medios_pago", "crear") && (
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
                <th className="px-4 py-3 text-center font-medium text-gray-600">Requiere comprobante</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {medios.map((m) => (
                <tr key={m.id} className={!m.activo ? "opacity-50" : ""}>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.nombre}</td>
                  <td className="px-4 py-3 text-center">
                    {m.requiere_comprobante ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Sí
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.activo ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {hasPermiso("medios_pago", "editar") && (
                        <button
                          onClick={() => abrirEditar(m)}
                          className="rounded-md px-3 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
                        >
                          Editar
                        </button>
                      )}
                      {hasPermiso("medios_pago", "eliminar") && (
                        <button
                          onClick={() => toggleActivo(m)}
                          className={`rounded-md px-3 py-1 text-xs font-medium ${
                            m.activo
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {m.activo ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Confirmación de activar/desactivar ── */}
      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.accion === "activar" ? "Activar método de pago" : "Desactivar método de pago"}
        message={`¿Desea ${confirmToggle?.accion ?? ""} el método "${confirmToggle?.medio.nombre ?? ""}"?`}
        confirmLabel={confirmToggle?.accion === "activar" ? "Activar" : "Desactivar"}
        tone={confirmToggle?.accion === "activar" ? "info" : "danger"}
        onConfirm={ejecutarToggleActivo}
        onCancel={() => setConfirmToggle(null)}
      />
    </PanelShell>
  );
}
