"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, History, Loader2, RefreshCw,
  ShieldAlert, Trash2
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { panelApi } from "@/services/api";
import type { LoteImportacion } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

export default function LotesImportacion() {
  useAuth();
  const router = useRouter();

  const [lotes, setLotes] = useState<LoteImportacion[]>([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [lotesError, setLotesError] = useState<string | null>(null);
  const [eliminandoLote, setEliminandoLote] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<LoteImportacion | null>(null);

  // ── Paginación ────────────────────────────────
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 10;

  const cargarLotes = async () => {
    setLotesLoading(true);
    setLotesError(null);
    try {
      const data = await panelApi.getLotesImportacion();
      setLotes(data ?? []);
      setPaginaActual(1);
    } catch {
      setLotesError("No se pudieron cargar los lotes de importación");
    } finally {
      setLotesLoading(false);
    }
  };

  const eliminarLote = (lote: LoteImportacion) => {
    setConfirmEliminar(lote);
  };

  const ejecutarEliminarLote = async () => {
    if (!confirmEliminar) return;
    const lote = confirmEliminar;
    setConfirmEliminar(null);
    setEliminandoLote(lote.id);
    setLotesError(null);
    try {
      await panelApi.eliminarLoteImportacion(lote.id);
      await cargarLotes();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
      if (e?.response?.status === 409) {
        setLotesError(e.response.data?.message ?? "No se puede eliminar el lote porque algunos créditos ya fueron asignados.");
      } else {
        setLotesError(e?.response?.data?.message ?? e?.message ?? "Error al eliminar el lote.");
      }
    } finally {
      setEliminandoLote(null);
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem("cobrapp_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr) as { rol?: string };
        const rol = u.rol ?? null;
        if (rol !== "ADMIN" && rol !== "SUPERVISOR") {
          router.replace("/dashboard");
          return;
        }
        cargarLotes();
      } catch {
        setLotesError("No se pudo leer la sesión del usuario");
      }
    }
  }, [router]);

  return (
    <PanelShell
      title="Lotes de importación"
      description="Historial de archivos Excel importados y su estado"
    >
      <div className="flex h-full w-full flex-col">
        <section className="flex flex-1 flex-col rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <History size={16} />
              </span>
              <h2 className="text-base font-bold text-blue-900">Lotes importados</h2>
            </div>
            <button
              onClick={cargarLotes}
              disabled={lotesLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              <RefreshCw size={13} className={lotesLoading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {lotesError && (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{lotesError}</span>
            </p>
          )}

          {lotesLoading && lotes.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-blue-500">
              <Loader2 size={16} className="animate-spin" />
              Cargando lotes...
            </div>
          ) : lotes.length === 0 ? (
            <p className="py-6 text-center text-sm text-blue-400">
              Aún no hay lotes de importación registrados.
            </p>
          ) : (
            <div className="space-y-3">
              {lotes
                .slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
                .map((lote) => {
                const asignado = lote.asignados_count > 0;
                return (
                  <div
                    key={lote.id}
                    className={`rounded-lg border p-4 transition ${
                      asignado
                        ? "border-sky-100 bg-sky-50/50"
                        : "border-sky-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-blue-900">
                          <FileSpreadsheet size={14} className="shrink-0 text-blue-500" />
                          {lote.nombre_archivo ?? `Lote #${lote.id}`}
                        </p>
                        <p className="mt-0.5 text-xs text-blue-500">
                          {new Date(lote.fecha_importacion).toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          {lote.usuario_nombre} {lote.usuario_apellido}
                          {lote.empresa_nombre ? ` · ${lote.empresa_nombre}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => eliminarLote(lote)}
                        disabled={eliminandoLote === lote.id || asignado}
                        title={
                          asignado
                            ? "No se puede eliminar: algunos créditos ya fueron asignados a cobradores"
                            : "Eliminar este lote"
                        }
                        className={`shrink-0 rounded-lg p-2 transition ${
                          asignado
                            ? "cursor-not-allowed text-blue-300"
                            : "text-red-500 hover:bg-red-50 hover:text-red-700"
                        }`}
                      >
                        {eliminandoLote === lote.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                      <div className="rounded-md bg-sky-50 px-2 py-1.5">
                        <p className="text-base font-bold text-blue-800">{lote.total_filas}</p>
                        <p className="text-blue-500">Filas</p>
                      </div>
                      <div className="rounded-md bg-green-50 px-2 py-1.5">
                        <p className="text-base font-bold text-green-700">{lote.creditos_creados}</p>
                        <p className="text-green-600">Créditos</p>
                      </div>
                      <div className="rounded-md bg-cyan-50 px-2 py-1.5">
                        <p className="text-base font-bold text-cyan-700">{lote.clientes_nuevos}</p>
                        <p className="text-cyan-600">Nuevos</p>
                      </div>
                      <div className="rounded-md bg-amber-50 px-2 py-1.5">
                        <p className="text-base font-bold text-amber-700">{lote.clientes_actualizados}</p>
                        <p className="text-amber-600">Actualizados</p>
                      </div>
                    </div>

                    {lote.errores > 0 && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
                        <AlertTriangle size={12} /> {lote.errores} fila(s) con errores
                      </p>
                    )}

                    {asignado && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-blue-500">
                        <ShieldAlert size={12} />
                        {lote.asignados_count} crédito(s) ya asignado(s) a cobradores — no se puede eliminar
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {lotes.length > POR_PAGINA && (
            <div className="mt-4 flex items-center justify-between border-t border-sky-100 pt-4">
              <button
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                disabled={paginaActual <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span className="text-sm text-blue-600">
                Página {paginaActual} de {Math.max(1, Math.ceil(lotes.length / POR_PAGINA))}
              </span>
              <button
                onClick={() => setPaginaActual((p) => Math.min(Math.ceil(lotes.length / POR_PAGINA), p + 1))}
                disabled={paginaActual >= Math.ceil(lotes.length / POR_PAGINA)}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ── Confirmación de eliminación ── */}
      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar lote de importación"
        message={
          confirmEliminar
            ? `¿Eliminar el lote "${confirmEliminar.nombre_archivo ?? `#${confirmEliminar.id}`}"?\n\nSe eliminarán ${confirmEliminar.creditos_count} crédito(s) y los clientes que solo fueron creados en este lote.\nEsta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={ejecutarEliminarLote}
        onCancel={() => setConfirmEliminar(null)}
      />
    </PanelShell>
  );
}
