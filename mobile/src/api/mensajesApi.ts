import client, { BASE_URL } from './client';

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

export type ImagenAdjunta = {
  uri: string;
  name: string;
  type: string;
};

export function buildImagenUrl(imagen_url: string | null): string | null {
  if (!imagen_url) return null;
  return `${BASE_URL}${imagen_url}`;
}

export const mensajesApi = {
  getConversaciones: () =>
    client.get<{ data: Conversacion[] }>('/api/mensajes').then(r => r.data.data),
  getConversacion: (usuarioId: number) =>
    client.get<{ data: MensajeChat[] }>(`/api/mensajes/${usuarioId}`).then(r => r.data.data),
  enviarMensaje: (receptor_id: number, contenido: string, imagen?: ImagenAdjunta) => {
    if (imagen) {
      const form = new FormData();
      form.append('receptor_id', String(receptor_id));
      if (contenido.trim()) form.append('contenido', contenido.trim());
      form.append('imagen', { uri: imagen.uri, name: imagen.name, type: imagen.type } as unknown as Blob);
      return client.post<{ message: string; data: { id: number; imagen_url: string | null } }>(
        '/api/mensajes',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      ).then(r => r.data);
    }
    return client.post<{ message: string; data: { id: number; imagen_url: string | null } }>(
      '/api/mensajes',
      { receptor_id, contenido }
    ).then(r => r.data);
  },
};
