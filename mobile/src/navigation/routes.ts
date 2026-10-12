/**
 * Constantes de rutas de navegación.
 * Centraliza los nombres de pantalla para evitar errores de tipeo
 * y facilitar renombrados.
 */

// Rutas del stack raíz
export const ROUTES = {
  LOGIN: 'Login',
  CAMBIAR_PASSWORD: 'CambiarPassword',
  VOLVER: 'Volver',
  MAPA: 'Mapa',
  VISITA: 'Visita',
  DESCANSO: 'Descanso',
} as const;

// Rutas de las pestañas principales
export const TAB_ROUTES = {
  AGENDA: 'Agenda',
  CAJA: 'Caja',
  COBROS: 'Cobros',
  MENSAJES: 'Mensajes',
  PERFIL: 'Perfil',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];
export type TabRouteName = (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
