import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("cobrapp_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

type ApiResponse<T> = {
  data: T;
  message?: string;
  token?: string;
};

export type DashboardSummary =
  | {
      rol: "COBRADOR";
      asignacionesTotales: number;
      asignacionesPendientes: number;
      asignacionesCompletadas: number;
      cuotasVencidas: number;
      montoCobrado: number;
    }
  | {
      rol: "SUPERVISOR";
      cobradores: number;
      clientes: number;
      asignacionesTotales: number;
      asignacionesPendientes: number;
      asignacionesCompletadas: number;
      montoCobrado: number;
    }
  | {
      rol: "ADMIN";
      empresas: number;
      clientes: number;
      usuarios: number;
      cuotasPendientes: number;
      cuotasVencidas: number;
      cuotasPagadas: number;
      montoCobrado: number;
    };

export type Empresa = {
  id: number;
  razon_social: string;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logo_url: string | null;
  estado: number | boolean;
};

export type Cliente = {
  id: number;
  cedula: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  estado: number | boolean;
  empresa: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
};

export type Cobranza = {
  id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_cuota: string;
  saldo_cuota: string;
  estado: string;
  fecha_pago: string | null;
  credito_id: number;
  numero_credito: string | null;
  descripcion: string | null;
  monto_total: string;
  cantidad_cuotas: number;
  cliente_id: number;
  cedula: string | null;
  cliente: string;
  asignacion_id: number | null;
  fecha_limite_asignacion: string | null;
  cobrador_asignado_id: number | null;
  cobrador_asignado: string | null;
};

export type Gestion = {
  id: number;
  resultado: "cobrado" | "ausente" | "reagendado";
  monto_cobrado: string | null;
  medio_pago: string | null;
  comentario: string | null;
  nueva_hora: string | null;
  latitud: number | null;
  longitud: number | null;
  fecha_hora: string;
  foto_path: string | null;
  recibo_id: number | null;
  cobrador: string;
  cliente_nombre: string;
  cliente_apellido: string | null;
  cedula: string | null;
  numero_cuota: number;
  monto_cuota: string;
  numero_credito: string | null;
};

// ── Recibos y Notas de Crédito (DESACTIVADO) ──
// export type Recibo = {
//   id: number;
//   numero_recibo: string;
//   estado: string;
//   fecha_emision: string;
//   total_recibo: string;
//   moneda: string;
//   aplico_nota_credito: number | boolean;
//   monto_sobrepago: string | null;
//   saldo_a_favor: string | null;
//   nota_credito_id: number | null;
//   motivo_anulacion: string | null;
//   fecha_anulacion: string | null;
//   tipo_emision: string;
//   cdc: string | null;
//   cliente_nombre: string;
//   cliente_apellido: string | null;
//   cliente_cedula: string | null;
//   cobrador_nombre: string;
//   cobrador_apellido: string | null;
//   medio_pago_nombre: string | null;
//   monto_cobrado: string | null;
//   nro_comprobante: string | null;
//   numero_cuota: number | null;
//   monto_cuota: string | null;
//   numero_credito: string | null;
//   empresa_nombre: string;
// };
//
// export type ReciboListResponse = {
//   data: Recibo[];
//   total: number;
//   pagina: number;
//   porPagina: number;
// };
//
// export type ReciboFiltros = {
//   fechaDesde?: string;
//   fechaHasta?: string;
//   estado?: string;
//   busqueda?: string;
//   cobradorId?: number;
//   empresaId?: number;
//   pagina?: number;
//   porPagina?: number;
// };
//
// export type NotaCreditoResult = {
//   notaCreditoId: number;
//   numeroNC: string;
//   montoSobrepago: number;
// };

export type Usuario = {
  id: number;
  nombre: string;
  apellido: string;
  cedula?: string | null;
  email: string;
  telefono: string | null;
  estado: number | boolean;
  empresa: string;
  rol: string;
};

// ── Permisos ──

export type Permiso = {
  id: number;
  modulo: string;
  accion: string;
  descripcion: string;
};

export type PermisoUsuario = {
  permisos: string[]; // ["clientes.ver", "cobranzas.crear", ...]
  excepciones: Array<{
    permiso_id: number;
    modulo: string;
    accion: string;
    otorgado: number;
  }>;
  rol: string;
};

export type UsuarioLogin = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  empresaId: number;
  rol: string;
  empresa_nombre: string | null;
  empresa_logo: string | null;
  permisos?: string[];
};

export type Rol = {
  id: number;
  nombre: string;
  descripcion: string | null;
};

export type Cobrador = {
  id: number;
  nombre: string;
  apellido: string | null;
};

export type AsignacionCobrador = {
  asignacion_id: number;
  fecha_asignacion: string;
  fecha_limite: string | null;
  asignacion_estado: string;
  cuota_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_cuota: number;
  saldo_cuota: number;
  cuota_estado: string;
  fecha_pago: string | null;
  credito_id: number;
  numero_credito: string;
  descripcion: string | null;
  cliente_id: number;
  cedula: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  zona_id: number | null;
  zona_nombre: string | null;
  zona_color: string | null;
  ultimo_resultado: string | null;
  ultima_visita: string | null;
};

export type ResumenAsignacionesCobrador = {
  total_asignaciones: number;
  pendientes: number;
  completadas: number;
  cuotas_pagadas: number;
  monto_pendiente: number;
  monto_cobrado: number;
  zonas: string[];
};

export type PoligonoPoint = { lat: number; lng: number };

