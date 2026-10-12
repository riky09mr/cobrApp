import React, { useState } from 'react';
import {
  View, Text, TextInput,
  StyleSheet, Alert, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { formatGuaranies, parseMonto } from '../utils/currency';
import { Card, PrimaryButton, LoadingView, Badge, StatRow } from '../components/ui';
import { TAB_ROUTES } from '../navigation/routes';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { useCaja } from '../hooks/useCaja';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Caja'>,
  NativeStackScreenProps<RootStackParamList>
>;

const hoy = () =>
  new Date().toLocaleDateString('es-PY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export default function CajaScreen({ navigation }: Props) {
  const { user } = useAuth();
  const {
    caja: cajaActiva,
    cargando,
    abriendo,
    cerrando,
    verificarCaja,
    abrirCaja,
    cerrarCaja,
  } = useCaja();

  const [saldoInicial, setSaldoInicial] = useState('0');

  // ── Estado del cierre de caja ──
  const [cierreVisible, setCierreVisible] = useState(false);
  const [saldoContado, setSaldoContado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [cierreResultado, setCierreResultado] = useState<{
    saldo_esperado: number;
    saldo_contado: number;
    diferencia: number;
  } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          await verificarCaja();
        } catch {
          Alert.alert('Error', 'No se pudo verificar el estado de la caja');
        }
      })();
    }, [verificarCaja])
  );

  const handleAbrirCaja = async () => {
    const monto = parseMonto(saldoInicial);
    if (monto < 0) {
      Alert.alert('Valor inválido', 'El saldo inicial no puede ser negativo');
      return;
    }

    Alert.alert(
      'Abrir caja',
      `¿Confirmas abrir tu caja con saldo inicial de ${formatGuaranies(monto)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir',
          onPress: async () => {
            try {
              await abrirCaja(monto);
              navigation.navigate(TAB_ROUTES.AGENDA);
            } catch (err: any) {
              const msg = err?.response?.data?.message || 'No se pudo abrir la caja';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  // ── Cerrar caja ──
  const handleCerrarCaja = async () => {
    const contado = parseMonto(saldoContado);
    if (contado < 0) {
      Alert.alert('Valor inválido', 'El saldo contado no puede ser negativo');
      return;
    }

    const esperado = cajaActiva?.saldo_esperado ?? 0;
    const diferencia = contado - esperado;
    const tipoDiferencia =
      Math.abs(diferencia) < 0.01 ? 'cuadrada' : diferencia > 0 ? 'sobrante' : 'faltante';

    Alert.alert(
      'Cerrar caja',
      `Saldo esperado: ${formatGuaranies(esperado)}\n` +
        `Saldo contado: ${formatGuaranies(contado)}\n\n` +
        `La caja quedará ${tipoDiferencia} (${formatGuaranies(diferencia)}).\n` +
        `¿Confirmás el cierre?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar caja',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await cerrarCaja(contado, observacion.trim() || undefined);
              setCierreResultado({
                saldo_esperado: res.saldo_esperado,
                saldo_contado: res.saldo_contado,
                diferencia: res.diferencia,
              });
              setCierreVisible(false);
              setSaldoContado('');
              setObservacion('');
            } catch (err: any) {
              const msg = err?.response?.data?.message || 'No se pudo cerrar la caja';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  if (cargando) {
    return <LoadingView />;
  }

  // ── Caja cerrada: mostrar resumen del cierre ──
  if (cierreResultado) {
    const { saldo_esperado, saldo_contado, diferencia } = cierreResultado;
    const cuadrada = Math.abs(diferencia) < 0.01;
    const sobrante = diferencia > 0;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Ionicons
          name={cuadrada ? 'checkmark-circle' : sobrante ? 'trending-up' : 'warning'}
          size={56}
          color={cuadrada ? colors.success : sobrante ? colors.warning : colors.danger}
          style={styles.icono}
        />
        <Text style={styles.titulo}>Caja cerrada</Text>
        <Text style={styles.fecha}>{hoy()}</Text>

        <Card>
          <StatRow label="Saldo esperado" value={formatGuaranies(saldo_esperado)} />
          <StatRow label="Saldo contado" value={formatGuaranies(saldo_contado)} />
          <View style={styles.separador} />
          <StatRow
            label={cuadrada ? 'Diferencia' : sobrante ? 'Sobrante' : 'Faltante'}
            value={formatGuaranies(diferencia)}
            color={cuadrada ? colors.success : sobrante ? colors.warning : colors.danger}
            bold
          />
        </Card>

        <Text style={styles.cantCobros}>
          {cuadrada
            ? '¡Caja cuadrada! Rendición correcta.'
            : sobrante
              ? 'Hay dinero de más. Verificá con tu supervisor.'
              : 'Falta dinero. Verificá con tu supervisor.'}
        </Text>

        <PrimaryButton
          label="Abrir nueva caja"
          icon="lock-open-outline"
          onPress={() => {
            setCierreResultado(null);
            setSaldoInicial('0');
          }}
        />
      </ScrollView>
    );
  }

  // ── Caja abierta: resumen + cierre ──
  if (cajaActiva) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Badge
          label="Caja abierta"
          icon="checkmark-circle"
          color={colors.success}
          bgColor={colors.successBg}
          textColor={colors.successDark}
        />

        {cajaActiva.es_de_otro_dia && (
          <View style={styles.alertaOtroDia}>
            <Ionicons name="warning-outline" size={22} color={colors.warning} />
            <Text style={styles.alertaOtroDiaText}>
              Esta caja es de un día anterior. No podés registrar cobros hasta cerrarla y abrir
              una nueva caja para hoy.
            </Text>
          </View>
        )}

        <Text style={styles.fecha}>{hoy()}</Text>
        <Text style={styles.cobrador}>
          {user?.nombre} {user?.apellido ?? ''}
        </Text>

        <Card>
          <StatRow label="Saldo inicial" value={formatGuaranies(cajaActiva.saldo_inicial)} />
          <StatRow label="Cobros efectivo" value={formatGuaranies(cajaActiva.total_efectivo)} color={colors.success} />
          <StatRow label="Otros medios" value={formatGuaranies(cajaActiva.total_otros)} color={colors.indigo} />
          <StatRow label="Gastos" value={formatGuaranies(cajaActiva.total_gastos)} color={colors.danger} />
          <View style={styles.separador} />
          <StatRow label="Saldo esperado" value={formatGuaranies(cajaActiva.saldo_esperado)} bold />
        </Card>

        <Text style={styles.cantCobros}>
          {cajaActiva.cantidad_cobros} cobro{cajaActiva.cantidad_cobros !== 1 ? 's' : ''} registrado{cajaActiva.cantidad_cobros !== 1 ? 's' : ''}
        </Text>

        {/* ── Cerrar caja ── */}
        {!cierreVisible ? (
          <PrimaryButton
            label="Cerrar caja y rendir cuentas"
            icon="lock-closed-outline"
            color={colors.danger}
            onPress={() => {
              setSaldoContado(String(cajaActiva.saldo_esperado));
              setCierreVisible(true);
            }}
          />
        ) : (
          <Card>
            <Text style={styles.label}>Saldo contado (Gs.)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={saldoContado}
              onChangeText={setSaldoContado}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.hint}>
              Contá el efectivo que tenés y cargá el total. Se compara con el saldo esperado.
            </Text>
            <Text style={styles.label}>Observación (opcional)</Text>
            <TextInput
              style={styles.input}
              value={observacion}
              onChangeText={setObservacion}
              placeholder="Ej: diferencia por vuelto..."
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.rowBtns}>
              <TouchableOpacity
                style={[styles.btnSecundario, { flex: 1 }]}
                onPress={() => setCierreVisible(false)}
              >
                <Text style={styles.btnSecundarioText}>Cancelar</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Cerrar caja"
                  icon="lock-closed-outline"
                  color={colors.danger}
                  onPress={handleCerrarCaja}
                  loading={cerrando}
                />
              </View>
            </View>
          </Card>
        )}

        <View style={styles.espacio} />
        <PrimaryButton
          label="Ir a mi agenda"
          icon="list-outline"
          onPress={() => navigation.navigate(TAB_ROUTES.AGENDA)}
        />
      </ScrollView>
    );
  }

  // ── Sin caja abierta → formulario de apertura ──
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Ionicons name="wallet-outline" size={56} color={colors.primary} style={styles.icono} />
      <Text style={styles.titulo}>Abrir caja del día</Text>
      <Text style={styles.fecha}>{hoy()}</Text>
      <Text style={styles.cobrador}>
        {user?.nombre} {user?.apellido ?? ''}
      </Text>

      <Card>
        <Text style={styles.label}>Saldo inicial (Gs.)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={saldoInicial}
          onChangeText={setSaldoInicial}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.hint}>
          Ingresá el dinero que llevás al salir. En la mayoría de los casos es 0.
        </Text>
      </Card>

      <PrimaryButton
        label="Abrir caja"
        icon="lock-open-outline"
        onPress={handleAbrirCaja}
        loading={abriendo}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center' },
  icono: { marginBottom: 12 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.textDarkGray, marginBottom: 4 },
  fecha: { fontSize: 14, color: colors.grayText, textTransform: 'capitalize', marginBottom: 2 },
  cobrador: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: colors.textDarkGray,
    textAlign: 'right',
  },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  alertaOtroDia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  alertaOtroDiaText: {
    flex: 1,
    fontSize: 13,
    color: colors.warningDark,
    lineHeight: 18,
  },
  separador: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  cantCobros: { fontSize: 13, color: colors.grayText, marginBottom: 20 },
  rowBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnSecundario: {
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecundarioText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  espacio: { height: 12 },
});
