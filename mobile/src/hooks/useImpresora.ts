import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getBondedPrinters,
  getPreferredPrinter,
  printTestTicket,
  setPreferredPrinter,
} from '../services/thermalPrinter';

/**
 * Encapsula la lógica de configuración y prueba de la impresora térmica.
 * Compartida entre PerfilScreen y cualquier otra pantalla que la necesite.
 */
export function useImpresora() {
  const configurar = useCallback(async () => {
    try {
      const bonded = await getBondedPrinters();
      if (bonded.length === 0) {
        Alert.alert(
          'Sin impresoras',
          'Emparejá primero la impresora desde Ajustes Bluetooth del celular.'
        );
        return;
      }

      const preferred = await getPreferredPrinter();
      const options = bonded.slice(0, 6).map((d) => {
        const label = `${d.name || 'Dispositivo'} (${d.address})${preferred === d.address ? ' - Actual' : ''}`;
        return {
          text: label,
          onPress: () => {
            setPreferredPrinter(d.address)
              .then(() => Alert.alert('Impresora guardada', label))
              .catch(() => Alert.alert('Error', 'No se pudo guardar la impresora'));
          },
        };
      });

      Alert.alert('Elegir impresora', 'Seleccioná la impresora térmica', [
        ...options,
        { text: 'Cancelar', style: 'cancel' },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cargar impresoras';
      Alert.alert('Bluetooth', message);
    }
  }, []);

  const probar = useCallback(async () => {
    try {
      await printTestTicket();
      Alert.alert('Impresion OK', 'Se envió ticket de prueba a la impresora.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo imprimir el test';
      Alert.alert('Error de impresion', message);
    }
  }, []);

  return { configurar, probar };
}
