import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './types';
import { ROUTES } from './routes';
import MainTabNavigator from './MainTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import CambiarPasswordScreen from '../screens/CambiarPasswordScreen';
import VisitaScreen from '../screens/VisitaScreen';
import MapaRutaScreen from '../screens/MapaRutaScreen';
import DescansoScreen from '../screens/DescansoScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, loading, debeCambiarPassword } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {user ? (
        debeCambiarPassword ? (
          <Stack.Screen
            name={ROUTES.CAMBIAR_PASSWORD}
            component={CambiarPasswordScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen name={ROUTES.VOLVER} component={MainTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen
              name={ROUTES.VISITA}
              component={VisitaScreen}
              options={({ route }) => ({
                headerTitle: () => (
                  <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 }}>
                    {route.params?.item?.nombre || 'Visita'}
                  </Text>
                ),
                headerBackTitle: 'Volver', // ← Esto es seguro, React Navigation lo maneja como string
              })}
            />
            <Stack.Screen name={ROUTES.MAPA} component={MapaRutaScreen} options={{ title: 'Ruta óptima' }} />
            <Stack.Screen
              name={ROUTES.DESCANSO}
              component={DescansoScreen}
              options={{ title: 'Descanso', presentation: 'modal' }}
            />
          </>
        )
      ) : (
        <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}