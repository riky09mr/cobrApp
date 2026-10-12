import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
  Animated, Easing, Image, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { colors } from '../theme/colors';
import { WEB_URL } from '../api/client';

type AnimState = 'idle' | 'riding' | 'crash';

const MOTO_SIZE = 64; // px — height and width of the animated moto image

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [animState, setAnimState] = useState<AnimState>('idle');
  const [btnWidth, setBtnWidth]   = useState(280);
  const [sinAcceso, setSinAcceso] = useState(false);

  const motoX        = useRef(new Animated.Value(0)).current;
  const motoRotate   = useRef(new Animated.Value(0)).current;
  const motoTranslateY = useRef(new Animated.Value(0)).current;

  /* ── Riding animation (success) ─────────────────────────── */
  const ride = () => {
    motoX.setValue(-MOTO_SIZE);
    motoRotate.setValue(0);
    motoTranslateY.setValue(0);
    setAnimState('riding');
    Animated.timing(motoX, {
      toValue: btnWidth + MOTO_SIZE,
      duration: 2000,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      useNativeDriver: true,
    }).start(() => setAnimState('idle'));
  };

  /* ── Crash animation (failure) ──────────────────────────── */
  const crash = () => {
    motoX.setValue(-MOTO_SIZE);
    motoRotate.setValue(0);
    motoTranslateY.setValue(0);
    setAnimState('crash');

    const stopX = btnWidth * 0.28;

    Animated.sequence([
      // Rush in
      Animated.timing(motoX, {
        toValue: stopX,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Impact jitter
      Animated.sequence([
        Animated.timing(motoX, { toValue: stopX + 10, duration: 60, useNativeDriver: true }),
        Animated.timing(motoX, { toValue: stopX - 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(motoX, { toValue: stopX + 6,  duration: 55, useNativeDriver: true }),
        Animated.timing(motoX, { toValue: stopX - 4,  duration: 55, useNativeDriver: true }),
        Animated.timing(motoX, { toValue: stopX + 2,  duration: 50, useNativeDriver: true }),
        Animated.timing(motoX, { toValue: stopX,      duration: 50, useNativeDriver: true }),
      ]),
      // Brief pause then tip over
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(motoRotate, {
          toValue: 48,
          duration: 750,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(motoTranslateY, {
          toValue: 14,
          duration: 750,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setTimeout(() => setAnimState('idle'), 300);
    });
  };

  /* ── Login handler ──────────────────────────────────────── */
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Ingresa tu email y contraseña');
      return;
    }
    if (loading) return;
    setLoading(true);
    ride();
    try {
      await login(email.trim(), password);
      // AuthContext handles navigation after login
    } catch (e: unknown) {
      crash();
      const err = e as { response?: { status?: number; data?: { code?: string } } };
      // Si el backend rechaza por no ser cobrador, mostrar pantalla de "sin acceso"
      if (err?.response?.status === 403 && err?.response?.data?.code === 'NO_ACCESO_APP') {
        setTimeout(() => {
          setLoading(false);
          setSinAcceso(true);
        }, 3100);
        return;
      }
      const msg = getErrorMessage(e, 'Error al iniciar sesión');
      setTimeout(() => {
        Alert.alert('Error', msg);
        setLoading(false);
      }, 3100);
    }
  };

  const irALaWeb = () => {
    Linking.openURL(WEB_URL).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la web');
    });
  };

  const rotateStr = motoRotate.interpolate({
    inputRange: [0, 48],
    outputRange: ['0deg', '48deg'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Card ─────────────────────────────────────────── */}
        <View style={styles.card}>

          {/* Imagen dentro del card */}
          <Image
            source={require('../../assets/login-bg.png')}
            style={styles.cardImage}
            resizeMode="cover"
          />

          {/* Formulario */}
          <View style={styles.form}>
            <Text style={styles.brand}>cobrApp</Text>
            <Text style={styles.title}>Iniciar sesión</Text>

            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.textMuted}
            />

            {/* ── Botón con animación de moto ─────────────── */}
            <View
              style={styles.btnWrapper}
              onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
            >
              {animState !== 'idle' && (
                <Animated.View
                  style={[
                    styles.motoAnim,
                    {
                      transform: [
                        { translateX: motoX },
                        { translateY: motoTranslateY },
                        { rotate: rotateStr },
                        { scaleX: -1 },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="bicycle" size={38} color={colors.primary} />
                </Animated.View>
              )}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading && animState === 'idle' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Iniciar sesión</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Modal: sin acceso a la app ─────────────────── */}
        <Modal
          visible={sinAcceso}
          transparent
          animationType="fade"
          onRequestClose={() => setSinAcceso(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIcon}>
                <Ionicons name="lock-closed" size={40} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Sin acceso a la app</Text>
              <Text style={styles.modalText}>
                Esta aplicación es exclusiva para cobradores. Tu usuario no tiene
                permisos para ingresar desde el móvil.
              </Text>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={irALaWeb}
                activeOpacity={0.85}
              >
                <Ionicons name="globe-outline" size={18} color={colors.textOnPrimary} />
                <Text style={styles.modalBtnText}>Ir a la web</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setSinAcceso(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: colors.shadowPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },

  // Image fills card width, 16:9-ish crop of the illustration
  cardImage: {
    width: '100%',
    height: 220,
  },

  form: {
    paddingHorizontal: 28,
    paddingBottom: 34,
    paddingTop: 20,
  },

  brand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.primaryLight,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textDark,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 22,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },

  btnWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },

  motoAnim: {
    position: 'absolute',
    width: MOTO_SIZE,
    height: MOTO_SIZE,
    zIndex: 10,
    top: (50 - MOTO_SIZE) / 2, // vertically centered in ~50px button
    alignItems: 'center',
    justifyContent: 'center',
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },

  // ── Modal sin acceso ────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: colors.shadowPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  modalBtnText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  modalClose: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCloseText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});

