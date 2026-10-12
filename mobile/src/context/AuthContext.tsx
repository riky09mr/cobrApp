import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { onSesionExpirada } from '../api/client';
import { registrarTokenPush, eliminarTokenPush } from '../utils/notifications';

type User = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  empresaId: number;
  rol: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  debeCambiarPassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  cambiarPassword: (passwordActual: string, passwordNueva: string) => Promise<void>;
  logout: () => Promise<void>;
  registrarActividad: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Tiempo máximo de inactividad antes de desloguear (2 horas en ms)
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;
// Clave donde se guarda el timestamp de la última actividad
const LAST_ACTIVITY_KEY = 'cobrapp_last_activity';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [debeCambiarPassword, setDebeCambiarPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ref para acceder al logout desde el interceptor sin re-crearlo
  const logoutRef = useRef<() => Promise<void>>(async () => {});

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Eliminar el token push del backend antes de desloguear
    const pushToken = await AsyncStorage.getItem('cobrapp_push_token');
    if (pushToken) {
      await eliminarTokenPush(pushToken);
    }
    await AsyncStorage.multiRemove(['cobrapp_token', 'cobrapp_user', LAST_ACTIVITY_KEY, 'cobrapp_push_token']);
    setToken(null);
    setUser(null);
    setDebeCambiarPassword(false);
  }, []);

  logoutRef.current = logout;

  // ── Forzar logout cuando el backend rechaza el token (401) ────────────────
  useEffect(() => {
    onSesionExpirada(() => {
      logoutRef.current();
    });
  }, []);

  // ── Restaurar sesión guardada ─────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      try {
        const [storedToken, storedUser, storedLastActivity] = await Promise.all([
          AsyncStorage.getItem('cobrapp_token'),
          AsyncStorage.getItem('cobrapp_user'),
          AsyncStorage.getItem(LAST_ACTIVITY_KEY),
        ]);

        if (storedToken && storedUser) {
          // Si la última actividad superó el límite de inactividad, desloguear
          if (storedLastActivity) {
            const last = Number(storedLastActivity);
            if (Date.now() - last > INACTIVITY_TIMEOUT) {
              await logout();
              return;
            }
          }
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [logout]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const res = await client.post('/api/auth/login', { email, password });
    const { data, token: newToken, debeCambiarPassword: debeCambiar } = res.data;
    await AsyncStorage.setItem('cobrapp_token', newToken);
    await AsyncStorage.setItem('cobrapp_user', JSON.stringify(data));
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    setToken(newToken);
    setUser(data);
    setDebeCambiarPassword(!!debeCambiar);

    // Registrar el token push para recibir alertas de cobranzas
    const pushToken = await registrarTokenPush();
    if (pushToken) {
      await AsyncStorage.setItem('cobrapp_push_token', pushToken);
    }
  };

  // ── Cambio de contraseña obligatorio ──────────────────────────────────────
  const cambiarPassword = async (passwordActual: string, passwordNueva: string) => {
    await client.post('/api/cambiar-password', { passwordActual, passwordNueva });
    setDebeCambiarPassword(false);
  };

  // ── Registro de actividad ─────────────────────────────────────────────────
  const registrarActividad = useCallback(() => {
    if (user) {
      AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())).catch(() => null);
    }
  }, [user]);

  // ── Temporizador de inactividad ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const verificarInactividad = async () => {
      const last = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
      if (last && Date.now() - Number(last) > INACTIVITY_TIMEOUT) {
        await logout();
      }
    };

    // Verificar cada minuto si se superó el límite de inactividad
    timer = setInterval(verificarInactividad, 60 * 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [user, logout]);

  // ── Detectar actividad del usuario (regreso a primer plano) ───────────────
  useEffect(() => {
    if (!user) return;

    const onAppState = (state: string) => {
      if (state === 'active') registrarActividad();
    };

    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      sub.remove();
    };
  }, [user, registrarActividad]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, debeCambiarPassword, login, cambiarPassword, logout, registrarActividad }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
