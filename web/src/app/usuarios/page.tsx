"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Key, AlertTriangle, User, Pencil, Info, ShieldCheck, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

import PanelShell from "@/components/PanelShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { panelApi, permisosApi } from "@/services/api";
import type { Usuario, CreateUsuarioPayload, Rol, Empresa, Permiso } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

export default function Usuarios() {
  useAuth(); // Proteger ruta
  
  const router = useRouter();
  const [rows, setRows] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserEmpresaId, setCurrentUserEmpresaId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateUsuarioPayload>({
    nombre: "",
    apellido: "",
    cedula: "",
    telefono: "",
    email: "",
    password: "",
    rol_id: 0,
    empresa_id: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingEstadoId, setUpdatingEstadoId] = useState<number | null>(null);
  const [confirmEstado, setConfirmEstado] = useState<{ usuario: Usuario; accion: string } | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [resetPassword, setResetPassword] = useState(false);

  // ── Búsqueda, filtros y paginación ─────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activo" | "inactivo">("todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 10;

  // ── Permisos ──
  const { hasPermiso } = usePermisos();
  const [permisosModal, setPermisosModal] = useState<{
    usuario: Usuario;
    catalogo: Permiso[];
    seleccionados: Set<string>;
    rol: string;
    loading: boolean;
    saving: boolean;
    error: string | null;
  } | null>(null);

  const getApiErrorData = (err: unknown): { status?: number; message?: string } => {
    const apiError = err as { response?: { status?: number; data?: { message?: string } } };
    return {
      status: apiError.response?.status,
      message: apiError.response?.data?.message,
    };
  };

  const loadUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const data = await panelApi.getUsuarios();
      setRows(data);
      setError(null);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      if (apiError.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError(apiError.message ?? "No se pudo cargar usuarios");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadRolesAndEmpresas = useCallback(async () => {
    try {
      const [rolesData, empresasData] = await Promise.all([
        panelApi.getRoles(),
        panelApi.getEmpresas(),
      ]);
      setRoles(rolesData);
      setEmpresas(empresasData);
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message ?? "No se pudieron cargar roles y empresas");
    }
  }, []);

  useEffect(() => {
    void loadUsuarios();
    void loadRolesAndEmpresas();
    
    // Obtener información del usuario actual
    const userDataStr = localStorage.getItem("cobrapp_user");
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        setCurrentUserId(userData.id ?? null);
        setCurrentUserRole(userData.rol);
        setCurrentUserEmpresaId(userData.empresaId);
      } catch {
        setError("No se pudo leer la sesión del usuario");
      }
    }
  }, [loadUsuarios, loadRolesAndEmpresas]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rol_id" || name === "empresa_id" ? parseInt(value, 10) : value,
    }));
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setShowForm(true);
    setFormError(null);
    setFormSuccess(null);
    setPasswordTemporal(null);
    setResetPassword(false);
    
    // Buscar el rol_id y empresa_id del usuario
    const rolEncontrado = roles.find(r => r.nombre === usuario.rol);
    const empresaEncontrada = empresas.find(e => e.razon_social === usuario.empresa);
    
    setFormData({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cedula: usuario.cedula || "",
      telefono: usuario.telefono || "",
      email: usuario.email,
      password: "",
      rol_id: rolEncontrado?.id || 0,
      empresa_id: empresaEncontrada?.id || 0,
    });
  };

  const handleCancelEdit = () => {
    setEditingUsuario(null);
    setShowForm(false);
    setFormSuccess(null);
    setPasswordTemporal(null);
    setResetPassword(false);
    setFormData({
      nombre: "",
      apellido: "",
      cedula: "",
      telefono: "",
      email: "",
      password: "",
      rol_id: 0,
      empresa_id: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setPasswordTemporal(null);

    // Validaciones básicas
    if (!formData.nombre || !formData.apellido || !formData.email) {
      setFormError("Los campos nombre, apellido y email son obligatorios");
      return;
    }

    if (formData.rol_id === 0) {
      setFormError("Debes seleccionar un rol");
      return;
    }

    // Si es ADMIN, validar empresa_id
    if (currentUserRole === "ADMIN" && formData.empresa_id === 0) {
      setFormError("Debes seleccionar una empresa");
      return;
    }

    try {
      setSubmitting(true);
      
      // Preparar payload - no enviar password ni empresa_id si es SUPERVISOR
      const payload: Partial<CreateUsuarioPayload> = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email,
        rol_id: formData.rol_id,
      };

      if (formData.cedula) payload.cedula = formData.cedula;
      if (formData.telefono) payload.telefono = formData.telefono;
      
      // Si es ADMIN, enviar empresa_id
      if (currentUserRole === "ADMIN") {
        payload.empresa_id = formData.empresa_id;
      }

      let response;
      if (editingUsuario) {
        // Modo edición
        response = await panelApi.updateUsuario(editingUsuario.id, { ...payload, resetPassword });
        setFormSuccess(response.message || "Usuario actualizado exitosamente");
        if (response.data?.passwordTemporal) {
          setPasswordTemporal(response.data.passwordTemporal);
        }
      } else {
        // Modo creación
        response = await panelApi.createUsuario(payload);
        
        // Mostrar contraseña temporal solo en creación
        if (response.data?.passwordTemporal) {
          setPasswordTemporal(response.data.passwordTemporal);
        }
        
        setFormSuccess(response.message || "Usuario creado exitosamente");
      }
      
      // Limpiar formulario
      setFormData({
        nombre: "",
        apellido: "",
        cedula: "",
        telefono: "",
        email: "",
        password: "",
        rol_id: 0,
        empresa_id: 0,
      });

      // Recargar lista de usuarios
      await loadUsuarios();

      // Si es edición, cerrar el formulario. Si es creación, dejarlo abierto para mostrar la contraseña
      if (editingUsuario) {
        setTimeout(() => {
          handleCancelEdit();
        }, 1500);
      }
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setFormError(apiError.message || `Error al ${editingUsuario ? 'actualizar' : 'crear'} usuario`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEstadoUsuario = (usuario: Usuario) => {
    const nuevoEstado = !Boolean(usuario.estado);
    const accion = nuevoEstado ? "activar" : "inactivar";
    setConfirmEstado({ usuario, accion });
  };

  const ejecutarToggleEstadoUsuario = async () => {
    if (!confirmEstado) return;
    const { usuario, accion } = confirmEstado;
    const nuevoEstado = !Boolean(usuario.estado);
    setConfirmEstado(null);

    try {
      setUpdatingEstadoId(usuario.id);
      await panelApi.updateEstadoUsuario(usuario.id, nuevoEstado);
      await loadUsuarios();
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setError(apiError.message || "No se pudo actualizar estado del usuario");
    } finally {
      setUpdatingEstadoId(null);
    }
  };

  // ── Gestión de permisos ──

  const abrirModalPermisos = async (usuario: Usuario) => {
    try {
      setPermisosModal({
        usuario,
        catalogo: [],
        seleccionados: new Set(),
        rol: "",
        loading: true,
        saving: false,
        error: null,
      });

      const [catalogoData, permisosUsuario] = await Promise.all([
        permisosApi.getCatalogo(),
        permisosApi.getPermisosUsuario(usuario.id),
      ]);

      setPermisosModal({
        usuario,
        catalogo: catalogoData.permisos,
        seleccionados: new Set(permisosUsuario.permisos),
        rol: permisosUsuario.rol,
        loading: false,
        saving: false,
        error: null,
      });
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setPermisosModal((prev) =>
        prev
          ? { ...prev, loading: false, error: apiError.message ?? "No se pudieron cargar los permisos" }
          : prev
      );
    }
  };

  const cerrarModalPermisos = () => {
    setPermisosModal(null);
  };

  const togglePermiso = (key: string) => {
    setPermisosModal((prev) => {
      if (!prev) return prev;
      const nuevos = new Set(prev.seleccionados);
      if (nuevos.has(key)) {
        nuevos.delete(key);
      } else {
        nuevos.add(key);
      }
      return { ...prev, seleccionados: nuevos };
    });
  };

  const toggleModulo = (modulo: string) => {
    setPermisosModal((prev) => {
      if (!prev) return prev;
      const permisosModulo = prev.catalogo.filter((p) => p.modulo === modulo);
      const todosSeleccionados = permisosModulo.every((p) => prev.seleccionados.has(`${p.modulo}.${p.accion}`));
      const nuevos = new Set(prev.seleccionados);
      permisosModulo.forEach((p) => {
        const key = `${p.modulo}.${p.accion}`;
        if (todosSeleccionados) {
          nuevos.delete(key);
        } else {
          nuevos.add(key);
        }
      });
      return { ...prev, seleccionados: nuevos };
    });
  };

  const guardarPermisos = async () => {
    if (!permisosModal) return;
    try {
      setPermisosModal((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
      await permisosApi.asignarPermisos(permisosModal.usuario.id, Array.from(permisosModal.seleccionados));
      cerrarModalPermisos();
    } catch (err: unknown) {
      const apiError = getApiErrorData(err);
      setPermisosModal((prev) =>
        prev ? { ...prev, saving: false, error: apiError.message ?? "No se pudieron guardar los permisos" } : prev
      );
    }
  };

  // ── Filtrado y paginación ──────────────────────────────────
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((u) => {
      if (q) {
        const nombreCompleto = `${u.nombre} ${u.apellido}`.toLowerCase();
        const email = u.email.toLowerCase();
        const cedula = (u.cedula ?? "").toLowerCase();
        if (!nombreCompleto.includes(q) && !email.includes(q) && !cedula.includes(q)) return false;
      }
      if (filtroRol !== "todos" && u.rol !== filtroRol) return false;
      if (filtroEstado === "activo" && !u.estado) return false;
      if (filtroEstado === "inactivo" && u.estado) return false;
      return true;
    });
  }, [rows, busqueda, filtroRol, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const usuariosPagina = usuariosFiltrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroRol, filtroEstado]);

  return (
    <PanelShell title="Usuarios" description="Administración de usuarios y roles">
      {/* ── Vista COBRADOR: solo su propio perfil ── */}
      {currentUserRole === "COBRADOR" && rows.length > 0 && (
        <div className="mx-auto max-w-lg space-y-4">
          <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md">
            <h2 className="mb-4 text-base font-bold text-blue-900">Mi perfil</h2>
            <div className="space-y-2 text-sm text-blue-800">
              <p><span className="font-medium w-28 inline-block">Nombre:</span>{rows[0].nombre} {rows[0].apellido}</p>
              <p><span className="font-medium w-28 inline-block">Email:</span>{rows[0].email}</p>
              {rows[0].cedula   && <p><span className="font-medium w-28 inline-block">Cédula:</span>{rows[0].cedula}</p>}
              {rows[0].telefono && <p><span className="font-medium w-28 inline-block">Teléfono:</span>{rows[0].telefono}</p>}
              <p><span className="font-medium w-28 inline-block">Empresa:</span>{rows[0].empresa}</p>
              <p><span className="font-medium w-28 inline-block">Rol:</span>{rows[0].rol}</p>
            </div>
          </section>
          <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md">
            <h2 className="mb-3 text-base font-bold text-blue-900">Cambiar contraseña</h2>
            <button
              onClick={() => router.push("/cambiar-password")}
              className="w-full rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white hover:from-cyan-700 hover:to-blue-700 transition inline-flex items-center justify-center gap-1"
            >
              <Key size={14} /> Cambiar mi contraseña
            </button>
          </section>
        </div>
      )}

      {currentUserRole === "COBRADOR" && rows.length === 0 && !loading && (
        <p className="text-blue-500">Cargando perfil…</p>
      )}

      {/* ── Vista ADMIN / SUPERVISOR ── */}
      {currentUserRole !== "COBRADOR" && (
      <div className="space-y-6">
        {/* Botón Nuevo Usuario */}
        {hasPermiso("usuarios", "crear") && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (showForm) {
                handleCancelEdit();
              } else {
                setShowForm(true);
                setEditingUsuario(null);
              }
            }}
            className="rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 px-6 py-2 font-semibold text-white shadow-md transition hover:shadow-lg inline-flex items-center gap-2"
          >
            {showForm ? <><X size={15} /> Cancelar</> : <><Plus size={15} /> Nuevo Usuario</>}
          </button>
        </div>
        )}

        {/* Formulario */}
        {showForm && (
          <section className="rounded-xl border border-cyan-200 bg-linear-to-br from-white to-cyan-50/30 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold text-blue-900">
              {editingUsuario ? "Editar Usuario" : "Crear Nuevo Usuario"}
            </h2>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
                <p className="font-semibold">{formSuccess}</p>
                {passwordTemporal && (
                  <div className="mt-2 rounded border border-green-400 bg-green-100 p-2">
                    <p className="font-bold inline-flex items-center gap-1"><Key size={14} /> Contraseña temporal generada:</p>
                    <p className="mt-1 font-mono text-lg font-bold text-green-900">{passwordTemporal}</p>
                    <p className="mt-1 text-xs text-green-700 inline-flex items-center gap-1">
                      <AlertTriangle size={12} /> El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                    </p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mensaje informativo sobre contraseña automática - Solo en modo creación */}
              {!editingUsuario && (
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700">
                  {(() => {
                    const empresaId = currentUserRole === "ADMIN" ? formData.empresa_id : currentUserEmpresaId;
                    const empresa = empresas.find((e) => e.id === empresaId);
                    const nombreEmpresa = empresa
                      ? empresa.razon_social.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "")
                      : "nombreempresa";
                    const anio = new Date().getFullYear();
                    return (
                      <>
                        <Info size={14} className="inline mr-1" />La contraseña será generada automáticamente:{" "}
                        <strong>{nombreEmpresa}{anio}</strong>
                        <br />
                        El usuario deberá cambiarla en su primer inicio de sesión.
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Nombre */}
                <div>
                  <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-blue-900">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    required
                  />
                </div>

                {/* Apellido */}
                <div>
                  <label htmlFor="apellido" className="mb-1 block text-sm font-medium text-blue-900">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    required
                  />
                </div>

                {/* Cédula */}
                <div>
                  <label htmlFor="cedula" className="mb-1 block text-sm font-medium text-blue-900">
                    Cédula
                  </label>
                  <input
                    type="text"
                    id="cedula"
                    name="cedula"
                    value={formData.cedula}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label htmlFor="telefono" className="mb-1 block text-sm font-medium text-blue-900">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-blue-900">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    required
                  />
                </div>

                {/* Rol */}
                <div>
                  <label htmlFor="rol_id" className="mb-1 block text-sm font-medium text-blue-900">
                    Rol *
                  </label>
                  <select
                    id="rol_id"
                    name="rol_id"
                    value={formData.rol_id}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    required
                  >
                    <option value="0">Seleccione un rol</option>
                    {roles
                      .filter((rol) => currentUserRole === "ADMIN" || rol.nombre !== "ADMIN")
                      .map((rol) => (
                        <option key={rol.id} value={rol.id}>
                          {rol.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Empresa - Solo visible para ADMIN */}
                {currentUserRole === "ADMIN" && (
                  <div>
                    <label htmlFor="empresa_id" className="mb-1 block text-sm font-medium text-blue-900">
                      Empresa *
                    </label>
                    <select
                      id="empresa_id"
                      name="empresa_id"
                      value={formData.empresa_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-sky-300 bg-white px-4 py-2 text-blue-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                      required
                    >
                      <option value="0">Seleccione una empresa</option>
                      {empresas.map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.razon_social}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Empresa - Solo info para SUPERVISOR */}
                {currentUserRole === "SUPERVISOR" && currentUserEmpresaId && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-blue-900">
                      Empresa
                    </label>
                    <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-blue-900">
                      {empresas.find((e) => e.id === currentUserEmpresaId)?.razon_social || "Su empresa"}
                      <span className="ml-2 text-xs text-cyan-600">(Automático)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Restablecer contraseña - Solo en modo edición */}
              {editingUsuario && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={resetPassword}
                      onChange={(e) => setResetPassword(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-amber-800"><Key size={14} className="inline mr-1" />Restablecer contraseña</span>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Se generará una contraseña temporal automática. El usuario deberá cambiarla al iniciar sesión.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-sky-300 bg-white px-6 py-2 font-semibold text-blue-900 transition hover:bg-sky-50"
                >
                  {passwordTemporal ? "Cerrar" : "Cancelar"}
                </button>
                {!passwordTemporal && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 px-6 py-2 font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
                  >
                    {submitting ? (editingUsuario ? "Actualizando..." : "Creando...") : (editingUsuario ? "Actualizar Usuario" : "Crear Usuario")}
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Lista de Usuarios */}
        <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          <h2 className="text-lg font-semibold text-blue-900">Lista de Usuarios</h2>

          {/* Barra de búsqueda y filtros */}
          <div className="mt-4 mb-2 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, apellido, email o cédula..."
                className="w-full rounded-lg border border-sky-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="todos">Todos los roles</option>
                {roles.map((rol) => (
                  <option key={rol.id} value={rol.nombre}>{rol.nombre}</option>
                ))}
              </select>
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

          {loading ? <p className="mt-2 text-blue-700">Cargando usuarios...</p> : null}
          {error ? <p className="mt-2 text-red-600">{error}</p> : null}

          {!loading && !error && rows.length > 0 && usuariosFiltrados.length === 0 && (
            <p className="mt-4 text-blue-500">No se encontraron usuarios que coincidan con la búsqueda o los filtros.</p>
          )}

          {!loading && !error && usuariosFiltrados.length > 0 ? (
            <>
            <p className="mt-3 mb-2 text-xs text-blue-400">
              Mostrando {usuariosPagina.length} de {usuariosFiltrados.length} usuarios
            </p>
            <ul className="space-y-3">
              {usuariosPagina.map((usuario) => (
                <li key={usuario.id} className="rounded-lg border border-sky-200 bg-sky-50/30 p-4 transition hover:bg-sky-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-blue-900 inline-flex items-center gap-1">
                        <User size={14} /> {usuario.nombre} {usuario.apellido}
                      </p>
                      <p className="mt-1 text-sm text-cyan-600">
                        {usuario.email} · {usuario.rol} · {usuario.empresa}
                      </p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${usuario.estado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {usuario.estado ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPermiso("usuarios", "permisos") && usuario.rol !== "ADMIN" && (
                        <button
                          onClick={() => void abrirModalPermisos(usuario)}
                          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 inline-flex items-center gap-1.5"
                        >
                          <ShieldCheck size={13} /> Permisos
                        </button>
                      )}
                      {hasPermiso("usuarios", "editar") && (currentUserRole === "ADMIN" || usuario.rol === "COBRADOR") && (
                        <button
                          onClick={() => handleEdit(usuario)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 inline-flex items-center gap-1.5"
                        >
                          <Pencil size={13} /> Editar
                        </button>
                      )}
                      {hasPermiso("usuarios", "eliminar") && currentUserId !== usuario.id && (currentUserRole === "ADMIN" || usuario.rol === "COBRADOR") && (
                        <button
                          onClick={() => handleToggleEstadoUsuario(usuario)}
                          disabled={updatingEstadoId === usuario.id}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                            usuario.estado
                              ? "bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {updatingEstadoId === usuario.id ? "Procesando..." : usuario.estado ? "Inactivar" : "Activar"}
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
          ) : null}
        </section>
      </div>
      )} {/* end ADMIN/SUPERVISOR */}

      {/* ── Modal de asignación de permisos ── */}
      {permisosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sky-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-blue-900 inline-flex items-center gap-2">
                  <ShieldCheck size={18} className="text-violet-600" />
                  Permisos de {permisosModal.usuario.nombre} {permisosModal.usuario.apellido}
                </h2>
                <p className="mt-0.5 text-xs text-blue-500">
                  Rol: <span className="font-semibold">{permisosModal.rol}</span> · Marca los permisos que deseas otorgar
                </p>
              </div>
              <button
                onClick={cerrarModalPermisos}
                className="rounded-lg p-2 text-blue-500 transition hover:bg-sky-50 hover:text-blue-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {permisosModal.error && (
                <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {permisosModal.error}
                </div>
              )}

              {permisosModal.loading ? (
                <div className="flex items-center justify-center py-12 text-blue-500">
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Cargando permisos...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Agrupar permisos por módulo */}
                  {(() => {
                    const modulos = new Map<string, Permiso[]>();
                    permisosModal.catalogo.forEach((p) => {
                      if (!modulos.has(p.modulo)) modulos.set(p.modulo, []);
                      modulos.get(p.modulo)!.push(p);
                    });

                    const labels: Record<string, string> = {
                      clientes: "Clientes",
                      cobranzas: "Cobranzas",
                      gestiones: "Gestiones",
                      usuarios: "Usuarios",
                      empresas: "Empresas",
                      reportes: "Reportes",
                      configuracion: "Configuración",
                      zonas: "Zonas",
                      medios_pago: "Métodos de pago",
                      importar: "Importar",
                      descansos: "Descansos",
                      horarios: "Horarios",
                      mensajes: "Mensajes",
                    };

                    const accionLabels: Record<string, string> = {
                      ver: "Ver",
                      crear: "Crear",
                      editar: "Editar",
                      eliminar: "Eliminar",
                      permisos: "Gestionar permisos",
                      intereses: "Configurar intereses",
                    };

                    return Array.from(modulos.entries()).map(([modulo, permisos]) => {
                      const todosSeleccionados = permisos.every((p) =>
                        permisosModal.seleccionados.has(`${p.modulo}.${p.accion}`)
                      );
                      return (
                        <div key={modulo} className="rounded-lg border border-sky-200 bg-sky-50/30 p-4">
                          <label className="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={todosSeleccionados}
                              onChange={() => toggleModulo(modulo)}
                              className="h-4 w-4 rounded border-sky-400 accent-violet-600"
                            />
                            <span className="text-sm font-bold text-blue-900">
                              {labels[modulo] ?? modulo}
                            </span>
                          </label>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {permisos.map((p) => {
                              const key = `${p.modulo}.${p.accion}`;
                              const checked = permisosModal.seleccionados.has(key);
                              return (
                                <label
                                  key={key}
                                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                                    checked
                                      ? "border-violet-300 bg-violet-50 text-violet-800"
                                      : "border-sky-200 bg-white text-blue-700 hover:bg-sky-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermiso(key)}
                                    className="h-3.5 w-3.5 rounded border-sky-400 accent-violet-600"
                                  />
                                  {accionLabels[p.accion] ?? p.accion}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-sky-200 bg-white px-6 py-4">
              <button
                onClick={cerrarModalPermisos}
                className="rounded-lg border border-sky-300 bg-white px-6 py-2 font-semibold text-blue-900 transition hover:bg-sky-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void guardarPermisos()}
                disabled={permisosModal.loading || permisosModal.saving}
                className="rounded-lg bg-linear-to-r from-violet-600 to-blue-600 px-6 py-2 font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50 inline-flex items-center gap-2"
              >
                {permisosModal.saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} /> Guardar permisos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de estado ── */}
      <ConfirmDialog
        open={!!confirmEstado}
        title={confirmEstado?.accion === "activar" ? "Activar usuario" : "Inactivar usuario"}
        message={`¿Seguro que deseas ${confirmEstado?.accion ?? ""} este usuario?`}
        confirmLabel={confirmEstado?.accion === "activar" ? "Activar" : "Inactivar"}
        tone={confirmEstado?.accion === "activar" ? "info" : "danger"}
        onConfirm={ejecutarToggleEstadoUsuario}
        onCancel={() => setConfirmEstado(null)}
      />
    </PanelShell>
  );
}