export type Zona = {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  poligono: PoligonoPoint[] | null;
  estado: number | boolean;
  cobrador_id: number | null;
  cobrador_nombre: string | null;
};

export type ClienteSinZona = {
  cliente_id: number;
  empresa_id: number;
  cliente: string;
  cedula: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
};

export type CuotaSinAsignar = {
  id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_cuota: string;
  saldo_cuota: string;
  estado: string;
  credito_id: number;
  numero_credito: string | null;
  descripcion: string | null;
  cliente_id: number;
  cliente: string;
  cedula: string | null;
  zona_id: number | null;
};

export type ReporteEficienciaCobrador = {
  cobrador_id: number;
  cobrador: string;
  empresa: string;
  total_asignaciones: number;
  completadas: number;
  pendientes: number;
  monto_cobrado: number;
  visitas_realizadas: number;
  visitas_cobradas: number;
  visitas_ausentes: number;
  visitas_reagendadas: number;
  eficiencia: number;
  tasa_efectividad_visitas: number;
};

export type ReporteMensual = {
  mes: string;
  cantidad_cobros: number;
  monto_mes: number;
};

export type ClienteMoroso = {
  cliente_id: number;
  cedula: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  cuotas_vencidas: number;
  creditos_vencidos: number;
  total_adeudado: number;
  max_dias_atraso: number;
  fecha_vencimiento_mas_antigua: string;
};

export type TotalesMorosidadCliente = {
  total_clientes: number;
  total_cuotas: number;
  total_creditos: number;
  total_adeudado: number;
};

export type CobradorDelDia = {
  cobrador_id: number;
  cobrador: string;
  empresa: string;
  asignaciones_dia: number;
  cobros_dia: number;
  monto_cobrado_dia: number;
  visitas_dia: number;
};

export type RankingCobrador = {
  posicion: number;
  cobrador_id: number;
  cobrador: string;
  empresa: string;
  total_asignaciones: number;
  completadas: number;
  pendientes: number;
  monto_cobrado: number;
  visitas_realizadas: number;
  visitas_cobradas: number;
  visitas_ausentes: number;
  visitas_reagendadas: number;
  tasa_efectividad_visitas: number;
};

// ── KPIs del marco teórico (Cárdenas 2021) ──

export type KpiDetalle = {
  [clave: string]: number | string | null;
};

export type KpiItem = {
  clave: string;
  nombre: string;
  valor: number | null;
  unidad: string;
  descripcion: string;
  detalle?: KpiDetalle;
};

export type ReporteKpiSimple = {
  fecha_desde: string;
  fecha_hasta: string;
  kpi: KpiItem;
  [clave: string]: unknown;
};

export type ResumenKpis = {
  periodo: { fecha_desde: string; fecha_hasta: string };
  kpis: KpiItem[];
};

export type FiltrosKpis = {
  empresa_id?: number;
  cobrador_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  costo_operativo?: number;
};

export type CreateCobranzaManualPayload = {
  cedula: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  descripcion?: string;
  monto_total: number;
  cantidad_cuotas?: number;
  periodicidad?: string;
  fecha_vencimiento: string;
  cobrador_id?: number;
  empresa_id?: number;
};

export type CreateUsuarioPayload = {
  nombre: string;
  apellido: string;
  cedula?: string;
  telefono?: string;
  email: string;
  password: string;
  rol_id: number;
  empresa_id: number;
};

export type CreateClientePayload = {
  cedula: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  latitud?: string | number;
  longitud?: string | number;
  empresa_id?: number;
  credito?: {
    numero_credito?: string;
    descripcion?: string;
    precio_contado?: number;
    entrega_inicial?: number;
    monto_total: number;
    cantidad_cuotas: number;
    cuotas_pagadas?: number;
    monto_cuota?: number;
    dia_pago?: number;
    periodicidad?: "SEMANAL" | "QUINCENAL" | "MENSUAL";
    tasa_interes?: number;
    fecha_otorgamiento?: string;
  };
};

export type ClienteSinUbicacion = {
  id: number;
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  empresa: string;
};

export type ImportResult = {
  total: number;
  importados: number;
  actualizados: number;
  sinUbicacion: number;
  creditosCreados: number;
  errores: Array<{ fila: number; error: string }>;
  erroresDuplicidad: number;
  duplicados: Array<{ fila: number; numero_credito: string; motivo?: string }>;
  archivoDuplicados: string | null;
  id_lote: number | null;
};

export type LoteImportacion = {
  id: number;
  empresa_id: number;
  usuario_id: number;
  nombre_archivo: string | null;
  total_filas: number;
  clientes_nuevos: number;
  clientes_actualizados: number;
  creditos_creados: number;
  errores: number;
  fecha_importacion: string;
  estado: string;
  usuario_nombre: string;
  usuario_apellido: string;
  empresa_nombre: string;
  creditos_count: number;
  asignados_count: number;
};

export type Conversacion = {
  id: number;
  nombre: string;
  apellido: string;
  rol: string;
  ultimo_mensaje: string | null;
  ultima_fecha: string | null;
  no_leidos: number;
};

export type MensajeChat = {
  id: number;
  emisor_id: number;
  receptor_id: number;
  contenido: string;
  imagen_url: string | null;
  leido: number;
  created_at: string;
  emisor_nombre: string;
};

