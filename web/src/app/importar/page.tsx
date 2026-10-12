"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Download, Upload, AlertTriangle, Lightbulb, FileText,
  FolderOpen, Loader2, User, MapPin, CreditCard, X, CheckCircle2, Users,
  RefreshCw, MapPinned, BadgeCheck, FileSpreadsheet, Copy, UserPlus2
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Empresa, ImportResult } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

export default function ImportarExcel() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [currentUserRol, setCurrentUserRol] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // ── Estado del formulario ──────────────────────────────────
  const [importEmpresaId, setImportEmpresaId] = useState<number>(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showResumen, setShowResumen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("cobrapp_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr) as { rol?: string; empresaId?: number };
        const rol = u.rol ?? null;
        setCurrentUserRol(rol);

        if (!hasPermiso("importar", "crear")) {
          router.replace("/dashboard");
          return;
        }

        if (rol !== "ADMIN" && u.empresaId) {
          setImportEmpresaId(u.empresaId);
        }
        panelApi
          .getEmpresas()
          .then(setEmpresas)
          .catch(() => setImportError("No se pudo cargar la lista de empresas"));
      } catch {
        setImportError("No se pudo leer la sesión del usuario");
      }
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setImportError("El archivo debe ser .xlsx o .xls");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setImportError("El archivo no puede superar los 5 MB");
      return;
    }
    setImportError(null);
    setImportFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setImportError("El archivo debe ser .xlsx o .xls");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setImportError("El archivo no puede superar los 5 MB");
      return;
    }
    setImportError(null);
    setImportFile(f);
  };

  const quitarArchivo = () => {
    setImportFile(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportar = async () => {
    if (!importFile) return;
    if (!importEmpresaId) {
      setImportError("Seleccioná una empresa");
      return;
    }
    setImporting(true);
    setImportResult(null);
    setImportMessage(null);
    setImportError(null);
    setShowResumen(false);
    try {
      const resp = await panelApi.importarClientes(
        importFile,
        importEmpresaId || undefined
      );
      setImportResult(resp.data ?? null);
      setImportMessage(resp.message ?? "Importación completada");
      setShowResumen(true);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string }; status?: number };
        request?: unknown;
        message?: string;
      };
      if (e?.response) {
        // El servidor respondió con un error (validación, formato, etc.)
        const status = e.response.status;
        const serverMsg = e.response.data?.message;
        if (status === 400) {
          setImportError(
            serverMsg ?? "El archivo no cumple con el formato esperado. Revisá la plantilla."
          );
        } else if (status === 413) {
          setImportError("El archivo es demasiado grande. El máximo permitido es 5 MB.");
        } else if (status === 401 || status === 403) {
          setImportError("No tenés permisos para realizar esta importación.");
        } else {
          setImportError(serverMsg ?? "Error del servidor al importar el archivo.");
        }
      } else if (e?.request) {
        // La petición se envió pero no hubo respuesta (problema de red/servidor caído)
        setImportError(
          "No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo."
        );
      } else {
        // Error al configurar la petición
        setImportError(e?.message ?? "Error inesperado al importar el archivo.");
      }
    } finally {
      setImporting(false);
    }
  };

  const resetear = () => {
    setImportFile(null);
    setImportResult(null);
    setImportMessage(null);
    setImportError(null);
    setShowResumen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <PanelShell
      title="Importar Excel"
      description="Cargá clientes y créditos masivamente desde un archivo Excel"
    >
      <div className="w-full space-y-6">

        {/* Instrucciones */}
        <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-blue-700">
                <ClipboardList size={16} />
              </span>
              <h2 className="text-base font-bold text-blue-900">Estructura del archivo Excel</h2>
            </div>
            <button
              onClick={() => router.push("/importar/manual")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:from-cyan-500 hover:to-blue-500"
            >
              <UserPlus2 size={15} /> Carga manual
            </button>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
              <p className="flex items-center gap-1.5 font-semibold text-blue-800">
                <User size={14} /> Datos del cliente
              </p>
              <p className="mt-1 font-mono text-blue-600">
                cedula* &nbsp;·&nbsp; nombre* &nbsp;·&nbsp; apellido &nbsp;·&nbsp; telefono &nbsp;·&nbsp; email &nbsp;·&nbsp; direccion
              </p>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
              <p className="flex items-center gap-1.5 font-semibold text-blue-800">
                <MapPin size={14} /> Ubicación <span className="font-normal text-blue-500">(elegí una opción)</span>
              </p>
              <p className="mt-1 font-mono text-blue-600">
                url_maps &nbsp;—&nbsp; ó bien &nbsp;—&nbsp; latitud + longitud
              </p>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 px-4 py-3 md:col-span-2">
              <p className="flex items-center gap-1.5 font-semibold text-purple-800">
                <CreditCard size={14} /> Crédito <span className="font-normal text-purple-500">(opcional — si completás monto y cuotas, se crea automáticamente)</span>
              </p>
              <div className="mt-1.5 grid gap-x-6 gap-y-0.5 font-mono text-xs text-purple-600 sm:grid-cols-2">
                <span>numero_credito · descripcion · precio_contado · entrega_inicial</span>
                <span>monto_total · cantidad_cuotas · cuotas_pagadas · monto_cuota</span>
                <span>dia_pago · periodicidad · tasa_interes · fecha_otorgamiento</span>
                <span className="text-purple-400">periodicidad: SEMANAL / QUINCENAL / MENSUAL · fecha: DD/MM/YYYY</span>
              </div>
            </div>
            <p className="text-xs text-blue-400 md:col-span-2">* <strong>cedula</strong> y <strong>nombre</strong> son obligatorios.</p>
          </div>
          <button
            onClick={() => panelApi.descargarPlantilla()}
            className="mt-4 flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-sky-100"
          >
            <Download size={14} /> Descargar Plantilla de ejemplo
          </button>

          {/* Separador + Formulario de importación */}
          <div className="mt-6 border-t border-sky-100 pt-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                <Upload size={16} />
              </span>
              <h2 className="text-base font-bold text-blue-900">Cargar archivo</h2>
            </div>

          {importResult ? (
            /* ── Resultado ── */
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="flex items-center gap-1.5 font-semibold text-green-800">
                  <CheckCircle2 size={16} /> {importMessage}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <FileSpreadsheet size={18} className="mx-auto mb-1 text-blue-500" />
                    <p className="text-2xl font-bold text-blue-900">{importResult.total}</p>
                    <p className="text-xs text-blue-600">Total filas</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <Users size={18} className="mx-auto mb-1 text-green-600" />
                    <p className="text-2xl font-bold text-green-700">{importResult.importados}</p>
                    <p className="text-xs text-green-600">Clientes nuevos</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <RefreshCw size={18} className="mx-auto mb-1 text-sky-500" />
                    <p className="text-2xl font-bold text-sky-600">{importResult.actualizados}</p>
                    <p className="text-xs text-sky-600">Actualizados</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <MapPinned size={18} className="mx-auto mb-1 text-amber-500" />
                    <p className="text-2xl font-bold text-amber-600">{importResult.sinUbicacion}</p>
                    <p className="text-xs text-amber-600">Sin ubicación</p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-white p-3 shadow-sm">
                    <BadgeCheck size={18} className="mx-auto mb-1 text-purple-500" />
                    <p className="text-2xl font-bold text-purple-700">{importResult.creditosCreados}</p>
                    <p className="text-xs text-purple-600">Créditos creados</p>
                  </div>
                  {importResult.duplicados.length > 0 && (
                    <div className="col-span-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <Copy size={18} className="mx-auto mb-1 text-orange-500" />
                      <p className="text-2xl font-bold text-orange-600">{importResult.duplicados.length}</p>
                      <p className="text-xs text-orange-600">N° de crédito duplicados</p>
                    </div>
                  )}
                </div>
              </div>

              {importResult.errores.length > 0 && (
                <details className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-red-700">
                    <AlertTriangle size={13} className="inline mr-1" />{importResult.errores.length} filas con errores (ver detalle)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {importResult.errores.map((e, i) => (
                      <li key={i} className="text-xs text-red-600">
                        Fila {e.fila}: {e.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {importResult.sinUbicacion > 0 && (
                <p className="text-sm text-amber-700">
                  <Lightbulb size={13} className="inline mr-1" />{importResult.sinUbicacion} cliente(s) sin ubicación. Podés asignarlas en{" "}
                  <button
                    className="font-medium underline"
                    onClick={() => router.push("/clientes")}
                  >
                    Clientes → Sin Ubicación
                  </button>
                  .
                </p>
              )}

              {importResult.duplicados.length > 0 && importResult.archivoDuplicados && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm text-orange-800">
                    <Copy size={13} className="inline mr-1" />
                    Se detectaron {importResult.duplicados.length} fila(s) con errores de duplicidad (número de crédito repetido en el archivo o ya registrado en la base de datos). Se guardaron en un archivo temporal.
                  </p>
                  <button
                    onClick={() => panelApi.descargarDuplicados(importResult.archivoDuplicados!)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
                  >
                    <Download size={14} /> Descargar duplicados
                  </button>
                  <p className="mt-1 text-xs text-orange-500">El archivo se eliminará automáticamente después de la descarga.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetear}
                  className="flex-1 rounded-lg border border-sky-300 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50"
                >
                  Importar otro archivo
                </button>
                <button
                  onClick={() => router.push("/clientes")}
                  className="flex-1 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white"
                >
                  Ver Clientes
                </button>
              </div>
            </div>
          ) : (
            /* ── Formulario ── */
            <div className="space-y-4">
              <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Empresa *</label>
                  <select
                    value={importEmpresaId}
                    onChange={(e) => setImportEmpresaId(parseInt(e.target.value, 10))}
                    disabled={currentUserRol !== "ADMIN"}
                    className={`w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      currentUserRol !== "ADMIN" ? "cursor-not-allowed opacity-70" : ""
                    }`}
                  >
                    {currentUserRol === "ADMIN" && <option value={0}>Seleccioná una empresa</option>}
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.razon_social}
                      </option>
                    ))}
                  </select>
                  {currentUserRol !== "ADMIN" && (
                    <p className="mt-1 text-xs text-blue-500">Se importará a la empresa de tu cuenta</p>
                  )}
                </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-blue-900">
                  Archivo Excel (.xlsx, .xls) *
                </label>
                <div
                  onClick={() => !importing && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    if (!importing) {
                      e.preventDefault();
                      setDragActive(true);
                    }
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition ${
                    importing
                      ? "pointer-events-none border-sky-200 bg-sky-50/50 opacity-60"
                      : dragActive
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-sky-300 bg-sky-50/50 hover:bg-sky-50"
                  }`}
                >
                  {importing ? (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-900">
                      <Loader2 size={18} className="animate-spin text-blue-500" />
                      Subiendo y procesando archivo...
                    </span>
                  ) : importFile ? (
                    <div className="flex items-center gap-2 px-4">
                      <FileText size={18} className="text-blue-500" />
                      <span className="text-sm font-medium text-blue-900">{importFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          quitarArchivo();
                        }}
                        className="ml-1 rounded-full p-1 text-blue-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Quitar archivo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FolderOpen size={48} className="text-blue-300" />
                      <p className="mt-2 text-sm text-blue-600">Click o arrastrá el archivo aquí</p>
                      <p className="text-xs text-blue-400">Máximo 5 MB · .xlsx / .xls</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {importError && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{importError}</span>
                </p>
              )}

              <button
                onClick={handleImportar}
                disabled={importing || !importFile || (currentUserRol === "ADMIN" && !importEmpresaId)}
                className="w-full rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-cyan-500/30 transition hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
              >
                {importing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Importando...
                  </span>
                ) : (
                  <><Upload size={14} className="inline mr-1" />Importar archivo</>
                )}
              </button>
            </div>
          )}
          </div>
        </section>
      </div>

      {/* ── Popup de resumen de importación ── */}
      {showResumen && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-blue-900">
                <CheckCircle2 size={20} className="text-green-600" />
                Resumen de importación
              </h3>
              <button
                onClick={() => setShowResumen(false)}
                className="rounded-full p-1 text-blue-400 transition hover:bg-blue-50 hover:text-blue-700"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Filas correctas */}
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">Filas guardadas correctamente</span>
                </div>
                <span className="text-2xl font-bold text-green-700">
                  {importResult.total - importResult.duplicados.length - (importResult.errores.length - importResult.erroresDuplicidad)}
                </span>
              </div>

              {/* Filas con errores de duplicidad */}
              {importResult.duplicados.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Copy size={18} className="text-orange-500" />
                    <span className="text-sm font-medium text-orange-800">Filas con errores de duplicidad</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-600">{importResult.duplicados.length}</span>
                </div>
              )}

              {/* Filas con otros errores */}
              {importResult.errores.length - importResult.erroresDuplicidad > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-500" />
                    <span className="text-sm font-medium text-red-800">Filas con otros errores</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">
                    {importResult.errores.length - importResult.erroresDuplicidad}
                  </span>
                </div>
              )}

              {/* Aviso de verificación en Excel */}
              {(importResult.duplicados.length > 0 || importResult.errores.length - importResult.erroresDuplicidad > 0) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      Verificá el archivo Excel de duplicados/errores para revisar las filas que no se pudieron cargar.
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              {importResult.archivoDuplicados && (
                <button
                  onClick={() => panelApi.descargarDuplicados(importResult.archivoDuplicados!)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600"
                >
                  <Download size={14} /> Descargar Excel
                </button>
              )}
              <button
                onClick={() => setShowResumen(false)}
                className="flex-1 rounded-lg border border-sky-300 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-sky-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
}
