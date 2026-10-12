import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { colors } from '../theme/colors';

export default function CambiarPasswordScreen() {
  const { cambiarPassword } = useAuth();
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    // Validaciones
    if (!passwordActual.trim() || !passwordNueva.trim() || !passwordConfirm.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    if (passwordNueva.length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (passwordNueva !== passwordConfirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      Alert.alert('Éxito', 'Contraseña cambiada exitosamente');
      // AuthContext actualiza debeCambiarPassword a false → RootNavigator redirige a la app
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'No se pudo cambiar la contraseña');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

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
          <View style={styles.form}>
            {/* Banner de advertencia */}
            <View style={styles.warningBanner}>
              <Ionicons name="lock-closed" size={16} color={colors.warningText} />
              <View style={styles.warningTextWrap}>
                <Text style={styles.warningTitle}>Cambio de contraseña obligatorio</Text>
                <Text style={styles.warningSubtitle}>
                  Por seguridad, debes cambiar tu contraseña antes de continuar.
                </Text>
              </View>
            </View>

            <Text style={styles.brand}>cobrApp</Text>
            <Text style={styles.title}>Cambiar Contraseña</Text>

            <TextInput
              style={styles.input}
              placeholder="Contraseña actual"
              secureTextEntry
              value={passwordActual}
              onChangeText={setPasswordActual}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              secureTextEntry
              value={passwordNueva}
              onChangeText={setPasswordNueva}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmar nueva contraseña"
              secureTextEntry
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Cambiar contraseña</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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

  form: {
    paddingHorizontal: 28,
    paddingVertical: 26,
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningTextWrap: { flex: 1, marginLeft: 8 },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warningText,
  },
  warningSubtitle: {
    fontSize: 12,
    color: colors.warningText,
    marginTop: 2,
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

  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
