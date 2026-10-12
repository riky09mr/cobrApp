import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ScrollView, ActivityIndicator, Linking, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cobradorApi, MedioPago, CuotaPendiente } from '../api/cobradorApi';
import {
  programarNotificacionReagendado,
} from '../utils/notifications';
import type { RootStackParamList } from '../navigation/types';
import { ROUTES, TAB_ROUTES } from '../navigation/routes';
import { printCobroTicket, showPrinterHintIfNeeded } from '../services/thermalPrinter';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getErrorMessageWithDetail } from '../utils/errors';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { formatGuaranies } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, 'Visita'>;

export default function VisitaScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { user } = useAuth();

  const [modo, setModo] = useState<'menu' | 'cobrado' | 'ausente' | 'reagendado'>('menu');
  const [submitting, setSubmitting] = useState(false);

  // Estado cobrado
  const [monto, setMonto] = useState(String(item.saldo_cuota ?? 0));
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [medioPagoId, setMedioPagoId] = useState<number | null>(null);
  const [nroComprobante, setNroComprobante] = useState('');
  const [mediosPagoError, setMediosPagoError] = useState<string | null>(null);

  // Cuotas pendientes del crédito (para pago de varias cuotas)
  const [cuotasPendientes, setCuotasPendientes] = useState<CuotaPendiente[]>([]);
  const [cuotasCargando, setCuotasCargando] = useState(false);
  const [cuotasError, setCuotasError] = useState<string | null>(null);
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState<number[]>([]);

  // Estado ausente
  const [comentario, setComentario] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  // Estado reagendado
  const [nuevaHora, setNuevaHora] = useState('');

  // GPS
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Modal comprobante
  const [comprobanteVisible, setComprobanteVisible] = useState(false);
  const [comprobanteData, setComprobanteData] = useState<{
    monto: number;
    medioPago: string;
    nroComprobante?: string;
    numeroRecibo?: string;
    fechaHora: string;
  } | null>(null);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((loc) => setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
      .catch(() => null);
    cobradorApi.getMediosPago()
      .then((lista) => {
        setMediosPago(lista);
        setMediosPagoError(null);
        if (lista.length > 0) setMedioPagoId(lista[0].id);
      })
      .catch((e: unknown) => {
        setMediosPagoError(getErrorMessage(e, 'No se pudieron cargar los medios de pago'));
      });
  }, []);

  const llamarCliente = () => {
    if (!item.telefono) {
      Alert.alert('Sin teléfono', 'El cliente no tiene número registrado');
      return;
    }
    Linking.openURL(`tel:${item.telefono}`);
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar la foto.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const cargarCuotasPendientes = async () => {
    if (!item.credito_id) return;
    setCuotasCargando(true);
    setCuotasError(null);
    try {
      const lista = await cobradorApi.getCuotasPendientesCredito(item.credito_id);
      setCuotasPendientes(lista);
      // Por defecto se selecciona la cuota actual (la que abrió la visita)
      setCuotasSeleccionadas([item.asignacion_id]);
      // El monto inicial corresponde a la cuota actual
      setMonto(String(item.saldo_cuota ?? 0));
    } catch (e: unknown) {
      setCuotasError(getErrorMessage(e, 'No se pudieron cargar las cuotas pendientes'));
    } finally {
      setCuotasCargando(false);
    }
  };

  const toggleCuota = (asignacionId: number) => {
    setCuotasSeleccionadas((prev) => {
      const yaSeleccionada = prev.includes(asignacionId);
      const nueva = yaSeleccionada
        ? prev.filter((id) => id !== asignacionId)
        : [...prev, asignacionId];
      // Recalcular monto = suma de saldos de las cuotas seleccionadas
      const total = cuotasPendientes
        .filter((c) => nueva.includes(c.asignacion_id))
        .reduce((acc, c) => acc + Number(c.saldo_cuota), 0);
      setMonto(String(total));
      return nueva;
    });
  };

  const confirmarCobro = async () => {
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    if (cuotasSeleccionadas.length === 0) {
      Alert.alert('Requerido', 'Seleccioná al menos una cuota a cobrar');
      return;
    }
    if (!medioPagoId) {
      Alert.alert('Requerido', 'Seleccioná un medio de pago');
      return;
    }
    const medioSeleccionado = mediosPago.find((m) => m.id === medioPagoId);
    if (medioSeleccionado?.requiere_comprobante && !nroComprobante.trim()) {
      Alert.alert('Requerido', 'Este medio de pago requiere un número de comprobante');
      return;
    }
    setSubmitting(true);
    try {
      const resCobro = await cobradorApi.registrarCobro({
        asignacionIds: cuotasSeleccionadas,
        monto: Number(monto),
        medioPagoId,
        nroComprobante: nroComprobante.trim() || undefined,
        latitud: coords?.lat,
        longitud: coords?.lng,
        fechaHora: new Date().toISOString(),
      });
      const medioNombre = mediosPago.find((m) => m.id === medioPagoId)?.nombre ?? 'N/D';
      const ticketPayload = {
        cliente: `${item.nombre} ${item.apellido ?? ''}`.trim(),
        monto: Number(monto),
        medioPago: medioNombre,
        nroComprobante: nroComprobante.trim() || undefined,
        cobrador: `${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim() || undefined,
        visitaId: resCobro.visitaId,
        fechaHora: new Date().toISOString(),
      };

      Alert.alert('\u00a1Cobro registrado!', 'El pago fue registrado exitosamente.', [
        {
          text: 'Imprimir ticket',
          onPress: () => {
            void (async () => {
              try {
                await printCobroTicket(ticketPayload);
              } catch (err) {
                showPrinterHintIfNeeded(err);
              } finally {
                navigation.goBack();
              }
            })();
          },
        },
        {
          text: 'Ver comprobante',
          onPress: () => {
            setComprobanteData({
              monto: Number(monto),
              medioPago: medioNombre,
              nroComprobante: nroComprobante.trim() || undefined,
              numeroRecibo: resCobro.recibo?.numeroRecibo,
              fechaHora: new Date().toISOString(),
            });
            setComprobanteVisible(true);
          },
        },
        { text: 'Cerrar', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { message?: string } };
      };
      const msg = getErrorMessageWithDetail(e, 'Error al registrar el cobro');
      // Si la caja abierta es de un día anterior, ofrecer ir directo a la pantalla de Caja
      // para cerrarla y abrir una nueva.
      const esCajaOtroDia =
        err?.response?.status === 409 &&
        (err?.response?.data?.message ?? '').includes('día anterior');
      if (esCajaOtroDia) {
        Alert.alert('Caja de otro día', msg, [
          {
            text: 'Ir a Caja',
            onPress: () => navigation.navigate(ROUTES.VOLVER, { screen: TAB_ROUTES.CAJA }),
          },
          { text: 'Cerrar', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmarAusente = async () => {
    if (!comentario.trim()) {
      Alert.alert('Requerido', 'Agrega un comentario antes de continuar');
      return;
    }
    setSubmitting(true);
    try {
      const res = await cobradorApi.registrarVisita({
        asignacionId: item.asignacion_id,
        resultado: 'ausente',
        latitud: coords?.lat,
        longitud: coords?.lng,
        comentario: comentario.trim(),
        fechaHora: new Date().toISOString(),
      });
      // Subir foto si existe
      if (fotoUri && res.visitaId) {
        try {
          await cobradorApi.subirFoto(res.visitaId, fotoUri);
        } catch {
          // La visita ya fue registrada; la foto falla silenciosamente
        }
      }
      Alert.alert('Visita registrada', 'Se registró como cliente ausente.', [
        { text: 'Cerrar', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Error al registrar la visita');
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmarReagendado = async () => {
    if (!nuevaHora.match(/^\d{2}:\d{2}$/)) {
      Alert.alert('Hora inválida', 'Ingresa la hora en formato HH:MM (ej: 15:30)');
      return;
    }
    const [hh, mm] = nuevaHora.split(':').map(Number);
    if (hh > 23 || mm > 59) {
      Alert.alert('Hora inválida', 'La hora debe estar entre 00:00 y 23:59');
      return;
    }
    setSubmitting(true);
    try {
      const resReag = await cobradorApi.registrarVisita({
        asignacionId: item.asignacion_id,
        resultado: 'reagendado',
        latitud: coords?.lat,
        longitud: coords?.lng,
        nuevaHora,
        fechaHora: new Date().toISOString(),
      });
      // Programar notificación local a la nueva hora
      programarNotificacionReagendado(
        `${item.nombre} ${item.apellido ?? ''}`.trim(),
        nuevaHora
      ).catch(() => null);
      Alert.alert('Reagendado', `El cobro fue reagendado para las ${nuevaHora}.`, [
        { text: 'Cerrar', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Error al reagendar');
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={commonStyles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* ── Info del cliente ── */}
      <View style={commonStyles.card}>
        <Text style={styles.clienteNombre}>
          {item.nombre} {item.apellido ?? ''}
        </Text>
        {item.cedula ? <Text style={styles.detalle}>CI: {item.cedula}</Text> : null}
        {item.direccion ? (
          <View style={styles.detalleRow}>
            <Ionicons name="location" size={13} color={colors.textSecondary} />
            <Text style={styles.detalle}> {item.direccion}</Text>
          </View>
        ) : null}
        {item.telefono ? (
          <TouchableOpacity style={styles.callBtn} onPress={llamarCliente}>
            <Ionicons name="call" size={15} color={colors.primary} />
            <Text style={styles.callBtnText}> Llamar: {item.telefono}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.montoInfo}>
          Saldo: {formatGuaranies(item.saldo_cuota)}
        </Text>
      </View>

      {/* ── Menú principal ── */}
      {modo === 'menu' && (
        <View style={styles.opcionesGrid}>
          <TouchableOpacity
            style={[styles.opcion, { backgroundColor: colors.success }]}
            onPress={() => {
              setModo('cobrado');
              cargarCuotasPendientes();
            }}
          >
            <Ionicons name="cash" size={30} color={colors.textOnPrimary} />
            <Text style={styles.opcionText}>Cobro exitoso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.opcion, { backgroundColor: colors.danger }]}
            onPress={() => setModo('ausente')}
          >
            <Ionicons name="person-remove" size={30} color={colors.textOnPrimary} />
            <Text style={styles.opcionText}>Cliente ausente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.opcion, { backgroundColor: colors.warning }]}
            onPress={() => setModo('reagendado')}
          >
            <Ionicons name="calendar" size={30} color={colors.textOnPrimary} />
            <Text style={styles.opcionText}>Visita posterior</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Cobro exitoso ── */}
      {modo === 'cobrado' && (
        <View style={commonStyles.card}>
          <View style={styles.formTitleRow}>
            <Ionicons name="cash" size={18} color={colors.success} />
            <Text style={styles.formTitle}> Registrar cobro</Text>
          </View>

          <Text style={styles.label}>Monto cobrado (Gs.)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={monto}
            onChangeText={setMonto}
          />

          {/* ── Selección de cuotas a cobrar ── */}
          <Text style={styles.label}>Cuotas a cobrar</Text>
          {cuotasCargando ? (
            <View style={styles.cuotasCargando}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.cuotasCargandoText}> Cargando cuotas pendientes…</Text>
            </View>
          ) : cuotasError ? (
            <View style={styles.mediosPagoError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.mediosPagoErrorText}>{cuotasError}</Text>
            </View>
          ) : cuotasPendientes.length === 0 ? (
            <View style={styles.mediosPagoError}>
              <Ionicons name="information-circle" size={16} color={colors.warning} />
              <Text style={styles.mediosPagoErrorText}>
                No hay cuotas pendientes para este crédito.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.cuotasLista}>
                {cuotasPendientes.map((c) => {
                  const seleccionada = cuotasSeleccionadas.includes(c.asignacion_id);
                  return (
                    <TouchableOpacity
                      key={c.asignacion_id}
                      style={[styles.cuotaItem, seleccionada && styles.cuotaItemSelected]}
                      onPress={() => toggleCuota(c.asignacion_id)}
                    >
                      <View style={styles.cuotaItemInfo}>
                        <Text style={[styles.cuotaNumero, seleccionada && styles.cuotaNumeroSelected]}>
                          Cuota N° {c.numero_cuota}
                        </Text>
                        <Text style={styles.cuotaFecha}>
                          Vence: {new Date(c.fecha_vencimiento).toLocaleDateString('es-PY')}
                        </Text>
                      </View>
                      <View style={styles.cuotaItemRight}>
                        <Text style={styles.cuotaMonto}>{formatGuaranies(c.saldo_cuota)}</Text>
                        <Ionicons
                          name={seleccionada ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={seleccionada ? colors.success : colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.helpText}>
                {cuotasSeleccionadas.length > 0
                  ? `Se cobrarán ${cuotasSeleccionadas.length} cuota(s).`
                  : 'Seleccioná al menos una cuota.'}
              </Text>
            </>
          )}

          <Text style={styles.label}>Medio de pago</Text>
          {mediosPagoError ? (
            <View style={styles.mediosPagoError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.mediosPagoErrorText}>{mediosPagoError}</Text>
            </View>
          ) : mediosPago.length === 0 ? (
            <View style={styles.mediosPagoError}>
              <Ionicons name="information-circle" size={16} color={colors.warning} />
              <Text style={styles.mediosPagoErrorText}>
                No hay medios de pago configurados. Contactá al administrador.
              </Text>
            </View>
          ) : (
            <View style={styles.mediosPago}>
              {mediosPago.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.medioBadge, medioPagoId === m.id && styles.medioSelected]}
                  onPress={() => { setMedioPagoId(m.id); setNroComprobante(''); }}
                >
                  <Text style={[styles.medioText, medioPagoId === m.id && styles.medioTextSelected]}>
                    {m.nombre || 'Sin nombre'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {mediosPago.some((m) => m.id === medioPagoId && m.requiere_comprobante) && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.label}>Nro. de comprobante *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: TRF-000123"
                value={nroComprobante}
                onChangeText={setNroComprobante}
                autoCapitalize="characters"
              />
            </View>
          )}

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModo('menu')}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.success }, submitting && styles.btnDisabled]}
              onPress={confirmarCobro}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar cobro</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Cliente ausente ── */}
      {modo === 'ausente' && (
        <View style={commonStyles.card}>
          <View style={styles.formTitleRow}>
            <Ionicons name="person-remove" size={18} color={colors.danger} />
            <Text style={styles.formTitle}> Cliente ausente</Text>
          </View>
          <TouchableOpacity style={styles.callBtnAlt} onPress={llamarCliente}>
            <View style={styles.callBtnRow}>
              <Ionicons name="call" size={15} color={colors.primary} />
              <Text style={styles.callBtnText}> 1. Llamar al cliente primero</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.label}>2. Comentario *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={3}
            placeholder="Ej: Casa cerrada, Vecino dice que viajó…"
            value={comentario}
            onChangeText={setComentario}
          />
          <Text style={styles.label}>3. Foto de evidencia</Text>
          <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto}>
            <View style={styles.callBtnRow}>
              <Ionicons
                name={fotoUri ? 'checkmark-circle' : 'camera'}
                size={18}
                color={fotoUri ? colors.success : colors.primary}
              />
              <Text style={[styles.fotoBtnText, fotoUri ? { color: colors.success } : {}]}>
                {fotoUri ? ' Foto tomada — Toca para cambiar' : ' Tomar foto'}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModo('menu')}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.danger }, submitting && styles.btnDisabled]}
              onPress={confirmarAusente}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.confirmBtnText}>Registrar ausencia</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Visita posterior (reagendado) ── */}
      {modo === 'reagendado' && (
        <View style={commonStyles.card}>
          <View style={styles.formTitleRow}>
            <Ionicons name="calendar" size={18} color={colors.warning} />
            <Text style={styles.formTitle}> Reagendar visita</Text>
          </View>
          <Text style={styles.label}>Nueva hora (HH:MM)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 15:30"
            value={nuevaHora}
            onChangeText={setNuevaHora}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            maxLength={5}
          />
          <Text style={styles.helpText}>El cliente reaparecerá en tu agenda a esa hora.</Text>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModo('menu')}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.warning }, submitting && styles.btnDisabled]}
              onPress={confirmarReagendado}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.confirmBtnText}>Reagendar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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

            {comprobanteData && (
              <>
                <View style={styles.modalMontoWrap}>
                  <Text style={styles.modalMontoLabel}>Monto cobrado</Text>
                  <Text style={styles.modalMonto}>{formatGuaranies(comprobanteData.monto)}</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Cliente</Text>
                  <Text style={styles.modalValue}>
                    {`${item.nombre}${item.apellido ? ' ' + item.apellido : ''}`}
                  </Text>
                </View>
                {item.cedula ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Cédula</Text>
                    <Text style={styles.modalValue}>{item.cedula}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Medio de pago</Text>
                  <Text style={styles.modalValue}>{comprobanteData.medioPago || '—'}</Text>
                </View>
                {comprobanteData.nroComprobante ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Nro. comprobante</Text>
                    <Text style={styles.modalValue}>{comprobanteData.nroComprobante}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Fecha y hora</Text>
                  <Text style={styles.modalValue}>
                    {new Date(comprobanteData.fechaHora).toLocaleString('es-PY', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Cuota</Text>
                  <Text style={styles.modalValue}>Cuota N° {item.numero_cuota}</Text>
                </View>
                {item.numero_credito ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Crédito</Text>
                    <Text style={styles.modalValue}>{item.numero_credito}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Recibo</Text>
                  <Text style={styles.modalValue}>
                    {comprobanteData.numeroRecibo ? `Recibo ${comprobanteData.numeroRecibo}` : 'Sin recibo'}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  clienteNombre: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  detalle: { fontSize: 13, color: colors.textSecondary, marginBottom: 3 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundAlt,
    borderRadius: 8, padding: 10, marginVertical: 8,
  },
  callBtnRow: { flexDirection: 'row', alignItems: 'center' },
  detalleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  callBtnAlt: {
    backgroundColor: colors.backgroundAlt, borderRadius: 8,
    padding: 12, marginBottom: 14, alignItems: 'center',
  },
  callBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  montoInfo: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginTop: 6 },
  opcionesGrid: { gap: 12 },
  opcion: {
    borderRadius: 14, padding: 20, flexDirection: 'row',
    alignItems: 'center', gap: 14,
  },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  opcionText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary, marginBottom: 14,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  mediosPago: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  mediosPagoError: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.danger + '14', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  mediosPagoErrorText: { flex: 1, fontSize: 13, color: colors.danger },
  medioBadge: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  medioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  medioText: { fontSize: 13, color: colors.textSecondary },
  medioTextSelected: { color: colors.textOnPrimary, fontWeight: '600' },

  // ── Selección de cuotas ─────────────────────────────────
  cuotasCargando: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, marginBottom: 14,
  },
  cuotasCargandoText: { fontSize: 13, color: colors.textSecondary },
  cuotasLista: { gap: 8, marginBottom: 8 },
  cuotaItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  cuotaItemSelected: {
    borderColor: colors.success, backgroundColor: colors.success + '0D',
  },
  cuotaItemInfo: { flex: 1 },
  cuotaNumero: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  cuotaNumeroSelected: { color: colors.successDark },
  cuotaFecha: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cuotaItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cuotaMonto: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  fotoBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 9, borderStyle: 'dashed',
    padding: 14, alignItems: 'center', marginBottom: 14,
  },
  fotoBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  helpText: { fontSize: 12, color: colors.textMuted, marginBottom: 14 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 9,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: {
    flex: 2, borderRadius: 9, paddingVertical: 12, alignItems: 'center',
  },
  confirmBtnText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },

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
