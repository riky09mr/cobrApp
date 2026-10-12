import { useCallback, useState } from 'react';
import { cobradorApi, CajaActiva } from '../api/cobradorApi';

export type CierreCajaResult = {
  arqueo_id: number;
  saldo_esperado: number;
  saldo_contado: number;
  diferencia: number;
};

/**
 * Hook que encapsula la lógica de la caja del día:
 * obtener la caja activa, abrir, registrar gastos y cerrar.
 * Evita duplicar esta lógica entre CajaScreen y PerfilScreen.
 */
export function useCaja() {
  const [caja, setCaja] = useState<CajaActiva | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [registrandoGasto, setRegistrandoGasto] = useState(false);

  /** Obtiene la caja activa del día. */
  const verificarCaja = useCallback(async () => {
    setCargando(true);
    try {
      const c = await cobradorApi.getCajaActiva();
      setCaja(c);
      return c;
    } finally {
      setCargando(false);
    }
  }, []);

  /** Abre una caja con el saldo inicial dado. */
  const abrirCaja = useCallback(async (saldoInicial: number) => {
    setAbriendo(true);
    try {
      const c = await cobradorApi.abrirCaja(saldoInicial);
      setCaja(c);
      return c;
    } finally {
      setAbriendo(false);
    }
  }, []);

  /** Registra un gasto en la caja abierta y refresca el resumen. */
  const registrarGasto = useCallback(async (concepto: string, monto: number) => {
    setRegistrandoGasto(true);
    try {
      if (!caja) throw new Error('No hay caja abierta');
      await cobradorApi.registrarGasto(caja.id, concepto, monto);
      await verificarCaja();
    } finally {
      setRegistrandoGasto(false);
    }
  }, [caja, verificarCaja]);

  /** Cierra la caja declarando el saldo contado. Devuelve el resultado del cierre. */
  const cerrarCaja = useCallback(async (saldoContado: number, observacion?: string): Promise<CierreCajaResult> => {
    setCerrando(true);
    try {
      const res = await cobradorApi.cerrarCaja(saldoContado, observacion);
      setCaja(null);
      return {
        arqueo_id: res.arqueo_id,
        saldo_esperado: res.saldo_esperado,
        saldo_contado: res.saldo_contado,
        diferencia: res.diferencia,
      };
    } finally {
      setCerrando(false);
    }
  }, []);

  return {
    caja,
    cargando,
    abriendo,
    cerrando,
    registrandoGasto,
    verificarCaja,
    abrirCaja,
    registrarGasto,
    cerrarCaja,
  };
}
