import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { colors } from '../theme/colors';
import client from '../api/client';

// Configura cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function solicitarPermisosNotificaciones(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cobrapp', {
      name: 'cobrApp',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.primary,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Obtiene el Expo Push Token del dispositivo y lo registra en el backend.
 * Debe llamarse después de iniciar sesión.
 * @returns {Promise<string | null>} El token registrado, o null si falló.
 */
export async function registrarTokenPush(): Promise<string | null> {
  try {
    // Solo funciona en dispositivos físicos (no en emulador/web)
    if (!Device.isDevice) {
      console.warn('[push] Los emuladores no soportan push de Expo.');
      return null;
    }

    const permiso = await solicitarPermisosNotificaciones();
    if (!permiso) {
      console.warn('[push] Permisos de notificación denegados.');
      return null;
    }

    // En Expo Go el projectId se infiere automáticamente.
    // Para builds standalone se puede pasar { projectId } explícito.
    const { data: token } = await Notifications.getExpoPushTokenAsync();

    const plataforma = Platform.OS; // 'android' | 'ios'

    await client.post('/api/push/registrar', { token, plataforma });
    return token;
  } catch (err) {
    console.warn('[push] No se pudo registrar el token:', err);
    return null;
  }
}

/**
 * Elimina el token push del backend (logout).
 */
export async function eliminarTokenPush(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await client.delete('/api/push/eliminar', { data: { token } });
  } catch (err) {
    console.warn('[push] No se pudo eliminar el token:', err);
  }
}

/**
 * Programa una notificación local para recordar una visita reagendada.
 * @param clienteNombre  Nombre del cliente
 * @param hora           Hora en formato "HH:MM"
 */
export async function programarNotificacionReagendado(
  clienteNombre: string,
  hora: string
): Promise<void> {
  const [h, m] = hora.split(':').map(Number);
  const ahora = new Date();
  const trigger = new Date(ahora);
  trigger.setHours(h, m, 0, 0);

  // Si la hora ya pasó hoy, no programar
  if (trigger <= ahora) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Visita reagendada',
      body: `Es hora de visitar a ${clienteNombre}`,
      data: { clienteNombre, hora },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });
}

/**
 * Muestra una notificación inmediata cuando llegan mensajes nuevos.
 */
export async function enviarNotificacionMensaje(
  remitenteNombre: string,
  cantidad: number,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nuevo mensaje',
      body:
        cantidad === 1
          ? `Mensaje de ${remitenteNombre}`
          : `${cantidad} mensajes nuevos de ${remitenteNombre}`,
      sound: true,
      data: { screen: 'Mensajes' },
    },
    trigger: null, // inmediata
  });
}

/**
 * Muestra una notificación inmediata cuando el almuerzo fue activado automáticamente.
 */
export async function notificarAlmuerzoAutomatico(hora: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Descanso de almuerzo activado',
      body: `El almuerzo fue activado automáticamente a las ${hora}`,
    },
    trigger: null, // inmediata
  });
}

/**
 * Muestra una notificación inmediata con el resumen del día al iniciar la app.
 * @param total      Total de cobros asignados para hoy
 * @param vencidas   Cuántos están con estado VENCIDA
 */
export async function notificarResumenDia(total: number, vencidas: number): Promise<void> {
  if (total === 0) return;
  const body =
    vencidas > 0
      ? `Tenés ${total} cobro${total !== 1 ? 's' : ''} hoy, ${vencidas} vencido${vencidas !== 1 ? 's' : ''}.`
      : `Tenés ${total} cobro${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''} para hoy.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Agenda del día',
      body,
    },
    trigger: null,
  });
}
