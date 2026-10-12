import { useCallback, useState } from 'react';
import { descansosApi, TipoDescanso, DescansoActivo } from '../api/descansosApi';

/**
 * Encapsula la lógica de descansos (activo + tipos) compartida entre
 * AgendaScreen y DescansoScreen.
 */
export function useDescanso() {
  const [activo, setActivo] = useState<DescansoActivo>(null);
  const [tipos, setTipos] = useState<TipoDescanso[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [act, tiposList] = await Promise.all([
        descansosApi.getActivo(),
        descansosApi.getTipos(),
      ]);
      setActivo(act);
      setTipos(tiposList);
      return act;
    } finally {
      setLoading(false);
    }
  }, []);

  const iniciar = useCallback(async (tipo: TipoDescanso) => {
    setSubmitting(true);
    try {
      await descansosApi.iniciar(tipo.id);
      await cargar();
    } finally {
      setSubmitting(false);
    }
  }, [cargar]);

  const finalizar = useCallback(async () => {
    setSubmitting(true);
    try {
      await descansosApi.finalizar();
      setActivo(null);
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { activo, tipos, loading, submitting, cargar, iniciar, finalizar };
}
