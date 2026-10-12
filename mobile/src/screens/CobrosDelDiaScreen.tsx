import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { cobradorApi, CobroDelDia } from '../api/cobradorApi';
import { printCobroTicket, showPrinterHintIfNeeded } from '../services/thermalPrinter';
import { verComprobante } from '../services/comprobante';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { formatGuaranies } from '../utils/currency';
import { getErrorMessage } from '../utils/errors';
import { EmptyState } from '../components/ui';

const hoy = () =>
  new Date().toLocaleDateString('es-PY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const horaCorta = (fechaHora: string) => {
  const d = new Date(fechaHora);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
};

const tieneRecibo = (cobro: CobroDelDia) => !!cobro.recibo_id && !!cobro.numero_recibo;

export default function CobrosDelDiaScreen() {
  const { user } = useAuth();
  const [cobros, setCobros] = useState<CobroDelDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [descargandoId, setDescargandoId] = useState<number | null>(null);
  const [comprobanteVisible, setComprobanteVisible] = useState(false);
  const [comprobanteCobro, setComprobanteCobro] = useState<CobroDelDia | null>(null);

  const cargar = useCallback(async (modo: 'inicial' | 'refresh') => {
    if (modo === 'inicial') setCargando(true);
    else setRefrescando(true);
    setError(null);
    try {
      const lista = await cobradorApi.getCobrosDelDia();
      setCobros(lista);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los cobros del día'));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void cargar('inicial');
    }, [cargar])
  );

  const handleVerComprobante = (cobro: CobroDelDia) => {
    setComprobanteCobro(cobro);
    setComprobanteVisible(true);
  };

  const handleDescargarComprobante = async (cobro: CobroDelDia) => {
    setDescargandoId(cobro.visita_id);
    try {
      await verComprobante(cobro.visita_id);
    } catch (err) {
      showPrinterHintIfNeeded(err);
    } finally {
      setDescargandoId(null);
    }
  };

  const handleReimprimirTicket = async (cobro: CobroDelDia) => {
    setImprimiendoId(cobro.visita_id);
    try {
      await printCobroTicket({
        cliente: `${cobro.cliente_nombre}${cobro.cliente_apellido ? ' ' + cobro.cliente_apellido : ''}`.trim(),
        monto: Number(cobro.monto_cobrado || 0),
        medioPago: cobro.medio_pago_nombre || 'N/D',
        nroComprobante: cobro.nro_comprobante || undefined,
        cobrador: `${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim() || undefined,
        visitaId: cobro.visita_id,
        fechaHora: cobro.fecha_hora,
      });
    } catch (err) {
      showPrinterHintIfNeeded(err);
    } finally {
      setImprimiendoId(null);
    }
  };

  const total = cobros.reduce((acc, c) => acc + Number(c.monto_cobrado || 0), 0);

  const renderItem = ({ item }: { item: CobroDelDia }) => {
    const cliente = `${item.cliente_nombre}${item.cliente_apellido ? ' ' + item.cliente_apellido : ''}`;
    const tieneReciboItem = tieneRecibo(item);
    const imprimiendo = imprimiendoId === item.visita_id;
    const descargando = descargandoId === item.visita_id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.clienteWrap}>
            <Text style={styles.cliente} numberOfLines={1}>{cliente}</Text>
            {item.cliente_cedula ? (
              <Text style={styles.cedula}>C.I. {item.cliente_cedula}</Text>
            ) : null}
          </View>
          <Text style={styles.hora}>{horaCorta(item.fecha_hora)}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.monto}>{formatGuaranies(item.monto_cobrado)}</Text>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <Ionicons name="wallet-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.chipText}>{item.medio_pago_nombre || '—'}</Text>
            </View>
            <View style={[styles.chip, tieneReciboItem ? styles.chipOk : styles.chipWarn]}>
              <Ionicons
                name={tieneReciboItem ? 'receipt-outline' : 'alert-circle-outline'}
                size={12}
                color={tieneReciboItem ? colors.successDark : colors.warningDark}
              />
              <Text style={[styles.chipText, { color: tieneReciboItem ? colors.successDark : colors.warningDark }]}>
                {tieneReciboItem ? `Recibo ${item.numero_recibo}` : 'Sin comprobante'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btnComprobante, styles.btnFlex]}
            onPress={() => handleVerComprobante(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={16} color={colors.textOnPrimary} />
            <Text style={styles.btnText}>Ver comprobante</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnTicket, styles.btnFlex]}
            onPress={() => { void handleReimprimirTicket(item); }}
            disabled={imprimiendo}
            activeOpacity={0.7}
          >
            {imprimiendo ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="print-outline" size={16} color={colors.primary} />
                <Text style={styles.btnTicketText}>Reimprimir ticket</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.btnDescargar}
          onPress={() => { void handleDescargarComprobante(item); }}
          disabled={descargando}
          activeOpacity={0.7}
        >
          {descargando ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.btnDescargarText}>Descargar comprobante</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { void cargar('inicial'); }}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.resumen}>
        <Text style={styles.resumenLabel}>Total cobrado hoy</Text>
        <Text style={styles.resumenTotal}>{formatGuaranies(total)}</Text>
        <Text style={styles.resumenFecha}>{hoy()}</Text>
      </View>

      {cobros.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="Sin cobros hoy"
          message="Todavía no registraste cobros en el día de hoy. Cuando cobres, van a aparecer acá."
        />
      ) : (
        <FlatList
          data={cobros}
          keyExtractor={(item) => String(item.visita_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => { void cargar('refresh'); }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* ── Modal: datos del comprobante ── */}
      <Modal
        visible={comprobanteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setComprobanteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="receipt" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Datos del pago</Text>
              </View>
              <TouchableOpacity onPress={() => setComprobanteVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {comprobanteCobro && (
              <>
                <View style={styles.modalMontoWrap}>
                  <Text style={styles.modalMontoLabel}>Monto cobrado</Text>
                  <Text style={styles.modalMonto}>{formatGuaranies(comprobanteCobro.monto_cobrado)}</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Cliente</Text>
                  <Text style={styles.modalValue}>
                    {`${comprobanteCobro.cliente_nombre}${comprobanteCobro.cliente_apellido ? ' ' + comprobanteCobro.cliente_apellido : ''}`}
                  </Text>
                </View>
                {comprobanteCobro.cliente_cedula ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Cédula</Text>
                    <Text style={styles.modalValue}>{comprobanteCobro.cliente_cedula}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Medio de pago</Text>
                  <Text style={styles.modalValue}>{comprobanteCobro.medio_pago_nombre || '—'}</Text>
                </View>
                {comprobanteCobro.nro_comprobante ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Nro. comprobante</Text>
                    <Text style={styles.modalValue}>{comprobanteCobro.nro_comprobante}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Fecha y hora</Text>
                  <Text style={styles.modalValue}>
                    {new Date(comprobanteCobro.fecha_hora).toLocaleString('es-PY', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Cuota</Text>
                  <Text style={styles.modalValue}>Cuota N° {comprobanteCobro.numero_cuota}</Text>
                </View>
                {comprobanteCobro.numero_credito ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Crédito</Text>
                    <Text style={styles.modalValue}>{comprobanteCobro.numero_credito}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Recibo</Text>
                  <Text style={styles.modalValue}>
                    {tieneRecibo(comprobanteCobro) ? `Recibo ${comprobanteCobro.numero_recibo}` : 'Sin recibo'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => setComprobanteVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24, gap: 12 },
  errorText: { color: colors.dangerDark, textAlign: 'center', fontSize: 14 },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: colors.textOnPrimary, fontWeight: '600' },
  resumen: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  resumenLabel: { color: colors.textOnPrimary, opacity: 0.85, fontSize: 12, fontWeight: '500' },
  resumenTotal: { color: colors.textOnPrimary, fontSize: 26, fontWeight: '800', marginTop: 2 },
  resumenFecha: { color: colors.textOnPrimary, opacity: 0.85, fontSize: 12, marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  clienteWrap: { flex: 1, paddingRight: 8 },
  cliente: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cedula: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  hora: { fontSize: 13, fontWeight: '600', color: colors.primary },
  cardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monto: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.grayBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipOk: { backgroundColor: colors.successBg },
  chipWarn: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnFlex: { flex: 1 },
  btnComprobante: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10,
  },
  btnTicket: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.backgroundAlt, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.primary,
  },
  btnText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
  btnTicketText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  btnDescargar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.backgroundAlt, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.borderLight, marginTop: 8,
  },
  btnDescargarText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  // ── Modal comprobante ────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  modalMontoWrap: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  modalMontoLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  modalMonto: { fontSize: 26, fontWeight: '800', color: colors.successDark, marginTop: 2 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  modalLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  modalValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  modalBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '700' },
});