export const authApi = {
  login: async (payload: { email: string; password: string }) => {
    const response = await api.post<
      ApiResponse<UsuarioLogin> & { debeCambiarPassword?: boolean }
    >("/api/auth/login", payload);
    if (response.data.token) {
      localStorage.setItem("cobrapp_token", response.data.token);
    }
    if (response.data.data) {
      localStorage.setItem("cobrapp_user", JSON.stringify(response.data.data));
    }
    return response.data;
  },
  register: async (payload: {
    nombreEmpresa: string;
    email: string;
    password: string;
    nombre?: string;
    apellido?: string;
  }) => {
    const response = await api.post<ApiResponse<{ empresaId: number; usuarioId: number }>>(
      "/api/auth/register",
      payload
    );
    return response.data;
  },
  logout: () => {
    localStorage.removeItem("cobrapp_token");
    localStorage.removeItem("cobrapp_user");
  },
};

export const panelApi = {
  getDashboardSummary: async () => {
    const response = await api.get<ApiResponse<DashboardSummary>>("/api/dashboard/summary");
    return response.data.data;
  },
  getEmpresas: async () => {
    const response = await api.get<ApiResponse<Empresa[]>>("/api/empresas");
    return response.data.data;
  },
  createEmpresa: async (data: { razon_social: string; ruc?: string; telefono?: string; email?: string; direccion?: string }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/empresas", data);
    return response.data.data;
  },
  updateEmpresa: async (id: number, data: { razon_social: string; ruc?: string; telefono?: string; email?: string; direccion?: string }) => {
    const response = await api.put<ApiResponse<null>>(`/api/empresas/${id}`, data);
    return response.data;
  },
  updateEstadoEmpresa: async (id: number, estado: boolean) => {
    const response = await api.patch<ApiResponse<null>>(`/api/empresas/${id}/estado`, { estado });
    return response.data;
  },
  uploadLogoEmpresa: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append("logo", file);
    const response = await api.patch<ApiResponse<{ logo_url: string }>>(
      `/api/empresas/${id}/logo`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },
  getClientes: async () => {
    const response = await api.get<ApiResponse<Cliente[]>>("/api/clientes");
    return response.data.data;
  },
  getCobranzas: async () => {
    const response = await api.get<ApiResponse<Cobranza[]>>("/api/cobranzas");
    return response.data.data;
  },
  registrarCobro: async (cuotaId: number, payload?: { medio_pago_id?: number; monto_cobrado?: number; nro_comprobante?: string }) => {
    const response = await api.patch<ApiResponse<{ message: string; visitaId?: number; recibo?: { reciboId: number; numeroRecibo: string } | null }>>(`/api/cobranzas/${cuotaId}/cobrar`, payload ?? {});
    return response.data;
  },
  updateFechaVencimiento: async (cuotaId: number, fecha_vencimiento: string) => {
    const response = await api.patch<ApiResponse<{ message: string; estado: string }>>(`/api/cobranzas/${cuotaId}/fecha`, { fecha_vencimiento });
    return response.data;
  },
  crearCobranzaManual: async (payload: CreateCobranzaManualPayload) => {
    const response = await api.post<ApiResponse<{ clienteId: number; creditoId: number; cuotaIds: number[]; asignacionId: number | null }>>("/api/cobranzas/manual", payload);
    return response.data;
  },
  asignarCobranza: async (cuotaId: number, payload: { cobrador_id: number; fecha_limite: string }) => {
    const response = await api.post<ApiResponse<{ message: string; asignacion_id: number }>>(`/api/cobranzas/${cuotaId}/asignar`, payload);
    return response.data;
  },
  getGestiones: async (params?: { cobradorId?: number; fechaDesde?: string; fechaHasta?: string; resultado?: string }) => {
    const response = await api.get<ApiResponse<Gestion[]>>("/api/gestiones", { params });
    return response.data.data;
  },
  getCobradores: async (empresa_id?: number) => {
    const response = await api.get<ApiResponse<Cobrador[]>>("/api/usuarios/cobradores", { params: empresa_id ? { empresa_id } : {} });
    return response.data.data;
  },
  getAsignacionesCobrador: async (cobradorId: number) => {
    const response = await api.get<ApiResponse<AsignacionCobrador[]>>(
      `/api/cobradores/${cobradorId}/asignaciones`
    );
    return response.data;
  },
  getZonas: async (empresa_id?: number) => {
    const response = await api.get<ApiResponse<Zona[]>>("/api/zonas", { params: empresa_id ? { empresa_id } : {} });
    return response.data.data;
  },
  createZona: async (payload: Partial<Omit<Zona, "id" | "cobrador_nombre">>) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/zonas", payload);
    return response.data;
  },
  updateZona: async (id: number, payload: Partial<Omit<Zona, "id" | "cobrador_nombre">>) => {
    const response = await api.put<ApiResponse<void>>(`/api/zonas/${id}`, payload);
    return response.data;
  },
  deleteZona: async (id: number) => {
    const response = await api.delete<ApiResponse<{ clientesDesasignados: number; cuotasDesasignadas: number; cobrador_id: number | null }>>(`/api/zonas/${id}`);
    return response.data;
  },
  getNoAsignadas: async (empresa_id?: number) => {
    const response = await api.get<ApiResponse<{ clientesSinZona: ClienteSinZona[]; cuotasSinAsignar: CuotaSinAsignar[] }>>("/api/zonas/no-asignadas", { params: empresa_id ? { empresa_id } : {} });
    return response.data.data;
  },
  asignarClienteZona: async (cliente_id: number, zona_id: number) => {
    const response = await api.post<ApiResponse<{ cliente_id: number; zona_id: number; zona_nombre: string; cuotasAsignadas: number; aviso: { zonaId: number; zonaNombre: string; cobradorNombre: string } | null }>>("/api/zonas/asignar-cliente", { cliente_id, zona_id });
    return response.data;
  },
  autoAsignar: async (empresa_id?: number) => {
    const response = await api.post<ApiResponse<{ asignadas: number; clientesUbicados: number }>>("/api/zonas/auto-asignar", { empresa_id });
    return response.data;
  },
  reasignarZona: async (id: number, payload?: { fecha_limite?: string }) => {
    const response = await api.post<ApiResponse<{ asignadas: number; reasignadas: number; clientesUbicados: number }>>(`/api/zonas/${id}/reasignar`, payload || {});
    return response.data;
  },
  getUsuarios: async () => {
    const response = await api.get<ApiResponse<Usuario[]>>("/api/usuarios");
    return response.data.data;
  },
  getPropioUsuario: async () => {
    const response = await api.get<ApiResponse<{ id: number; nombre: string; apellido: string; cedula: string | null; telefono: string | null; email: string; empresa: string; rol: string }>>("/api/usuarios/me");
    return response.data.data;
  },
  updatePerfil: async (payload: { nombre: string; apellido: string; cedula?: string; telefono?: string; email: string }) => {
    const response = await api.put<ApiResponse<{ nombre: string; apellido: string; email: string }>>("/api/usuarios/me", payload);
    return response.data;
  },
  getRoles: async () => {
    const response = await api.get<ApiResponse<Rol[]>>("/api/roles");
    return response.data.data;
  },
  createUsuario: async (payload: Partial<CreateUsuarioPayload>) => {
    const response = await api.post<ApiResponse<{ id: number; nombre: string; apellido: string; email: string; rol: string; passwordTemporal?: string }>>(
      "/api/usuarios",
      payload
    );
    return response.data;
  },
  updateUsuario: async (id: number, payload: Partial<CreateUsuarioPayload> & { resetPassword?: boolean }) => {
    const response = await api.put<ApiResponse<{ id: number; nombre: string; apellido: string; email: string; rol: string; passwordTemporal?: string }>>(
      `/api/usuarios/${id}`,
      payload
    );
    return response.data;
  },
  updateEstadoUsuario: async (id: number, estado: boolean) => {
    const response = await api.patch<ApiResponse<null>>(`/api/usuarios/${id}/estado`, { estado });
    return response.data;
  },
  changePassword: async (payload: { passwordActual: string; passwordNueva: string }) => {
    const response = await api.post<ApiResponse<void>>("/api/cambiar-password", payload);
    return response.data;
  },
  crearCliente: async (payload: CreateClientePayload) => {
    const response = await api.post<ApiResponse<{ id: number; credito_id: number | null; cuota_ids: number[] }>>("/api/clientes", payload);
    return response.data;
  },
  updateCliente: async (
    id: number,
    payload: { nombre: string; apellido?: string; cedula?: string; telefono?: string; email?: string; direccion?: string }
  ) => {
    const response = await api.put<ApiResponse<null>>(`/api/clientes/${id}`, payload);
    return response.data;
  },
  getClientesSinUbicacion: async () => {
    const response = await api.get<ApiResponse<ClienteSinUbicacion[]>>("/api/clientes/sin-ubicacion");
    return response.data.data;
  },
  updateUbicacionCliente: async (
    id: number,
    payload: { latitud?: number; longitud?: number; url_maps?: string }
  ) => {
    const response = await api.patch<ApiResponse<{ latitud: number; longitud: number }>>(
      `/api/clientes/${id}/ubicacion`,
      payload
    );
    return response.data;
  },
  importarClientes: async (file: File, empresa_id?: number) => {
    const formData = new FormData();
    formData.append("archivo", file);
    if (empresa_id) formData.append("empresa_id", String(empresa_id));
    const response = await api.post<ApiResponse<ImportResult>>("/api/clientes/importar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  descargarPlantilla: () => {
    window.open("http://localhost:5000/api/clientes/plantilla", "_blank");
  },
  descargarDuplicados: async (archivo: string) => {
    const response = await api.get(`/api/clientes/importar/duplicados/${archivo}`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = archivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  getLotesImportacion: async () => {
    const response = await api.get<ApiResponse<LoteImportacion[]>>("/api/clientes/lotes-importacion");
    return response.data.data;
  },
  eliminarLoteImportacion: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/api/clientes/lotes-importacion/${id}`);
    return response.data;
  },
  getConversaciones: async () => {
    const response = await api.get<ApiResponse<Conversacion[]>>("/api/mensajes");
    return response.data.data;
  },
  getConversacion: async (usuarioId: number) => {
    const response = await api.get<ApiResponse<MensajeChat[]>>(`/api/mensajes/${usuarioId}`);
    return response.data.data;
  },
  enviarMensaje: async (receptor_id: number, contenido: string, imagen?: File) => {
    if (imagen) {
      const form = new FormData();
      form.append("receptor_id", String(receptor_id));
      if (contenido.trim()) form.append("contenido", contenido.trim());
      form.append("imagen", imagen);
      const response = await api.post<ApiResponse<{ id: number; imagen_url: string | null }>>(
        "/api/mensajes", form, { headers: { "Content-Type": "multipart/form-data" } }
      );
      return response.data;
    }
    const response = await api.post<ApiResponse<{ id: number; imagen_url: string | null }>>("/api/mensajes", { receptor_id, contenido });
    return response.data;
  },
  getNoLeidos: async () => {
    const response = await api.get<ApiResponse<{ total: number }>>("/api/mensajes/no-leidos");
    return response.data.data;
  },
  getFacturaConfig: async (empresaId?: number) => {
    const url = empresaId ? `/api/facturas-config/${empresaId}` : "/api/facturas-config";
    const response = await api.get<ApiResponse<FacturaConfigCompleta | null>>(url);
    return response.data.data;
  },
  updateFacturaConfig: async (empresaId: number, data: FacturaConfigPayload) => {
    const response = await api.put<ApiResponse<{ message: string }>>(`/api/facturas-config/${empresaId}`, data);
    return response.data;
  },
  getTimbradoHistorial: async (empresaId: number) => {
    const response = await api.get<ApiResponse<FacturaTimbrado[]>>(`/api/facturas-timbrado/${empresaId}/historial`);
    return response.data.data;
  },
  // ── Recibos y Notas de Crédito (DESACTIVADO) ──
  // getRecibos: async (params?: ReciboFiltros) => {
  //   const response = await api.get<ReciboListResponse>("/api/recibos", { params });
  //   return response.data;
  // },
  // getRecibo: async (id: number) => {
  //   const response = await api.get<ApiResponse<Recibo>>(`/api/recibos/${id}`);
  //   return response.data.data;
  // },
  // anularRecibo: async (id: number, payload: { motivo: string; generar_nota_credito?: boolean }) => {
  //   const response = await api.post<ApiResponse<{ message: string; notaCreditoId?: number; numeroNC?: string }>>(`/api/recibos/${id}/anular`, payload);
  //   return response.data;
  // },
  // generarNotaCredito: async (id: number, payload: { monto_real_cobrado: number; motivo: string }) => {
  //   const response = await api.post<ApiResponse<NotaCreditoResult>>(`/api/recibos/${id}/nota-credito`, payload);
  //   return response.data;
  // },
};

/**
 * API de reportes — cada función acepta filtros opcionales
 */
export const reportesApi = {
  getEficienciaCobradores: async (filtros?: {
    empresa_id?: number;
    cobrador_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    eficiencia_min?: number;
  }) => {
    const response = await api.get<
      ApiResponse<ReporteEficienciaCobrador[]> & { mensual: ReporteMensual[] }
    >(
      "/api/reportes/cobrador/eficiencia",
      { params: filtros }
    );
    return {
      data: response.data.data,
      mensual: response.data.mensual ?? [],
    };
  },

  /**
   * Cartera vencida por antigüedad
   */
  getCarteraVencida: async (filtros?: {
    empresa_id?: number;
    fecha_corte?: string;
  }) => {
    type RangoCartera = {
      rango: string;
      cantidad_cuotas: number;
      cantidad_creditos: number;
      cantidad_clientes: number;
      monto_total: number;
    };
    type TotalesCartera = {
      total_cuotas: number;
      total_creditos: number;
      total_clientes: number;
      total_monto: number;
    };
    type DetalleDeudor = {
      cliente_id: number;
      cedula: string | null;
      nombre: string;
      apellido: string | null;
      cuotas_vencidas: number;
      total_adeudado: number;
      max_dias_atraso: number;
      fecha_vencimiento_mas_antigua: string;
    };

    const response = await api.get<
      ApiResponse<RangoCartera[]> & {
        totales: TotalesCartera;
        detalle: DetalleDeudor[];
        fecha_corte: string;
      }
    >("/api/reportes/cartera/vencida", { params: filtros });
    return {
      data: response.data.data,
      totales: response.data.totales,
      detalle: response.data.detalle,
      fecha_corte: response.data.fecha_corte,
    };
  },

  /**
   * Cobranza por período
   */
  getCobranzaPeriodo: async (filtros?: {
    empresa_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    agrupacion?: "diaria" | "semanal" | "mensual";
    cobrador_id?: number;
  }) => {
    type PeriodoCobranza = {
      periodo: string;
      cantidad_cobros: number;
      cobradores_activos: number;
      monto_cobrado: number;
      promedio_por_cobro: number;
    };
    type TotalesPeriodo = {
      total_cobros: number;
      total_cobradores: number;
      total_monto: number;
      promedio_general: number;
    };
    type CobradorOpcion = {
      id: number;
      nombre: string;
      apellido: string;
    };

    const response = await api.get<
      ApiResponse<PeriodoCobranza[]> & {
        totales: TotalesPeriodo;
        cobradores: CobradorOpcion[];
        filtros: {
          fecha_desde: string;
          fecha_hasta: string;
          agrupacion: string;
        };
      }
    >("/api/reportes/periodo/cobranza", { params: filtros });
    return {
      data: response.data.data,
      totales: response.data.totales,
      cobradores: response.data.cobradores,
      filtros: response.data.filtros,
    };
  },

  /**
   * Rotación de Cartera — monto cobrado sobre cartera vigente (anualizado)
   */
  getKpiRotacion: async (filtros?: FiltrosKpis) => {
    const response = await api.get<ApiResponse<ReporteKpiSimple>>(
      "/api/reportes/kpis/rotacion",
      { params: filtros }
    );
    return response.data.data;
  },

  /**
   * Cobertura de Cobro — asignaciones con visita sobre el total asignado
   */
  getKpiCobertura: async (filtros?: FiltrosKpis) => {
    const response = await api.get<ApiResponse<ReporteKpiSimple>>(
      "/api/reportes/kpis/cobertura",
      { params: filtros }
    );
    return response.data.data;
  },

  /**
   * Tasa de Reagendamiento — visitas reagendadas sobre el total
   */
  getKpiReagendamiento: async (filtros?: FiltrosKpis) => {
    const response = await api.get<ApiResponse<ReporteKpiSimple>>(
      "/api/reportes/kpis/reagendamiento",
      { params: filtros }
    );
    return response.data.data;
  },

  /**
   * Costo por Gestión — costo operativo entre gestiones (requiere costo_operativo)
   */
  getKpiCosto: async (filtros?: FiltrosKpis) => {
    const response = await api.get<ApiResponse<ReporteKpiSimple>>(
      "/api/reportes/kpis/costo",
      { params: filtros }
    );
    return response.data.data;
  },

  /**
   * Resumen de los 6 KPIs del marco teórico en un solo reporte
   */
  getKpisResumen: async (filtros?: FiltrosKpis) => {
    const response = await api.get<ApiResponse<ResumenKpis>>(
      "/api/reportes/kpis/resumen",
      { params: filtros }
    );
    return response.data.data;
  },

  /**
   * Morosidad por cliente — clientes con cuotas vencidas
   */
  getMorosidadCliente: async (filtros?: {
    empresa_id?: number;
    fecha_corte?: string;
  }) => {
    const response = await api.get<
      ApiResponse<ClienteMoroso[]> & {
        totales: TotalesMorosidadCliente;
        fecha_corte: string;
      }
    >("/api/reportes/cliente/morosidad", { params: filtros });
    return {
      data: response.data.data,
      totales: response.data.totales,
      fecha_corte: response.data.fecha_corte,
    };
  },

  /**
   * Cobradores del día — actividad de cobradores en una fecha puntual
   */
  getCobradoresDia: async (filtros?: { fecha?: string }) => {
    const response = await api.get<
      ApiResponse<CobradorDelDia[]> & { fecha: string }
    >("/api/reportes/cobradores/dia", { params: filtros });
    return {
      data: response.data.data,
      fecha: response.data.fecha,
    };
  },

  /**
   * Ranking de cobradores por monto cobrado en un período
   */
  getRankingCobradores: async (filtros?: {
    empresa_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) => {
    const response = await api.get<
      ApiResponse<RankingCobrador[]> & {
        fecha_desde: string | null;
        fecha_hasta: string | null;
      }
    >("/api/reportes/cobrador/ranking", { params: filtros });
    return {
      data: response.data.data,
      fecha_desde: response.data.fecha_desde,
      fecha_hasta: response.data.fecha_hasta,
    };
  },
};

export type FacturaEmisor = {
  id?: number;
  empresa_id: number;
  razon_social: string | null;
  ruc: string | null;
  ruc_dv: string | null;
  direccion: string | null;
  actividad_economica: string | null;
};

/**
 * Timbrado autorizado por la DNIT.
 * Incluye el establecimiento, punto de emision y rango de numeracion.
 * es_electronica = false → Factura impresa (solo PDF)
 * es_electronica = true  → Documento Electronico SIFEN (CDC + XML + QR)
 */
export type FacturaTimbrado = {
  id?: number;
  empresa_id: number;
  numero_timbrado: string;
  establecimiento: string;    // 3 digitos ej. "001"
  punto_emision: string;      // 3 digitos ej. "001"
  fecha_inicio: string | null;       // ISO "YYYY-MM-DD"
  fecha_vencimiento: string | null;  // ISO "YYYY-MM-DD"
  numero_desde: number;
  numero_hasta: number;
  numero_actual: number;
  es_electronica: number | boolean;
  activo: number | boolean;
};

export type FacturaConfigCompleta = {
  emisor: FacturaEmisor | null;
  timbrado: FacturaTimbrado | null;
};

export type FacturaConfigPayload = {
  emisor?: Partial<FacturaEmisor>;
  timbrado?: Partial<FacturaTimbrado>;
};

export type TipoDescanso = {
  id: number;
  nombre: string;
  es_obligatorio: number | boolean;
  hora_inicio: string | null;
  hora_fin_auto: string | null;
  activo: number | boolean;
  created_at: string;
};

export type DescansoReporte = {
  id: number;
  fecha: string;
  hora_inicio_real: string;
  hora_fin_real: string;
  duracion_minutos: number | null;
  activado_auto: number;
  comentario: string | null;
  tipo_nombre: string;
  cobrador_nombre: string;
  cobrador_apellido: string | null;
};

export type HorarioCobrador = {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: number;
};

export type ExcepcionHorario = {
  id: number;
  fecha: string;
  tipo: 'LIBRE' | 'HORARIO_ESPECIAL';
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string | null;
};

export const descansosApi = {
  getTipos: async () => {
    const response = await api.get<ApiResponse<TipoDescanso[]>>("/api/descansos/tipos");
    return response.data.data;
  },
  crearTipo: async (payload: { nombre: string; esObligatorio: boolean; horaInicio?: string | null; horaFinAuto?: string | null }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/descansos/tipos", payload);
    return response.data;
  },
  editarTipo: async (id: number, payload: Partial<{ nombre: string; esObligatorio: boolean; horaInicio: string | null; horaFinAuto: string | null; activo: boolean }>) => {
    const response = await api.put<ApiResponse<void>>(`/api/descansos/tipos/${id}`, payload);
    return response.data;
  },
  desactivarTipo: async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(`/api/descansos/tipos/${id}`);
    return response.data;
  },
  getReporte: async (params?: { cobradorId?: number; fecha?: string }) => {
    const response = await api.get<ApiResponse<DescansoReporte[]>>("/api/descansos/reporte", { params });
    return response.data.data;
  },
};

export type MedioPago = {
  id: number;
  nombre: string;
  requiere_comprobante: boolean;
  activo: boolean;
};

export type TimbradoV12 = {
  id: number;
  empresa_id: number;
  numero_timbrado: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'BORRADOR' | 'VIGENTE' | 'VENCIDO' | 'ANULADO' | 'INACTIVO';
  observaciones: string | null;
  es_electronico: boolean | number;
};

export type EstablecimientoV12 = {
  id: number;
  empresa_id: number;
  timbrado_id: number | null;
  codigo: string;
  descripcion: string;
  activo: boolean | number;
};

export type PuntoExpedicionV12 = {
  id: number;
  empresa_id: number;
  timbrado_id: number;
  establecimiento_id: number;
  establecimiento_codigo?: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean | number;
};

export type CajaV12 = {
  id: number;
  empresa_id: number;
  punto_expedicion_id: number;
  nombre: string;
  estado: 'ACTIVA' | 'BLOQUEADA' | 'INACTIVA';
  cobrador_asignado_id: number | null;
  cobrador_nombre?: string | null;
  saldo_inicial_referencia: string | number;
  saldo_actual: string | number;
  fecha_apertura_actual: string | null;
  fecha_cierre_actual: string | null;
  establecimiento_codigo?: string;
  punto_codigo?: string;
};

export type NumeradorV12 = {
  id: number;
  empresa_id: number;
  timbrado_id: number;
  establecimiento_id: number;
  punto_expedicion_id: number;
  tipo_documento: 'RECIBO_COBRANZA' | 'FACTURA_CONTADO' | 'FACTURA_CREDITO' | 'NOTA_CREDITO';
  serie: string;
  numero_desde: number;
  numero_hasta: number;
  ultimo_numero_asignado: number;
  activo: boolean | number;
  bloqueado: boolean | number;
  numero_timbrado?: string;
  establecimiento_codigo?: string;
  punto_codigo?: string;
};

export const cobranzasConfigApi = {
  getTimbrados: async (empresaId?: number) => {
    const response = await api.get<ApiResponse<TimbradoV12[]>>("/api/configuracion/cobranzas/timbrados", {
      params: empresaId ? { empresa_id: empresaId } : undefined,
    });
    return response.data.data;
  },
  createTimbrado: async (payload: Partial<TimbradoV12> & { empresa_id?: number }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/configuracion/cobranzas/timbrados", payload);
    return response.data;
  },
  updateTimbrado: async (id: number, payload: Partial<TimbradoV12> & { empresa_id?: number }) => {
    const response = await api.put<ApiResponse<void>>(`/api/configuracion/cobranzas/timbrados/${id}`, payload);
    return response.data;
  },
  getEstablecimientos: async (empresaId?: number) => {
    const response = await api.get<ApiResponse<EstablecimientoV12[]>>("/api/configuracion/cobranzas/establecimientos", {
      params: empresaId ? { empresa_id: empresaId } : undefined,
    });
    return response.data.data;
  },
  createEstablecimiento: async (payload: Partial<EstablecimientoV12> & { empresa_id?: number }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/configuracion/cobranzas/establecimientos", payload);
    return response.data;
  },
  updateEstablecimiento: async (id: number, payload: Partial<EstablecimientoV12> & { empresa_id?: number }) => {
    const response = await api.put<ApiResponse<void>>(`/api/configuracion/cobranzas/establecimientos/${id}`, payload);
    return response.data;
  },
  getPuntosExpedicion: async (empresaId?: number) => {
    const response = await api.get<ApiResponse<PuntoExpedicionV12[]>>("/api/configuracion/cobranzas/puntos-expedicion", {
      params: empresaId ? { empresa_id: empresaId } : undefined,
    });
    return response.data.data;
  },
  createPuntoExpedicion: async (payload: Partial<PuntoExpedicionV12> & { empresa_id?: number }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/configuracion/cobranzas/puntos-expedicion", payload);
    return response.data;
  },
  updatePuntoExpedicion: async (id: number, payload: Partial<PuntoExpedicionV12> & { empresa_id?: number }) => {
    const response = await api.put<ApiResponse<void>>(`/api/configuracion/cobranzas/puntos-expedicion/${id}`, payload);
    return response.data;
  },
  getCajas: async (empresaId?: number) => {
    const response = await api.get<ApiResponse<CajaV12[]>>("/api/configuracion/cobranzas/cajas", {
      params: empresaId ? { empresa_id: empresaId } : undefined,
    });
    return response.data.data;
  },
  createCaja: async (payload: Partial<CajaV12> & { empresa_id?: number }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/configuracion/cobranzas/cajas", payload);
    return response.data;
  },
  updateCaja: async (id: number, payload: Partial<CajaV12> & { empresa_id?: number }) => {
    const response = await api.put<ApiResponse<void>>(`/api/configuracion/cobranzas/cajas/${id}`, payload);
    return response.data;
  },
  getNumeradores: async (empresaId?: number) => {
    const response = await api.get<ApiResponse<NumeradorV12[]>>("/api/configuracion/cobranzas/numeradores", {
      params: empresaId ? { empresa_id: empresaId } : undefined,
    });
    return response.data.data;
  },
  createNumerador: async (payload: Partial<NumeradorV12> & { empresa_id?: number }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/configuracion/cobranzas/numeradores", payload);
    return response.data;
  },
  updateNumerador: async (id: number, payload: Partial<NumeradorV12> & { empresa_id?: number }) => {
    const response = await api.put<ApiResponse<void>>(`/api/configuracion/cobranzas/numeradores/${id}`, payload);
    return response.data;
  },
};

export type EmpresaInteresesConfig = {
  empresa_id: number;
  generar_interes: boolean | number;
  dias_gracia: number;
  porcentaje_interes_diario: number | string;
  contar_domingos: boolean | number;
  contar_feriados: boolean | number;
};

export type FeriadoEmpresa = {
  id: number;
  empresa_id: number;
  fecha: string;
  fecha_original: string | null;
  descripcion: string | null;
  origen: string | null;
};

export const interesesConfigApi = {
  getConfiguracion: async (empresaId?: number) => {
    const response = await api.get<ApiResponse<{ config: EmpresaInteresesConfig; feriados: FeriadoEmpresa[] }>>(
      "/api/configuracion/intereses",
      { params: empresaId ? { empresa_id: empresaId } : undefined }
    );
    return response.data.data;
  },
  updateConfiguracion: async (payload: Partial<EmpresaInteresesConfig> & { empresa_id?: number }) => {
    const response = await api.put<ApiResponse<void>>("/api/configuracion/intereses", payload);
    return response.data;
  },
  crearFeriado: async (payload: { fecha: string; descripcion?: string; aplicar_a_todas?: boolean } & { empresa_id?: number }) => {
    const response = await api.post<{
      message: string;
      id?: number;
      creadas?: number[];
      omitidas?: { empresa_id: number; motivo: string }[];
    }>("/api/configuracion/intereses/feriados", payload);
    return response.data;
  },
  actualizarFeriado: async (
    id: number,
    payload: { fecha: string; descripcion?: string; aplicar_a_todas?: boolean } & { empresa_id?: number }
  ) => {
    const response = await api.put<{
      message: string;
      actualizadas?: number[];
      omitidas?: { empresa_id: number; motivo: string }[];
    }>(`/api/configuracion/intereses/feriados/${id}`, payload);
    return response.data;
  },
  eliminarFeriado: async (id: number, empresaId?: number) => {
    const response = await api.delete<ApiResponse<void>>(`/api/configuracion/intereses/feriados/${id}`, {
      params: empresaId ? { empresa_id: empresaId } : undefined,
    });
    return response.data;
  },
  recalcular: async (payload: { fecha_corte?: string } & { empresa_id?: number }) => {
    const response = await api.post<ApiResponse<{ fecha_corte: string; procesadas: number; actualizadas: number }>>(
      "/api/configuracion/intereses/recalcular",
      payload
    );
    return response.data;
  },
};

export const mediosPagoApi = {
  getAll: async () => {
    const response = await api.get<ApiResponse<MedioPago[]>>("/api/medios-pago");
    return response.data.data;
  },
  crear: async (payload: { nombre: string; requiere_comprobante: boolean }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/medios-pago", payload);
    return response.data;
  },
  actualizar: async (id: number, payload: Partial<{ nombre: string; requiere_comprobante: boolean; activo: boolean }>) => {
    const response = await api.put<ApiResponse<void>>(`/api/medios-pago/${id}`, payload);
    return response.data;
  },
};

export const horariosApi = {
  getHorarios: async (cobradorId: number) => {
    const response = await api.get<ApiResponse<HorarioCobrador[]>>(`/api/supervisor/horarios/${cobradorId}`);
    return response.data.data;
  },
  guardarHorario: async (payload: { cobradorId: number; diaSemana: number; horaInicio: string; horaFin: string }) => {
    const response = await api.post<ApiResponse<{ id: number }>>("/api/supervisor/horarios", payload);
    return response.data;
  },
  eliminarHorario: async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(`/api/supervisor/horarios/${id}`);
    return response.data;
  },
  getExcepciones: async (cobradorId: number) => {
    const response = await api.get<ApiResponse<ExcepcionHorario[]>>(`/api/supervisor/horarios/${cobradorId}/excepciones`);
    return response.data.data;
  },
  crearExcepcion: async (cobradorId: number, payload: { fecha: string; tipo: string; horaInicio?: string; horaFin?: string; motivo?: string }) => {
    const response = await api.post<ApiResponse<{ id: number }>>(`/api/supervisor/horarios/${cobradorId}/excepciones`, payload);
    return response.data;
  },
  eliminarExcepcion: async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(`/api/supervisor/horarios/excepciones/${id}`);
    return response.data;
  },
};

export const permisosApi = {
  getMisPermisos: async () => {
    const response = await api.get<ApiResponse<{ permisos: string[] }>>("/api/permisos");
    return response.data.data;
  },
  getCatalogo: async () => {
    const response = await api.get<ApiResponse<{ permisos: Permiso[] }>>("/api/permisos/catalogo");
    return response.data.data;
  },
  getPermisosUsuario: async (usuarioId: number) => {
    const response = await api.get<ApiResponse<PermisoUsuario>>(`/api/permisos/usuario/${usuarioId}`);
    return response.data.data;
  },
  asignarPermisos: async (usuarioId: number, permisos: string[]) => {
    const response = await api.put<ApiResponse<{ message: string }>>(`/api/permisos/usuario/${usuarioId}`, { permisos });
    return response.data;
  },
};

export default api;
