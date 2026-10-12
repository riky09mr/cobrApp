import type { NavigatorScreenParams } from '@react-navigation/native';
import type { AgendaItem } from '../api/cobradorApi';

/**
 * Tipos de navegación de la app.
 */
export type RootStackParamList = {
  Login: undefined;
  CambiarPassword: undefined;
  Volver: NavigatorScreenParams<MainTabParamList> | undefined;
  Mapa: { agenda: AgendaItem[] };
  Visita: { item: AgendaItem };
  Descanso: undefined;
};

export type MainTabParamList = {
  Agenda: undefined;
  Caja: undefined;
  Cobros: undefined;
  Mensajes: undefined;
  Perfil: undefined;
};
