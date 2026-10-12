import client from './client';

export type TipoDescanso = {
  id: number;
  nombre: string;
  es_obligatorio: number;
  hora_inicio: string | null;
  hora_fin_auto: string | null;
};

export type DescansoActivo = {
  id: number;
  hora_inicio_real: string;
  activado_auto: number;
  comentario: string | null;
  tipo_nombre: string;
  es_obligatorio: number;
} | null;

export const descansosApi = {
  getTipos: async (): Promise<TipoDescanso[]> => {
    const res = await client.get('/api/descansos/tipos');
    return res.data.data;
  },

  getActivo: async (): Promise<DescansoActivo> => {
    const res = await client.get('/api/cobrador/descansos/activo');
    return res.data.data;
  },

  iniciar: async (tipoDescansoId: number, comentario?: string) => {
    const res = await client.post('/api/cobrador/descansos/iniciar', { tipoDescansoId, comentario });
    return res.data;
  },

  finalizar: async () => {
    const res = await client.post('/api/cobrador/descansos/finalizar');
    return res.data;
  },
};
