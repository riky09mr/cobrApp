import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MensajesProvider } from '../context/MensajesContext';
import { colors } from '../theme/colors';
import CustomTabBar from './CustomTabBar';
import type { MainTabParamList } from './types';
import { TAB_ROUTES } from './routes';
import AgendaScreen from '../screens/AgendaScreen';
import CajaScreen from '../screens/CajaScreen';
import CobrosDelDiaScreen from '../screens/CobrosDelDiaScreen';
import MensajesScreen from '../screens/MensajesScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <MensajesProvider>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.textOnPrimary,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Tab.Screen name={TAB_ROUTES.AGENDA}   component={AgendaScreen}   options={{ title: 'Mi agenda' }} />
        <Tab.Screen name={TAB_ROUTES.CAJA}     component={CajaScreen}     options={{ title: 'Caja del día' }} />
        <Tab.Screen name={TAB_ROUTES.COBROS}   component={CobrosDelDiaScreen} options={{ title: 'Mis cobros' }} />
        <Tab.Screen name={TAB_ROUTES.MENSAJES} component={MensajesScreen} options={{ title: 'Mensajes' }} />
        <Tab.Screen name={TAB_ROUTES.PERFIL}   component={PerfilScreen}   options={{ title: 'Mi perfil' }} />
      </Tab.Navigator>
    </MensajesProvider>
  );
}
