import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cobradorApi, AgendaItem } from '../api/cobradorApi';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { formatGuaranies } from '../utils/currency';
import { ROUTES, TAB_ROUTES } from '../navigation/routes';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { EmptyState } from '../components/ui';
import { useDescanso } from '../hooks/useDescanso';
import {
  solicitarPermisosNotificaciones,
  notificarResumenDia,
} from '../utils/notifications';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Agenda'>,
  NativeStackScreenProps<RootStackParamList>
>;
type FiltroType = 'todas' | 'hoy' | 'vencidas';
type SeccionType = { title: string; data: AgendaItem[]; accent: string };

const todayISO = () => new Date().toISOString().split('T')[0];
// Normaliza fecha de MySQL (puede venir como '2026-05-26T00:00:00.000Z' o '2026-05-26 00:00:00')
const fISO = (s: string) => s.split('T')[0].split(' ')[0];

const ESTADO_BADGE: Record<string, { bg: string; text: string }> = {
  VENCIDA:  { bg: colors.dangerBg, text: colors.dangerDark },
  PENDIENTE:{ bg: colors.warningBg, text: colors.warningDark },
  PAGADO:   { bg: colors.successBg, text: colors.successDark },
};

function buildSecciones(items: AgendaItem[], filtro: FiltroType): SeccionType[] {
  const hoy = todayISO();
  let lista = items;
  if (filtro === 'hoy')           lista = items.filter(i => fISO(i.fecha_vencimiento) === hoy);
  else if (filtro === 'vencidas') lista = items.filter(i => fISO(i.fecha_vencimiento) < hoy);

  const vencidas = lista.filter(i => fISO(i.fecha_vencimiento) < hoy);
  const deHoy    = lista.filter(i => fISO(i.fecha_vencimiento) === hoy);
  const proximas = lista.filter(i => fISO(i.fecha_vencimiento) > hoy);

  const secs: SeccionType[] = [];
  if (vencidas.length) secs.push({ title: 'VENCIDAS', data: vencidas, accent: colors.danger });
  if (deHoy.length)    secs.push({ title: 'HOY',      data: deHoy,    accent: colors.primary });
  if (proximas.length) secs.push({ title: 'PROXIMAS', data: proximas, accent: colors.textSecondary });
  return secs;
}

