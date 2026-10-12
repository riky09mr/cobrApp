import client from './client';

export type AgendaItem = {
  asignacion_id: number;
  fecha_limite: string;
  asignacion_estado: string;
  cuota_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_cuota: string;
  saldo_cuota: string;
  cuota_estado: string;
  credito_id: number;
  numero_credito: string | null;
  descripcion: string | null;
  cliente_id: number;
  cedula: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  ultimo_resultado: 'cobrado' | 'ausente' | 'reagendado' | null;
  reagendado_hora: string | null;
};

export type CuotaPendiente = {
  asignacion_id: number;
  asignacion_estado: string;
  cuota_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_cuota: string;
  saldo_cuota: string;
  cuota_estado: string;
  credito_id: number;
  numero_credito: string | null;
  descripcion: string | null;
  cliente_id: number;
  nombre: string;
  apellido: string | null;
};

export type RegistrarCobroPayload = {
  asignacionId?: number;
  asignacionIds?: number[];
  monto: number;
  medioPagoId: number;
  nroComprobante?: string;
  latitud?: number;
  longitud?: number;
  fechaHora?: string;
};

export type CajaActiva = {
  id: number;
  fecha_apertura: string;
  saldo_inicial: number;
  estado: 'ABIERTO' | 'CERRADO';
  total_efectivo: number;
  total_otros: number;
  cantidad_cobros: number;
  total_gastos: number;
  saldo_esperado: number;
  es_de_otro_dia?: boolean;
};

export type MedioPago = {
  id: number;
  nombre: string;
  requiere_comprobante: boolean;
  activo: boolean;
};

export type RegistrarVisitaPayload = {
  asignacionId: number;
  resultado: 'ausente' | 'reagendado';
  latitud?: number;
  longitud?: number;
  comentario?: string;
  fechaHora?: string;
  nuevaHora?: string;
};

export type CobroDelDia = {
  visita_id: number;
  fecha_hora: string;
  monto_cobrado: string;
  nro_comprobante: string | null;
  medio_pago_id: number | null;
  medio_pago_nombre: string | null;
  recibo_id: number | null;
  numero_recibo: string | null;
  cliente_nombre: string;
  cliente_apellido: string | null;
  cliente_cedula: string | null;
  numero_cuota: number;
  numero_credito: string | null;
};

export const cobradorApi = {
  getAgenda: async (fecha?: string): Promise<AgendaItem[]> => {
    const params = fecha ? { fecha } : {};
    const res = await client.get('/api/cobrador/agenda', { params });
    return res.data.data;
  },

  getCuotasPendientesCredito: async (creditoId: number): Promise<CuotaPendiente[]> => {
    const res = await client.get(`/api/cobrador/creditos/${creditoId}/cuotas-pendientes`);
    return res.data.data;
  },

  registrarCobro: async (payload: RegistrarCobroPayload) => {
    const res = await client.post('/api/cobrador/cobros', payload);
    return res.data;
  },

  getCobrosDelDia: async (fecha?: string): Promise<CobroDelDia[]> => {
    const params = fecha ? { fecha } : {};
    const res = await client.get('/api/cobrador/cobros', { params });
    return res.data.data;
  },

  registrarVisita: async (payload: RegistrarVisitaPayload) => {
    const res = await client.post('/api/cobrador/visitas', payload);
    return res.data;
  },

  // ── Caja ──────────────────────────────────────────────────
  getCajaActiva: async (): Promise<CajaActiva | null> => {
    const res = await client.get('/api/cobrador/caja/activa');
    return res.data.data;
  },

  abrirCaja: async (saldo_inicial = 0): Promise<{ arqueo_id: number }> => {
    const res = await client.post('/api/cobrador/caja/abrir', { saldo_inicial });
    return res.data;
  },

  cerrarCaja: async (saldo_contado: number, observacion?: string) => {
    const res = await client.post('/api/cobrador/caja/cerrar', { saldo_contado, observacion });
    return res.data;
  },

  registrarGasto: async (arqueoId: number, concepto: string, monto: number) => {
    const res = await client.post(`/api/cobrador/caja/${arqueoId}/gastos`, { concepto, monto });
    return res.data;
  },

  getMediosPago: async (): Promise<MedioPago[]> => {
    const res = await client.get('/api/medios-pago');
    return res.data.data;
  },

  subirFoto: async (visitaId: number, fotoUri: string) => {
    const formData = new FormData();
    formData.append('foto', {
      uri: fotoUri,
      name: `evidencia_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
    const res = await client.post(`/api/cobrador/visitas/${visitaId}/foto`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
