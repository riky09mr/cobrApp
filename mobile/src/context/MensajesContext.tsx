import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { mensajesApi } from '../api/mensajesApi';
import { enviarNotificacionMensaje } from '../utils/notifications';
import { useAuth } from './AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type MensajesCtx = {
  noLeidos: number;
  refrescar: () => Promise<void>;
};

const MensajesCtxDefault: MensajesCtx = { noLeidos: 0, refrescar: async () => {} };
const MensajesCtx = createContext<MensajesCtx>(MensajesCtxDefault);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MensajesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [noLeidos, setNoLeidos] = useState(0);

  // prevCount = -1 significa primera carga (no disparar notificación)
  const prevCount = useRef<number>(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refrescar = useCallback(async () => {
    if (!user) return;
    try {
      const convs = await mensajesApi.getConversaciones();
      const total = convs.reduce((sum, c) => sum + (c.no_leidos ?? 0), 0);

      // Disparar notificación solo si ya pasó la carga inicial y el conteo subió
      if (prevCount.current >= 0 && total > prevCount.current) {
        // Encontrar el remitente con más mensajes nuevos
        const conNoLeidos = convs
          .filter(c => c.no_leidos > 0)
          .sort((a, b) => b.no_leidos - a.no_leidos);
        if (conNoLeidos.length > 0) {
          await enviarNotificacionMensaje(
            conNoLeidos[0].nombre,
            total - prevCount.current,
          ).catch(() => null);
        }
      }

      prevCount.current = total;
      setNoLeidos(total);
    } catch {
      // silencioso — puede fallar si el token expiró u off-line
    }
  }, [user]);

  // Iniciar / detener polling al loguear / desloguear
  useEffect(() => {
    if (!user) {
      setNoLeidos(0);
      prevCount.current = -1;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    void refrescar(); // primera carga inmediata
    intervalRef.current = setInterval(refrescar, 30_000); // polling cada 30 s
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, refrescar]);

  // Refrescar también al volver al primer plano
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refrescar();
    });
    return () => sub.remove();
  }, [refrescar]);

  return (
    <MensajesCtx.Provider value={{ noLeidos, refrescar }}>
      {children}
    </MensajesCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useMensajesContext = () => useContext(MensajesCtx);