export default function AgendaScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activo: descansoActivo, cargar: cargarDescanso } = useDescanso();
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificadoHoy, setNotificadoHoy] = useState(false);
  const [filtro, setFiltro] = useState<FiltroType>('todas');
  const [mapaVisible, setMapaVisible] = useState(false);

  const hoy = todayISO();
  const vencidasCount = useMemo(() => agenda.filter(i => fISO(i.fecha_vencimiento) < hoy).length, [agenda]);
  const hoyCount      = useMemo(() => agenda.filter(i => fISO(i.fecha_vencimiento) === hoy).length, [agenda]);
  const conGPS        = useMemo(() => agenda.filter(i => i.latitud && i.longitud), [agenda]);
  const secciones     = useMemo(() => buildSecciones(agenda, filtro), [agenda, filtro]);

  const cargar = useCallback(async () => {
    try {
      const [items] = await Promise.all([
        cobradorApi.getAgenda(),
        cargarDescanso(),
      ]);
      setAgenda(items);
      return items;
    } catch {
      Alert.alert('Error', 'No se pudo cargar la agenda');
      return null;
    }
  }, [cargarDescanso]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate(ROUTES.DESCANSO)} style={{ marginRight: 4 }}>
          <Ionicons name="pause-circle-outline" size={22} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      const items = await cargar();
      setLoading(false);
      if (items && !notificadoHoy) {
        const ok = await solicitarPermisosNotificaciones();
        if (ok) {
          const v = items.filter(i => i.cuota_estado === 'VENCIDA').length;
          await notificarResumenDia(items.length, v);
        }
        setNotificadoHoy(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const caja = await cobradorApi.getCajaActiva();
        if (!caja) { navigation.navigate(TAB_ROUTES.CAJA); return; }
        cargar();
      })();
    }, [cargar, navigation])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  const irMapa = () => {
    if (conGPS.length === 0) {
      Alert.alert('Sin ubicación', 'Ningún cliente tiene coordenadas registradas.');
      return;
    }
    navigation.navigate(ROUTES.MAPA, { agenda: conGPS });
  };

  const toggleMapa = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMapaVisible(v => !v);
  };

  const irVisita = (item: AgendaItem) => {
    const hoyLocal = todayISO();
    if (fISO(item.fecha_vencimiento) > hoyLocal) {
      Alert.alert(
        'No disponible',
        `Esta cuota vence el ${new Date(fISO(item.fecha_vencimiento) + 'T00:00:00').toLocaleDateString('es-PY')}. Solo podés gestionar cuotas del día o vencidas.`,
      );
      return;
    }
    navigation.navigate(ROUTES.VISITA, { item });
  };

  const fechaHdr = new Date().toLocaleDateString('es-PY', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Calcular region del mapa centrada en los puntos GPS
  const mapRegion = useMemo(() => {
    if (conGPS.length === 0) return null;
    const lats = conGPS.map(i => i.latitud!);
    const lngs = conGPS.map(i => i.longitud!);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const delta = Math.max(maxLat - minLat, maxLng - minLng, 0.01) * 1.4;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [conGPS]);

  if (loading) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      {/* Banner de descanso activo */}
      {descansoActivo && (
        <TouchableOpacity style={styles.descansoBar} onPress={() => navigation.navigate(ROUTES.DESCANSO)}>
          <View style={styles.descansoBarRow}>
            <Ionicons name="pause-circle" size={16} color={colors.warningText} style={{ marginRight: 6 }} />
            <Text style={styles.descansoBarText}>
              Descanso: {descansoActivo.tipo_nombre}
              {descansoActivo.activado_auto ? ' (auto)' : ''} · Toca para reanudar
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/**/}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hola, {user?.nombre}</Text>
          <Text style={styles.fecha}>{fechaHdr}</Text>
        </View>
        <TouchableOpacity
          style={styles.btnDescanso}
          onPress={() => navigation.navigate(ROUTES.DESCANSO)}
        >
          <Ionicons name="pause-circle-outline" size={20} color={colors.warningText} />
        </TouchableOpacity>
      </View>

      {/* Tarjetas de estadísticas */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.borderLight }]}>
          <Text style={styles.statNum}>{agenda.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.dangerBorder }]}>
          <Text style={[styles.statNum, { color: colors.dangerDark }]}>{vencidasCount}</Text>
          <Text style={styles.statLabel}>Vencidas</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.skyLight }]}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{hoyCount}</Text>
          <Text style={styles.statLabel}>Hoy</Text>
        </View>
        <TouchableOpacity
          style={[styles.statCard, { borderColor: colors.greenLight, flex: 0, paddingHorizontal: 14 }]}
          onPress={irMapa}
        >
          <Ionicons name="map" size={18} color={colors.successDark} />
          <Text style={[styles.statLabel, { color: colors.successDark }]}>{conGPS.length} GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Botón mini-mapa */}
      {conGPS.length > 0 && (
        <TouchableOpacity style={styles.mapaToggle} onPress={toggleMapa}>
          <Ionicons name={mapaVisible ? 'chevron-up' : 'map-outline'} size={15} color={colors.primary} />
          <Text style={styles.mapaToggleText}>
            {mapaVisible ? 'Ocultar mapa' : `Ver mapa (${conGPS.length} clientes con GPS)`}
          </Text>
        </TouchableOpacity>
      )}

      {mapaVisible && mapRegion && (
        <View style={styles.miniMapContainer}>
          <MapView style={styles.miniMap} region={mapRegion}>
            {conGPS.map(item => (
              <Marker
                key={item.asignacion_id}
                coordinate={{ latitude: item.latitud!, longitude: item.longitud! }}
                title={`${item.nombre} ${item.apellido ?? ''}`}
                description={formatGuaranies(item.saldo_cuota)}
                pinColor={fISO(item.fecha_vencimiento) < hoy ? colors.danger : fISO(item.fecha_vencimiento) === hoy ? colors.primary : colors.textSecondary}
                onCalloutPress={() => irVisita(item)}
              />
            ))}
          </MapView>
          <TouchableOpacity style={styles.btnMapaFullscreen} onPress={irMapa}>
            <Ionicons name="expand" size={14} color={colors.textOnPrimary} />
            <Text style={styles.btnMapaFullscreenText}> Ver ruta completa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {(['todas', 'hoy', 'vencidas'] as FiltroType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>
              {f === 'todas' ? 'Todas' : f === 'hoy' ? 'Hoy' : 'Vencidas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista por secciones */}
      {secciones.length === 0 ? (
        <EmptyState
          icon="checkmark-circle"
          iconColor={colors.success}
          title={filtro === 'todas' ? 'Sin cobros asignados' : 'Sin cobros en esta sección'}
        />
      ) : (
        <SectionList
          sections={secciones}
          keyExtractor={(item) => String(item.asignacion_id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { borderLeftColor: section.accent }]}>
              <Text style={[styles.sectionTitle, { color: section.accent }]}>{section.title}</Text>
              <Text style={[styles.sectionCount, { color: section.accent }]}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const badge = ESTADO_BADGE[item.cuota_estado] ?? { bg: colors.backgroundAlt, text: colors.textSecondary };
            const esVencida  = fISO(item.fecha_vencimiento) < hoy;
            const esProxima  = fISO(item.fecha_vencimiento) > hoy;
            return (
              <TouchableOpacity
                style={[commonStyles.card, esVencida && styles.cardVencida, esProxima && styles.cardProxima]}
                onPress={() => irVisita(item)}
                activeOpacity={esProxima ? 0.5 : 0.7}
              >
                {/* Estado + nombre */}
                <View style={styles.cardRow}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{item.cuota_estado}</Text>
                  </View>
                  <Text style={styles.clienteNombre} numberOfLines={1}>
                    {item.nombre}{item.apellido ? ` ${item.apellido}` : ''}
                  </Text>
                </View>

                {/* Dirección */}
                {item.direccion ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.infoText} numberOfLines={1}> {item.direccion}</Text>
                  </View>
                ) : null}

                {/* Crédito + cuota */}
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.infoText}>
                    {item.numero_credito ? `Cred. #${item.numero_credito} - ` : ''}Cuota #{item.numero_cuota}{item.descripcion ? ` - ${item.descripcion}` : ''}
                  </Text>
                </View>

                {/* Fecha */}
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={12} color={esVencida ? colors.danger : colors.textMuted} />
                  <Text style={[styles.infoText, esVencida && { color: colors.danger }]}>
                    {' '}Vence: {new Date(fISO(item.fecha_vencimiento) + 'T00:00:00').toLocaleDateString('es-PY')}
                  </Text>
                  {item.reagendado_hora ? (
                    <>
                      <Ionicons name="time-outline" size={12} color={colors.warningDark} style={{ marginLeft: 8 }} />
                      <Text style={{ fontSize: 11, color: colors.warningDark, fontWeight: '600' }}> {item.reagendado_hora}</Text>
                    </>
                  ) : null}
                </View>

                {/* Monto */}
                <View style={styles.cardFooter}>
                  <Text style={styles.monto}>
                    {formatGuaranies(item.saldo_cuota)}
                  </Text>
                  <View style={styles.cardActions}>
                    {item.latitud && item.longitud && (
                      <View style={styles.gpsBadge}>
                        <Ionicons name="navigate" size={11} color={colors.primary} />
                        <Text style={styles.gpsBadgeText}> GPS</Text>
                      </View>
                    )}
                    {esProxima
                      ? <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
                      : <Ionicons name="chevron-forward" size={16} color={colors.border} />
                    }
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  descansoBar: { backgroundColor: colors.yellowLight, paddingVertical: 8, paddingHorizontal: 16 },
  descansoBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  descansoBarText: { color: colors.warningText, fontWeight: '600', fontSize: 13 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  greeting: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  fecha: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 1 },
  btnDescanso: {
    backgroundColor: colors.yellowBg, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    justifyContent: 'center', alignItems: 'center',
  },

  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 10, borderWidth: 1.5,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '500' },

  mapaToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.backgroundAlt, borderBottomWidth: 1, borderBottomColor: colors.blueBorder,
  },
  mapaToggleText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  miniMapContainer: { position: 'relative', height: 180 },
  miniMap: { width: '100%', height: 180 },
  btnMapaFullscreen: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  btnMapaFullscreenText: { color: colors.textOnPrimary, fontSize: 12, fontWeight: '600' },

  filtrosRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  filtroBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.background,
  },
  filtroBtnActive: { borderColor: colors.primary, backgroundColor: colors.backgroundAlt },
  filtroText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filtroTextActive: { color: colors.primary },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, marginBottom: 6, paddingLeft: 8,
    borderLeftWidth: 3,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  sectionCount: { fontSize: 11, fontWeight: '700' },

  cardVencida:  { borderLeftWidth: 3, borderLeftColor: colors.danger },
  cardProxima:  { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  clienteNombre: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  infoText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  monto: { fontSize: 15, fontWeight: '800', color: colors.textDark },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gpsBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundAlt, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  gpsBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
});
