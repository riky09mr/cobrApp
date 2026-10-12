"use client";

import { Building2, Pencil, Upload, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { panelApi } from "@/services/api";
import type { Empresa } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

export default function Empresas() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [rows, setRows] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Búsqueda y paginación ────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 10;

  // ── Modal editar ───────────────────────────────────────────
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ razon_social: "", ruc: "", telefono: "", email: "", direccion: "" });
  const [saving, setSaving] = useState(false);
  const [updatingEstadoId, setUpdatingEstadoId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Confirmación de estado ────────────────────────────────
  const [confirmEstado, setConfirmEstado] = useState<{ empresa: Empresa; accion: string } | null>(null);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleApiError = useCallback((err: unknown) => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      localStorage.removeItem("cobrapp_token");
      localStorage.removeItem("cobrapp_user");
      router.push("/login");
    }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await panelApi.getEmpresas());
    } catch (err) {
      handleApiError(err);
      setError("No se pudo cargar empresas");
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    const userStr = localStorage.getItem("cobrapp_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr) as { rol?: string };
        setIsAdmin(u.rol === "ADMIN");
      } catch {
        setError("No se pudo leer la sesión del usuario");
      }
    }
    void load();
  }, [load]);

  const abrirEditar = (e: Empresa) => {
    setCreating(false);
    setEditing(e);
    setForm({
      razon_social: e.razon_social,
      ruc: e.ruc ?? "",
      telefono: e.telefono ?? "",
      email: e.email ?? "",
      direccion: e.direccion ?? "",
    });
    setEditError(null);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const abrirNuevaEmpresa = () => {
    setCreating(true);
    setEditing(null);
    setForm({ razon_social: "", ruc: "", telefono: "", email: "", direccion: "" });
    setEditError(null);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const cerrarModal = () => {
    setCreating(false);
    setEditing(null);
    setEditError(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // ── Filtrado y paginación ──────────────────────────────────
  const rowsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => {
      const razonSocial = e.razon_social.toLowerCase();
      const ruc = (e.ruc ?? "").toLowerCase();
      return razonSocial.includes(q) || ruc.includes(q);
    });
  }, [rows, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(rowsFiltrados.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const rowsPagina = rowsFiltrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  const handleGuardar = async () => {
    if (!editing) return;
    if (!form.razon_social.trim()) { setEditError("La razón social es requerida"); return; }
    setSaving(true);
    setEditError(null);
    try {
      await panelApi.updateEmpresa(editing.id, {
        razon_social: form.razon_social.trim(),
        ruc: form.ruc.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
      });

      if (logoFile) {
        setUploadingLogo(true);
        await panelApi.uploadLogoEmpresa(editing.id, logoFile);
        setUploadingLogo(false);
      }

      setEditing(null);
      void load();
    } catch (err: unknown) {
      setUploadingLogo(false);
      const e = err as { response?: { data?: { message?: string } } };
      setEditError(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCrear = async () => {
    if (!form.razon_social.trim()) {
      setEditError("La razón social es requerida");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const empresa = await panelApi.createEmpresa({
        razon_social: form.razon_social.trim(),
        ruc: form.ruc.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
      });

      if (logoFile) {
        setUploadingLogo(true);
        await panelApi.uploadLogoEmpresa(empresa.id, logoFile);
        setUploadingLogo(false);
      }

      cerrarModal();
      void load();
    } catch (err: unknown) {
      setUploadingLogo(false);
      const e = err as { response?: { data?: { message?: string } } };
      setEditError(e?.response?.data?.message ?? "No se pudo crear la empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEstado = async (empresa: Empresa) => {
    const nuevoEstado = !Boolean(empresa.estado);
    const accion = nuevoEstado ? "activar" : "inactivar";
    setConfirmEstado({ empresa, accion });
  };

  const ejecutarToggleEstado = async () => {
    if (!confirmEstado) return;
    const { empresa, accion } = confirmEstado;
    const nuevoEstado = !Boolean(empresa.estado);
    setConfirmEstado(null);

    setUpdatingEstadoId(empresa.id);
    try {
      await panelApi.updateEstadoEmpresa(empresa.id, nuevoEstado);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "No se pudo actualizar estado de la empresa");
    } finally {
      setUpdatingEstadoId(null);
    }
  };

return (
    <PanelShell title="Empresas" description="Gestión de empresas del sistema">
      <section className="rounded-xl border border-sky-200 bg-white shadow-md shadow-sky-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-sky-100">
          <Building2 size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-blue-900">Empresas</h2>
          {hasPermiso("empresas", "crear") && (
            <button
              onClick={abrirNuevaEmpresa}
              className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Nueva Empresa
            </button>
          )}
          <span className="text-sm text-blue-500">
            {rows.length} registro{rows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Buscador */}
        <div className="border-b border-sky-100 px-6 py-3">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por razón social o RUC..."
              className="w-full rounded-lg border border-sky-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        
        {loading && <p className="px-6 py-8 text-blue-700">Cargando...</p>}
        {error && <p className="px-6 py-4 text-red-600">{error}</p>}

        {!loading && !error && rows.length > 0 && rowsFiltrados.length === 0 && (
          <p className="px-6 py-8 text-blue-500">No se encontraron empresas que coincidan con la búsqueda.</p>
        )}

        {!loading && !error && rowsFiltrados.length > 0 && (
          <div className="overflow-x-auto">
            <p className="px-4 pt-3 text-xs text-blue-400">
              Mostrando {rowsPagina.length} de {rowsFiltrados.length} empresas
            </p>
            <table className="w-full text-sm">
              <thead className="bg-sky-50 text-blue-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Logo</th>
                  <th className="px-4 py-3 text-left font-medium">Razón Social</th>
                  <th className="px-4 py-3 text-left font-medium">RUC</th>
                  <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Dirección</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  {hasPermiso("empresas", "editar") && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-50">
                {rowsPagina.map((emp) => (
                  <tr key={emp.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="px-4 py-3">
                      {emp.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`http://localhost:5000${emp.logo_url}`}
                          alt="Logo"
                          className="h-8 w-8 rounded object-contain border border-sky-100"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-100 text-xs font-bold text-blue-600">
                          {emp.razon_social.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-900">{emp.razon_social}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.ruc ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.telefono ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.email ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-48 truncate">{emp.direccion ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${emp.estado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {emp.estado ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    {hasPermiso("empresas", "editar") && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirEditar(emp)}
                            className="flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-sky-100 transition-colors border border-sky-200"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            onClick={() => handleToggleEstado(emp)}
                            disabled={updatingEstadoId === emp.id}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                              emp.estado
                                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {updatingEstadoId === emp.id ? "Procesando..." : emp.estado ? "Inactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-sky-100 px-4 py-3">
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
        )}
      </section>

      {/* ── Modal Editar ─────────────────────────────────────── */}
      {((creating && hasPermiso("empresas", "crear")) || (editing && hasPermiso("empresas", "editar"))) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Building2 size={16} className="text-blue-600" />
                {creating ? "Nueva empresa" : "Editar empresa"}
              </h3>
              <button onClick={cerrarModal} className="rounded-full p-1 hover:bg-sky-50 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Logo */}
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-2">Logo de la empresa</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-sky-200 bg-sky-50 overflow-hidden">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Preview" className="h-full w-full object-contain" />
                    ) : editing?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`http://localhost:5000${editing.logo_url}`} alt="Logo actual" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-2xl font-bold text-sky-300">{form.razon_social.charAt(0).toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-sky-50 transition-colors"
                    >
                      <Upload size={13} /> {editing?.logo_url ? "Cambiar logo" : "Subir logo"}
                    </button>
                    {logoFile && <p className="mt-1 text-xs text-cyan-600 truncate max-w-40">{logoFile.name}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">JPG, PNG, WEBP — máx. 2 MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">Razón Social *</label>
                <input
                  value={form.razon_social}
                  onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">RUC</label>
                  <input
                    value={form.ruc}
                    onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                    className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">Dirección</label>
                <input
                  value={form.direccion}
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
            </div>

            <div className="flex justify-end gap-3 border-t border-sky-100 px-6 py-4">
              <button
                onClick={cerrarModal}
                className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-sky-50"
              >
                Cancelar
              </button>
              <button
                onClick={creating ? handleCrear : handleGuardar}
                disabled={saving || uploadingLogo}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingLogo ? "Subiendo logo..." : saving ? "Guardando..." : creating ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de estado ── */}
      <ConfirmDialog
        open={!!confirmEstado}
        title={confirmEstado?.accion === "activar" ? "Activar empresa" : "Inactivar empresa"}
        message={`¿Seguro que deseas ${confirmEstado?.accion ?? ""} esta empresa?`}
        confirmLabel={confirmEstado?.accion === "activar" ? "Activar" : "Inactivar"}
        tone={confirmEstado?.accion === "activar" ? "info" : "danger"}
        onConfirm={ejecutarToggleEstado}
        onCancel={() => setConfirmEstado(null)}
      />
    </PanelShell>
  );
}
