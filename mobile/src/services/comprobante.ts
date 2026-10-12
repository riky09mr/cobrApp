import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api/client';

/**
 * Descarga el comprobante fiscal (PDF) de un cobro y lo guarda de forma
 * visible: en Android pide elegir carpeta (ej: Descargas) y en iOS/iPadOS
 * (o si se cancela el selector) abre el menú de compartir.
 *
 * @param visitaId ID de la visita_cobro
 * @returns true si se guardó/compartió, false si no hay comprobante o se canceló
 */
export async function verComprobante(visitaId: number): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem('cobrapp_token');
    const url = `${BASE_URL}/api/cobrador/cobros/${visitaId}/comprobante`;
    const localPath = (FileSystem.cacheDirectory ?? '') + `comprobante_${visitaId}.pdf`;
    const res = await FileSystem.downloadAsync(url, localPath, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    if (res.status !== 200) {
      if (res.status === 404) {
        Alert.alert(
          'Sin comprobante',
          'Este cobro no tiene comprobante de pago generado.'
        );
      } else {
        Alert.alert('Error', `No se pudo descargar el comprobante (HTTP ${res.status})`);
      }
      return false;
    }
    const { uri } = res;

    // Android: elegir carpeta (ej: Descargas) y guardar el PDF de forma visible
    if (Platform.OS === 'android') {
      try {
        const dir = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (dir.granted && dir.directoryUri) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const destino = await FileSystem.StorageAccessFramework.createFileAsync(
            dir.directoryUri,
            `comprobante_${visitaId}.pdf`,
            'application/pdf'
          );
          await FileSystem.writeAsStringAsync(destino, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert('Guardado', 'Comprobante guardado en la carpeta seleccionada');
          return true;
        }
      } catch {
        // Si SAF falla, se cae al share como respaldo
      }
    }

    // iOS o si se canceló el selector: menú compartir
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Comprobante de cobro',
        UTI: 'com.adobe.pdf',
      });
      return true;
    }
    Alert.alert('Descargado', `PDF guardado en: ${uri}`);
    return true;
  } catch {
    Alert.alert('Error', 'No se pudo descargar el comprobante');
    return false;
  }
}
