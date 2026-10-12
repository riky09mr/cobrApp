import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// En emulador Android: 10.0.2.2  |  En dispositivo físico: IP local de tu PC en Wi-Fi
export const BASE_URL = 'http://192.168.108.42:5000'; // IP actual
//export const BASE_URL = 'http://192.168.108.43:5000'; // IP anterior

// URL de la web (Next.js). Se deriva de la misma IP del backend, puerto 3000.
export const WEB_URL = BASE_URL.replace(/:5000$/, ':3000');

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    // Identifica que la petición proviene de la app móvil.
    // El backend usa este header para aplicar la restricción de rol COBRADOR
    // solo a la app móvil, sin afectar el login desde la web.
    'X-App-Origen': 'mobile',
  },
});

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('cobrapp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Manejo de sesión expirada (401) ──────────────────────────────────────────
// Listener que el AuthContext registra para forzar el logout cuando el backend
// rechaza el token (expirado o inválido).
type SesionExpiradaListener = () => void;
let sesionExpiradaListener: SesionExpiradaListener | null = null;

export const onSesionExpirada = (listener: SesionExpiradaListener) => {
  sesionExpiradaListener = listener;
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Limpiar credenciales guardadas y notificar al contexto para desloguear
      await AsyncStorage.multiRemove(['cobrapp_token', 'cobrapp_user', 'cobrapp_last_activity']);
      sesionExpiradaListener?.();
    }
    return Promise.reject(error);
  }
);

export default client;
