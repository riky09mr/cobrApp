import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { formatGuaranies } from '../utils/currency';
import { Card, StatRow, MenuBtn, Badge } from '../components/ui';
import { ROUTES, TAB_ROUTES } from '../navigation/routes';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { useCaja } from '../hooks/useCaja';
import { useImpresora } from '../hooks/useImpresora';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Perfil'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function PerfilScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { caja, cargando, verificarCaja } = useCaja();
  const { configurar: configurarImpresora, probar: probarImpresion } = useImpresora();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          await verificarCaja();
        } catch {
          // silencioso
        }
      })();
    }, [verificarCaja])
  );

  const handleLogout = () =>
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que querés salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: logout },
      ]
    );

  const iniciales = `${user?.nombre?.[0] ?? ''}${user?.apellido?.[0] ?? ''}`.toUpperCase();

  return (
    <ScrollView style={commonStyles.container} contentContainerStyle={commonStyles.content}>

      {/* ── Avatar ── */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{iniciales || '?'}</Text>
        </View>
        <Text style={s.nombre}>{user?.nombre} {user?.apellido ?? ''}</Text>
        <Badge
          label="Cobrador"
          icon="briefcase-outline"
          color={colors.primary}
          bgColor={colors.backgroundAlt}
        />
      </View>

      {/* ── Resumen de caja hoy ── */}
      <Card>
        <Text style={s.cardTitle}>Resumen de hoy</Text>
        {cargando ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : caja ? (
          <>
            <StatRow label="Cobros realizados" value={String(caja.cantidad_cobros)} />
            <StatRow
              label="Total efectivo"
              value={formatGuaranies(caja.total_efectivo)}
              color={colors.success}
            />
            <StatRow
              label="Otros medios"
              value={formatGuaranies(caja.total_otros)}
              color={colors.indigo}
            />
            <StatRow
              label="Gastos"
              value={formatGuaranies(caja.total_gastos)}
              color={colors.danger}
            />
            <StatRow
              label="Saldo esperado"
              value={formatGuaranies(caja.saldo_esperado)}
              bold
            />
          </>
        ) : (
          <View style={s.sinCajaRow}>
            <Ionicons name="wallet-outline" size={20} color={colors.border} />
            <Text style={s.sinCajaText}>No hay caja abierta hoy</Text>
          </View>
        )}
      </Card>

      {/* ── Acciones ── */}
      <Card>
        <Text style={s.cardTitle}>Acciones rápidas</Text>
        <MenuBtn
          icon="pause-circle-outline"
          label="Gestionar descanso"
          color={colors.warning}
          onPress={() => navigation.navigate(ROUTES.DESCANSO)}
        />
        <View style={s.separador} />
        <MenuBtn
          icon="map-outline"
          label="Ver ruta del día"
          color={colors.primary}
          onPress={() => navigation.navigate(TAB_ROUTES.AGENDA)}
        />
        <View style={s.separador} />
        <MenuBtn
          icon="print-outline"
          label="Configurar impresora térmica"
          color={colors.sky}
          onPress={() => { void configurarImpresora(); }}
        />
        <View style={s.separador} />
        <MenuBtn
          icon="receipt-outline"
          label="Probar impresión de ticket"
          color={colors.success}
          onPress={() => { void probarImpresion(); }}
        />
      </Card>

      {/* ── Cerrar sesión ── */}
      <TouchableOpacity style={s.btnLogout} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={s.btnLogoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    shadowColor: colors.shadowPrimary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  avatarText: { color: colors.textOnPrimary, fontSize: 30, fontWeight: '700' },
  nombre: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  sinCajaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  sinCajaText: { fontSize: 14, color: colors.textMuted },
  separador: { height: 1, backgroundColor: colors.grayBg, marginVertical: 2 },
  btnLogout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, backgroundColor: colors.dangerBgSoft,
    borderRadius: 14, marginTop: 4,
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 1,
  },
  btnLogoutText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
