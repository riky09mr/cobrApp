import React, { useEffect } from 'react';
import { AppState, View, TouchableWithoutFeedback } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  solicitarPermisosNotificaciones,
  notificarAlmuerzoAutomatico,
} from './src/utils/notifications';
import { descansosApi } from './src/api/descansosApi';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

function AppContent() {
  const { registrarActividad } = useAuth();

  useEffect(() => {
    solicitarPermisosNotificaciones();

    // Al regresar al primer plano, revisar si el almuerzo fue activado automáticamente
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        try {
          const activo = await descansosApi.getActivo();
          if (activo && activo.activado_auto === 1) {
            const hora = new Date(activo.hora_inicio_real).toLocaleTimeString('es-PY', {
              hour: '2-digit',
              minute: '2-digit',
            });
            notificarAlmuerzoAutomatico(hora).catch(() => null);
          }
        } catch {
          // silencioso si no hay sesión
        }
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={registrarActividad}>
      <View style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </View>
    </TouchableWithoutFeedback>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

