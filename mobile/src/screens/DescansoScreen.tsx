import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TipoDescanso } from '../api/descansosApi';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { useDescanso } from '../hooks/useDescanso';

type Props = NativeStackScreenProps<RootStackParamList, 'Descanso'>;

export default function DescansoScreen({ navigation }: Props) {
  const { activo, tipos, loading, submitting, cargar, iniciar, finalizar } = useDescanso();

  useEffect(() => {
    cargar().catch(() => {
      Alert.alert('Error', 'No se pudo cargar la información de descansos');
    });
  }, [cargar]);

  const handleIniciar = async (tipo: TipoDescanso) => {
    try {
      await iniciar(tipo);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al iniciar el descanso';
      Alert.alert('Error', msg);
    }
  };

  const handleFinalizar = async () => {
    try {
      await finalizar();
      navigation.goBack();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al finalizar el descanso';
      Alert.alert('Error', msg);
    }
  };

  const horaInicio = activo
    ? new Date(activo.hora_inicio_real).toLocaleTimeString('es-PY', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  if (loading) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size="large" color={colors.warning} />
      </View>
    );
  }

  // ── Descanso activo: pantalla de pausa ──
  if (activo) {
    return (
      <View style={styles.container}>
        <View style={styles.pausaCard}>
          <Ionicons name="pause-circle" size={72} color={colors.warning} style={{ marginBottom: 12 }} />
          <Text style={styles.pausaTipo}>{activo.tipo_nombre}</Text>
          <Text style={styles.pausaHora}>Iniciado a las {horaInicio}</Text>
          {activo.activado_auto === 1 && (
            <View style={styles.autoBanner}>
              <Text style={styles.autoText}>
                Almuerzo activado automáticamente a las {horaInicio}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.reanudarBtn, submitting && styles.btnDisabled]}
          onPress={handleFinalizar}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="play" size={16} color={colors.textOnPrimary} />
              <Text style={styles.reanudarBtnText}>Reanudar actividad</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.volverBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.volverBtnText}>Volver a agenda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Sin descanso activo: seleccionar tipo ──
  return (
    <View style={styles.container}>
      <Text style={styles.selTitle}>Selecciona el tipo de descanso</Text>
      {tipos.length === 0 ? (
        <Text style={styles.empty}>No hay tipos de descanso configurados para tu empresa.</Text>
      ) : (
        <FlatList
          data={tipos}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tipoCard, submitting && styles.btnDisabled]}
              onPress={() => handleIniciar(item)}
              disabled={submitting}
            >
              <View style={styles.tipoRow}>
                <Ionicons name="cafe" size={18} color={colors.warningText} />
                <Text style={styles.tipoNombre}> {item.nombre}</Text>
                {item.es_obligatorio ? (
                  <Ionicons name="warning" size={15} color={colors.warningDark} style={{ marginLeft: 4 }} />
                ) : null}
              </View>
              {item.hora_inicio && (
                <Text style={styles.tipoHora}>Disponible desde: {item.hora_inicio}</Text>
              )}
              {item.hora_fin_auto && (
                <Text style={styles.tipoHora}>Activación auto: {item.hora_fin_auto}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={styles.volverBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.volverBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.amberBg, padding: 20 },
  pausaCard: {
    backgroundColor: colors.warningBg, borderRadius: 20, padding: 32,
    alignItems: 'center', marginTop: 30, marginBottom: 30,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  tipoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pausaTipo: { fontSize: 22, fontWeight: '800', color: colors.warningText, marginBottom: 6 },
  pausaHora: { fontSize: 15, color: colors.amberDark },
  autoBanner: {
    backgroundColor: colors.amberLight, borderRadius: 10, padding: 10, marginTop: 14,
  },
  autoText: { fontSize: 12, color: colors.warningText, textAlign: 'center' },
  reanudarBtn: {
    backgroundColor: colors.success, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  reanudarBtnText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 17 },
  volverBtn: {
    borderWidth: 1, borderColor: colors.grayBorder, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  volverBtnText: { color: colors.grayText, fontWeight: '600', fontSize: 15 },
  selTitle: {
    fontSize: 18, fontWeight: '700', color: colors.textPrimary,
    textAlign: 'center', marginTop: 20, marginBottom: 4,
  },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  tipoCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 18,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tipoNombre: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  tipoHora: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
});
