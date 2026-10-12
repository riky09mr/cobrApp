import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Linking, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import client from '../api/client';
import { nearestNeighborTSP, GeoPoint } from '../utils/tsp';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Mapa'>;

export default function MapaRutaScreen({ route, navigation }: Props) {
  const { agenda } = route.params;

  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [ordenManual, setOrdenManual] = useState<number[] | null>(null);
  const [roadCoords, setRoadCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [rutaPorCalles, setRutaPorCalles] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceder a tu ubicación para calcular la ruta.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setOrigin({ lat: loc.coords.latitude, lng: loc.coords.longitude, index: -1 });
    })();
  }, []);

  // Stops con lat/lng válidos
  const stops: GeoPoint[] = useMemo(
    () =>
      agenda.map((item, i) => ({
        lat: item.latitud as number,
        lng: item.longitud as number,
        index: i,
      })),
    [agenda]
  );

  // Ruta óptima (recalcula cuando tenemos el origen)
  const rutaOptima: GeoPoint[] = useMemo(() => {
    if (!origin) return stops;
    return nearestNeighborTSP(origin, stops);
  }, [origin, stops]);

  // Orden actual: manual si fue editado, óptimo por defecto
  const rutaActual = useMemo(() => {
    if (ordenManual) {
      const byIndex: Record<number, GeoPoint> = {};
      stops.forEach((s) => { byIndex[s.index] = s; });
      return ordenManual.map((i) => byIndex[i]);
    }
    return rutaOptima;
  }, [ordenManual, rutaOptima, stops]);

  const polylineCoords = useMemo(
    () =>
      (origin ? [origin, ...rutaActual.filter((p) => p.index !== -1)] : rutaActual).map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
      })),
    [origin, rutaActual]
  );

  // Obtiene la ruta real por calles a través del backend (POST /api/ruta),
  // que a su vez consulta OSRM. Si falla, se dibuja la línea recta como respaldo.
  const fetchRoadRoute = useCallback(async (coords: { latitude: number; longitude: number }[]) => {
    if (coords.length < 2) return;
    setLoadingRoute(true);
    try {
      const res = await client.post('/api/ruta', { coordinates: coords });
      const data = res.data;
      if (data.coordinates?.length > 1) {
        setRoadCoords(data.coordinates);
        setRutaPorCalles(true);
      } else {
        setRoadCoords(coords); // fallback a línea recta
        setRutaPorCalles(false);
      }
    } catch {
      setRoadCoords(coords); // fallback a línea recta si no hay internet
      setRutaPorCalles(false);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  useEffect(() => {
    if (polylineCoords.length >= 2) {
      fetchRoadRoute(polylineCoords);
    }
  }, [polylineCoords, fetchRoadRoute]);

  // Abre Google Maps con todos los paradas en orden
  const abrirGoogleMaps = () => {
    const puntos = polylineCoords;
    if (puntos.length === 0) return;
    const destino = puntos[puntos.length - 1];
    const waypoints = puntos
      .slice(1, -1)
      .map((p) => `${p.latitude},${p.longitude}`)
      .join('|');
    const originStr = origin
      ? `${origin.lat},${origin.lng}`
      : `${puntos[0].latitude},${puntos[0].longitude}`;
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${originStr}` +
      `&destination=${destino.latitude},${destino.longitude}` +
      (waypoints ? `&waypoints=${waypoints}` : '') +
      `&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'No se pudo abrir Google Maps')
    );
  };

  const moverArriba = (idx: number) => {
    if (idx === 0) return;
    const base = ordenManual ?? rutaOptima.filter((p) => p.index !== -1).map((p) => p.index);
    const next = [...base];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrdenManual(next);
  };

  const moverAbajo = (idx: number) => {
    const base = ordenManual ?? rutaOptima.filter((p) => p.index !== -1).map((p) => p.index);
    if (idx === base.length - 1) return;
    const next = [...base];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrdenManual(next);
  };

  const inicialRegion = agenda[0]?.latitud
    ? {
        latitude: agenda[0].latitud as number,
        longitude: agenda[0].longitud as number,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : undefined;

  const listaOrdenada = useMemo(() => {
    const indices =
      ordenManual ?? rutaOptima.filter((p) => p.index !== -1).map((p) => p.index);
    return indices.map((i) => agenda[i]);
  }, [ordenManual, rutaOptima, agenda]);

  return (
    <View style={styles.container}>
      {/* ── Mapa ── */}
      <MapView
        style={styles.map}
        initialRegion={inicialRegion}
        showsUserLocation
      >
        {agenda.map((item, i) => (
          <Marker
            key={item.asignacion_id}
            coordinate={{ latitude: item.latitud as number, longitude: item.longitud as number }}
            title={`${i + 1}. ${item.nombre} ${item.apellido ?? ''}`}
            description={`Gs. ${Number(item.saldo_cuota).toLocaleString('es-PY')}`}
          />
        ))}
        {(roadCoords.length > 1 ? roadCoords : polylineCoords).length > 1 && (
          <Polyline
            coordinates={roadCoords.length > 1 ? roadCoords : polylineCoords}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* ── Lista ordenable ── */}
      <View style={styles.lista}>
        <View style={styles.listaHeader}>
          <Text style={styles.listaTitle}>
            Orden de visitas
            {loadingRoute && <Text style={styles.loadingRouteText}> · calculando ruta…</Text>}
            {!loadingRoute && !rutaPorCalles && (
              <Text style={styles.loadingRouteText}> · ruta aproximada</Text>
            )}
          </Text>
          <View style={styles.listaHeaderActions}>
            {ordenManual && (
              <TouchableOpacity onPress={() => setOrdenManual(null)}>
                <Text style={styles.resetBtn}>Restablecer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.gmapsBtn} onPress={abrirGoogleMaps}>
              <Ionicons name="navigate" size={13} color={colors.textOnPrimary} />
              <Text style={styles.gmapsBtnText}> Google Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={listaOrdenada}
          keyExtractor={(item) => String(item.asignacion_id)}
          renderItem={({ item, index }) => (
            <View style={styles.item}>
              <View style={styles.itemNum}>
                <Text style={styles.itemNumText}>{index + 1}</Text>
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemNombre} numberOfLines={1}>
                  {item.nombre} {item.apellido ?? ''}
                </Text>
                <Text style={styles.itemMonto}>
                  Gs. {Number(item.saldo_cuota).toLocaleString('es-PY')}
                </Text>
              </View>
              <View style={styles.itemArrows}>
                <TouchableOpacity onPress={() => moverArriba(index)} style={styles.arrowBtn}>
                  <Text>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moverAbajo(index)} style={styles.arrowBtn}>
                  <Text>▼</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.irBtn}
                onPress={() => navigation.navigate('Visita', { item })}
              >
                <Text style={styles.irBtnText}>Ir</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  lista: {
    height: 260, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  listaHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.grayBg,
  },
  listaTitle: { fontWeight: '700', fontSize: 14, color: colors.textPrimary },
  loadingRouteText: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  listaHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resetBtn: { fontSize: 12, color: colors.primary },
  gmapsBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.success, borderRadius: 7,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  gmapsBtnText: { color: colors.textOnPrimary, fontSize: 12, fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  itemNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  itemNumText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 12 },
  itemBody: { flex: 1 },
  itemNombre: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  itemMonto: { fontSize: 11, color: colors.textSecondary },
  itemArrows: { flexDirection: 'row', gap: 4, marginRight: 8 },
  arrowBtn: { padding: 4 },
  irBtn: {
    backgroundColor: colors.primary, borderRadius: 7,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  irBtnText: { color: colors.textOnPrimary, fontWeight: '600', fontSize: 12 },
});
