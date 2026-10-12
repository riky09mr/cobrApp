/**
 * Paleta de colores centralizada de cobrApp.
 * Usá estos tokens en lugar de colores hardcodeados para mantener consistencia.
 */
export const colors = {
  // ── Primarios (azul cobrApp) ─────────────────────────────
  primary: '#0284C7',
  primaryDark: '#0369A1',
  primaryLight: '#0891B2',

  // ── Fondos ───────────────────────────────────────────────
  background: '#F8FAFC',
  backgroundAlt: '#EFF6FF',
  surface: '#FFFFFF',

  // ── Texto ────────────────────────────────────────────────
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textDark: '#1E3A5F',
  textOnPrimary: '#FFFFFF',

  // ── Bordes ───────────────────────────────────────────────
  border: '#CBD5E1',
  borderLight: '#E2E8F0',

  // ── Tonos pastel (bordes de tarjetas de estado) ─────────
  skyLight: '#BAE6FD',   // azul claro (Hoy)
  greenLight: '#BBF7D0', // verde claro (GPS)
  yellowLight: '#FCD34D',// amarillo (barra de descanso)
  yellowBg: '#FEF9C3',   // fondo amarillo suave (botón descanso)
  blueBorder: '#DBEAFE', // borde azul suave (toggle mapa)

  // ── Tonos ámbar (pantalla de descanso) ──────────────────
  amberBg: '#FFFBEB',    // fondo de pantalla descanso
  amberDark: '#B45309',  // texto hora descanso
  amberLight: '#FDE68A', // banner auto-descanso

  // ── Grises neutros ──────────────────────────────────────
  grayBorder: '#D1D5DB', // borde gris
  grayText: '#6B7280',   // texto gris
  grayBg: '#F1F5F9',     // fondo gris claro (separadores)

  // ── Azules de mensajería (chat) ─────────────────────────
  chatPrimary: '#2563EB', // burbuja propia / badge / botón enviar
  chatPrimaryDark: '#1D4ED8', // texto iniciales avatar
  chatPrimaryLight: '#BFDBFE', // hora / visto en burbuja propia
  chatPrimaryLighter: '#93C5FD', // visto leído
  chatBubbleOtro: '#E0F2FE', // burbuja del otro

  // ── Colores de acento (perfil / menús) ──────────────────
  indigo: '#6366F1',   // otros medios de pago
  sky: '#0EA5E9',      // impresora térmica
  textDarkGray: '#1F2937', // texto de valores de estadísticas
  dangerBgSoft: '#FEF2F2', // fondo botón cerrar sesión

  // ── Semánticos ───────────────────────────────────────────
  success: '#10B981',
  successDark: '#059669',
  successBg: '#D1FAE5',
  warning: '#F59E0B',
  warningDark: '#D97706',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FECACA',

  // ── Sombras ──────────────────────────────────────────────
  shadow: '#0F172A',
  shadowPrimary: '#0284C7',
} as const;

export type AppColors = typeof colors;
