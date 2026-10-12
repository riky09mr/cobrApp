import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { mensajesApi, Conversacion, MensajeChat, ImagenAdjunta, buildImagenUrl } from '../api/mensajesApi';
import { useAuth } from '../context/AuthContext';
import { useMensajesContext } from '../context/MensajesContext';
import { colors } from '../theme/colors';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { EmptyState } from '../components/ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Mensajes'>,
  NativeStackScreenProps<RootStackParamList>
>;

function iniciales(nombre: string, apellido: string) {
  return ((nombre[0] ?? '') + (apellido[0] ?? '')).toUpperCase();
}

function formatHora(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const mismodia =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear();
  if (mismodia) return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  return (
    d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function MensajesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { refrescar: refrescarBadge } = useMensajesContext();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [contacto, setContacto] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [imagenPendiente, setImagenPendiente] = useState<ImagenAdjunta | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargarConversaciones = useCallback(async () => {
    try {
      const data = await mensajesApi.getConversaciones();
      setConversaciones(data);
    } catch {
      // silencioso en polling
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargarConversaciones();
    }, [cargarConversaciones])
  );

  const cargarMensajes = useCallback(async (uid: number) => {
    try {
      const data = await mensajesApi.getConversacion(uid);
      setMensajes(data);
      setConversaciones(prev =>
        prev.map(c => (c.id === uid ? { ...c, no_leidos: 0 } : c))
      );
      void refrescarBadge(); // actualiza el badge del tab
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      // silencioso en polling
    }
  }, []);

  const seleccionarContacto = useCallback(
    (c: Conversacion) => {
      setContacto(c);
      setLoadingChat(true);
      mensajesApi
        .getConversacion(c.id)
        .then(data => {
          setMensajes(data);
          setConversaciones(prev =>
            prev.map(cv => (cv.id === c.id ? { ...cv, no_leidos: 0 } : cv))
          );
          void refrescarBadge(); // actualiza el badge del tab
          setLoadingChat(false);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
        })
        .catch(() => setLoadingChat(false));

      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => void cargarMensajes(c.id), 5000);
    },
    [cargarMensajes, refrescarBadge]
  );

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const volver = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setContacto(null);
    setMensajes([]);
    void cargarConversaciones();
  };

  useEffect(() => {
    navigation.setOptions({
      title: contacto ? `${contacto.nombre} ${contacto.apellido}` : 'Mensajes',
      headerLeft: contacto
        ? () => (
            <TouchableOpacity onPress={volver} style={{ marginLeft: 0, marginRight: 8 }}>
              <Ionicons name="arrow-back" size={24} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [contacto, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnviar = async () => {
    if (!contacto || (!texto.trim() && !imagenPendiente)) return;
    setEnviando(true);
    try {
      await mensajesApi.enviarMensaje(contacto.id, texto.trim(), imagenPendiente ?? undefined);
      setTexto('');
      setImagenPendiente(null);
      await cargarMensajes(contacto.id);
    } catch {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const seleccionarImagen = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para adjuntar imágenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `img_${Date.now()}.jpg`;
      const type = asset.mimeType ?? 'image/jpeg';
      setImagenPendiente({ uri: asset.uri, name, type });
    }
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `foto_${Date.now()}.jpg`;
      const type = asset.mimeType ?? 'image/jpeg';
      setImagenPendiente({ uri: asset.uri, name, type });
    }
  };

  // ── Lista de conversaciones ──────────────────────────────────────
  if (!contacto) {
    return (
      <View style={styles.container}>
        {loadingConvs ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : conversaciones.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No hay contactos disponibles"
          />
        ) : (
          <FlatList
            data={conversaciones}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => seleccionarContacto(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{iniciales(item.nombre, item.apellido)}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <View style={styles.contactHeader}>
                    <Text style={styles.contactNombre}>
                      {item.nombre} {item.apellido}
                    </Text>
                    {item.no_leidos > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.no_leidos}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.contactUltimo} numberOfLines={1}>
                    {item.ultimo_mensaje ?? 'Sin mensajes aún'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    );
  }

  // ── Vista de conversación ────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loadingChat ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {mensajes.length === 0 && (
            <Text style={styles.emptyText}>¡Enviá el primer mensaje!</Text>
          )}
          {mensajes.map(m => {
            const esMio = m.emisor_id === user?.id;
            return (
              <View
                key={m.id}
                style={[styles.bubbleRow, esMio ? styles.bubbleRowRight : styles.bubbleRowLeft]}
              >
                <View style={[styles.bubble, esMio ? styles.bubbleMio : styles.bubbleOtro]}>
                  {m.imagen_url && (
                    <Image
                      source={{ uri: buildImagenUrl(m.imagen_url) ?? '' }}
                      style={styles.bubbleImage}
                      resizeMode="cover"
                    />
                  )}
                  {m.contenido.trim() !== '' && (
                    <Text style={esMio ? styles.bubbleTextMio : styles.bubbleTextOtro}>
                      {m.contenido}
                    </Text>
                  )}
                  <View style={styles.bubbleMeta}>
                    <Text style={esMio ? styles.horaTextMio : styles.horaTextOtro}>
                      {formatHora(m.created_at)}
                    </Text>
                    {esMio && (
                      <Text style={[styles.vistoText, m.leido === 1 && styles.vistoLeido]}>
                        {m.leido === 1 ? ' ✓✓' : ' ✓'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity onPress={tomarFoto} style={styles.iconBtn}>
          <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={seleccionarImagen} style={styles.iconBtn}>
          <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          {imagenPendiente && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imagenPendiente.uri }} style={styles.previewImg} resizeMode="cover" />
              <TouchableOpacity style={styles.previewClose} onPress={() => setImagenPendiente(null)}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder={imagenPendiente ? 'Agregá un texto (opcional)…' : 'Escribí un mensaje…'}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, ((!texto.trim() && !imagenPendiente) || enviando) && styles.sendBtnDisabled]}
          onPress={handleEnviar}
          disabled={(!texto.trim() && !imagenPendiente) || enviando}
        >
          {enviando ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={colors.textOnPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: colors.grayBg, marginLeft: 72 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blueBorder, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: colors.chatPrimaryDark, fontWeight: '700', fontSize: 15 },
  contactInfo: { flex: 1 },
  contactHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contactNombre: { fontSize: 14, fontWeight: '600', color: colors.textDark, flex: 1 },
  contactUltimo: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.chatPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: colors.textOnPrimary, fontSize: 11, fontWeight: '700' },
  chatScroll: { flex: 1 },
  chatContent: { padding: 12, gap: 6, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleMio: { backgroundColor: colors.chatPrimary, borderBottomRightRadius: 4 },
  bubbleOtro: { backgroundColor: colors.chatBubbleOtro, borderBottomLeftRadius: 4 },
  bubbleTextMio: { color: colors.textOnPrimary, fontSize: 14 },
  bubbleTextOtro: { color: colors.textDark, fontSize: 14 },
  horaTextMio: { color: colors.chatPrimaryLight, fontSize: 10, textAlign: 'right', marginTop: 2 },
  horaTextOtro: { color: colors.textMuted, fontSize: 10, textAlign: 'right', marginTop: 2 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  vistoText: { color: colors.chatPrimaryLight, fontSize: 10 },
  vistoLeido: { color: colors.chatPrimaryLighter },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 6, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100, fontSize: 14, backgroundColor: colors.background },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chatPrimary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  bubbleImage: { width: 200, height: 180, borderRadius: 10, marginBottom: 4 },
  previewWrap: { marginBottom: 6, alignSelf: 'flex-start' },
  previewImg: { width: 70, height: 70, borderRadius: 8 },
  previewClose: { position: 'absolute', top: -6, right: -6 },
});
